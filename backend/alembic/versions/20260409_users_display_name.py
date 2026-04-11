"""users.display_name (ник в игре)

Revision ID: 20260409_users_display_name
Revises: 20260408_rebuild_schema_v2
Create Date: 2026-04-09
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260409_users_display_name"
down_revision: Union[str, Sequence[str], None] = "20260408_rebuild_schema_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("display_name", sa.String(length=32), nullable=False, server_default="Игрок"),
    )
    op.alter_column("users", "display_name", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "display_name")
