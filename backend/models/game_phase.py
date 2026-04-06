"""Модель игровой фазы."""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class GamePhase(Base):
    """Фаза игры (день/ночь/голосование и т.д.)."""
    __tablename__ = "game_phases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )
    phase_order: Mapped[int] = mapped_column(Integer, nullable=False)
    phase_type: Mapped[str] = mapped_column(String(100), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Связи
    session: Mapped["Session"] = relationship(
        back_populates="game_phases", foreign_keys=[session_id]
    )
    game_actions: Mapped[list["GameAction"]] = relationship(back_populates="phase")
