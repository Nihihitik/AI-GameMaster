from __future__ import annotations

import uuid

from services.game_engine import resolve_night


# Роли и ночные действия, которые поддерживаются движком:
#   kill          — мафия
#   check         — шериф
#   heal          — доктор
#   don_check     — дон (проверяет, шериф ли цель; не раскрывает полный team)
#   lover_visit   — любовница (блокирует цель и себя на эту ночь)
#   maniac_kill   — маньяк (параллельный убийца)
# Реальная валидация и запись действий выполняется в `api/routers/game.py::night_action`,
# а подсчёт жертв — в `services/game_engine.py::resolve_night`.


async def resolve_night_for_session(session_id: uuid.UUID, phase_id: uuid.UUID) -> None:
    """Заготовка для выделения резолвера ночи в отдельный модуль.

    Сейчас основной код расположен в `services/game_engine.py`.
    """
    from core.database import async_session_factory
    from models.session import Session
    from models.game_phase import GamePhase

    async with async_session_factory() as db:
        session = await db.get(Session, session_id)
        phase = await db.get(GamePhase, phase_id)
        if session and phase:
            await resolve_night(db, session, phase)

