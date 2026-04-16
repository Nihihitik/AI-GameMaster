from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from api.deps import get_player_or_404, get_session_or_404, has_active_pro, require_host
from core.exceptions import GameError


def _fake_session(**kwargs):
    defaults = dict(id=uuid.uuid4(), status="active", settings={}, host_user_id=uuid.uuid4(), code="ABC123")
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _fake_player(**kwargs):
    defaults = dict(id=uuid.uuid4(), session_id=uuid.uuid4(), user_id=uuid.uuid4(), role_id=None, status="alive", name="Player")
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_get_session_or_404_returns_session():
    session = _fake_session()
    db = Mock()
    db.get = AsyncMock(return_value=session)
    result = await get_session_or_404(db, session.id)
    assert result is session


@pytest.mark.asyncio
async def test_get_session_or_404_raises_on_missing():
    db = Mock()
    db.get = AsyncMock(return_value=None)
    with pytest.raises(GameError) as exc:
        await get_session_or_404(db, uuid.uuid4())
    assert exc.value.status_code == 404
    assert exc.value.code == "session_not_found"


@pytest.mark.asyncio
async def test_get_player_or_404_returns_player():
    player = _fake_player()
    db = Mock()
    db.scalar = AsyncMock(return_value=player)
    result = await get_player_or_404(db, player.session_id, player.user_id)
    assert result is player


@pytest.mark.asyncio
async def test_get_player_or_404_raises_on_missing():
    db = Mock()
    db.scalar = AsyncMock(return_value=None)
    with pytest.raises(GameError) as exc:
        await get_player_or_404(db, uuid.uuid4(), uuid.uuid4())
    assert exc.value.status_code == 404
    assert exc.value.code == "player_not_found"


def test_require_host_passes():
    uid = uuid.uuid4()
    session = _fake_session(host_user_id=uid)
    require_host(session, uid)  # no error


def test_require_host_raises():
    session = _fake_session(host_user_id=uuid.uuid4())
    with pytest.raises(GameError) as exc:
        require_host(session, uuid.uuid4())
    assert exc.value.status_code == 403
    assert exc.value.code == "not_host"


@pytest.mark.asyncio
async def test_has_active_pro_true():
    db = Mock()
    db.scalar = AsyncMock(return_value=uuid.uuid4())
    assert await has_active_pro(db, uuid.uuid4()) is True


@pytest.mark.asyncio
async def test_has_active_pro_false():
    db = Mock()
    db.scalar = AsyncMock(return_value=None)
    assert await has_active_pro(db, uuid.uuid4()) is False
