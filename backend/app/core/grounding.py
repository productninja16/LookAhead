"""Verifies that every dollar figure in model output traces back to the profile or the engine.

This is the hallucination guard (target: <= 2% of responses) and the basis of the
Verdict Grounding Rate metric.
"""

from __future__ import annotations

import re
from collections.abc import Iterable

from .models import Profile, Snapshot

_DOLLAR = re.compile(r"\$\s?(\d[\d,]*(?:\.\d+)?)\s?([kK])?\b")


def extract_dollars(text: str) -> list[float]:
    out = []
    for m in _DOLLAR.finditer(text):
        v = float(m.group(1).replace(",", ""))
        out.append(v * 1000 if m.group(2) else v)
    return out


def known_numbers(profile: Profile, snap: Snapshot, extra: Iterable[float] = ()) -> set[float]:
    nums = {
        profile.net_pay,
        profile.checking_balance,
        profile.savings_balance,
        snap.safe_to_spend,
        snap.daily_budget,
        snap.due_before_payday,
        snap.monthly_income,
        snap.monthly_essentials,
        snap.goal_contributions_before_payday,
    }
    for o in profile.obligations:
        nums.add(o.amount)
    for g in snap.goals:
        nums.update([g["target"], g["saved"], g["remaining"], g["monthly_contribution"]])
    nums.update(extra)
    return {float(n) for n in nums if n is not None}


def _matches(value: float, known: set[float]) -> bool:
    tol = max(1.0, value * 0.005)
    return any(abs(value - k) <= tol for k in known)


def check(text: str, known: set[float]) -> dict:
    cited = extract_dollars(text)
    ungrounded = [v for v in cited if not _matches(v, known)]
    return {
        "grounded": not ungrounded and bool(cited),
        "references_user_numbers": bool(cited) and not ungrounded,
        "cited": cited,
        "ungrounded": ungrounded,
    }
