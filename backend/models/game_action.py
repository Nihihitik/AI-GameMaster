"""Модель игрового действия."""

import uuid

from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class GameAction(Base):
    """Действие игрока в рамках фазы (голосование, убийство и т.д.)."""
    __tablename__ = "game_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )
    phase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("game_phases.id"), nullable=False
    )
    actor_player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("player_roles.id"), nullable=False
    )
    target_player_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("player_roles.id"), nullable=True
    )
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Связи
    session: Mapped["Session"] = relationship(back_populates="game_actions")
    phase: Mapped["GamePhase"] = relationship(back_populates="game_actions")
    actor_player: Mapped["PlayerRole"] = relationship(
        back_populates="actions_as_actor", foreign_keys=[actor_player_id]
    )
    target_player: Mapped["PlayerRole | None"] = relationship(
        back_populates="actions_as_target", foreign_keys=[target_player_id]
    )
