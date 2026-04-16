from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, Mock

import pytest

from core.exceptions import GameError
from services.session_service import generate_unique_code, validate_role_config


@pytest.mark.asyncio
async def test_generate_unique_code_6_chars():
    db = Mock()
    db.scalar = AsyncMock(return_value=None)
    code = await generate_unique_code(db)
    assert len(code) == 6
    assert code.isalnum()
    assert code == code.upper()


@pytest.mark.asyncio
async def test_generate_unique_code_retries_on_collision():
    db = Mock()
    db.scalar = AsyncMock(side_effect=[uuid.uuid4(), None])
    code = await generate_unique_code(db)
    assert len(code) == 6
    assert db.scalar.await_count == 2


@pytest.mark.asyncio
async def test_generate_unique_code_raises_after_max_retries():
    db = Mock()
    db.scalar = AsyncMock(return_value=uuid.uuid4())
    with pytest.raises(GameError) as exc:
        await generate_unique_code(db)
    assert exc.value.code == "internal_error"


def test_validate_role_config_valid():
    civilian = validate_role_config(6, {"mafia": 2, "don": 0, "sheriff": 1, "doctor": 1, "lover": 0, "maniac": 0})
    assert civilian == 2


def test_validate_role_config_no_mafia_raises():
    with pytest.raises(GameError) as exc:
        validate_role_config(6, {"mafia": 0, "don": 0, "sheriff": 0, "doctor": 0, "lover": 0, "maniac": 0})
    assert exc.value.code == "invalid_role_config"


def test_validate_role_config_mafia_ge_city_raises():
    with pytest.raises(GameError) as exc:
        validate_role_config(6, {"mafia": 3, "don": 0, "sheriff": 0, "doctor": 0, "lover": 0, "maniac": 0})
    assert exc.value.code == "invalid_role_config"


def test_validate_role_config_negative_civilian_raises():
    with pytest.raises(GameError) as exc:
        validate_role_config(5, {"mafia": 1, "don": 1, "sheriff": 1, "doctor": 1, "lover": 1, "maniac": 1})
    assert exc.value.code == "invalid_role_config"
