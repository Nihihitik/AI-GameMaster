from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from services.dev_test_lobby_service import build_session_detail_response


class _ScalarsResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


@pytest.mark.asyncio
async def test_build_session_detail_response_exposes_player_links_to_host(make_session, make_player):
    host_user_id = uuid.uuid4()
    guest_user_id = uuid.uuid4()
    session = make_session(
        id=uuid.uuid4(),
        status="waiting",
        settings={"dev_test_lobby": True},
        host_user_id=host_user_id,
        code="DEV123",
        player_count=5,
    )
    session.created_at = datetime.now(timezone.utc)
    session.players = [
        make_player(session_id=session.id, user_id=host_user_id, join_order=1, name="Host"),
        make_player(session_id=session.id, user_id=guest_user_id, join_order=2, name="Player 2"),
    ]

    db = Mock()
    db.scalars = AsyncMock(
        return_value=_ScalarsResult(
            [
                SimpleNamespace(user_id=host_user_id, slot_number=1, player_slug="player1", bootstrap_key="host"),
                SimpleNamespace(user_id=guest_user_id, slot_number=2, player_slug="player2", bootstrap_key="secret-2"),
            ]
        )
    )

    result = await build_session_detail_response(db, session, host_user_id)

    assert result.dev_lobby is not None
    assert result.dev_lobby.is_test_lobby is True
    assert result.dev_lobby.player_links is not None
    assert [link.player_slug for link in result.dev_lobby.player_links] == ["player1", "player2"]
    assert result.dev_lobby.player_links[0].url == "/sessions/DEV123"
    assert result.dev_lobby.player_links[1].url == "/sessions/DEV123/player2?devKey=secret-2"


@pytest.mark.asyncio
async def test_build_session_detail_response_hides_player_links_from_non_host(make_session, make_player):
    host_user_id = uuid.uuid4()
    guest_user_id = uuid.uuid4()
    session = make_session(
        id=uuid.uuid4(),
        status="waiting",
        settings={"dev_test_lobby": True},
        host_user_id=host_user_id,
        code="DEV123",
        player_count=5,
    )
    session.created_at = datetime.now(timezone.utc)
    session.players = [
        make_player(session_id=session.id, user_id=host_user_id, join_order=1, name="Host"),
        make_player(session_id=session.id, user_id=guest_user_id, join_order=2, name="Player 2"),
    ]

    db = Mock()
    db.scalars = AsyncMock()

    result = await build_session_detail_response(db, session, guest_user_id)

    assert result.dev_lobby is not None
    assert result.dev_lobby.is_test_lobby is True
    assert result.dev_lobby.player_links is None
    db.scalars.assert_not_awaited()
