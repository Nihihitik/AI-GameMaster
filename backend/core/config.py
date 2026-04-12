"""Конфигурация приложения. Значения загружаются из `.env` файла."""

from __future__ import annotations

import json
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_json_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(x) for x in value]
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        if s.startswith("["):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    return [str(x) for x in parsed]
            except Exception:
                pass
        return [v.strip() for v in s.split(",") if v.strip()]
    return [str(value)]


class Settings(BaseSettings):
    """Настройки приложения через переменные окружения."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/gamemaster"
    )
    SECRET_KEY: str = Field(default="change-me-to-a-random-string-at-least-32-chars")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # CORS_ORIGINS приходит как JSON-строка или как CSV.
    # Храним в виде строки, чтобы pydantic-settings не пытался парсить JSON
    # (list[str] заставляет его всегда звать json.loads). Превращаем в список
    # через свойство `cors_origins`.
    CORS_ORIGINS: str = Field(default="http://localhost:5173")

    # Режим отладки (включает логирование SQL-запросов)
    DEBUG: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return _parse_json_list(self.CORS_ORIGINS)


settings = Settings()
