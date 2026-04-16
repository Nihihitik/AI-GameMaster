from __future__ import annotations

import json
import logging
import sys
import traceback
from contextvars import ContextVar, Token
from datetime import datetime, timezone
from typing import Any


_REQUEST_ID = ContextVar("request_id", default=None)
_CLIENT_REQUEST_ID = ContextVar("client_request_id", default=None)
_USER_ID = ContextVar("user_id", default=None)
_SESSION_ID = ContextVar("session_id", default=None)
_ROUTE = ContextVar("route", default=None)
_SOURCE = ContextVar("source", default="backend")

_LEVELS = {
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warn": logging.WARNING,
    "warning": logging.WARNING,
    "error": logging.ERROR,
}
_SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "refresh_token",
    "access_token",
    "authorization",
    "token",
    "token_hash",
}


def coerce_log_level(level: str | int | None, default: int = logging.INFO) -> int:
    if isinstance(level, int):
        return level
    if not level:
        return default
    return _LEVELS.get(str(level).strip().lower(), default)


def redact_value(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            normalized = str(key).strip().lower()
            if normalized in _SENSITIVE_KEYS:
                redacted[str(key)] = "***"
            else:
                redacted[str(key)] = redact_value(item)
        return redacted
    if isinstance(value, list):
        return [redact_value(item) for item in value]
    if isinstance(value, tuple):
        return [redact_value(item) for item in value]
    return value


def get_log_context() -> dict[str, str | None]:
    return {
        "request_id": _REQUEST_ID.get(),
        "client_request_id": _CLIENT_REQUEST_ID.get(),
        "user_id": _USER_ID.get(),
        "session_id": _SESSION_ID.get(),
        "route": _ROUTE.get(),
        "source": _SOURCE.get(),
    }


def set_log_context(**kwargs: Any) -> dict[str, Token]:
    tokens: dict[str, Token] = {}
    mapping = {
        "request_id": _REQUEST_ID,
        "client_request_id": _CLIENT_REQUEST_ID,
        "user_id": _USER_ID,
        "session_id": _SESSION_ID,
        "route": _ROUTE,
        "source": _SOURCE,
    }
    for key, value in kwargs.items():
        if key not in mapping or value is None:
            continue
        tokens[key] = mapping[key].set(str(value))
    return tokens


def reset_log_context(tokens: dict[str, Token]) -> None:
    mapping = {
        "request_id": _REQUEST_ID,
        "client_request_id": _CLIENT_REQUEST_ID,
        "user_id": _USER_ID,
        "session_id": _SESSION_ID,
        "route": _ROUTE,
        "source": _SOURCE,
    }
    for key, token in reversed(list(tokens.items())):
        mapping[key].reset(token)


class _ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        context = get_log_context()
        record.request_id = context["request_id"]
        record.client_request_id = context["client_request_id"]
        record.user_id = context["user_id"]
        record.session_id = context["session_id"]
        record.route = context["route"]
        record.source = getattr(record, "source", context["source"])
        record.event = getattr(record, "event", None)
        record.details = getattr(record, "details", None)
        return True


class _DevFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat()
        parts = [timestamp, record.levelname, record.name]
        if record.event:
            parts.append(f"[{record.event}]")
        parts.append(record.getMessage())

        context_parts = []
        for key in ("source", "request_id", "client_request_id", "user_id", "session_id", "route"):
            value = getattr(record, key, None)
            if value:
                context_parts.append(f"{key}={value}")
        if context_parts:
            parts.append("| " + " ".join(context_parts))

        details = getattr(record, "details", None)
        if details:
            parts.append("| details=" + json.dumps(details, ensure_ascii=False, sort_keys=True))

        if record.exc_info:
            parts.append("\n" + "".join(traceback.format_exception(*record.exc_info)).rstrip())
        return " ".join(parts)


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "event": getattr(record, "event", None),
            "source": getattr(record, "source", None),
            "request_id": getattr(record, "request_id", None),
            "client_request_id": getattr(record, "client_request_id", None),
            "user_id": getattr(record, "user_id", None),
            "session_id": getattr(record, "session_id", None),
            "route": getattr(record, "route", None),
            "details": getattr(record, "details", None),
        }
        if record.exc_info:
            payload["exception"] = "".join(traceback.format_exception(*record.exc_info)).rstrip()
        return json.dumps({k: v for k, v in payload.items() if v is not None}, ensure_ascii=False)


def configure_logging(app_env: str, log_level: str | int | None) -> None:
    level = coerce_log_level(log_level, logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    handler.addFilter(_ContextFilter())
    handler.setFormatter(_DevFormatter() if app_env == "development" else _JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)
    root.addHandler(handler)

    logging.getLogger("uvicorn").handlers.clear()
    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.error").handlers.clear()


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def log_event(
    logger: logging.Logger,
    level: int,
    event: str,
    message: str | None = None,
    *,
    source: str | None = None,
    **details: Any,
) -> None:
    logger.log(
        level,
        message or event,
        extra={
            "event": event,
            "source": source,
            "details": redact_value(details) if details else None,
        },
    )


def log_exception(
    logger: logging.Logger,
    event: str,
    message: str | None = None,
    *,
    source: str | None = None,
    **details: Any,
) -> None:
    logger.error(
        message or event,
        exc_info=True,
        extra={
            "event": event,
            "source": source,
            "details": redact_value(details) if details else None,
        },
    )
