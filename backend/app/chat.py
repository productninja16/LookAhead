"""Chat orchestration: classify -> branch (verdict | tool confirmation | memory | conversation)."""

from __future__ import annotations

import re
from datetime import date

from . import limits, store
from .core import grounding, llm, memory, tools
from .core.classifier import classify, parse_amount
from .core.engine import recalculate
from .core.models import Profile
from .core.obligations import project
from .core.personas import voice
from .core.verdict import make_verdict

OUT_OF_SCOPE = re.compile(
    r"\b(roth|ira|401\s?\(?k\)?|stocks?|invest\w*|crypto|bitcoin|etf|mutual fund|tax(es)?|lawsuit|bankruptcy)\b", re.I
)
PRICE_WANTED = re.compile(r"\b(can i afford|should i (buy|get)|afford)\b", re.I)


def _d(x: float) -> str:
    return f"${x:,.0f}"


def _text(text: str, follow_ups: list[str] | None = None, source: str = "fallback") -> dict:
    return {"type": "text", "text": text, "followUps": follow_ups or [], "source": source}


def conversational_fallback(profile: Profile, text: str, today: date) -> dict:
    snap = recalculate(profile, today)
    t = text.lower().strip()
    stripped = re.sub(r"[\s.$,]", "", t)
    if OUT_OF_SCOPE.search(t):
        return _text(
            "That's outside what I do. I don't give investment, tax, or legal advice. "
            "I can show how a spending decision affects your cash flow, bills, and goals.",
            ["Can I afford a $300 purchase?", "What bills are coming up?"],
        )
    if re.fullmatch(r"\d[\d,k]*(\.\d+)?", stripped) and parse_amount(text):
        return _text(
            f"{_d(parse_amount(text))} for what? Tell me what you're considering "
            f"(e.g. \"Can I afford a {_d(parse_amount(text))} laptop?\") and I'll check it against your numbers."
        )
    if PRICE_WANTED.search(t):
        return _text("What's the price? Give me the amount and I'll run the numbers.")
    if re.search(r"safe.to.spend", t):
        return _text(
            f"Safe-to-spend is what's left in checking after bills and goal contributions due before your next "
            f"payday. Right now that's {_d(snap.safe_to_spend)}, about {_d(snap.daily_budget)}/day for "
            f"{snap.days_to_payday} days.",
            ["What bills are coming up?", "Can I afford a $200 purchase?"],
        )
    if re.search(r"daily budget", t):
        return _text(
            f"Your daily budget is safe-to-spend divided by days to payday: {_d(snap.safe_to_spend)} over "
            f"{snap.days_to_payday} days = {_d(snap.daily_budget)}/day."
        )
    if re.search(r"buffer|emergency", t):
        return _text(
            f"Your savings cover {snap.buffer_months:.1f} months of essential expenses "
            f"({snap.buffer_status}). Three months or more counts as Healthy.",
            ["What's my goal progress?"],
        )
    if re.search(r"goal|progress", t):
        lines = [
            f"{g['name']}: {_d(g['saved'])} of {_d(g['target'])} "
            + (f"(~{g['months_to_go']:.0f} months at {_d(g['monthly_contribution'])}/mo)" if g["months_to_go"] else f"({g['status']})")
            for g in snap.goals
        ]
        return _text("\n".join(lines) or "You haven't set any goals yet.")
    if re.search(r"bill|due|coming up|upcoming|obligation", t):
        upcoming = project(profile, today, months=2)[:4]
        lines = [f"{b.name}: {_d(b.amount)} in {b.days_away} days" for b in upcoming]
        return _text("Coming up:\n" + "\n".join(lines) if lines else "No bills in the next two months.")
    if re.search(r"payday|left", t):
        return _text(
            f"{snap.days_to_payday} days to payday, with {_d(snap.safe_to_spend)} safe to spend "
            f"({_d(snap.daily_budget)}/day)."
        )
    if re.fullmatch(r"(hi|hello|hey)[!. ]*", t):
        return _text(
            f"Hi {profile.name}! Ask me about a specific purchase and I'll check it against your real numbers.",
            ["Can I afford a $250 purchase?", "What bills are coming up?"],
        )
    if re.search(r"\bthank", t):
        return _text("Anytime. Ask me before the next big one.")
    return _text(
        f"Where you stand: {_d(snap.safe_to_spend)} safe to spend, {_d(snap.daily_budget)}/day for "
        f"{snap.days_to_payday} days. Ask me about a specific purchase (include the price) and I'll check it.",
        ["Can I afford a $300 purchase?", "What bills are coming up?"],
    )


_CHAT_SYSTEM = """You are LookAhead, a US personal-finance decision companion. Answer the user's message briefly (max 3 sentences).
RULES: never calculate; only quote dollar figures that appear in CONTEXT; no investment, tax or legal advice;
if asked something outside spending decisions, say so and redirect. Voice: {voice}"""


def conversational(profile: Profile, text: str, today: date, history: list[dict], use_llm: bool) -> dict:
    fallback = conversational_fallback(profile, text, today)
    if not use_llm or OUT_OF_SCOPE.search(text):
        return fallback
    snap = recalculate(profile, today)
    upcoming = ", ".join(f"{b.name} {_d(b.amount)} in {b.days_away}d" for b in project(profile, today, 2)[:5])
    ctx = (
        f"Safe-to-spend {_d(snap.safe_to_spend)}; daily budget {_d(snap.daily_budget)}; {snap.days_to_payday} days to "
        f"payday; buffer {snap.buffer_months:.1f} months ({snap.buffer_status}); checking {_d(profile.checking_balance)}; "
        f"upcoming: {upcoming}; memory: {memory.render(profile, today) or 'none'}"
    )
    recent = "\n".join(f"{m['role']}: {m['content']}" for m in history[-10:])
    try:
        out = llm.complete(
            llm.SMART_MODEL,
            _CHAT_SYSTEM.format(voice=voice(profile.avatar)),
            f"CONTEXT: {ctx}\n\nRECENT:\n{recent}\n\nUSER: {text}",
            max_tokens=250,
        ).strip()
        known = grounding.known_numbers(profile, snap, extra=[b.amount for b in project(profile, today, 2)])
        if out and not grounding.check(out, known)["ungrounded"]:
            return _text(out, fallback.get("followUps", []), source="llm")
    except llm.LLMError:
        pass
    return fallback


def handle(sid: str, profile: Profile, text: str, llm_requested: bool, today: date) -> tuple[dict, Profile]:
    """Returns (response, possibly-updated profile). The caller persists the profile."""
    reason = None
    use_llm = llm_requested and llm.available()
    if llm_requested and not llm.available():
        reason = "no_api_key"
    elif use_llm:
        ok, why = limits.check(sid)
        if not ok:
            use_llm, reason = False, why
    if not llm_requested:
        reason = "disabled"
    if use_llm:
        limits.record(sid)

    history = store.get_messages(sid, limit=10)
    store.add_message(sid, "user", text)
    intent = classify(text, use_llm)
    kind = intent["intent"]
    snap = recalculate(profile, today)
    messages: list[dict] = []

    if kind == "purchase_check":
        v = make_verdict(profile, snap, intent["amount"], intent["item"] or "this purchase", today, history, use_llm)
        messages.append({"type": "verdict", **v})
        reply_summary = f"{v['headline']}. {v['directAnswer']}"
    elif kind == "tool_call":
        prop = tools.propose(profile, text)
        if prop:
            messages.append(
                {"type": "tool_confirmation", "proposal": prop.model_dump(), "impact": tools.impact(profile, prop, today)}
            )
            reply_summary = prop.summary
        else:
            m = _text("I couldn't tell which bill or number to change. Try naming it, e.g. \"I paid my rent\".")
            messages.append(m)
            reply_summary = m["text"]
    elif kind == "semantic_update":
        memory.add_entry(profile, "Known Weak Spots", text.rstrip(".! ").strip(), today)
        m = _text(
            "Noted. I'll factor that in when I frame future verdicts. You can see (and age out) what I've learned in the Memory panel.",
            ["Can I afford a $300 purchase?"],
        )
        messages.append(m)
        reply_summary = m["text"]
    else:
        m = conversational(profile, text, today, history, use_llm)
        messages.append(m)
        reply_summary = m["text"]

    store.add_message(sid, "assistant", reply_summary)
    return (
        {
            "intent": kind,
            "classifier": intent["source"],
            "messages": messages,
            "llm": {"used": use_llm, "reason": reason, "calls_left": limits.remaining(sid)},
        },
        profile,
    )
