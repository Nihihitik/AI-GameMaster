"""Сервис лобби: передача роли хоста и удаление пустой сессии после ухода игрока."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import log_event
from models.player import Player
from models.session import Session


logger = logging.getLogger(__name__)


@dataclass
class LobbyLeaveOutcome:
    session_deleted: bool
    host_transferred: bool
    new_host_user_id: Optional[uuid.UUID] = None
    new_host_player_id: Optional[uuid.UUID] = None
    new_host_name: Optional[str] = None


async def handle_player_left(
    db: AsyncSession,
    session: Session,
    leaver_user_id: uuid.UUID,
) -> LobbyLeaveOutcome:
    """Вызывается после того, как игрок удалён из `players`.

    Если оставшихся игроков нет — удаляет сессию. Если ушёл хост и остались игроки —
    передаёт роль хоста игроку с минимальным `join_order`. Коммит выполняется внутри.
    """
    session_id = session.id
    remaining = await db.scalar(
        select(func.count(Player.id)).where(Player.session_id == session_id)
    )
    remaining = int(remaining or 0)

    if remaining == 0:
        await db.delete(session)
        await db.commit()
        log_event(
            logger,
            logging.INFO,
            "lobby.session_deleted_empty",
            "Session deleted — last player left",
            session_id=str(session_id),
        )
        return LobbyLeaveOutcome(session_deleted=True, host_transferred=False)

    if session.host_user_id != leaver_user_id:
        await db.commit()
        return LobbyLeaveOutcome(session_deleted=False, host_transferred=False)

    new_host = await db.scalar(
        select(Player)
        .where(Player.session_id == session_id)
        .order_by(Player.join_order.asc())
        .limit(1)
    )
    if new_host is None:
        # Теоретически недостижимо (remaining > 0), но подстрахуемся.
        await db.delete(session)
        await db.commit()
        return LobbyLeaveOutcome(session_deleted=True, host_transferred=False)

    session.host_user_id = new_host.user_id
    await db.commit()

    log_event(
        logger,
        logging.INFO,
        "lobby.host_transferred",
        "Host role transferred after previous host left",
        session_id=str(session_id),
        previous_host_user_id=str(leaver_user_id),
        new_host_user_id=str(new_host.user_id),
        new_host_player_id=str(new_host.id),
    )

    return LobbyLeaveOutcome(
        session_deleted=False,
        host_transferred=True,
        new_host_user_id=new_host.user_id,
        new_host_player_id=new_host.id,
        new_host_name=new_host.name,
    )
