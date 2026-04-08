from __future__ import annotations

from pydantic import BaseModel, Field


class RoleConfig(BaseModel):
    mafia: int = Field(ge=1)
    sheriff: int = Field(ge=0, le=1)
    doctor: int = Field(ge=0, le=1)


class SessionSettings(BaseModel):
    role_reveal_timer_seconds: int = Field(default=15, ge=10, le=30)
    discussion_timer_seconds: int = Field(default=120, ge=30, le=300)
    voting_timer_seconds: int = Field(default=60, ge=15, le=120)
    night_action_timer_seconds: int = Field(default=30, ge=15, le=60)
    role_config: RoleConfig


class CreateSessionRequest(BaseModel):
    player_count: int = Field(ge=5, le=20)
    settings: SessionSettings


class SessionResponse(BaseModel):
    id: str
    code: str
    host_user_id: str
    player_count: int
    status: str
    settings: dict
    created_at: str


class PlayerInList(BaseModel):
    id: str
    name: str
    join_order: int
    is_host: bool


class SessionDetailResponse(BaseModel):
    id: str
    code: str
    host_user_id: str
    player_count: int
    status: str
    settings: dict
    players: list[PlayerInList]
    created_at: str


class JoinRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)


class JoinResponse(BaseModel):
    player_id: str
    session_id: str
    join_order: int


class UpdateSettingsRequest(BaseModel):
    role_reveal_timer_seconds: int | None = Field(default=None, ge=10, le=30)
    discussion_timer_seconds: int | None = Field(default=None, ge=30, le=300)
    voting_timer_seconds: int | None = Field(default=None, ge=15, le=120)
    night_action_timer_seconds: int | None = Field(default=None, ge=15, le=60)
    role_config: RoleConfig | None = None

