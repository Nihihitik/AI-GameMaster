from __future__ import annotations

from pydantic import BaseModel


class SubscriptionStatusResponse(BaseModel):
    plan: str  # "free" | "pro"
    status: str | None  # "active" | "cancelled" | "expired" | None
    period_end: str | None
    cancel_at_period_end: bool


class CreateSubscriptionRequest(BaseModel):
    plan: str  # "pro"


class CreateSubscriptionResponse(BaseModel):
    subscription_id: str
    plan: str
    status: str
    period_start: str
    period_end: str

