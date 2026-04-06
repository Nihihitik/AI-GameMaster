"""Модель пользователя."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class UserPlan(str, enum.Enum):
    """Тарифный план пользователя."""
    FREE = "free"
    PREMIUM = "premium"


class User(Base):
    """Пользователь системы."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hash_password: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[UserPlan] = mapped_column(
        Enum(UserPlan), default=UserPlan.FREE, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Связи
    sessions: Mapped[list["Session"]] = relationship(back_populates="owner")
    session_players: Mapped[list["SessionPlayer"]] = relationship(back_populates="user")
