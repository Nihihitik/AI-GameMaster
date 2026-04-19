"""dev_test_lobby_links for development test lobbies

Revision ID: 20260419_dev_test_lobby_links
Revises: 20260412_extend_roles
Create Date: 2026-04-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260419_dev_test_lobby_links"
down_revision: Union[str, Sequence[str], None] = "20260412_extend_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dev_test_lobby_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slot_number", sa.Integer(), nullable=False),
        sa.Column("player_slug", sa.String(length=32), nullable=False),
        sa.Column("bootstrap_key", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "player_slug", name="uq_dev_test_lobby_links_session_slug"),
        sa.UniqueConstraint("session_id", "slot_number", name="uq_dev_test_lobby_links_session_slot"),
        sa.UniqueConstraint("session_id", "user_id", name="uq_dev_test_lobby_links_session_user"),
    )
    op.create_index(
        "ix_dev_test_lobby_links_session_id",
        "dev_test_lobby_links",
        ["session_id"],
        unique=False,
    )
    op.create_index(
        "ix_dev_test_lobby_links_user_id",
        "dev_test_lobby_links",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_dev_test_lobby_links_user_id", table_name="dev_test_lobby_links")
    op.drop_index("ix_dev_test_lobby_links_session_id", table_name="dev_test_lobby_links")
    op.drop_table("dev_test_lobby_links")
