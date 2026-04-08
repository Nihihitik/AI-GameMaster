"""Lobby роутер (список игроков, выход/кик, закрытие, настройки до старта)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user, get_db
from core.exceptions import GameError
from models.game_event import GameEvent
from models.player import Player
from models.session import Session
from schemas.session import PlayerInList, UpdateSettingsRequest
from services.ws_manager import ws_manager


router = APIRouter()


@router.get("/{session_id}/players")
async def list_players(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")

    players = (await db.scalars(select(Player).where(Player.session_id == session_id))).all()
    items = [
        PlayerInList(
            id=str(p.id),
            name=p.name,
            join_order=p.join_order,
            is_host=(p.user_id == session.host_user_id),
        )
        for p in sorted(players, key=lambda x: x.join_order)
    ]
    return {"players": items}


@router.delete("/{session_id}/players/me", status_code=204)
async def leave_lobby(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")
    if session.status != "waiting":
        raise GameError(409, "game_already_started", "Игра уже началась")

    player = await db.scalar(
        select(Player).where(Player.session_id == session_id, Player.user_id == current_user.id)
    )
    if player is None:
        raise GameError(404, "player_not_found", "Игрок не найден в этой сессии")

    pid = player.id
    await db.delete(player)
    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session_id,
            phase_id=None,
            event_type="player_left",
            payload={"player_id": str(pid)},
        )
    )
    await db.commit()

    await ws_manager.send_to_session(session_id, {"type": "player_left", "payload": {"player_id": str(pid)}})
    return None


@router.delete("/{session_id}/players/{player_id}", status_code=204)
async def kick_player(
    session_id: uuid.UUID,
    player_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")
    if session.host_user_id != current_user.id:
        raise GameError(403, "not_host", "Только организатор может выполнить это действие")
    if session.status != "waiting":
        raise GameError(409, "game_already_started", "Игра уже началась")

    player = await db.scalar(select(Player).where(Player.session_id == session_id, Player.id == player_id))
    if player is None:
        raise GameError(404, "player_not_found", "Игрок не найден в этой сессии")
    if player.user_id == current_user.id:
        raise GameError(403, "not_host", "Нельзя кикнуть себя")

    kicked_user_id = player.user_id
    await db.delete(player)
    await db.commit()

    await ws_manager.send_to_session(session_id, {"type": "player_left", "payload": {"player_id": str(player_id)}})
    await ws_manager.send_to_user(session_id, kicked_user_id, {"type": "kicked", "payload": {"reason": "host_kicked"}})
    await ws_manager.close_connection(session_id, kicked_user_id, code=4000)
    return None


@router.delete("/{session_id}", status_code=204)
async def close_session(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")
    if session.host_user_id != current_user.id:
        raise GameError(403, "not_host", "Только организатор может выполнить это действие")

    session.status = "finished"
    from datetime import datetime, timezone

    session.ended_at = datetime.now(timezone.utc)
    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session_id,
            phase_id=None,
            event_type="session_closed",
            payload={},
        )
    )
    await db.commit()

    await ws_manager.send_to_session(session_id, {"type": "session_closed", "payload": {}})
    await ws_manager.close_session(session_id)
    return None


@router.patch("/{session_id}/settings")
async def update_settings(
    session_id: uuid.UUID,
    payload: UpdateSettingsRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")
    if session.host_user_id != current_user.id:
        raise GameError(403, "not_host", "Только организатор может выполнить это действие")
    if session.status != "waiting":
        raise GameError(409, "game_already_started", "Игра уже началась")

    current = session.settings or {}
    patch = payload.model_dump(exclude_unset=True)
    # role_config валидация (если передана)
    if patch.get("role_config") is not None:
        rc = patch["role_config"]
        mafia = int(rc.get("mafia", 0))
        sheriff = int(rc.get("sheriff", 0))
        doctor = int(rc.get("doctor", 0))
        if mafia + sheriff + doctor > session.player_count:
            raise GameError(400, "invalid_role_config", "Некорректная конфигурация ролей")
        if mafia >= (session.player_count - mafia):
            raise GameError(400, "invalid_role_config", "Мафия должна быть строго меньше города")
        civilian = session.player_count - mafia - sheriff - doctor
        patch["role_config"] = {**rc, "civilian": civilian}

    session.settings = {**current, **patch}
    await db.commit()

    await ws_manager.send_to_session(
        session_id,
        {"type": "settings_updated", "payload": {"settings": session.settings}},
    )
    return {"settings": session.settings}

