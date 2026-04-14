from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class RoleConfig(BaseModel):
    mafia: int = Field(ge=0)
    sheriff: int = Field(default=0, ge=0, le=1)
    doctor: int = Field(default=0, ge=0, le=1)
    don: int = Field(default=0, ge=0, le=1)
    lover: int = Field(default=0, ge=0, le=1)
    maniac: int = Field(default=0, ge=0, le=1)


class SessionSettings(BaseModel):
    role_reveal_timer_seconds: int = Field(default=15, ge=10, le=30)
    discussion_timer_seconds: int = Field(default=120, ge=30, le=300)
    voting_timer_seconds: int = Field(default=60, ge=15, le=120)
    night_action_timer_seconds: int = Field(default=30, ge=15, le=60)
    role_config: RoleConfig


class CreateSessionRequest(BaseModel):
    player_count: int = Field(ge=5, le=20)
    settings: SessionSettings
    host_name: str | None = Field(default=None, max_length=32)

    @field_validator("host_name")
    @classmethod
    def strip_host_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s[:32] if s else None


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
    is_me: bool = False


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
    """Если name не передан или пустой — в столе игрока подставится ник из профиля (регистрация)."""

    name: str | None = Field(default=None, max_length=32)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s if s else None


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
