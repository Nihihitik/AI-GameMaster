# syntax=docker/dockerfile:1.7
FROM python:3.12-slim

WORKDIR /app

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Пин версии uv — воспроизводимые сборки вместо :latest
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

COPY pyproject.toml uv.lock ./

# Cache-mount на uv-кэш ускоряет пересборку при неизменных lock'ах
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
