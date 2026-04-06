FROM python:3.12-slim

WORKDIR /app

# Установка менеджера пакетов uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Копирование файлов зависимостей
COPY pyproject.toml uv.lock ./

# Установка зависимостей
RUN uv sync --frozen --no-dev

# Копирование исходного кода приложения
COPY . .

# Порт, на котором работает приложение
EXPOSE 8000

# Запуск FastAPI через uvicorn
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
