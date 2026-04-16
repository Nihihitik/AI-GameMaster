from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest


class ScalarsResult:
    """Mock wrapper for db.scalars(...) return value."""
    def __init__(self, items):
        self._items = items
    def all(self):
        return self._items
    def __iter__(self):
        return iter(self._items)


@pytest.fixture
def mock_db():
    db = Mock()
    db.scalar = AsyncMock(return_value=None)
    db.scalars = AsyncMock(return_value=ScalarsResult([]))
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.add = Mock()
    db.delete = AsyncMock()
    db.get = AsyncMock(return_value=None)
    db.expire_all = Mock()
    return db


@pytest.fixture
def mock_ws():
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    ws.close = AsyncMock()
    return ws


def _make_ns(**kwargs):
    return SimpleNamespace(**kwargs)


@pytest.fixture
def make_session():
    from models.session import Session
    def _factory(*, id=None, status="active", settings=None, host_user_id=None, code="ABC123", player_count=6):
        s = Session.__new__(Session)
        s.id = id or uuid.uuid4()
        s.status = status
        s.settings = settings or {}
        s.host_user_id = host_user_id or uuid.uuid4()
        s.code = code
        s.player_count = player_count
        s.created_at = None
        s.ended_at = None
        return s
    return _factory


@pytest.fixture
def make_player():
    from models.player import Player
    def _factory(*, id=None, session_id=None, user_id=None, role_id=None, status="alive", name="Player", join_order=1):
        p = Player.__new__(Player)
        p.id = id or uuid.uuid4()
        p.session_id = session_id or uuid.uuid4()
        p.user_id = user_id or uuid.uuid4()
        p.role_id = role_id
        p.status = status
        p.name = name
        p.join_order = join_order
        return p
    return _factory


@pytest.fixture
def make_role():
    from models.role import Role
    def _factory(*, id=None, slug="civilian", name="\u041c\u0438\u0440\u043d\u044b\u0439", team="city", abilities=None):
        r = Role.__new__(Role)
        r.id = id or uuid.uuid4()
        r.slug = slug
        r.name = name
        r.team = team
        r.abilities = abilities or {}
        return r
    return _factory


@pytest.fixture
def make_phase():
    from models.game_phase import GamePhase
    def _factory(*, id=None, session_id=None, phase_type="night", phase_number=1, started_at=None, ended_at=None):
        p = GamePhase.__new__(GamePhase)
        p.id = id or uuid.uuid4()
        p.session_id = session_id or uuid.uuid4()
        p.phase_type = phase_type
        p.phase_number = phase_number
        p.started_at = started_at
        p.ended_at = ended_at
        return p
    return _factory


class FakeAsyncContext:
    """Replacement for `async with async_session_factory() as db`."""
    def __init__(self, value):
        self.value = value
    async def __aenter__(self):
        return self.value
    async def __aexit__(self, exc_type, exc, tb):
        return False
