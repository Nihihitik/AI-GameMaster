"""Конфигурация подключения к базе данных и управление сессиями."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from core.config import settings


# Асинхронный движок SQLAlchemy для работы с PostgreSQL через asyncpg
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
)

# Фабрика асинхронных сессий для работы с БД
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Базовый класс для всех ORM-моделей."""
    pass


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Зависимость FastAPI для получения асинхронной сессии БД."""
    async with async_session_maker() as session:
        yield session