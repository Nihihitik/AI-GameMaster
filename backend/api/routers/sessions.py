"""Sessions роутер (создание сессий, join по коду, чтение по коду)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.deps import get_current_user, get_db
from core.exceptions import GameError
from models.game_event import GameEvent
from models.player import Player
from models.session import Session
from models.subscription import Subscription
from schemas.session import (
    CreateSessionRequest,
    JoinRequest,
    JoinResponse,
    PlayerInList,
    SessionDetailResponse,
    SessionResponse,
)
from services.session_service import generate_unique_code
from services.ws_manager import ws_manager


router = APIRouter()


def _validate_role_config(player_count: int, role_config: dict) -> int:
    """Валидирует конфигурацию ролей и возвращает итоговое число мирных.

    Баланс:
      mafia_count = mafia + don
      city_count  = player_count - mafia_count - maniac
    Требуется: mafia_count >= 1 и mafia_count < city_count.
    Маньяк — отдельная команда, но в балансе "мафия vs. город" считается
    отдельно от города (он не союзник ни тем, ни другим).
    """
    mafia = int(role_config.get("mafia", 0))
    don = int(role_config.get("don", 0))
    sheriff = int(role_config.get("sheriff", 0))
    doctor = int(role_config.get("doctor", 0))
    lover = int(role_config.get("lover", 0))
    maniac = int(role_config.get("maniac", 0))

    mafia_count = mafia + don
    if mafia_count < 1:
        raise GameError(400, "invalid_role_config", "Должна быть хотя бы одна мафия")

    city_count = player_count - mafia_count - maniac
    if city_count <= 0:
        raise GameError(400, "invalid_role_config", "Недостаточно мест для города")
    if mafia_count >= city_count:
        raise GameError(400, "invalid_role_config", "Мафия должна быть строго меньше города")

    civilian = player_count - mafia - don - sheriff - doctor - lover - maniac
    if civilian < 0:
        raise GameError(400, "invalid_role_config", "Некорректная конфигурация ролей")

    return civilian


async def _has_pro(db: AsyncSession, user_id: uuid.UUID) -> bool:
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


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    payload: CreateSessionRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    if payload.player_count > 5 and not await _has_pro(db, current_user.id):
        raise GameError(403, "pro_required", "Для этого количества игроков нужна подписка Pro")

    role_cfg = payload.settings.role_config.model_dump()
    civilian = _validate_role_config(payload.player_count, role_cfg)

    settings = payload.settings.model_dump()
    settings["role_config"] = {**role_cfg, "civilian": civilian}

    code = await generate_unique_code(db)
    session = Session(
        id=uuid.uuid4(),
        code=code,
        host_user_id=current_user.id,
        player_count=payload.player_count,
        status="waiting",
        settings=settings,
    )
    db.add(session)
    await db.flush()  # получаем session.id до создания Player, чтобы FK был валиден

    # Хост автоматически становится первым игроком лобби.
    host_display_name = (payload.host_name or current_user.display_name or "").strip()
    if not host_display_name:
        host_display_name = current_user.email.split("@")[0]
    host_display_name = host_display_name[:32]

    host_player = Player(
        id=uuid.uuid4(),
        session_id=session.id,
        user_id=current_user.id,
        name=host_display_name,
        join_order=1,
        status="alive",
        role_id=None,
    )
    db.add(host_player)
    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session.id,
            phase_id=None,
            event_type="player_joined",
            payload={
                "player_id": str(host_player.id),
                "name": host_player.name,
                "join_order": host_player.join_order,
            },
        )
    )
    await db.commit()

    return SessionResponse(
        id=str(session.id),
        code=session.code,
        host_user_id=str(session.host_user_id),
        player_count=session.player_count,
        status=session.status,
        settings=session.settings,
        created_at=session.created_at.isoformat() if session.created_at else "",
    )


@router.get("/{code}", response_model=SessionDetailResponse)
async def get_session_by_code(
    code: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionDetailResponse:
    session = await db.scalar(
        select(Session)
        .options(selectinload(Session.players))
        .where(Session.code == code)
    )
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")

    players = [
        PlayerInList(
            id=str(p.id),
            name=p.name,
            join_order=p.join_order,
            is_host=(p.user_id == session.host_user_id),
            is_me=(p.user_id == current_user.id),
        )
        for p in sorted(session.players, key=lambda x: x.join_order)
    ]
    return SessionDetailResponse(
        id=str(session.id),
        code=session.code,
        host_user_id=str(session.host_user_id),
        player_count=session.player_count,
        status=session.status,
        settings=session.settings,
        players=players,
        created_at=session.created_at.isoformat() if session.created_at else "",
    )


@router.post("/{code}/join", response_model=JoinResponse)
async def join_session(
    code: str,
    payload: JoinRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JoinResponse:
    raw = payload.name
    if raw:
        name = raw[:32]
    else:
        dn = (current_user.display_name or "").strip()
        if not dn:
            raise GameError(
                400,
                "validation_error",
                "name: передайте имя в join или задайте ник при регистрации",
            )
        name = dn[:32]

    session = await db.scalar(select(Session).where(Session.code == code))
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")
    if session.status != "waiting":
        raise GameError(403, "wrong_phase", "Сессия не принимает новых игроков")

    existing = await db.scalar(
        select(Player).where(Player.session_id == session.id, Player.user_id == current_user.id)
    )
    if existing is not None:
        # Тот же аккаунт возвращается в комнату (после вылета клиента / перезапуска приложения).
        # Другой человек не может занять чужой слот: привязка session_id + user_id уникальна.
        return JoinResponse(
            player_id=str(existing.id),
            session_id=str(session.id),
            join_order=existing.join_order,
        )

    current_count = await db.scalar(
        select(func.count(Player.id)).where(Player.session_id == session.id)
    )
    current_count = int(current_count or 0)
    if current_count >= session.player_count:
        raise GameError(409, "session_full", "Все места заняты")

    join_order = current_count + 1
    player = Player(
        id=uuid.uuid4(),
        session_id=session.id,
        user_id=current_user.id,
        name=name,
        join_order=join_order,
        status="alive",
        role_id=None,
    )
    db.add(player)
    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session.id,
            phase_id=None,
            event_type="player_joined",
            payload={"player_id": str(player.id), "name": player.name, "join_order": join_order},
        )
    )
    await db.commit()

    await ws_manager.send_to_session(
        session.id,
        {
            "type": "player_joined",
            "payload": {"player_id": str(player.id), "name": player.name, "join_order": join_order},
        },
    )
    return JoinResponse(player_id=str(player.id), session_id=str(session.id), join_order=join_order)

