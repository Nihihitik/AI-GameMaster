"""Ночные действия спецролей."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class NightAction(Base):
    __tablename__ = "night_actions"

    __table_args__ = (
        UniqueConstraint("phase_id", "actor_player_id", name="uq_night_actions_phase_actor"),
        CheckConstraint("action_type IN ('kill', 'check', 'heal')", name="ck_night_actions_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("game_phases.id", ondelete="CASCADE"),
        nullable=False,
    )
    actor_player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id"), nullable=False
    )
    target_player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id"), nullable=False
    )
    action_type: Mapped[str] = mapped_column(String(10), nullable=False)
    was_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    phase: Mapped["GamePhase"] = relationship(back_populates="night_actions")
    actor: Mapped["Player"] = relationship(foreign_keys=[actor_player_id])
    target: Mapped["Player"] = relationship(foreign_keys=[target_player_id])

