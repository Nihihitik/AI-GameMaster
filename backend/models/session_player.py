"""Модель участника сессии."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class SessionPlayer(Base):
    """Связь пользователя с игровой сессией (участник партии)."""
    __tablename__ = "session_players"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Связи
    session: Mapped["Session"] = relationship(back_populates="session_players")
    user: Mapped["User"] = relationship(back_populates="session_players")
    player_roles: Mapped[list["PlayerRole"]] = relationship(back_populates="session_player")
