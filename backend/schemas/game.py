from __future__ import annotations

from pydantic import BaseModel


class NightActionRequest(BaseModel):
    target_player_id: str


class VoteRequest(BaseModel):
    target_player_id: str | None = None

