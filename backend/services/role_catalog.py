from __future__ import annotations

import uuid

from sqlalchemy import select

from core.database import async_session_factory
from models.role import Role


ROLE_CATALOG = [
    {"slug": "mafia", "name": "Мафия", "team": "mafia", "abilities": {"night_action": "kill"}},
    {"slug": "don", "name": "Дон", "team": "mafia", "abilities": {"night_action": "don_check"}},
    {"slug": "sheriff", "name": "Шериф", "team": "city", "abilities": {"night_action": "check"}},
    {"slug": "doctor", "name": "Доктор", "team": "city", "abilities": {"night_action": "heal"}},
    {"slug": "lover", "name": "Любовница", "team": "city", "abilities": {"night_action": "lover_visit"}},
    {"slug": "maniac", "name": "Маньяк", "team": "maniac", "abilities": {"night_action": "maniac_kill"}},
    {"slug": "civilian", "name": "Мирный", "team": "city", "abilities": {"night_action": None}},
]


async def ensure_role_catalog() -> None:
    """Гарантирует наличие базового справочника ролей в БД.

    Это обычная часть startup backend, а не отдельный runtime-скрипт.
    Функция идемпотентна: существующие роли не дублирует.
    """
    async with async_session_factory() as db:
        for data in ROLE_CATALOG:
            existing = await db.scalar(select(Role).where(Role.slug == data["slug"]))
            if existing is None:
                db.add(Role(id=uuid.uuid4(), **data))
        await db.commit()
