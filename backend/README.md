# AI GameMaster Backend

FastAPI backend для AI GameMaster с PostgreSQL.

## Требования

- Docker & Docker Compose
- Python 3.12+ (для локальной разработки)
- [uv](https://docs.astral.sh/uv/) (для управления зависимостями)

## Быстрый старт

### 1. Настройка окружения

```bash
cp .env.example .env
```

При необходимости отредактируйте `.env` — по умолчанию используются значения для локальной разработки.

### 2. Запуск через Docker Compose

```bash
docker compose up -d
```

Это поднимет:
- **db** — PostgreSQL 16 на порту `5432`
- **backend** — FastAPI на порту `8000`

API будет доступен по адресу: http://localhost:8000

Документация Swagger UI: http://localhost:8000/docs

### 3. Запуск только БД (для локальной разработки)

```bash
docker compose up db -d
```

Затем запустите backend локально:

```bash
uv sync
uv run uvicorn main:app --reload
```

## Миграции (Alembic)

Применить все миграции:

```bash
uv run alembic upgrade head
```

Создать новую миграцию после изменения моделей:

```bash
uv run alembic revision --autogenerate -m "описание_изменений"
```

Откатить последнюю миграцию:

```bash
uv run alembic downgrade -1
```

## Подключение к базе данных

### Параметры подключения (по умолчанию)

| Параметр | Значение        |
|----------|-----------------|
| Host     | `localhost`     |
| Port     | `5432`          |
| Database | `gamemaster`    |
| User     | `gamemaster`    |
| Password | `gamemaster`    |

### URL для подключения

**Async (asyncpg, используется в приложении):**

```
postgresql+asyncpg://gamemaster:gamemaster@localhost:5432/gamemaster
```

**Стандартный (psql, DBeaver, DataGrip и т.д.):**

```
postgresql://gamemaster:gamemaster@localhost:5432/gamemaster
```

### Подключение через psql

```bash
docker compose exec db psql -U gamemaster -d gamemaster
```

## Структура проекта

```
backend/
├── alembic/              # Миграции Alembic
│   ├── versions/         # Файлы миграций
│   └── env.py            # Конфигурация Alembic (async)
├── core/
│   ├── config.py         # Настройки приложения (pydantic-settings)
│   └── database.py       # Async engine + session
├── models/               # SQLAlchemy ORM модели
│   ├── user.py
│   ├── session.py
│   ├── game_phase.py
│   ├── session_player.py
│   ├── role.py
│   ├── session_role.py
│   ├── player_role.py
│   └── game_action.py
├── routers/              # FastAPI роутеры
├── schemas/              # Pydantic схемы (request/response)
├── services/             # Бизнес-логика
├── tests/                # Тесты
├── main.py               # Точка входа FastAPI
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml
```
