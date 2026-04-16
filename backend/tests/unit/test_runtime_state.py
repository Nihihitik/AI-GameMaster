from __future__ import annotations

import asyncio
import uuid

import pytest

from services.runtime_state import RuntimeState, SessionRuntime


def test_session_runtime_defaults():
    rt = SessionRuntime()
    assert rt.day_sub_phase is None
    assert rt.night_turn is None
    assert rt.timer_name is None
    assert rt.game_paused is False
    assert rt.phase_transition_depth == 0
    assert isinstance(rt.blocked_tonight, set)
    assert len(rt.blocked_tonight) == 0


def test_session_runtime_night_action_event():
    rt = SessionRuntime()
    assert isinstance(rt.night_action_event, asyncio.Event)


def test_get_creates_new():
    rs = RuntimeState()
    sid = uuid.uuid4()
    rt = rs.get(sid)
    assert isinstance(rt, SessionRuntime)


def test_get_returns_same_instance():
    rs = RuntimeState()
    sid = uuid.uuid4()
    assert rs.get(sid) is rs.get(sid)


def test_get_different_sessions():
    rs = RuntimeState()
    s1, s2 = uuid.uuid4(), uuid.uuid4()
    assert rs.get(s1) is not rs.get(s2)


def test_clear_removes():
    rs = RuntimeState()
    sid = uuid.uuid4()
    old = rs.get(sid)
    rs.clear(sid)
    new = rs.get(sid)
    assert old is not new


def test_clear_nonexistent_no_error():
    rs = RuntimeState()
    rs.clear(uuid.uuid4())  # no error
