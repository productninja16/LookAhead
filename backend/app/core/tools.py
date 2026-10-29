"""Profile mutations. Deterministic CRUD behind a confirmation step; no LLM involved."""

from __future__ import annotations

import re
from datetime import date

from pydantic import BaseModel

from .classifier import parse_amount
from .engine import recalculate
from .models import PayFrequency, Profile
from .obligations import advance

_PAYCHECKS = {
    PayFrequency.weekly: 52,
    PayFrequency.biweekly: 26,
    PayFrequency.semimonthly: 24,
    PayFrequency.monthly: 12,
}


class ToolProposal(BaseModel):
    action: str  # mark_paid | add_bonus | update_income | update_obligation | cancel_obligation
    params: dict
    summary: str


def _match_obligation(profile: Profile, text: str):
    t = text.lower()
    for o in profile.obligations:
        words = [w for w in re.split(r"\W+", o.name.lower()) if len(w) > 3]
        if o.name.lower() in t or o.category in t or any(w in t for w in words):
            return o
    return None


def propose(profile: Profile, text: str) -> ToolProposal | None:
    t = text.lower()
    amount = parse_amount(text)
    ob = _match_obligation(profile, text)

    if re.search(r"\b(cancell?ed|canceled)\b", t) and ob:
        return ToolProposal(
            action="cancel_obligation",
            params={"obligation_id": ob.id},
            summary=f"Remove {ob.name} (${ob.amount:,.0f}) from your obligations?",
        )
    if re.search(r"\bpaid\b", t) and ob:
        paid = amount or ob.amount
        return ToolProposal(
            action="mark_paid",
            params={"obligation_id": ob.id, "amount": paid},
            summary=f"Mark {ob.name} as paid (${paid:,.0f} leaves checking)?",
        )
    if re.search(r"\b(bonus|received|got paid)\b", t) and amount:
        return ToolProposal(
            action="add_bonus",
            params={"amount": amount},
            summary=f"Add a one-time ${amount:,.0f} to your checking balance?",
        )
    if re.search(r"\b(raise|salary|making|earn|income|pay)\b", t) and amount and not ob:
        monthly = amount if re.search(r"month", t) or amount < 20000 else amount / 12
        if re.search(r"\b(year|annual|yr)\b", t):
            monthly = amount / 12
        return ToolProposal(
            action="update_income",
            params={"monthly_take_home": round(monthly, 2)},
            summary=f"Update your take-home pay to about ${monthly:,.0f}/month?",
        )
    if ob and amount:
        return ToolProposal(
            action="update_obligation",
            params={"obligation_id": ob.id, "amount": amount},
            summary=f"Update {ob.name} from ${ob.amount:,.0f} to ${amount:,.0f}?",
        )
    return None


def apply(profile: Profile, proposal: ToolProposal) -> Profile:
    p = profile.model_copy(deep=True)
    a, params = proposal.action, proposal.params
    if a == "add_bonus":
        p.checking_balance += params["amount"]
    elif a == "update_income":
        p.net_pay = round(params["monthly_take_home"] * 12 / _PAYCHECKS[p.pay_frequency], 2)
    else:
        ob = next((o for o in p.obligations if o.id == params["obligation_id"]), None)
        if ob is None:
            return p
        if a == "mark_paid":
            p.checking_balance = max(0.0, p.checking_balance - params["amount"])
            ob.next_due = advance(ob.next_due, ob.frequency)
        elif a == "update_obligation":
            ob.amount = params["amount"]
        elif a == "cancel_obligation":
            p.obligations = [o for o in p.obligations if o.id != ob.id]
    return p


def impact(profile: Profile, proposal: ToolProposal, today: date) -> dict:
    before = recalculate(profile, today)
    after = recalculate(apply(profile, proposal), today)
    return {
        "safe_to_spend_before": round(before.safe_to_spend),
        "safe_to_spend_after": round(after.safe_to_spend),
        "daily_budget_before": round(before.daily_budget),
        "daily_budget_after": round(after.daily_budget),
    }
