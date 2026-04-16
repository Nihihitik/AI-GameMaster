"""Точка входа FastAPI-приложения."""

from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from core.exceptions import GameError, game_error_handler
from core.logging import configure_logging, log_event, log_exception
from core.logging_middleware import RequestContextLoggingMiddleware
from services.recovery_service import recovery_loop
from services.role_catalog import ensure_role_catalog


configure_logging(settings.APP_ENV, settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


app = FastAPI(title="AI-GameMaster")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextLoggingMiddleware)


@app.exception_handler(GameError)
async def _game_error_handler(request, exc: GameError):
    return await game_error_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc: RequestValidationError):
    first_error = exc.errors()[0] if exc.errors() else {"loc": [], "msg": "Invalid input"}
    field = ".".join(str(loc) for loc in first_error.get("loc", []) if loc != "body")
    message = f"{field}: {first_error.get('msg', 'Invalid input')}".strip(": ")
    response = JSONResponse(
        status_code=400,
        content={"error": {"code": "validation_error", "message": message}},
    )
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        response.headers["X-Request-ID"] = str(request_id)
    log_event(
        logger,
        logging.WARNING,
        "request.validation_failed",
        message,
        method=request.method,
        path=request.url.path,
    )
    return response


@app.exception_handler(Exception)
async def generic_error_handler(request, exc: Exception):
    response = JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "Внутренняя ошибка сервера"}},
    )
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        response.headers["X-Request-ID"] = str(request_id)
    log_exception(
        logger,
        "request.unhandled_exception",
        "Unhandled backend exception",
        method=request.method,
        path=request.url.path,
    )
    return response


from api.routers.auth import router as auth_router
from api.routers.sessions import router as sessions_router
from api.routers.lobby import router as lobby_router
from api.routers.game import router as game_router
from api.routers.logs import router as logs_router
from api.routers.subscriptions import router as subscriptions_router
from api.websockets.ws import router as ws_router

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(sessions_router, prefix="/api/sessions", tags=["sessions"])
app.include_router(lobby_router, prefix="/api/sessions", tags=["lobby"])
app.include_router(game_router, prefix="/api/sessions", tags=["game"])
app.include_router(logs_router, prefix="/api/logs", tags=["logs"])
app.include_router(subscriptions_router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(ws_router, prefix="/ws", tags=["ws"])


@app.on_event("startup")
async def _startup_recovery():
    # Справочник ролей должен существовать до любых игровых действий и recovery.
    await ensure_role_catalog()
    # Продакшн-режим: поднимаем фоновый recovery, который продолжает активные игры
    asyncio.create_task(recovery_loop())
    log_event(logger, logging.INFO, "app.started", "Backend startup completed", app_env=settings.APP_ENV)


@app.get("/")
async def health():
    return {"status": "ok"}
