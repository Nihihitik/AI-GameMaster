"""Сервис таймеров (asyncio.Task) по сессиям.

В продакшн-режиме таймеры пересоздаются после рестарта через recovery-сервис.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable


class TimerService:
    def __init__(self):
        self._timers: dict[uuid.UUID, dict[str, asyncio.Task]] = {}

    async def start_timer(
        self,
        session_id: uuid.UUID,
        timer_name: str,
        seconds: int,
        callback: Callable[[], Awaitable[None]],
    ):
        await self.cancel_timer(session_id, timer_name)
        task = asyncio.create_task(self._run(session_id, timer_name, seconds, callback))
        self._timers.setdefault(session_id, {})[timer_name] = task

    async def cancel_timer(self, session_id: uuid.UUID, timer_name: str):
        timers = self._timers.get(session_id, {})
        task = timers.pop(timer_name, None)
        if task and not task.done():
            task.cancel()

    async def cancel_all(self, session_id: uuid.UUID):
        timers = self._timers.pop(session_id, {})
        for task in timers.values():
            if not task.done():
                task.cancel()

    def has_timer(self, session_id: uuid.UUID, timer_name: str) -> bool:
        task = self._timers.get(session_id, {}).get(timer_name)
        return bool(task and not task.done())

    async def _run(self, session_id: uuid.UUID, timer_name: str, seconds: int, callback):
        try:
            await asyncio.sleep(seconds)
            await callback()
        except asyncio.CancelledError:
            pass
        finally:
            timers = self._timers.get(session_id, {})
            timers.pop(timer_name, None)


timer_service = TimerService()

