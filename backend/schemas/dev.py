from __future__ import annotations

from pydantic import BaseModel

from schemas.auth import MeResponse


class DevLobbyPlayerLink(BaseModel):
    slot_number: int
    player_slug: str
    player_name: str
    url: str


class DevLobbyInfo(BaseModel):
    is_test_lobby: bool
    player_links: list[DevLobbyPlayerLink] | None = None


class ActivateDevPlayerRequest(BaseModel):
    code: str
    player_slug: str
    bootstrap_key: str


class ActivateDevPlayerResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: MeResponse
