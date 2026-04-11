from __future__ import annotations

import random
import string

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import GameError
from models.session import Session


async def generate_unique_code(db: AsyncSession) -> str:
    chars = string.ascii_uppercase + string.digits
    for _ in range(10):
        code = "".join(random.choices(chars, k=6))
        exists = await db.scalar(select(Session.id).where(Session.code == code))
        if not exists:
            return code
    raise GameError(500, "internal_error", "Не удалось сгенерировать уникальный код")

