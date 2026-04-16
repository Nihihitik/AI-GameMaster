from __future__ import annotations

import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from core.logging import log_event


logger = logging.getLogger(__name__)


class GameError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


async def game_error_handler(request: Request, exc: GameError) -> JSONResponse:
    event = "request.handled_error"
    level = logging.INFO
    if request.url.path.endswith("/refresh") and exc.code in {"token_invalid", "token_expired"}:
        event = "auth.refresh_failed"
        level = logging.WARNING
    elif exc.code == "action_already_submitted":
        event = "game.duplicate_action"
        level = logging.WARNING
    elif exc.code in {"blocked_by_lover", "wrong_phase", "game_paused", "already_paused", "not_paused"}:
        event = "game.action_blocked"
        level = logging.WARNING
    elif exc.code == "phase_mismatch":
        event = "runtime_state_mismatch"
        level = logging.WARNING

    response = JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        response.headers["X-Request-ID"] = str(request_id)
    log_event(
        logger,
        level,
        event,
        exc.message,
        method=request.method,
        path=request.url.path,
        status_code=exc.status_code,
        error_code=exc.code,
    )
    return response
