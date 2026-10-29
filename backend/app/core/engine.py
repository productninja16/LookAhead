"""Deterministic financial recalculation. The LLM never does math; it receives this Snapshot."""

from __future__ import annotations

from datetime import date

from .models import PayFrequency, Profile, Snapshot
from .obligations import monthly_equivalent

_PAYCHECKS_PER_YEAR = {
    PayFrequency.weekly: 52,
    PayFrequency.biweekly: 26,
    PayFrequency.semimonthly: 24,
    PayFrequency.monthly: 12,
}

THIN_MONTHS = 1.0
HEALTHY_MONTHS = 3.0
DAYS_PER_MONTH = 30.4


def monthly_income(net_pay: float, freq: PayFrequency) -> float:
    return net_pay * _PAYCHECKS_PER_YEAR[freq] / 12


def buffer_status(months: float) -> str:
    if months < THIN_MONTHS:
        return "Thin"
    if months < HEALTHY_MONTHS:
        return "Building"
    return "Healthy"


def recalculate(profile: Profile, today: date) -> Snapshot:
    days = max(1, (profile.next_payday - today).days)

    due_before = sum(
        o.amount for o in profile.obligations if today <= o.next_due <= profile.next_payday
    )
    goal_before = sum(g.monthly_contribution for g in profile.goals) * days / DAYS_PER_MONTH

    safe = max(0.0, profile.checking_balance - due_before - goal_before)
    daily = safe / days

    essentials = sum(
        monthly_equivalent(o.amount, o.frequency) for o in profile.obligations if o.essential
    )
    months = profile.savings_balance / essentials if essentials else float("inf")

    goals = []
    for g in profile.goals:
        remaining = max(0.0, g.target - g.saved)
        if remaining == 0:
            months_to_go, status = 0.0, "Reached"
        elif g.monthly_contribution <= 0:
            months_to_go, status = None, "Stalled"
        else:
            months_to_go = remaining / g.monthly_contribution
            status = "On track" if months_to_go <= 36 else "Slow"
        goals.append(
            {
                "id": g.id,
                "name": g.name,
                "target": g.target,
                "saved": g.saved,
                "remaining": remaining,
                "monthly_contribution": g.monthly_contribution,
                "months_to_go": months_to_go,
                "status": status,
            }
        )

    return Snapshot(
        days_to_payday=days,
        due_before_payday=due_before,
        goal_contributions_before_payday=goal_before,
        safe_to_spend=safe,
        daily_budget=daily,
        monthly_income=monthly_income(profile.net_pay, profile.pay_frequency),
        monthly_essentials=essentials,
        buffer_months=months if months != float("inf") else 99.0,
        buffer_status=buffer_status(months),
        goals=goals,
    )
