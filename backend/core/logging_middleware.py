from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware

from core.logging import log_event, reset_log_context, set_log_context


logger = logging.getLogger(__name__)


class RequestContextLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        client_request_id = request.headers.get("X-Client-Request-ID")
        response = None
        tokens = set_log_context(
            request_id=request_id,
            client_request_id=client_request_id,
            route=request.url.path,
            source="backend",
        )
        request.state.request_id = request_id
        request.state.client_request_id = client_request_id
        route_tokens = {}

        try:
            response = await call_next(request)
        except Exception:
            reset_log_context(route_tokens)
            reset_log_context(tokens)
            raise
        finally:
            route = request.scope.get("route")
            if route is not None and getattr(route, "path", None):
                route_tokens = set_log_context(route=route.path)

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        status_code = getattr(response, "status_code", 500)
        response.headers["X-Request-ID"] = request_id

        level = logging.DEBUG
        if status_code >= 500:
            level = logging.ERROR
        elif status_code >= 400:
            level = logging.WARNING

        log_event(
            logger,
            level,
            "http.request_completed",
            f"{request.method} {request.url.path} -> {status_code}",
            method=request.method,
            path=request.url.path,
            status_code=status_code,
            duration_ms=duration_ms,
            client_host=getattr(request.client, "host", None),
        )
        reset_log_context(route_tokens)
        reset_log_context(tokens)
        return response
