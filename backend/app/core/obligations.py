"""Obligation date arithmetic. Pure computation, zero LLM."""

from __future__ import annotations

import calendar
from datetime import date

from .models import BillFrequency, Profile, UpcomingBill

_MONTH_STEP = {
    BillFrequency.monthly: 1,
    BillFrequency.quarterly: 3,
    BillFrequency.semiannual: 6,
    BillFrequency.annual: 12,
}


def add_months(d: date, months: int) -> date:
    idx = d.month - 1 + months
    year, month = d.year + idx // 12, idx % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def advance(d: date, freq: BillFrequency) -> date:
    return add_months(d, _MONTH_STEP[freq])


def monthly_equivalent(amount: float, freq: BillFrequency) -> float:
    return amount / _MONTH_STEP[freq]


def project(profile: Profile, today: date, months: int = 6) -> list[UpcomingBill]:
    """Every occurrence of every obligation from today through `months` months out."""
    end = add_months(today, months)
    bills: list[UpcomingBill] = []
    for ob in profile.obligations:
        due = ob.next_due
        while due <= end:
            if due >= today:
                bills.append(
                    UpcomingBill(
                        obligation_id=ob.id,
                        name=ob.name,
                        amount=ob.amount,
                        due=due,
                        days_away=(due - today).days,
                    )
                )
            due = advance(due, ob.frequency)
    return sorted(bills, key=lambda b: b.due)


def blind_spot(profile: Profile, today: date, months: int = 6) -> UpcomingBill | None:
    """The 'forgotten obligation': the largest non-monthly bill coming up.

    Monthly bills are top of mind; quarterly/annual ones are what quietly break a budget.
    """
    non_monthly = {o.id for o in profile.obligations if o.frequency != BillFrequency.monthly}
    candidates = [b for b in project(profile, today, months) if b.obligation_id in non_monthly]
    if not candidates:
        return None
    return max(candidates, key=lambda b: (b.amount, -b.days_away))
