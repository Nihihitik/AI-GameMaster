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

from models.game_event import GameEvent
from models.game_phase import GamePhase
from services.runtime_state import runtime_state


async def get_last_phase_changed(
    db: AsyncSession, session_id: uuid.UUID, phase_id: uuid.UUID
) -> dict | None:
    ev = await db.scalar(
        select(GameEvent)
        .where(
            GameEvent.session_id == session_id,
            GameEvent.phase_id == phase_id,
            GameEvent.event_type == "phase_changed",
        )
        .order_by(GameEvent.created_at.desc())
        .limit(1)
    )
    return ev.payload if ev else None


def parse_iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _safe_uuid(raw) -> uuid.UUID | None:
    if raw is None:
        return None
    try:
        return uuid.UUID(str(raw))
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
        "timer_seconds": None,
        "timer_started_at": None,
    }
    if not phase:
        return empty

    payload = await get_last_phase_changed(db, session_id, phase.id)

    # Восстанавливаем дополнительные поля runtime, которые не входят в базовый return.
    rt = runtime_state.get(session_id)

    # blocked_tonight — последнее phase_changed текущей ночи.
    if payload and phase.phase_type == "night":
        blocked_raw = payload.get("blocked_tonight") or []
        restored_blocked: set[uuid.UUID] = set()
        for item in blocked_raw:
            u = _safe_uuid(item)
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
        llt = _safe_uuid(last_night_result.payload.get("lover_last_target"))
        if llt is not None and rt.lover_last_target is None:
            rt.lover_last_target = llt
        # day_blocked_player восстанавливаем только для текущего дня.
        if phase.phase_type == "day" and last_night_result.phase_id is not None:
            dbp = _safe_uuid(last_night_result.payload.get("day_blocked_player"))
            if dbp is not None and rt.day_blocked_player is None:
                rt.day_blocked_player = dbp

    if not payload:
        return empty

    return {
        "sub_phase": payload.get("sub_phase"),
        "night_turn": payload.get("night_turn"),
        "timer_seconds": payload.get("timer_seconds"),
        "timer_started_at": parse_iso_dt(payload.get("timer_started_at")),
    }

