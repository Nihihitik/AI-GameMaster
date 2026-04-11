"""rebuild_schema_v2

Revision ID: 20260408_rebuild_schema_v2
Revises: 2001c4cd71c8
Create Date: 2026-04-08

ВНИМАНИЕ: миграция переводит схему со старой MVP на новую спецификацию.
Для простоты и предсказуемости (MVP) делает DROP старых таблиц и создаёт новые.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260408_rebuild_schema_v2"
down_revision: Union[str, Sequence[str], None] = "2001c4cd71c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- Drop old schema (order matters)
    # FK sessions.current_phase_id -> game_phases.id
    op.execute("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS fk_sessions_current_phase_id")

    # Используем IF EXISTS, чтобы миграция была идемпотентнее на окружениях,
    # где часть таблиц уже отсутствует.
    op.execute("DROP TABLE IF EXISTS game_actions CASCADE")
    op.execute("DROP TABLE IF EXISTS player_roles CASCADE")
    op.execute("DROP TABLE IF EXISTS session_roles CASCADE")
    op.execute("DROP TABLE IF EXISTS session_players CASCADE")
    op.execute("DROP TABLE IF EXISTS game_phases CASCADE")
    op.execute("DROP TABLE IF EXISTS sessions CASCADE")
    op.execute("DROP TABLE IF EXISTS roles CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")

    # clean old enums if exist
    op.execute("DROP TYPE IF EXISTS sessionstatus")
    op.execute("DROP TYPE IF EXISTS userplan")

    # ---- New schema (11 tables)
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("idx_users_email", "users", ["email"], unique=False)

    op.create_table(
        "roles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("team", sa.String(length=10), nullable=False),
        sa.Column("abilities", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.CheckConstraint("team IN ('mafia', 'city')", name="ck_roles_team"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=6), nullable=False),
        sa.Column("host_user_id", sa.UUID(), nullable=False),
        sa.Column("player_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="waiting"),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('waiting', 'active', 'finished')", name="ck_sessions_status"),
        sa.CheckConstraint("player_count BETWEEN 5 AND 20", name="ck_sessions_player_count"),
        sa.ForeignKeyConstraint(["host_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("idx_sessions_code", "sessions", ["code"], unique=False)
    op.create_index("idx_sessions_host", "sessions", ["host_user_id"], unique=False)

    op.create_table(
        "players",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=32), nullable=False),
        sa.Column("role_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="alive"),
        sa.Column("join_order", sa.Integer(), nullable=False),
        sa.CheckConstraint("status IN ('alive', 'dead')", name="ck_players_status"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "user_id", name="uq_players_session_user"),
    )
    op.create_index("idx_players_session", "players", ["session_id"], unique=False)
    op.create_index("idx_players_user", "players", ["user_id"], unique=False)

    op.create_table(
        "game_phases",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("phase_type", sa.String(length=15), nullable=False),
        sa.Column("phase_number", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint("phase_type IN ('role_reveal', 'day', 'night')", name="ck_phases_type"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "phase_number", "phase_type", name="uq_phases_session_number_type"),
    )

    op.create_table(
        "night_actions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("phase_id", sa.UUID(), nullable=False),
        sa.Column("actor_player_id", sa.UUID(), nullable=False),
        sa.Column("target_player_id", sa.UUID(), nullable=False),
        sa.Column("action_type", sa.String(length=10), nullable=False),
        sa.Column("was_blocked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.CheckConstraint("action_type IN ('kill', 'check', 'heal')", name="ck_night_actions_type"),
        sa.ForeignKeyConstraint(["actor_player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["phase_id"], ["game_phases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_player_id"], ["players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phase_id", "actor_player_id", name="uq_night_actions_phase_actor"),
    )

    op.create_table(
        "day_votes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("phase_id", sa.UUID(), nullable=False),
        sa.Column("voter_player_id", sa.UUID(), nullable=False),
        sa.Column("target_player_id", sa.UUID(), nullable=True),
        sa.CheckConstraint("voter_player_id != target_player_id", name="ck_day_votes_no_self_vote"),
        sa.ForeignKeyConstraint(["phase_id"], ["game_phases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["voter_player_id"], ["players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phase_id", "voter_player_id", name="uq_day_votes_phase_voter"),
    )

    op.create_table(
        "game_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("phase_id", sa.UUID(), nullable=True),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "event_type IN ("
            "'player_joined', 'player_left', 'game_started', "
            "'role_acknowledged', 'all_acknowledged', 'phase_changed', "
            "'night_action_submitted', 'night_result', 'player_eliminated', "
            "'vote_cast', 'vote_result', 'game_finished', 'session_closed'"
            ")",
            name="ck_game_events_type",
        ),
        sa.ForeignKeyConstraint(["phase_id"], ["game_phases.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_game_events_session_created", "game_events", ["session_id", "created_at"], unique=False)

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("plan", sa.String(length=10), nullable=False),
        sa.Column("period_start", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("period_end", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(length=15), nullable=False),
        sa.CheckConstraint("plan IN ('free', 'pro')", name="ck_subscriptions_plan"),
        sa.CheckConstraint("status IN ('active', 'cancelled', 'expired')", name="ck_subscriptions_status"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_subscriptions_user", "subscriptions", ["user_id"], unique=False)

    op.create_table(
        "payments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("subscription_id", sa.UUID(), nullable=False),
        sa.Column("amount_kopecks", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("provider_payment_id", sa.String(length=255), nullable=True),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=15), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("amount_kopecks > 0", name="ck_payments_amount"),
        sa.CheckConstraint("status IN ('pending', 'succeeded', 'failed', 'refunded')", name="ck_payments_status"),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index(
        "uq_payments_provider_payment_id",
        "payments",
        ["provider_payment_id"],
        unique=True,
        postgresql_where=sa.text("provider_payment_id IS NOT NULL"),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("idx_refresh_tokens_hash", "refresh_tokens", ["token_hash"], unique=False)
    op.create_index("idx_refresh_tokens_user", "refresh_tokens", ["user_id"], unique=False)


def downgrade() -> None:
    # reverse: drop new tables
    op.drop_index("idx_refresh_tokens_user", table_name="refresh_tokens")
    op.drop_index("idx_refresh_tokens_hash", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index("uq_payments_provider_payment_id", table_name="payments")
    op.drop_table("payments")

    op.drop_index("idx_subscriptions_user", table_name="subscriptions")
    op.drop_table("subscriptions")

    op.drop_index("idx_game_events_session_created", table_name="game_events")
    op.drop_table("game_events")

    op.drop_table("day_votes")
    op.drop_table("night_actions")
    op.drop_table("game_phases")

    op.drop_index("idx_players_user", table_name="players")
    op.drop_index("idx_players_session", table_name="players")
    op.drop_table("players")

    op.drop_index("idx_sessions_host", table_name="sessions")
    op.drop_index("idx_sessions_code", table_name="sessions")
    op.drop_table("sessions")

    op.drop_table("roles")

    op.drop_index("idx_users_email", table_name="users")
    op.drop_table("users")

