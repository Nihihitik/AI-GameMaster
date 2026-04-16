"""Dev-only observability endpoints для logs-frontend dashboard.

Не требуют auth — защита через env-флаг OBSERVABILITY_ENABLED.
В production флаг должен быть выключен.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_db
from core.config import settings
from core.exceptions import GameError
from core.logging import log_event
from models.player import Player
from models.session import Session
from models.user import User
from services.ws_manager import ws_manager


router = APIRouter()
logger = logging.getLogger(__name__)


def _ensure_enabled() -> None:
    if not settings.OBSERVABILITY_ENABLED:
        raise GameError(404, "not_found", "Observability disabled")


@router.get("/sessions")
async def list_sessions(
    status: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> dict:
    _ensure_enabled()
    limit = max(1, min(limit, 500))

    stmt = select(Session)
    if status in {"waiting", "active", "finished"}:
        stmt = stmt.where(Session.status == status)
    stmt = stmt.order_by(Session.created_at.desc()).limit(limit)

    sessions = (await db.scalars(stmt)).all()

    if not sessions:
        return {"sessions": [], "total": 0}

    session_ids = [s.id for s in sessions]
    host_ids = {s.host_user_id for s in sessions}

    counts_rows = (
        await db.execute(
            select(Player.session_id, func.count(Player.id))
            .where(Player.session_id.in_(session_ids))
            .group_by(Player.session_id)
        )
    ).all()
    counts = {row[0]: int(row[1]) for row in counts_rows}

    hosts_rows = (await db.execute(select(User).where(User.id.in_(host_ids)))).scalars().all()
    hosts = {h.id: h for h in hosts_rows}

    items = []
    for s in sessions:
        host = hosts.get(s.host_user_id)
        items.append(
            {
                "id": str(s.id),
                "code": s.code,
                "status": s.status,
                "player_count": s.player_count,
                "joined_count": counts.get(s.id, 0),
                "host_user_id": str(s.host_user_id),
                "host_email": host.email if host else None,
                "host_display_name": host.display_name if host else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            }
        )

    return {"sessions": items, "total": len(items)}


@router.post("/sessions/{session_id}/close", status_code=200)
async def close_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    _ensure_enabled()

    try:
        sid = uuid.UUID(session_id)
    except ValueError as exc:
        raise GameError(400, "validation_error", "session_id: ожидается UUID") from exc

    # Проверяем наличие записи отдельно от update, чтобы корректно вернуть 404.
    existing = await db.scalar(select(Session.id).where(Session.id == sid))
    if existing is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")

    # Атомарный CAS: апдейтим только если статус ещё не finished. Это исключает
    # дублирование log_event и ws-уведомления при двух параллельных close-запросах.
    result = await db.execute(
        update(Session)
        .where(Session.id == sid, Session.status != "finished")
        .values(status="finished", ended_at=func.now())
    )
    await db.commit()

    if result.rowcount == 0:
        return {"id": str(sid), "status": "finished", "noop": True}

    log_event(
        logger,
        logging.INFO,
        "session.closed",
        "Session closed via observability",
        session_id=str(sid),
        source="observability",
    )

    try:
        await ws_manager.send_to_session(
            sid,
            {
                "type": "session_closed",
                "payload": {"reason": "closed_by_admin"},
            },
        )
    except Exception:  # pragma: no cover - dev-only path
        logger.exception("Failed to notify ws clients about session close")

    return {"id": str(sid), "status": "finished", "noop": False}


@router.get("/info")
async def info() -> dict:
    return {
        "enabled": settings.OBSERVABILITY_ENABLED,
        "app_env": settings.APP_ENV,
    }
