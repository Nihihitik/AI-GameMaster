"""FastAPI dependencies: DB session + current_user по JWT + общие хелперы."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_async_session
from core.exceptions import GameError
from models.player import Player
from models.session import Session
from models.subscription import Subscription
from models.user import User
from services.auth_service import decode_access_token

security = HTTPBearer()


async def get_db() -> AsyncSession:
    # `get_async_session` — generator dependency, но тут нам нужен AsyncSession объект.
    # Используем напрямую фабрику, чтобы не терять управление контекстом.
    from core.database import async_session_factory

    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise GameError(status_code=401, code="token_invalid", message="Невалидный токен авторизации")

    user_id = payload.get("sub")
    if not user_id:
        raise GameError(status_code=401, code="token_invalid", message="Невалидный токен авторизации")
    try:
        uid = uuid.UUID(str(user_id))
    except Exception:
        raise GameError(status_code=401, code="token_invalid", message="Невалидный токен авторизации")

    user = await db.get(User, uid)
    if user is None:
        raise GameError(status_code=401, code="token_invalid", message="Пользователь не найден")
    return user


# ---------------------------------------------------------------------------
# Общие хелперы для роутеров
# ---------------------------------------------------------------------------


async def get_session_or_404(db: AsyncSession, session_id: uuid.UUID) -> Session:
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")
    return session


async def get_player_or_404(
    db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID,
) -> Player:
    player = await db.scalar(
        select(Player).where(Player.session_id == session_id, Player.user_id == user_id)
    )
    if player is None:
        raise GameError(404, "player_not_found", "Игрок не найден в этой сессии")
    return player


def require_host(session: Session, user_id: uuid.UUID) -> None:
    if session.host_user_id != user_id:
        raise GameError(403, "not_host", "Только организатор может выполнить это действие")


async def has_active_pro(db: AsyncSession, user_id: uuid.UUID) -> bool:
    now = datetime.now(timezone.utc)
    exists = await db.scalar(
        select(Subscription.id).where(
            Subscription.user_id == user_id,
            Subscription.plan == "pro",
            Subscription.status == "active",
            Subscription.period_end > now,
        )
    )
    return exists is not None

