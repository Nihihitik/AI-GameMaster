"""WS connection manager: хранит соединения и рассылает сообщения по сессии/пользователю."""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections import defaultdict

from fastapi import WebSocket
from core.logging import log_event

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._connections: dict[uuid.UUID, dict[uuid.UUID, WebSocket]] = defaultdict(dict)

    async def connect(self, session_id: uuid.UUID, user_id: uuid.UUID, ws: WebSocket):
        await ws.accept()
        self._connections[session_id][user_id] = ws
        log_event(logger, logging.INFO, "ws.connected", "WebSocket connected", session_id=str(session_id), user_id=str(user_id))

    async def disconnect(self, session_id: uuid.UUID, user_id: uuid.UUID):
        self._connections.get(session_id, {}).pop(user_id, None)
        if session_id in self._connections and not self._connections[session_id]:
            del self._connections[session_id]
        log_event(logger, logging.INFO, "ws.disconnected", "WebSocket disconnected", session_id=str(session_id), user_id=str(user_id))

    async def send_to_session(self, session_id: uuid.UUID, message: dict):
        connections = list(self._connections.get(session_id, {}).items())
        if not connections:
            return

        async def _send(user_id: uuid.UUID, ws: WebSocket) -> uuid.UUID | None:
            try:
                await ws.send_json(message)
                return None
            except Exception:
                log_event(
                    logger,
                    logging.WARNING,
                    "ws.stale_connection",
                    "Failed to broadcast over stale WebSocket",
                    session_id=str(session_id),
                    user_id=str(user_id),
                )
                return user_id

        results = await asyncio.gather(*(_send(uid, ws) for uid, ws in connections))
        for user_id in results:
            if user_id is not None:
                await self.disconnect(session_id, user_id)

    async def send_to_user(self, session_id: uuid.UUID, user_id: uuid.UUID, message: dict):
        ws = self._connections.get(session_id, {}).get(user_id)
        if not ws:
            return
        try:
            await ws.send_json(message)
        except Exception:
            log_event(
                logger,
                logging.WARNING,
                "ws.stale_connection",
                "Failed to send to stale WebSocket",
                session_id=str(session_id),
                user_id=str(user_id),
            )
            await self.disconnect(session_id, user_id)

    async def close_connection(self, session_id: uuid.UUID, user_id: uuid.UUID, code: int = 1000):
        ws = self._connections.get(session_id, {}).get(user_id)
        if ws:
            try:
                await ws.close(code=code)
            except Exception:
                log_event(
                    logger,
                    logging.WARNING,
                    "ws.stale_connection",
                    "Failed to close WebSocket connection cleanly",
                    session_id=str(session_id),
                    user_id=str(user_id),
                )
        await self.disconnect(session_id, user_id)

    async def close_session(self, session_id: uuid.UUID, code: int = 1000):
        connections = self._connections.pop(session_id, {})
        for ws in connections.values():
            try:
                await ws.close(code=code)
            except Exception:
                log_event(
                    logger,
                    logging.WARNING,
                    "ws.stale_connection",
                    "Failed to close WebSocket during session shutdown",
                    session_id=str(session_id),
                )


ws_manager = ConnectionManager()
