from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from services import recovery_service


class _FakeContext:
    def __init__(self, value):
        self.value = value

    async def __aenter__(self):
        return self.value

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_recover_missing_phase_moves_role_reveal_to_first_night(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = SimpleNamespace()
    latest_phase = SimpleNamespace(phase_type="role_reveal", phase_number=0)

    monkeypatch.setattr(recovery_service, "async_session_factory", lambda: _FakeContext(db))
    monkeypatch.setattr(
        recovery_service,
        "restore_runtime_like_fields",
        AsyncMock(return_value={"sub_phase": None}),
    )
    to_night = AsyncMock()
    monkeypatch.setattr(recovery_service, "transition_to_night", to_night)
    monkeypatch.setattr(recovery_service, "transition_to_day", AsyncMock())
    monkeypatch.setattr(recovery_service, "transition_to_voting", AsyncMock())

    await recovery_service._recover_missing_phase("session-1", latest_phase)

    to_night.assert_awaited_once_with("session-1", 1)


@pytest.mark.asyncio
async def test_recover_missing_phase_continues_after_finished_day_voting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = SimpleNamespace()
    latest_phase = SimpleNamespace(phase_type="day", phase_number=2)

    monkeypatch.setattr(recovery_service, "async_session_factory", lambda: _FakeContext(db))
    monkeypatch.setattr(
        recovery_service,
        "restore_runtime_like_fields",
        AsyncMock(return_value={"sub_phase": "voting"}),
    )
    to_night = AsyncMock()
    monkeypatch.setattr(recovery_service, "transition_to_night", to_night)
    monkeypatch.setattr(recovery_service, "transition_to_day", AsyncMock())
    monkeypatch.setattr(recovery_service, "transition_to_voting", AsyncMock())

    await recovery_service._recover_missing_phase("session-1", latest_phase)

    to_night.assert_awaited_once_with("session-1", 3)
