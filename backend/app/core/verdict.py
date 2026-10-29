"""Purchase-check verdicts.

The verdict label and every number come from code (`compute_facts`). The LLM only words the
explanation, and its output is rejected if it cites a dollar figure we can't trace.
"""

from __future__ import annotations

from datetime import date

from . import grounding, llm, memory
from .models import Profile, Snapshot
from .obligations import blind_spot
from .personas import label as persona_label
from .personas import voice


def _d(x: float) -> str:
    return f"${x:,.0f}"


def compute_facts(profile: Profile, snap: Snapshot, amount: float, item: str, today: date) -> dict:
    spot = blind_spot(profile, today)
    top_goal = next((g for g in snap.goals if g["monthly_contribution"] > 0 and g["remaining"] > 0), None)
    safe_after = snap.safe_to_spend - amount
    days_of_budget = round(amount / snap.daily_budget, 1) if snap.daily_budget > 0 else None
    goal_delay = round(amount / top_goal["monthly_contribution"], 1) if top_goal else None

    spot_risk = bool(spot and spot.days_away <= 60 and safe_after < spot.amount)
    if amount > snap.safe_to_spend:
        verdict = "not_now"
    elif amount > 0.4 * snap.safe_to_spend or spot_risk or snap.buffer_status == "Thin":
        verdict = "caution"
    else:
        verdict = "yes"

    return {
        "item": item,
        "amount": round(amount),
        "safe_to_spend": round(snap.safe_to_spend),
        "safe_after": round(safe_after),
        "daily_budget": round(snap.daily_budget),
        "days_of_budget": days_of_budget,
        "days_to_payday": snap.days_to_payday,
        "pct_of_safe": round(100 * amount / snap.safe_to_spend) if snap.safe_to_spend else None,
        "buffer_status": snap.buffer_status,
        "buffer_months": round(snap.buffer_months, 1),
        "blind_spot": (
            {"name": spot.name, "amount": round(spot.amount), "days_away": spot.days_away} if spot else None
        ),
        "blind_spot_at_risk": spot_risk,
        "goal": (
            {"name": top_goal["name"], "delay_months": goal_delay, "monthly_contribution": round(top_goal["monthly_contribution"])}
            if top_goal
            else None
        ),
        "verdict": verdict,
    }


HEADLINES = {
    "yes": "You can afford this",
    "caution": "You can, but watch out",
    "not_now": "Not right now",
}


def template_verdict(profile: Profile, f: dict) -> dict:
    """Deterministic explanation. Also what the app uses when the LLM is off, capped, or fails."""
    amount, safe, after = _d(f["amount"]), _d(f["safe_to_spend"]), _d(abs(f["safe_after"]))
    ref = f["item"] if f["item"].startswith("this ") else f"the {f['item']}"
    lead = ref[0].upper() + ref[1:]
    if f["verdict"] == "not_now":
        direct = f"{lead} at {amount} is more than your {safe} safe-to-spend until payday."
    elif f["verdict"] == "caution":
        direct = f"You can technically afford {ref} at {amount} out of {safe} safe-to-spend, but it leaves only {after}."
    else:
        direct = f"{lead} at {amount} fits: you'd still have {after} safe-to-spend until payday."

    tradeoffs = []
    if f["days_of_budget"]:
        tradeoffs.append(
            f"It equals {f['days_of_budget']} days of your {_d(f['daily_budget'])}/day budget, "
            f"with {f['days_to_payday']} days to payday."
        )
    if f["goal"] and f["goal"]["delay_months"]:
        tradeoffs.append(
            f"At {_d(f['goal']['monthly_contribution'])}/month, it delays your {f['goal']['name']} "
            f"by about {f['goal']['delay_months']} months if you fund it from savings."
        )
    risk = ""
    if f["blind_spot"]:
        b = f["blind_spot"]
        risk = f"{b['name']} ({_d(b['amount'])}) is due in {b['days_away']} days."
        if f["blind_spot_at_risk"]:
            risk += " This purchase would leave less than that covered."
    if f["buffer_status"] == "Thin":
        risk += " Your emergency buffer is thin, so every dollar of slack matters."

    next_step = {
        "yes": "If it's a want and not a need, sleep on it for 24 hours. Then buy it.",
        "caution": "Wait 48 hours and re-check. If you still want it, consider a cheaper option first.",
        "not_now": "Wait until after payday, or save toward it. Ask me again then.",
    }[f["verdict"]]
    return {
        "directAnswer": direct,
        "tradeoffs": tradeoffs,
        "risksOrCaution": risk.strip(),
        "nextStep": next_step,
        "followUps": ["What if I wait until payday?", "Show my upcoming bills", f"What if it were half the price?"],
    }


_SYSTEM = """You are LookAhead, a US personal-finance decision companion. You explain a purchase verdict.
RULES:
- The verdict and every number are already computed in FACTS. Never calculate. Quote figures exactly as given, in dollars.
- Do not invent any dollar figure that is not in FACTS or PROFILE.
- No investment, tax, or legal advice. No product recommendations.
- Be concrete and brief. Warm, not preachy.
Reply with JSON only:
{"directAnswer": str (1-2 sentences, must state the verdict consistent with FACTS.verdict),
 "tradeoffs": [str, up to 3],
 "risksOrCaution": str (empty if none),
 "nextStep": str,
 "followUps": [up to 3 short follow-up questions the user might ask]}"""


def build_context(profile: Profile, snap: Snapshot, facts: dict, history: list[dict], today: date) -> list[dict]:
    """The 5-layer context stack, as shown to the user in the 'how this was computed' panel."""
    mem = memory.render(profile, today)
    recent = "\n".join(f"{m['role']}: {m['content']}" for m in history[-10:])
    return [
        {
            "layer": 1,
            "name": "Financial snapshot",
            "content": f"Take-home ${profile.net_pay:,.0f} {profile.pay_frequency.value}; payday in {snap.days_to_payday} days; "
            f"checking {_d(profile.checking_balance)}; savings {_d(profile.savings_balance)}; "
            f"{len(profile.obligations)} obligations; avatar {persona_label(profile.avatar)}.",
        },
        {
            "layer": 2,
            "name": "Real-time recalculation",
            "content": f"Safe-to-spend {_d(snap.safe_to_spend)}, daily budget {_d(snap.daily_budget)}, "
            f"buffer {snap.buffer_status} ({snap.buffer_months:.1f} months).",
        },
        {
            "layer": 3,
            "name": "6-month obligation projection",
            "content": (
                f"Biggest upcoming blind spot: {facts['blind_spot']['name']} "
                f"{_d(facts['blind_spot']['amount'])} in {facts['blind_spot']['days_away']} days."
                if facts["blind_spot"]
                else "No large irregular bills in the next 6 months."
            ),
        },
        {"layer": 4, "name": "Semantic memory", "content": mem or "Nothing learned yet."},
        {"layer": 5, "name": "Session context (last 10 messages)", "content": recent or "New conversation."},
    ]


def make_verdict(
    profile: Profile,
    snap: Snapshot,
    amount: float,
    item: str,
    today: date,
    history: list[dict],
    use_llm: bool,
) -> dict:
    facts = compute_facts(profile, snap, amount, item, today)
    layers = build_context(profile, snap, facts, history, today)
    known = grounding.known_numbers(profile, snap, extra=_fact_numbers(facts))
    body, source, guard = None, "fallback", None

    if use_llm:
        user = (
            f"PERSONA VOICE: {voice(profile.avatar)}\n\n"
            f"FACTS: {facts}\n\nPROFILE SUMMARY: {layers[0]['content']}\n\n"
            f"MEMORY:\n{layers[3]['content']}\n\nRECENT MESSAGES:\n{layers[4]['content']}"
        )
        try:
            data = llm.extract_json(llm.complete(llm.SMART_MODEL, _SYSTEM, user, max_tokens=700))
            text = " ".join(
                [str(data.get("directAnswer", "")), *map(str, data.get("tradeoffs", [])),
                 str(data.get("risksOrCaution", "")), str(data.get("nextStep", ""))]
            )
            guard = grounding.check(text, known)
            if guard["ungrounded"] or not data.get("directAnswer"):
                guard["rejected"] = True  # hallucinated figure: discard and use the deterministic text
            else:
                body = {
                    "directAnswer": str(data["directAnswer"]),
                    "tradeoffs": [str(x) for x in data.get("tradeoffs", [])][:3],
                    "risksOrCaution": str(data.get("risksOrCaution", "")),
                    "nextStep": str(data.get("nextStep", "")),
                    "followUps": [str(x) for x in data.get("followUps", [])][:3],
                }
                source = "llm"
        except llm.LLMError:
            guard = None

    if body is None:
        body = template_verdict(profile, facts)
    final_guard = guard if source == "llm" and guard else grounding.check(
        " ".join([body["directAnswer"], *body["tradeoffs"], body["risksOrCaution"]]), known
    )
    return {
        "verdict": facts["verdict"],
        "headline": HEADLINES[facts["verdict"]],
        **body,
        "facts": facts,
        "context_layers": layers,
        "grounding": final_guard,
        "source": source,
        "llm_rejected": bool(guard and guard.get("rejected")),
    }


def _fact_numbers(facts: dict) -> list[float]:
    nums: list[float] = []
    for k in ("amount", "safe_to_spend", "safe_after", "daily_budget"):
        if facts.get(k) is not None:
            nums.append(abs(facts[k]))
    if facts["blind_spot"]:
        nums.append(facts["blind_spot"]["amount"])
    if facts["goal"]:
        nums.append(facts["goal"]["monthly_contribution"])
    return nums
