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
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Базовый класс для всех ORM-моделей."""
    pass


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Зависимость FastAPI для получения асинхронной сессии БД.

    Важно: при исключении гарантирует rollback.
    """
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# Backwards-compat alias (если где-то уже импортируют старое имя)
async_session_maker = async_session_factory