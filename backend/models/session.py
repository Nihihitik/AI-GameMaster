"""Модель игровой сессии."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Enum, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class SessionStatus(str, enum.Enum):
    """Статус игровой сессии."""
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"


class Session(Base):
    """Игровая сессия (лобби/партия)."""
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    max_players: Mapped[int] = mapped_column(Integer, nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), default=SessionStatus.WAITING, nullable=False
    )
    current_phase_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("game_phases.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Связи
    owner: Mapped["User"] = relationship(back_populates="sessions")
    current_phase: Mapped["GamePhase | None"] = relationship(
        foreign_keys=[current_phase_id]
    )
    game_phases: Mapped[list["GamePhase"]] = relationship(
        back_populates="session", foreign_keys="GamePhase.session_id"
    )
    session_players: Mapped[list["SessionPlayer"]] = relationship(back_populates="session")
    session_roles: Mapped[list["SessionRole"]] = relationship(back_populates="session")
    game_actions: Mapped[list["GameAction"]] = relationship(back_populates="session")
