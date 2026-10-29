from datetime import date

import pytest

from app.core.engine import monthly_income, recalculate
from app.core.models import (
    BillFrequency,
    Goal,
    Obligation,
    PayFrequency,
    Profile,
)
from app.core.obligations import advance, blind_spot, project

TODAY = date(2026, 3, 1)


def make_profile(**kw) -> Profile:
    base = dict(
        net_pay=2500,
        pay_frequency=PayFrequency.biweekly,
        next_payday=date(2026, 3, 15),
        checking_balance=4000,
        savings_balance=9000,
        obligations=[
            Obligation(id="rent", name="Rent", amount=1500, next_due=date(2026, 3, 5), category="rent"),
            Obligation(id="car", name="Car payment", amount=350, next_due=date(2026, 3, 20), category="debt"),
            Obligation(
                id="ins", name="Car insurance", amount=900, frequency=BillFrequency.semiannual,
                next_due=date(2026, 4, 20), category="insurance",
            ),
        ],
        goals=[Goal(id="ef", name="Emergency fund", target=15000, saved=9000, monthly_contribution=500)],
    )
    base.update(kw)
    return Profile(**base)


def test_monthly_income_conversions():
    assert monthly_income(2500, PayFrequency.biweekly) == pytest.approx(2500 * 26 / 12)
    assert monthly_income(1000, PayFrequency.weekly) == pytest.approx(1000 * 52 / 12)
    assert monthly_income(3000, PayFrequency.semimonthly) == 6000
    assert monthly_income(5000, PayFrequency.monthly) == 5000


def test_safe_to_spend_subtracts_only_bills_due_before_payday():
    snap = recalculate(make_profile(), TODAY)
    # Rent (Mar 5) is due before Mar 15 payday; car (Mar 20) and insurance are not.
    assert snap.days_to_payday == 14
    assert snap.due_before_payday == 1500
    assert snap.safe_to_spend == pytest.approx(4000 - 1500 - snap.goal_contributions_before_payday)
    assert snap.daily_budget == pytest.approx(snap.safe_to_spend / 14, rel=1e-6)


def test_paid_obligation_is_excluded():
    p = make_profile()
    p.obligations[0].next_due = date(2026, 4, 5)  # rent already paid, rolled forward
    snap = recalculate(p, TODAY)
    assert snap.due_before_payday == 0


def test_buffer_status_thresholds():
    assert recalculate(make_profile(savings_balance=500), TODAY).buffer_status == "Thin"
    assert recalculate(make_profile(savings_balance=4000), TODAY).buffer_status == "Building"
    assert recalculate(make_profile(savings_balance=20000), TODAY).buffer_status == "Healthy"


def test_safe_to_spend_never_negative_and_daily_budget_floor():
    snap = recalculate(make_profile(checking_balance=100), TODAY)
    assert snap.safe_to_spend == 0
    assert snap.daily_budget == 0


def test_payday_today_counts_as_one_day():
    snap = recalculate(make_profile(next_payday=TODAY), TODAY)
    assert snap.days_to_payday == 1


def test_goal_timeline():
    snap = recalculate(make_profile(), TODAY)
    goal = snap.goals[0]
    assert goal["remaining"] == 6000
    assert goal["months_to_go"] == 12
    assert goal["status"] == "On track"


def test_advance_monthly_and_semiannual():
    assert advance(date(2026, 1, 31), BillFrequency.monthly) == date(2026, 2, 28)
    assert advance(date(2026, 4, 20), BillFrequency.semiannual) == date(2026, 10, 20)
    assert advance(date(2026, 4, 20), BillFrequency.annual) == date(2027, 4, 20)


def test_projection_six_months():
    bills = project(make_profile(), TODAY, months=6)
    names = [b.name for b in bills]
    assert names.count("Rent") == 6
    assert names.count("Car payment") == 6
    assert names.count("Car insurance") == 1  # Apr 20 only; Oct 20 falls outside the 6-month window


def test_blind_spot_is_largest_non_monthly_bill():
    spot = blind_spot(make_profile(), TODAY)
    assert spot is not None
    assert spot.name == "Car insurance"
    assert spot.amount == 900
    assert spot.days_away == 50
