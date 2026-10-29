from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class PayFrequency(str, Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    semimonthly = "semimonthly"
    monthly = "monthly"


class BillFrequency(str, Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    semiannual = "semiannual"
    annual = "annual"


class Avatar(str, Enum):
    strategist = "strategist"
    adventurer = "adventurer"
    builder = "builder"


class Obligation(BaseModel):
    id: str
    name: str
    amount: float = Field(gt=0)
    frequency: BillFrequency = BillFrequency.monthly
    next_due: date
    essential: bool = True
    category: str = "other"  # rent, debt, insurance, subscription, bnpl, utilities, other


class Goal(BaseModel):
    id: str
    name: str
    target: float = Field(gt=0)
    saved: float = Field(ge=0, default=0)
    monthly_contribution: float = Field(ge=0, default=0)


class Profile(BaseModel):
    name: str = "Friend"
    avatar: Avatar = Avatar.strategist
    pay_frequency: PayFrequency = PayFrequency.biweekly
    net_pay: float = Field(gt=0)  # take-home per paycheck, USD
    next_payday: date
    checking_balance: float = Field(ge=0)
    savings_balance: float = Field(ge=0, default=0)
    obligations: list[Obligation] = []
    goals: list[Goal] = []
    memory: list[dict] = []  # semantic memory entries: {section, text, created}


class Snapshot(BaseModel):
    """Output of the deterministic recalculation. The LLM only ever sees these numbers."""

    days_to_payday: int
    due_before_payday: float
    goal_contributions_before_payday: float
    safe_to_spend: float
    daily_budget: float
    monthly_income: float
    monthly_essentials: float
    buffer_months: float
    buffer_status: str  # Thin | Building | Healthy
    goals: list[dict]


class UpcomingBill(BaseModel):
    obligation_id: str
    name: str
    amount: float
    due: date
    days_away: int
