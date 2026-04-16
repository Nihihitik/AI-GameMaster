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


def validate_role_config(player_count: int, role_config: dict) -> int:
    """Валидирует конфигурацию ролей и возвращает итоговое число мирных.

    Баланс:
      mafia_count = mafia + don
      city_count  = player_count - mafia_count - maniac
    Требуется: mafia_count >= 1 и mafia_count < city_count.
    """
    mafia = int(role_config.get("mafia", 0))
    don = int(role_config.get("don", 0))
    sheriff = int(role_config.get("sheriff", 0))
    doctor = int(role_config.get("doctor", 0))
    lover = int(role_config.get("lover", 0))
    maniac = int(role_config.get("maniac", 0))

    mafia_count = mafia + don
    if mafia_count < 1:
        raise GameError(400, "invalid_role_config", "Должна быть хотя бы одна мафия")

    city_count = player_count - mafia_count - maniac
    if city_count <= 0:
        raise GameError(400, "invalid_role_config", "Недостаточно мест для города")
    if mafia_count >= city_count:
        raise GameError(400, "invalid_role_config", "Мафия должна быть строго меньше города")

    civilian = player_count - mafia - don - sheriff - doctor - lover - maniac
    if civilian < 0:
        raise GameError(400, "invalid_role_config", "Некорректная конфигурация ролей")

    return civilian

