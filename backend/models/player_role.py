"""Модель назначенной роли игрока."""

import uuid

from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class PlayerRole(Base):
    """Роль, назначенная конкретному игроку в сессии."""
    __tablename__ = "player_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("session_players.id"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False
    )
    is_alive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_awake: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Связи
    session_player: Mapped["SessionPlayer"] = relationship(back_populates="player_roles")
    role: Mapped["Role"] = relationship(back_populates="player_roles")
    actions_as_actor: Mapped[list["GameAction"]] = relationship(
        back_populates="actor_player", foreign_keys="GameAction.actor_player_id"
    )
    actions_as_target: Mapped[list["GameAction"]] = relationship(
        back_populates="target_player", foreign_keys="GameAction.target_player_id"
    )
