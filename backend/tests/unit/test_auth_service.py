from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock

import pytest

from services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    delete_user_account,
    hash_password,
    hash_refresh_token,
    refresh_expires_at,
    verify_password,
)


class TestHashPassword:
    def test_returns_bcrypt_string(self):
        h = hash_password("password123")
        assert h.startswith("$2b$")

    def test_different_salts(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2


class TestVerifyPassword:
    def test_correct(self):
        h = hash_password("secret")
        assert verify_password("secret", h) is True

    def test_wrong(self):
        h = hash_password("secret")
        assert verify_password("wrong", h) is False


class TestAccessToken:
    def test_roundtrip(self):
        uid = str(uuid.uuid4())
        token = create_access_token(uid, "test@example.com")
        payload = decode_access_token(token)
        assert payload["sub"] == uid
        assert payload["email"] == "test@example.com"

    def test_has_exp(self):
        token = create_access_token("1", "a@b.com")
        payload = decode_access_token(token)
        assert "exp" in payload

    def test_has_iat(self):
        token = create_access_token("1", "a@b.com")
        payload = decode_access_token(token)
        assert "iat" in payload


class TestRefreshToken:
    def test_length(self):
        token = create_refresh_token()
        assert len(token) == 64

    def test_unique(self):
        t1 = create_refresh_token()
        t2 = create_refresh_token()
        assert t1 != t2


class TestHashRefreshToken:
    def test_is_hex(self):
        h = hash_refresh_token("token123")
        assert len(h) == 64
        int(h, 16)  # should not raise

    def test_deterministic(self):
        assert hash_refresh_token("abc") == hash_refresh_token("abc")

    def test_different_inputs(self):
        assert hash_refresh_token("a") != hash_refresh_token("b")


class TestRefreshExpiresAt:
    def test_30_days(self):
        now = datetime.now(timezone.utc)
        result = refresh_expires_at(now)
        diff = (result - now).days
        assert diff == 30

    def test_default_now(self):
        result = refresh_expires_at()
        now = datetime.now(timezone.utc)
        diff = (result - now).total_seconds()
        assert abs(diff - 30 * 86400) < 5


@pytest.mark.asyncio
async def test_delete_user_account_executes_all_deletes():
    db = Mock()

    class ScalarsResult:
        def all(self):
            return [uuid.uuid4()]

    db.scalars = AsyncMock(return_value=ScalarsResult())
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    await delete_user_account(db, uuid.uuid4())

    assert db.execute.await_count >= 5
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_user_account_no_subscriptions():
    db = Mock()

    class ScalarsResult:
        def all(self):
            return []

    db.scalars = AsyncMock(return_value=ScalarsResult())
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    await delete_user_account(db, uuid.uuid4())

    # No payment delete when no subscriptions
    assert db.execute.await_count >= 4
    db.commit.assert_awaited_once()
