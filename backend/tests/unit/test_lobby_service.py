from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from services.lobby_service import handle_player_left


def _fake_session(*, host_user_id, status="waiting", session_id=None):
    return SimpleNamespace(
        id=session_id or uuid.uuid4(),
        host_user_id=host_user_id,
        status=status,
    )


def _fake_player(*, user_id, join_order, name, player_id=None, session_id=None):
    return SimpleNamespace(
        id=player_id or uuid.uuid4(),
        user_id=user_id,
        join_order=join_order,
        name=name,
        session_id=session_id or uuid.uuid4(),
    )


def _scalar_side_effect(*values):
    """Возвращает значения из `values` по очереди при вызовах db.scalar."""
    iterator = iter(values)

    async def _scalar(_query):
        return next(iterator)

    return _scalar


@pytest.mark.asyncio
async def test_handle_player_left_deletes_empty_session():
    host_uid = uuid.uuid4()
    session = _fake_session(host_user_id=host_uid)

    db = Mock()
    db.scalar = AsyncMock(side_effect=_scalar_side_effect(0))
    db.delete = AsyncMock()
    db.commit = AsyncMock()

    outcome = await handle_player_left(db, session, host_uid)

    assert outcome.session_deleted is True
    assert outcome.host_transferred is False
    db.delete.assert_awaited_once_with(session)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_handle_player_left_transfers_host_to_min_join_order():
    host_uid = uuid.uuid4()
    session = _fake_session(host_user_id=host_uid)

    new_host = _fake_player(
        user_id=uuid.uuid4(),
        join_order=2,
        name="Bob",
        session_id=session.id,
    )

    db = Mock()
    db.scalar = AsyncMock(side_effect=_scalar_side_effect(1, new_host))
    db.delete = AsyncMock()
    db.commit = AsyncMock()

    outcome = await handle_player_left(db, session, host_uid)

    assert outcome.session_deleted is False
    assert outcome.host_transferred is True
    assert outcome.new_host_user_id == new_host.user_id
    assert outcome.new_host_player_id == new_host.id
    assert outcome.new_host_name == "Bob"
    assert session.host_user_id == new_host.user_id
    db.delete.assert_not_awaited()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_handle_player_left_non_host_does_not_transfer():
    host_uid = uuid.uuid4()
    other_uid = uuid.uuid4()
    session = _fake_session(host_user_id=host_uid)

    db = Mock()
    db.scalar = AsyncMock(side_effect=_scalar_side_effect(3))
    db.delete = AsyncMock()
    db.commit = AsyncMock()

    outcome = await handle_player_left(db, session, other_uid)

    assert outcome.session_deleted is False
    assert outcome.host_transferred is False
    assert session.host_user_id == host_uid
    db.delete.assert_not_awaited()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_handle_player_left_host_leaves_with_no_remaining_found():
    """Race-safety: count>0, но SELECT вернул None — сессию удаляем."""
    host_uid = uuid.uuid4()
    session = _fake_session(host_user_id=host_uid, status="finished")

    db = Mock()
    db.scalar = AsyncMock(side_effect=_scalar_side_effect(1, None))
    db.delete = AsyncMock()
    db.commit = AsyncMock()

    outcome = await handle_player_left(db, session, host_uid)

    assert outcome.session_deleted is True
    assert outcome.host_transferred is False
    db.delete.assert_awaited_once_with(session)
