"""Заполнение таблицы ролей для MVP (идемпотентно).

Запуск из каталога backend:

  uv run python -m scripts.seed
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select

from core.database import async_session_factory
from models.role import Role


SEED_ROLES = [
    {"slug": "mafia", "name": "Мафия", "team": "mafia", "abilities": {"night_action": "kill"}},
    {"slug": "don", "name": "Дон", "team": "mafia", "abilities": {"night_action": "don_check"}},
    {"slug": "sheriff", "name": "Шериф", "team": "city", "abilities": {"night_action": "check"}},
    {"slug": "doctor", "name": "Доктор", "team": "city", "abilities": {"night_action": "heal"}},
    {"slug": "lover", "name": "Любовница", "team": "city", "abilities": {"night_action": "lover_visit"}},
    {"slug": "maniac", "name": "Маньяк", "team": "maniac", "abilities": {"night_action": "maniac_kill"}},
    {"slug": "civilian", "name": "Мирный", "team": "city", "abilities": {"night_action": None}},
]


async def seed_roles() -> None:
    async with async_session_factory() as db:
        for data in SEED_ROLES:
            existing = await db.scalar(select(Role).where(Role.slug == data["slug"]))
            if existing is None:
                db.add(Role(id=uuid.uuid4(), **data))
        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_roles())
