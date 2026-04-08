from __future__ import annotations

import uuid

from services.game_engine import transition_to_day, transition_to_night, transition_to_voting


async def to_night(session_id: uuid.UUID, number: int) -> None:
    await transition_to_night(session_id, number)


async def to_day(session_id: uuid.UUID, number: int) -> None:
    await transition_to_day(session_id, number)


async def to_voting(session_id: uuid.UUID) -> None:
    await transition_to_voting(session_id)

