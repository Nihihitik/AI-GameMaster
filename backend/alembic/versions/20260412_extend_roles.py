"""extend_roles: новые роли (don, lover, maniac) и типы ночных действий

Revision ID: 20260412_extend_roles
Revises: 20260409_users_display_name
Create Date: 2026-04-12

Расширяет CHECK-констрейнты на `roles.team` и `night_actions.action_type`
для поддержки новых ролей (дон, любовница, маньяк) и их ночных действий
(don_check, lover_visit, maniac_kill).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260412_extend_roles"
down_revision: Union[str, Sequence[str], None] = "20260409_users_display_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- roles.team: добавляем 'maniac'
    op.execute("ALTER TABLE roles DROP CONSTRAINT IF EXISTS ck_roles_team")
    op.execute(
        "ALTER TABLE roles ADD CONSTRAINT ck_roles_team "
        "CHECK (team IN ('mafia', 'city', 'maniac'))"
    )

    # --- night_actions.action_type: добавляем don_check / lover_visit / maniac_kill
    op.execute("ALTER TABLE night_actions DROP CONSTRAINT IF EXISTS ck_night_actions_type")
    # Новые значения ('maniac_kill' = 11 символов) не помещаются в String(10),
    # поэтому расширяем колонку до String(15).
    op.alter_column(
        "night_actions",
        "action_type",
        existing_type=sa.String(length=10),
        type_=sa.String(length=15),
        existing_nullable=False,
    )
    op.execute(
        "ALTER TABLE night_actions ADD CONSTRAINT ck_night_actions_type "
        "CHECK (action_type IN ("
        "'kill', 'check', 'heal', 'don_check', 'lover_visit', 'maniac_kill'"
        "))"
    )


def downgrade() -> None:
    # Откат до исходного набора.
    # ВНИМАНИЕ: downgrade может упасть, если в таблицах уже есть строки
    # с новыми значениями (например, роль 'maniac'). Это ожидаемо — перед
    # откатом нужно вручную очистить такие данные.
    op.execute("ALTER TABLE night_actions DROP CONSTRAINT IF EXISTS ck_night_actions_type")
    op.alter_column(
        "night_actions",
        "action_type",
        existing_type=sa.String(length=15),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
    op.execute(
        "ALTER TABLE night_actions ADD CONSTRAINT ck_night_actions_type "
        "CHECK (action_type IN ('kill', 'check', 'heal'))"
    )

    op.execute("ALTER TABLE roles DROP CONSTRAINT IF EXISTS ck_roles_team")
    op.execute(
        "ALTER TABLE roles ADD CONSTRAINT ck_roles_team "
        "CHECK (team IN ('mafia', 'city'))"
    )
