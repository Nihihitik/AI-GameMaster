"""Модель роли в игре."""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Role(Base):
    """Роль в игре (например: мафия, мирный житель, доктор и т.д.)."""
    __tablename__ = "roles"

    __table_args__ = (
        CheckConstraint("team IN ('mafia', 'city', 'maniac')", name="ck_roles_team"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    team: Mapped[str] = mapped_column(String(10), nullable=False)
    abilities: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Связи
    # Связи описаны на стороне других моделей (Role используется как справочник)
    pass
