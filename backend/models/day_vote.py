"""Дневные голоса."""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class DayVote(Base):
    __tablename__ = "day_votes"

    __table_args__ = (
        UniqueConstraint("phase_id", "voter_player_id", name="uq_day_votes_phase_voter"),
        CheckConstraint("voter_player_id != target_player_id", name="ck_day_votes_no_self_vote"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("game_phases.id", ondelete="CASCADE"),
        nullable=False,
    )
    voter_player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id"), nullable=False
    )
    target_player_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id"), nullable=True
    )

    phase: Mapped["GamePhase"] = relationship(back_populates="day_votes")
    voter: Mapped["Player"] = relationship(foreign_keys=[voter_player_id])
    target: Mapped["Player | None"] = relationship(foreign_keys=[target_player_id])

