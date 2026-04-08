from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_openapi_available():
    # Тест не требует реальной БД: просто проверяем, что Swagger/OpenAPI генерится
    # и приложение импортируется без скрытых ошибок подключения роутеров.
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/openapi.json")
        assert r.status_code == 200
        data = r.json()
        assert "paths" in data
        assert "/api/auth/register" in data["paths"]
