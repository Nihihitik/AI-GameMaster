"""FastAPI dependencies: DB session + current_user по JWT."""

from __future__ import annotations

import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_async_session
from core.exceptions import GameError
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

