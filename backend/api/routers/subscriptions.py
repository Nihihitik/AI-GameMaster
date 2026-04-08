from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user, get_db
from core.exceptions import GameError
from models.subscription import Subscription
from schemas.subscription import (
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
    SubscriptionStatusResponse,
)


router = APIRouter()


@router.get("/me", response_model=SubscriptionStatusResponse)
async def me(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionStatusResponse:
    sub = await db.scalar(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.period_end.desc())
        .limit(1)
    )
    if sub is None:
        return SubscriptionStatusResponse(
            plan="free", status=None, period_end=None, cancel_at_period_end=False
        )
    return SubscriptionStatusResponse(
        plan=sub.plan,
        status=sub.status,
        period_end=sub.period_end.isoformat(),
        cancel_at_period_end=sub.cancel_at_period_end,
    )


@router.post("", response_model=CreateSubscriptionResponse, status_code=201)
async def create_subscription(
    payload: CreateSubscriptionRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreateSubscriptionResponse:
    if payload.plan != "pro":
        raise GameError(400, "validation_error", "plan: Допустимо только значение 'pro'")

    now = datetime.now(timezone.utc)
    sub = Subscription(
        id=uuid.uuid4(),
        user_id=current_user.id,
        plan="pro",
        status="active",
        period_start=now,
        period_end=now + timedelta(days=30),
        cancel_at_period_end=False,
    )
    db.add(sub)
    await db.commit()

    return CreateSubscriptionResponse(
        subscription_id=str(sub.id),
        plan=sub.plan,
        status=sub.status,
        period_start=sub.period_start.isoformat(),
        period_end=sub.period_end.isoformat(),
    )

