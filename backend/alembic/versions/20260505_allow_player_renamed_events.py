"""allow player_renamed game events

Revision ID: 20260505_player_renamed
Revises: 20260419_dev_test_lobby_links
Create Date: 2026-05-05
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op


revision: str = "20260505_player_renamed"
down_revision: Union[str, Sequence[str], None] = "20260419_dev_test_lobby_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EVENT_TYPES_WITH_RENAME = (
    "'player_joined', 'player_left', 'game_started', "
    "'player_renamed', "
    "'role_acknowledged', 'all_acknowledged', 'phase_changed', "
    "'night_action_submitted', 'night_result', 'player_eliminated', "
    "'vote_cast', 'vote_result', 'game_finished', 'session_closed'"
)

EVENT_TYPES_WITHOUT_RENAME = (
    "'player_joined', 'player_left', 'game_started', "
    "'role_acknowledged', 'all_acknowledged', 'phase_changed', "
    "'night_action_submitted', 'night_result', 'player_eliminated', "
    "'vote_cast', 'vote_result', 'game_finished', 'session_closed'"
)


def upgrade() -> None:
    op.execute("ALTER TABLE game_events DROP CONSTRAINT IF EXISTS ck_game_events_type")
    op.execute(
        "ALTER TABLE game_events ADD CONSTRAINT ck_game_events_type "
        f"CHECK (event_type IN ({EVENT_TYPES_WITH_RENAME}))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE game_events DROP CONSTRAINT IF EXISTS ck_game_events_type")
    op.execute(
        "ALTER TABLE game_events ADD CONSTRAINT ck_game_events_type "
        f"CHECK (event_type IN ({EVENT_TYPES_WITHOUT_RENAME}))"
    )
