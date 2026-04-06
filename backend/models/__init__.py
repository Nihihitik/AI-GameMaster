"""Регистрация всех ORM-моделей. Импорт здесь нужен для Alembic autogenerate."""

from models.user import User, UserPlan
from models.role import Role
from models.session import Session, SessionStatus
from models.game_phase import GamePhase
from models.session_player import SessionPlayer
from models.session_role import SessionRole
from models.player_role import PlayerRole
from models.game_action import GameAction

__all__ = [
    "User",
    "UserPlan",
    "Role",
    "Session",
    "SessionStatus",
    "GamePhase",
    "SessionPlayer",
    "SessionRole",
    "PlayerRole",
    "GameAction",
]
