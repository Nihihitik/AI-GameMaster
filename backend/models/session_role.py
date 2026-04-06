"""Модель роли в сессии."""

import uuid

from sqlalchemy import Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class SessionRole(Base):
    """Конфигурация ролей для конкретной сессии (какие роли и сколько)."""
    __tablename__ = "session_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    # Связи
    session: Mapped["Session"] = relationship(back_populates="session_roles")
    role: Mapped["Role"] = relationship(back_populates="session_roles")
