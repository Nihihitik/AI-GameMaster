from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from services.state_service import parse_iso_dt


def _fake_phase(**kwargs):
    defaults = dict(id=uuid.uuid4(), session_id=uuid.uuid4(), phase_type="night", phase_number=1, started_at=None, ended_at=None)
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_parse_iso_dt_valid():
    result = parse_iso_dt("2024-01-01T00:00:00+00:00")
    assert isinstance(result, datetime)


def test_parse_iso_dt_zulu():
    result = parse_iso_dt("2024-01-01T00:00:00Z")
    assert isinstance(result, datetime)


def test_parse_iso_dt_none():
    assert parse_iso_dt(None) is None


def test_parse_iso_dt_empty():
    assert parse_iso_dt("") is None


def test_parse_iso_dt_garbage():
    assert parse_iso_dt("not-a-date") is None


@pytest.mark.asyncio
async def test_restore_returns_empty_when_no_phase():
    from services.state_service import restore_runtime_like_fields

    db = Mock()
    result = await restore_runtime_like_fields(db, uuid.uuid4(), None)
    assert result["sub_phase"] is None
    assert result["night_turn"] is None
    assert result["timer_name"] is None


@pytest.mark.asyncio
async def test_restore_returns_empty_when_no_event():
    from services.state_service import restore_runtime_like_fields

    db = Mock()
    # get_last_phase_changed_event returns None, then last_night_result returns None
    db.scalar = AsyncMock(side_effect=[None, None])
    phase = _fake_phase(phase_type="day")
    result = await restore_runtime_like_fields(db, phase.session_id, phase)
    assert result["sub_phase"] is None


@pytest.mark.asyncio
async def test_restore_extracts_sub_phase():
    from services.state_service import restore_runtime_like_fields

    event = SimpleNamespace(
        payload={"sub_phase": "discussion", "timer_seconds": 60, "timer_started_at": "2024-01-01T00:00:00Z"},
        created_at=datetime.now(timezone.utc),
    )
    db = Mock()
    # Calls: get_last_phase_changed_event, last_night_result, get_last_announcement_event (announcement is None)
    db.scalar = AsyncMock(side_effect=[event, None, None])
    phase = _fake_phase(phase_type="day")

    result = await restore_runtime_like_fields(db, phase.session_id, phase)
    assert result["sub_phase"] == "discussion"
    assert result["timer_name"] == "discussion"
    assert result["timer_seconds"] == 60


@pytest.mark.asyncio
async def test_restore_infers_night_timer_name():
    from services.state_service import restore_runtime_like_fields

    event = SimpleNamespace(
        payload={"night_turn": "mafia", "timer_seconds": 30, "timer_started_at": "2024-01-01T00:00:00Z"},
        created_at=datetime.now(timezone.utc),
    )
    db = Mock()
    # Calls: get_last_phase_changed_event, last_night_result, get_last_announcement_event (announcement is None)
    db.scalar = AsyncMock(side_effect=[event, None, None])
    phase = _fake_phase(phase_type="night")

    result = await restore_runtime_like_fields(db, phase.session_id, phase)
    assert result["night_turn"] == "mafia"
    assert result["timer_name"] == "night_mafia"
