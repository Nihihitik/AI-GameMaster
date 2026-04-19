"""Dev-only bootstrap links for synthetic test lobby players."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, TIMESTAMP, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class DevTestLobbyLink(Base):
    __tablename__ = "dev_test_lobby_links"

    __table_args__ = (
        UniqueConstraint("session_id", "slot_number", name="uq_dev_test_lobby_links_session_slot"),
        UniqueConstraint("session_id", "player_slug", name="uq_dev_test_lobby_links_session_slug"),
        UniqueConstraint("session_id", "user_id", name="uq_dev_test_lobby_links_session_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slot_number: Mapped[int] = mapped_column(Integer, nullable=False)
    player_slug: Mapped[str] = mapped_column(String(32), nullable=False)
    bootstrap_key: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
