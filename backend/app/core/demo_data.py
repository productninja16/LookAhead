"""One-click demo personas. Dates are relative to today so the demo never looks stale."""

from __future__ import annotations

from datetime import date, timedelta

from .models import Avatar, BillFrequency, Goal, Obligation, PayFrequency, Profile
from .obligations import add_months

DEMOS = {
    "maya": {
        "title": "Maya, 24 · New grad",
        "blurb": "First job in Austin. $2,100 biweekly take-home, student loans, building an emergency fund.",
        "avatar": Avatar.builder,
    },
    "dev": {
        "title": "Dev, 31 · Software engineer",
        "blurb": "Seattle. $3,400 biweekly, rent + car, a laptop on Affirm, annual insurance coming up.",
        "avatar": Avatar.strategist,
    },
    "sam": {
        "title": "Sam, 28 · Designer",
        "blurb": "Chicago. $2,600 semi-monthly, impulse-prone, thin savings. Wants a straight answer.",
        "avatar": Avatar.adventurer,
    },
}


def _bill(id, name, amount, due: date, freq=BillFrequency.monthly, essential=True, category="other"):
    return Obligation(id=id, name=name, amount=amount, next_due=due, frequency=freq,
                      essential=essential, category=category)


def build(key: str, today: date) -> Profile:
    d = lambda n: today + timedelta(days=n)  # noqa: E731
    if key == "maya":
        return Profile(
            name="Maya", avatar=Avatar.builder, pay_frequency=PayFrequency.biweekly, net_pay=2100,
            next_payday=d(9), checking_balance=2650, savings_balance=3200,
            obligations=[
                _bill("rent", "Rent", 1350, d(4), category="rent"),
                _bill("student", "Student loan", 310, d(12), category="debt"),
                _bill("phone", "Phone plan", 55, d(15), category="utilities"),
                _bill("spotify", "Spotify + Netflix", 28, d(7), essential=False, category="subscription"),
                _bill("ins", "Renters insurance", 168, add_months(today, 2), BillFrequency.annual, category="insurance"),
            ],
            goals=[
                Goal(id="ef", name="Emergency fund", target=9000, saved=3200, monthly_contribution=400),
                Goal(id="trip", name="Japan trip", target=3500, saved=600, monthly_contribution=150),
            ],
        )
    if key == "dev":
        return Profile(
            name="Dev", avatar=Avatar.strategist, pay_frequency=PayFrequency.biweekly, net_pay=3400,
            next_payday=d(6), checking_balance=5100, savings_balance=22000,
            obligations=[
                _bill("rent", "Rent", 2300, d(3), category="rent"),
                _bill("car", "Car payment", 410, d(11), category="debt"),
                _bill("affirm", "Laptop (Affirm)", 135, d(14), essential=False, category="bnpl"),
                _bill("util", "Utilities + internet", 190, d(9), category="utilities"),
                _bill("ins", "Auto insurance", 1180, d(47), BillFrequency.semiannual, category="insurance"),
            ],
            goals=[
                Goal(id="house", name="Down payment", target=80000, saved=22000, monthly_contribution=1500),
            ],
        )
    if key == "sam":
        return Profile(
            name="Sam", avatar=Avatar.adventurer, pay_frequency=PayFrequency.semimonthly, net_pay=2600,
            next_payday=d(8), checking_balance=1900, savings_balance=900,
            memory=[{"section": "Known Weak Spots", "text": "Tends to impulse-buy electronics after stressful weeks",
                     "created": today.isoformat()}],
            obligations=[
                _bill("rent", "Rent", 1650, d(3), category="rent"),
                _bill("cc", "Credit card minimum", 120, d(10), category="debt"),
                _bill("gym", "Gym", 45, d(5), essential=False, category="subscription"),
                _bill("ins", "Health insurance", 520, d(30), BillFrequency.quarterly, category="insurance"),
            ],
            goals=[Goal(id="ef", name="Emergency fund", target=6000, saved=900, monthly_contribution=200)],
        )
    raise KeyError(key)
