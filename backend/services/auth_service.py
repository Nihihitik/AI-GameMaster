"""Auth утилиты: bcrypt + JWT + refresh rotation helpers."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.payment import Payment
from models.player import Player
from models.refresh_token import RefreshToken
from models.session import Session
from models.subscription import Subscription
from models.user import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def create_refresh_token() -> str:
    return secrets.token_hex(32)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def refresh_expires_at(now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


async def delete_user_account(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Удаляет пользователя и связанные данные (сессии как хост, участие в чужих, подписки, токены)."""
    sub_ids = (await db.scalars(select(Subscription.id).where(Subscription.user_id == user_id))).all()
    if sub_ids:
        await db.execute(delete(Payment).where(Payment.subscription_id.in_(sub_ids)))
    await db.execute(delete(Subscription).where(Subscription.user_id == user_id))
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    await db.execute(delete(Session).where(Session.host_user_id == user_id))
    await db.execute(delete(Player).where(Player.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()

