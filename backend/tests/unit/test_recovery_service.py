from __future__ import annotations

import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock
import types

import pytest
from sqlalchemy.orm import DeclarativeBase

fastapi_stub = types.ModuleType("fastapi")
fastapi_stub.Request = object
fastapi_stub.WebSocket = object
fastapi_responses_stub = types.ModuleType("fastapi.responses")
fastapi_responses_stub.JSONResponse = object
pydantic_stub = types.ModuleType("pydantic")
pydantic_stub.Field = lambda default=None, **kwargs: default
pydantic_settings_stub = types.ModuleType("pydantic_settings")


class _BaseSettings:
    def __init__(self, **kwargs):
        for name, value in self.__class__.__dict__.items():
            if name.startswith("_") or isinstance(value, property) or callable(value):
                continue
            setattr(self, name, kwargs.get(name, value))


pydantic_settings_stub.BaseSettings = _BaseSettings
pydantic_settings_stub.SettingsConfigDict = dict
core_database_stub = types.ModuleType("core.database")


class _Base(DeclarativeBase):
    pass


core_database_stub.Base = _Base
core_database_stub.async_session_factory = object()
core_database_stub.async_session_maker = object()

sys.modules.setdefault("fastapi", fastapi_stub)
sys.modules.setdefault("fastapi.responses", fastapi_responses_stub)
sys.modules.setdefault("pydantic", pydantic_stub)
sys.modules.setdefault("pydantic_settings", pydantic_settings_stub)
sys.modules.setdefault("core.database", core_database_stub)

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
