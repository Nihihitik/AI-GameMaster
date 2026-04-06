"""initial_models

Revision ID: 2001c4cd71c8
Revises:
Create Date: 2026-04-06 14:07:33.527372

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2001c4cd71c8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Independent tables
    op.create_table('users',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('hash_password', sa.String(length=255), nullable=False),
    sa.Column('plan', sa.Enum('FREE', 'PREMIUM', name='userplan'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('roles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('type', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    # 2. Sessions without current_phase_id FK (added later due to circular dep)
    op.create_table('sessions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('code', sa.String(length=50), nullable=False),
    sa.Column('max_players', sa.Integer(), nullable=False),
    sa.Column('owner_id', sa.UUID(), nullable=False),
    sa.Column('status', sa.Enum('WAITING', 'IN_PROGRESS', 'FINISHED', name='sessionstatus'), nullable=False),
    sa.Column('current_phase_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code')
    )

    # 3. Game phases (depends on sessions)
    op.create_table('game_phases',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('phase_order', sa.Integer(), nullable=False),
    sa.Column('phase_type', sa.String(length=100), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # 4. Add circular FK: sessions.current_phase_id -> game_phases.id
    op.create_foreign_key(
        'fk_sessions_current_phase_id',
        'sessions', 'game_phases',
        ['current_phase_id'], ['id'],
    )

    # 5. Tables depending on sessions + users
    op.create_table('session_players',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('session_roles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('role_id', sa.UUID(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
    sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # 6. Player roles (depends on session_players + roles)
    op.create_table('player_roles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('session_player_id', sa.UUID(), nullable=False),
    sa.Column('role_id', sa.UUID(), nullable=False),
    sa.Column('is_alive', sa.Boolean(), nullable=False),
    sa.Column('is_awake', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
    sa.ForeignKeyConstraint(['session_player_id'], ['session_players.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # 7. Game actions (depends on sessions, game_phases, player_roles)
    op.create_table('game_actions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('phase_id', sa.UUID(), nullable=False),
    sa.Column('actor_player_id', sa.UUID(), nullable=False),
    sa.Column('target_player_id', sa.UUID(), nullable=True),
    sa.Column('action_type', sa.String(length=100), nullable=False),
    sa.Column('result', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['actor_player_id'], ['player_roles.id'], ),
    sa.ForeignKeyConstraint(['phase_id'], ['game_phases.id'], ),
    sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
    sa.ForeignKeyConstraint(['target_player_id'], ['player_roles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('game_actions')
    op.drop_table('player_roles')
    op.drop_table('session_roles')
    op.drop_table('session_players')
    op.drop_constraint('fk_sessions_current_phase_id', 'sessions', type_='foreignkey')
    op.drop_table('game_phases')
    op.drop_table('sessions')
    op.drop_table('roles')
    op.drop_table('users')
