"""Конфигурация приложения. Значения загружаются из .env файла."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения через переменные окружения."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # URL подключения к базе данных (PostgreSQL + asyncpg)
    DATABASE_URL: str
    # Режим отладки (включает логирование SQL-запросов)
    DEBUG: bool = False


# Единственный экземпляр настроек, используемый во всём приложении
settings = Settings()
