"""Восстановление состояния игры (reconnect-safe).

Этот модуль делает то, что нужно для FR-7.4/C12:
- не полагается на in-memory runtime (он может потеряться при рестарте сервера)
- восстанавливает подфазы и таймеры из `game_events.phase_changed`
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.utils import safe_uuid
from models.game_event import GameEvent
from models.game_phase import GamePhase
from services.runtime_state import runtime_state


async def get_last_phase_changed_event(
    db: AsyncSession, session_id: uuid.UUID, phase_id: uuid.UUID
) -> GameEvent | None:
    return await db.scalar(
        select(GameEvent)
        .where(
            GameEvent.session_id == session_id,
            GameEvent.phase_id == phase_id,
            GameEvent.event_type == "phase_changed",
        )
        .order_by(GameEvent.created_at.desc())
        .limit(1)
    )


async def get_last_phase_changed(
    db: AsyncSession, session_id: uuid.UUID, phase_id: uuid.UUID
) -> dict | None:
    ev = await get_last_phase_changed_event(db, session_id, phase_id)
    return ev.payload if ev else None


async def get_last_announcement_event(
    db: AsyncSession, session_id: uuid.UUID, phase_id: uuid.UUID
) -> GameEvent | None:
    return await db.scalar(
        select(GameEvent)
        .where(
            GameEvent.session_id == session_id,
            GameEvent.phase_id == phase_id,
            GameEvent.event_type.in_(("phase_changed", "night_result", "vote_result")),
        )
        .order_by(GameEvent.created_at.desc())
        .limit(1)
    )


async def get_last_known_phase(
    db: AsyncSession,
    session_id: uuid.UUID,
) -> GamePhase | None:
    return await db.scalar(
        select(GamePhase)
        .where(GamePhase.session_id == session_id)
        .order_by(GamePhase.started_at.desc())
        .limit(1)
    )


def parse_iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


async def restore_runtime_like_fields(
    db: AsyncSession, session_id: uuid.UUID, phase: GamePhase | None
) -> dict:
    """Восстановление runtime-полей из `game_events`.

    Возвращает словарь с sub_phase / night_turn / timer_* и заодно обновляет
    `runtime_state.get(session_id)`, дописывая blocked_tonight / lover_last_target /
    day_blocked_player из последних событий, если runtime был пуст (после рестарта).
    """
    empty = {
        "sub_phase": None,
        "night_turn": None,
        "timer_name": None,
        "timer_seconds": None,
        "timer_started_at": None,
        "vote_round": 1,
        "candidate_ids": None,
        "announcement": None,
    }
    if not phase:
        return empty

    event = await get_last_phase_changed_event(db, session_id, phase.id)
    payload = event.payload if event else None

    # Восстанавливаем дополнительные поля runtime, которые не входят в базовый return.
    rt = runtime_state.get(session_id)

    # blocked_tonight — последнее phase_changed текущей ночи.
    if payload and phase.phase_type == "night":
        blocked_raw = payload.get("blocked_tonight") or []
        restored_blocked: set[uuid.UUID] = set()
        for item in blocked_raw:
            u = safe_uuid(item)
            if u is not None:
                restored_blocked.add(u)
        if restored_blocked and not rt.blocked_tonight:
            rt.blocked_tonight = restored_blocked

    # lover_last_target / day_blocked_player — из последнего night_result этой сессии.
    last_night_result = await db.scalar(
        select(GameEvent)
        .where(
            GameEvent.session_id == session_id,
            GameEvent.event_type == "night_result",
        )
        .order_by(GameEvent.created_at.desc())
        .limit(1)
    )
    if last_night_result and isinstance(last_night_result.payload, dict):
        llt = safe_uuid(last_night_result.payload.get("lover_last_target"))
        if llt is not None and rt.lover_last_target is None:
            rt.lover_last_target = llt
        # day_blocked_player восстанавливаем только для текущего дня.
        if phase.phase_type == "day" and last_night_result.phase_id is not None:
            dbp = safe_uuid(last_night_result.payload.get("day_blocked_player"))
            if dbp is not None and rt.day_blocked_player is None:
                rt.day_blocked_player = dbp

    if not payload:
        return empty

    restored_candidate_ids: list[uuid.UUID] | None = None
    candidate_ids_raw = payload.get("candidate_ids")
    if isinstance(candidate_ids_raw, list):
        restored_candidate_ids = []
        for item in candidate_ids_raw:
            u = safe_uuid(item)
            if u is not None:
                restored_candidate_ids.append(u)
        if restored_candidate_ids and not rt.voting_candidate_ids:
            rt.voting_candidate_ids = restored_candidate_ids

    announcement = payload.get("announcement")
    announcement_started_at = event.created_at if event else None
    if announcement is None:
        announcement_event = await get_last_announcement_event(db, session_id, phase.id)
        if announcement_event and isinstance(announcement_event.payload, dict):
            announcement = announcement_event.payload.get("announcement")
            announcement_started_at = announcement_event.created_at
    if announcement and isinstance(announcement, dict) and rt.current_announcement is None:
        rt.current_announcement = announcement
        rt.announcement_started_at = announcement_started_at

    timer_name = payload.get("timer_name")
    if timer_name is None:
        if payload.get("sub_phase") == "discussion":
            timer_name = "discussion"
        elif payload.get("sub_phase") == "voting":
            timer_name = "voting"
        elif payload.get("night_turn"):
            timer_name = f"night_{payload.get('night_turn')}"

    return {
        "sub_phase": payload.get("sub_phase"),
        "night_turn": payload.get("night_turn"),
        "timer_name": timer_name,
        "timer_seconds": payload.get("timer_seconds"),
        "timer_started_at": parse_iso_dt(payload.get("timer_started_at")),
        "vote_round": int(payload.get("vote_round") or 1),
        "candidate_ids": restored_candidate_ids,
        "announcement": announcement if isinstance(announcement, dict) else None,
    }
