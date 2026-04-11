from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    nickname: str = Field(min_length=1, max_length=32, description="Отображается в игре; уникальность не требуется")

    @field_validator("nickname")
    @classmethod
    def strip_nickname(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("ник не может быть пустым")
        return s[:32]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user_id: str
    email: str
    nickname: str
    access_token: str
    refresh_token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str


class MeResponse(BaseModel):
    user_id: str
    email: str
    nickname: str
    has_pro: bool
    created_at: str


class UpdateNicknameRequest(BaseModel):
    nickname: str = Field(min_length=1, max_length=32, description="Новый ник для отображения в игре и при join без name")

    @field_validator("nickname")
    @classmethod
    def strip_nickname(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("ник не может быть пустым")
        return s[:32]


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, description="Подтверждение паролем перед удалением")


class LogoutRequest(BaseModel):
    refresh_token: str

