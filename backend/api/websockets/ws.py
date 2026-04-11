"""WebSocket endpoint для push-событий сессии.

Подключение: `/ws/sessions/{session_id}?token={access_token}`
WS используется для синхронизации и триггеров озвучки; действия игроки отправляют через REST.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, WebSocket
from fastapi.websockets import WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select

from core.database import async_session_factory
from models.player import Player
from services.auth_service import decode_access_token
from services.ws_manager import ws_manager


router = APIRouter()


@router.websocket("/sessions/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: uuid.UUID,
    token: str = Query(...),
):
    try:
        payload = decode_access_token(token)
    except JWTError:
        await websocket.close(code=4001)
        return

    try:
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        await websocket.close(code=4001)
        return

    async with async_session_factory() as db:
        player = await db.scalar(
            select(Player.id).where(Player.session_id == session_id, Player.user_id == user_id)
        )
    if not player:
        await websocket.close(code=4003)
        return

    await ws_manager.connect(session_id, user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong", "payload": {}})
    except WebSocketDisconnect:
        await ws_manager.disconnect(session_id, user_id)

