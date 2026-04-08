from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class SessionRuntime:
    # day subphase: "discussion" | "voting" | None
    day_sub_phase: str | None = None

    # night turn: "mafia" | "doctor" | "sheriff" | None
    night_turn: str | None = None

    # current timer metadata for state endpoint
    timer_name: str | None = None
    timer_seconds: int | None = None
    timer_started_at: datetime | None = None

    # events to unblock waiting in night sequence
    night_action_event: asyncio.Event = field(default_factory=asyncio.Event)

    # mafia: first choice wins (store target player_id)
    mafia_choice_target: uuid.UUID | None = None
    mafia_choice_by: uuid.UUID | None = None  # actor_player_id

    # background task marker (чтобы не запускать несколько recovery/sequence параллельно)
    night_sequence_running: bool = False


class RuntimeState:
    def __init__(self):
        self._sessions: dict[uuid.UUID, SessionRuntime] = {}

    def get(self, session_id: uuid.UUID) -> SessionRuntime:
        return self._sessions.setdefault(session_id, SessionRuntime())

    def clear(self, session_id: uuid.UUID) -> None:
        self._sessions.pop(session_id, None)


runtime_state = RuntimeState()

