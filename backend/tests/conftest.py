from __future__ import annotations

import asyncio
import os

import pytest


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
def _set_test_env():
    # Позволяет запускать тесты локально без лишних сюрпризов.
    os.environ.setdefault("SECRET_KEY", "test-secret-key-32-characters-minimum!!")

