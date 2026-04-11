"""Auth роутер (email+password, JWT, refresh rotation).

Отвечает за регистрацию/логин/refresh/logout и выдачу токенов.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user, get_db
from core.exceptions import GameError
from models.refresh_token import RefreshToken
from models.subscription import Subscription
from models.user import User
from schemas.auth import (
    AuthResponse,
    DeleteAccountRequest,
    LoginRequest,
    LogoutRequest,
    MeResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UpdateNicknameRequest,
)
from services.auth_service import (
    create_access_token,
    create_refresh_token,
    delete_user_account,
    hash_password,
    hash_refresh_token,
    refresh_expires_at,
    verify_password,
)


router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise GameError(409, "email_already_registered", "Этот email уже зарегистрирован")

    user = User(
        id=uuid.uuid4(),
        email=payload.email,
        display_name=payload.nickname,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()

    access = create_access_token(str(user.id), user.email)
    refresh = create_refresh_token()
    db.add(
        RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=hash_refresh_token(refresh),
            expires_at=refresh_expires_at(),
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise GameError(409, "email_already_registered", "Этот email уже зарегистрирован")

    return AuthResponse(
        user_id=str(user.id),
        email=user.email,
        nickname=user.display_name,
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await db.scalar(select(User).where(User.email == payload.email))
    if user is None:
        raise GameError(401, "invalid_credentials", "Неверный email или пароль")
    if not verify_password(payload.password, user.password_hash):
        raise GameError(401, "invalid_credentials", "Неверный email или пароль")

    access = create_access_token(str(user.id), user.email)
    refresh = create_refresh_token()
    db.add(
        RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=hash_refresh_token(refresh),
            expires_at=refresh_expires_at(),
        )
    )
    await db.commit()

    return AuthResponse(
        user_id=str(user.id),
        email=user.email,
        nickname=user.display_name,
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(payload.refresh_token)

    rt = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if rt is None:
        raise GameError(401, "token_invalid", "Refresh токен не найден или уже использован")
    if rt.expires_at < now:
        await db.delete(rt)
        await db.commit()
        raise GameError(401, "token_expired", "Срок действия токена истёк")

    user = await db.get(User, rt.user_id)
    if user is None:
        await db.delete(rt)
        await db.commit()
        raise GameError(401, "token_invalid", "Refresh токен не найден или уже использован")

    # rotation: удалить использованный
    await db.delete(rt)

    access = create_access_token(str(user.id), user.email)
    refresh_token = create_refresh_token()
    db.add(
        RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=refresh_expires_at(now),
        )
    )
    await db.commit()

    return TokenResponse(access_token=access, refresh_token=refresh_token)


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> MeResponse:
    now = datetime.now(timezone.utc)
    has_pro = await db.scalar(
        select(Subscription.id).where(
            Subscription.user_id == current_user.id,
            Subscription.plan == "pro",
            Subscription.status == "active",
            Subscription.period_end > now,
        )
    )
    return MeResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        nickname=current_user.display_name,
        has_pro=has_pro is not None,
        created_at=current_user.created_at.isoformat(),
    )


@router.patch("/me", response_model=MeResponse)
async def update_me_nickname(
    payload: UpdateNicknameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    current_user.display_name = payload.nickname
    await db.commit()
    await db.refresh(current_user)
    now = datetime.now(timezone.utc)
    has_pro = await db.scalar(
        select(Subscription.id).where(
            Subscription.user_id == current_user.id,
            Subscription.plan == "pro",
            Subscription.status == "active",
            Subscription.period_end > now,
        )
    )
    return MeResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        nickname=current_user.display_name,
        has_pro=has_pro is not None,
        created_at=current_user.created_at.isoformat(),
    )


@router.delete("/me", status_code=204)
async def delete_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if not verify_password(payload.password, current_user.password_hash):
        raise GameError(401, "invalid_credentials", "Неверный пароль")
    await delete_user_account(db, current_user.id)
    return None


@router.post("/logout", status_code=204)
async def logout(
    payload: LogoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    token_hash = hash_refresh_token(payload.refresh_token)
    await db.execute(
        delete(RefreshToken).where(
            RefreshToken.user_id == current_user.id, RefreshToken.token_hash == token_hash
        )
    )
    await db.commit()
    return None

