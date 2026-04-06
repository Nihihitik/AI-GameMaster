"""Модель роли в игре."""

import uuid

from sqlalchemy import String, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Role(Base):
    """Роль в игре (например: мафия, мирный житель, доктор и т.д.)."""
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Связи
    session_roles: Mapped[list["SessionRole"]] = relationship(back_populates="role")
    player_roles: Mapped[list["PlayerRole"]] = relationship(back_populates="role")
