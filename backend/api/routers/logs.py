from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends

from api.deps import get_optional_current_user
from core.config import settings
from core.exceptions import GameError
from core.logging import coerce_log_level, log_event, reset_log_context, set_log_context


router = APIRouter()
logger = logging.getLogger(__name__)
_ALLOWED_LEVELS = {"debug", "info", "warn", "warning", "error"}
_MAX_EVENTS = 100


@router.post("/frontend", status_code=202)
async def ingest_frontend_logs(
    payload: dict,
    current_user=Depends(get_optional_current_user),
):
    if not settings.FRONTEND_LOG_INGEST_ENABLED:
        raise GameError(404, "not_found", "Логирование frontend отключено")

    events = payload.get("events")
    if not isinstance(events, list) or not events:
        raise GameError(400, "validation_error", "events: ожидается непустой список")
    if len(events) > _MAX_EVENTS:
        raise GameError(400, "validation_error", f"events: максимум {_MAX_EVENTS} событий за запрос")

    accepted = 0
    for item in events:
        if not isinstance(item, dict):
            continue
        level_name = str(item.get("level", "info")).lower()
        event = str(item.get("event", "")).strip()
        if level_name not in _ALLOWED_LEVELS or not event:
            continue

        context = item.get("context") if isinstance(item.get("context"), dict) else {}
        details = item.get("details") if isinstance(item.get("details"), dict) else {}
        session_id = context.get("sessionId") or context.get("session_id")
        user_id = context.get("userId") or context.get("user_id") or getattr(current_user, "id", None)
        tokens = set_log_context(
            session_id=session_id,
            user_id=user_id,
            source="frontend",
            client_request_id=context.get("clientRequestId") or context.get("client_request_id"),
        )

        try:
            timestamp = item.get("timestamp")
            parsed_ts = None
            if isinstance(timestamp, str):
                try:
                    parsed_ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).isoformat()
                except ValueError:
                    parsed_ts = timestamp
            log_event(
                logger,
                coerce_log_level(level_name, logging.INFO),
                event,
                str(item.get("message") or event),
                source="frontend",
                frontend_context=context,
                frontend_details=details,
                frontend_timestamp=parsed_ts,
                frontend_route=context.get("route"),
            )
            accepted += 1
        finally:
            reset_log_context(tokens)

    if accepted == 0:
        raise GameError(400, "validation_error", "events: нет валидных событий")
    return {"accepted": accepted}
