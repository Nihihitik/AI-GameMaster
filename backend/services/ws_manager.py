"""WS connection manager: хранит соединения и рассылает сообщения по сессии/пользователю."""

from __future__ import annotations

import uuid
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: dict[uuid.UUID, dict[uuid.UUID, WebSocket]] = defaultdict(dict)

    async def connect(self, session_id: uuid.UUID, user_id: uuid.UUID, ws: WebSocket):
        await ws.accept()
        self._connections[session_id][user_id] = ws

    async def disconnect(self, session_id: uuid.UUID, user_id: uuid.UUID):
        self._connections.get(session_id, {}).pop(user_id, None)
        if session_id in self._connections and not self._connections[session_id]:
            del self._connections[session_id]

    async def send_to_session(self, session_id: uuid.UUID, message: dict):
        for ws in list(self._connections.get(session_id, {}).values()):
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def send_to_user(self, session_id: uuid.UUID, user_id: uuid.UUID, message: dict):
        ws = self._connections.get(session_id, {}).get(user_id)
        if not ws:
            return
        try:
            await ws.send_json(message)
        except Exception:
            pass

    async def close_connection(self, session_id: uuid.UUID, user_id: uuid.UUID, code: int = 1000):
        ws = self._connections.get(session_id, {}).get(user_id)
        if ws:
            try:
                await ws.close(code=code)
            except Exception:
                pass
        await self.disconnect(session_id, user_id)

    async def close_session(self, session_id: uuid.UUID, code: int = 1000):
        connections = self._connections.pop(session_id, {})
        for ws in connections.values():
            try:
                await ws.close(code=code)
            except Exception:
                pass


ws_manager = ConnectionManager()

