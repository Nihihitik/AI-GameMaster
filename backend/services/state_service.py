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


async def restore_runtime_like_fields(
    db: AsyncSession, session_id: uuid.UUID, phase: GamePhase | None
) -> dict:
    """Возвращает (sub_phase, night_turn, timer_seconds, timer_started_at)."""
    if not phase:
        return {"sub_phase": None, "night_turn": None, "timer_seconds": None, "timer_started_at": None}
    payload = await get_last_phase_changed(db, session_id, phase.id)
    if not payload:
        return {"sub_phase": None, "night_turn": None, "timer_seconds": None, "timer_started_at": None}
    return {
        "sub_phase": payload.get("sub_phase"),
        "night_turn": payload.get("night_turn"),
        "timer_seconds": payload.get("timer_seconds"),
        "timer_started_at": parse_iso_dt(payload.get("timer_started_at")),
    }

