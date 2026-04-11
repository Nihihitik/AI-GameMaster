"""Модель игровой сессии."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, TIMESTAMP, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from core.database import Base


class Session(Base):
    """Игровая сессия (лобби/партия)."""
    __tablename__ = "sessions"

    __table_args__ = (
        CheckConstraint("status IN ('waiting', 'active', 'finished')", name="ck_sessions_status"),
        CheckConstraint("player_count BETWEEN 5 AND 20", name="ck_sessions_player_count"),
        Index("idx_sessions_host", "host_user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(6), unique=True, nullable=False, index=True)
    host_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    player_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="waiting", nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    # Связи
    host_user: Mapped["User"] = relationship(back_populates="sessions")
    players: Mapped[list["Player"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    phases: Mapped[list["GamePhase"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    events: Mapped[list["GameEvent"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
