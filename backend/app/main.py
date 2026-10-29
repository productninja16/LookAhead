from __future__ import annotations

import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import chat, limits, store
from .core import demo_data, llm, memory, tools
from .core.engine import recalculate
from .core.models import Avatar, BillFrequency, Goal, Obligation, PayFrequency, Profile
from .core.obligations import blind_spot, project
from .core.personas import PERSONAS

COOKIE = "la_sid"
FOLLOWUP_AFTER_DAYS = 7


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.init()
    store.purge_older_than(7)
    yield


app = FastAPI(title="LookAhead", lifespan=lifespan)


def session_id(request: Request, response: Response) -> str:
    sid = request.cookies.get(COOKIE)
    if not sid or len(sid) != 32:
        sid = uuid.uuid4().hex
        response.set_cookie(COOKIE, sid, max_age=7 * 86400, httponly=True, samesite="lax")
    return sid


def require_profile(sid: str = Depends(session_id)) -> tuple[str, Profile]:
    profile = store.get_profile(sid)
    if profile is None:
        raise HTTPException(404, "No profile yet. Complete onboarding or load a demo persona.")
    return sid, profile


def state_payload(sid: str, profile: Profile) -> dict:
    today = date.today()
    snap = recalculate(profile, today)
    spot = blind_spot(profile, today)
    return {
        "profile": profile.model_dump(mode="json"),
        "snapshot": snap.model_dump(mode="json"),
        "upcoming": [b.model_dump(mode="json") for b in project(profile, today, 6)],
        "blind_spot": spot.model_dump(mode="json") if spot else None,
        "persona": {"key": profile.avatar.value, **PERSONAS[profile.avatar]},
        "memory": [
            {"index": i, **e, "stale": memory.is_stale(e, today)} for i, e in enumerate(profile.memory)
        ],
        "llm": {
            "available": llm.available(),
            "calls_left": limits.remaining(sid),
            "session_cap": limits.SESSION_CAP,
        },
        "today": today.isoformat(),
    }


# ---------- onboarding / demo ----------


class ObligationIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    amount: float = Field(gt=0, le=1_000_000)
    frequency: BillFrequency = BillFrequency.monthly
    next_due: date
    essential: bool = True
    category: str = "other"


class GoalIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    target: float = Field(gt=0, le=10_000_000)
    saved: float = Field(ge=0, default=0)
    monthly_contribution: float = Field(ge=0, default=0)


class OnboardingIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    avatar: Avatar
    pay_frequency: PayFrequency
    net_pay: float = Field(gt=0, le=1_000_000)
    next_payday: date
    checking_balance: float = Field(ge=0, le=100_000_000)
    savings_balance: float = Field(ge=0, le=100_000_000)
    obligations: list[ObligationIn] = Field(default_factory=list, max_length=25)
    goals: list[GoalIn] = Field(default_factory=list, max_length=10)


@app.get("/api/demos")
def list_demos():
    return [{"key": k, "title": v["title"], "blurb": v["blurb"], "avatar": v["avatar"].value} for k, v in demo_data.DEMOS.items()]


@app.post("/api/demo/{key}")
def load_demo(key: str, sid: str = Depends(session_id)):
    if key not in demo_data.DEMOS:
        raise HTTPException(404, "Unknown demo persona")
    store.delete_session(sid)
    profile = demo_data.build(key, date.today())
    store.save_profile(sid, profile)
    if key == "sam":  # a decision old enough to trigger the follow-up loop in the demo
        store.save_decision(sid, "Wireless earbuds", 179, "caution", created=time.time() - 9 * 86400)
    return state_payload(sid, profile)


@app.post("/api/onboarding")
def onboarding(body: OnboardingIn, sid: str = Depends(session_id)):
    store.delete_session(sid)
    profile = Profile(
        name=body.name.strip(),
        avatar=body.avatar,
        pay_frequency=body.pay_frequency,
        net_pay=body.net_pay,
        next_payday=body.next_payday,
        checking_balance=body.checking_balance,
        savings_balance=body.savings_balance,
        obligations=[Obligation(id=uuid.uuid4().hex[:8], **o.model_dump()) for o in body.obligations],
        goals=[Goal(id=uuid.uuid4().hex[:8], **g.model_dump()) for g in body.goals],
    )
    store.save_profile(sid, profile)
    return state_payload(sid, profile)


@app.get("/api/state")
def get_state(sp: tuple[str, Profile] = Depends(require_profile)):
    return state_payload(*sp)


@app.delete("/api/session")
def reset(sid: str = Depends(session_id)):
    store.delete_session(sid)
    return {"ok": True}


# ---------- chat ----------


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    llm_enabled: bool = True


@app.post("/api/chat")
def post_chat(body: ChatIn, sp: tuple[str, Profile] = Depends(require_profile)):
    sid, profile = sp
    result, profile = chat.handle(sid, profile, body.message.strip(), body.llm_enabled, date.today())
    store.save_profile(sid, profile)
    return result


@app.get("/api/conversation")
def conversation(sp: tuple[str, Profile] = Depends(require_profile)):
    return store.get_messages(sp[0])


class ConfirmIn(BaseModel):
    proposal: tools.ToolProposal
    confirm: bool


@app.post("/api/tools/confirm")
def confirm_tool(body: ConfirmIn, sp: tuple[str, Profile] = Depends(require_profile)):
    sid, profile = sp
    if body.confirm:
        ids = {o.id for o in profile.obligations}
        oid = body.proposal.params.get("obligation_id")
        if body.proposal.action in {"mark_paid", "update_obligation", "cancel_obligation"} and oid not in ids:
            raise HTTPException(400, "Unknown obligation")
        profile = tools.apply(profile, body.proposal)
        store.save_profile(sid, profile)
    return state_payload(sid, profile)


@app.post("/api/obligations/{oid}/paid")
def mark_paid(oid: str, sp: tuple[str, Profile] = Depends(require_profile)):
    sid, profile = sp
    ob = next((o for o in profile.obligations if o.id == oid), None)
    if ob is None:
        raise HTTPException(404, "Unknown obligation")
    prop = tools.ToolProposal(action="mark_paid", params={"obligation_id": oid, "amount": ob.amount}, summary="")
    profile = tools.apply(profile, prop)
    store.save_profile(sid, profile)
    return state_payload(sid, profile)


# ---------- decisions ----------


class DecisionIn(BaseModel):
    item: str = Field(min_length=1, max_length=80)
    amount: float = Field(gt=0, le=10_000_000)
    verdict: Literal["yes", "caution", "not_now"]


class DecisionUpdate(BaseModel):
    status: Literal["waiting", "bought", "skipped"]
    regret: Literal["good_call", "regret"] | None = None


@app.post("/api/decisions")
def create_decision(body: DecisionIn, sp: tuple[str, Profile] = Depends(require_profile)):
    return {"id": store.save_decision(sp[0], body.item, body.amount, body.verdict)}


@app.get("/api/decisions")
def decisions(sp: tuple[str, Profile] = Depends(require_profile)):
    now = time.time()
    out = []
    for d in store.list_decisions(sp[0]):
        age = int((now - d["created"]) // 86400)
        out.append({**d, "age_days": age, "followup_due": d["status"] == "waiting" and age >= FOLLOWUP_AFTER_DAYS})
    return out


@app.patch("/api/decisions/{did}")
def patch_decision(did: int, body: DecisionUpdate, sp: tuple[str, Profile] = Depends(require_profile)):
    if not store.update_decision(sp[0], did, body.status, body.regret):
        raise HTTPException(404, "Unknown decision")
    return {"ok": True}


class AvatarIn(BaseModel):
    avatar: Avatar


@app.patch("/api/profile/avatar")
def set_avatar(body: AvatarIn, sp: tuple[str, Profile] = Depends(require_profile)):
    sid, profile = sp
    profile.avatar = body.avatar
    store.save_profile(sid, profile)
    return state_payload(sid, profile)


# ---------- memory ----------


@app.delete("/api/memory/{index}")
def forget(index: int, sp: tuple[str, Profile] = Depends(require_profile)):
    sid, profile = sp
    if not 0 <= index < len(profile.memory):
        raise HTTPException(404, "Unknown memory entry")
    profile.memory.pop(index)
    store.save_profile(sid, profile)
    return state_payload(sid, profile)


@app.get("/healthz")
def healthz():
    return {"ok": True}


# ---------- built React app (production) ----------

DIST = Path(os.getenv("FRONTEND_DIST", Path(__file__).resolve().parents[2] / "frontend" / "dist"))
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        candidate = (DIST / path).resolve()
        if path and candidate.is_file() and DIST.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
