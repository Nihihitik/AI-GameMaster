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

API будет доступен по адресу: [http://localhost:8000](http://localhost:8000)

Документация Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)

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


| Параметр | Значение     |
| -------- | ------------ |
| Host     | `localhost`  |
| Port     | `5432`       |
| Database | `gamemaster` |
| User     | `gamemaster` |
| Password | `gamemaster` |


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

## Структура проекта (актуально)

```
backend/
├── alembic/
├── api/
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── game.py
│   │   ├── lobby.py
│   │   ├── sessions.py
│   │   ├── subscriptions.py
│   │   └── users.py
│   ├── websockets/
│   │   ├── __init__.py
│   │   ├── chat.py
│   │   ├── game.py
│   │   └── ws.py
│   ├── __init__.py
│   └── deps.py
├── core/
│   ├── logging/
│   ├── __init__.py
│   ├── config.py
│   ├── database.py
│   ├── exceptions.py
│   └── security.py
├── models/
│   ├── __init__.py
│   ├── day_vote.py
│   ├── game_event.py
│   ├── game_phase.py
│   ├── night_action.py
│   ├── payment.py
│   ├── player.py
│   ├── refresh_token.py
│   ├── role.py
│   ├── session.py
│   ├── subscription.py
│   └── user.py
├── schemas/
│   ├── __init__.py
│   ├── ai.py
│   ├── auth.py
│   ├── game.py
│   ├── role.py
│   ├── session.py
│   ├── subscription.py
│   └── user.py
├── scripts/
│   ├── seed.py                  # Seed ролей: python -m scripts.seed
│   └── run_e2e_five_players.py  # E2E-смоук 5 игроков
├── services/
│   ├── websocket_manager/
│   ├── __init__.py
│   ├── ai_service.py
│   ├── auth_service.py
│   ├── chat_service.py
│   ├── game_engine.py
│   ├── night_action_resolver.py
│   ├── phase_manager.py
│   ├── recovery_service.py
│   ├── runtime_state.py
│   ├── session_service.py
│   ├── state_service.py
│   ├── timer_service.py
│   └── ws_manager.py
├── tests/
│   ├── integration
│   ├── unit
│   ├── conftest.py
│   └── test_smoke_openapi
├── .dockerignore
├── docker-compose.yml
├── Dockerfile
├── main.py
├── pyproject.toml
├── README.md
└── uv.lock
```

## Swagger / OpenAPI

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

Рекомендованный порядок ручной проверки:

- **Auth**
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me` (с `Authorization: Bearer <access>`)
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- **Sessions / Lobby**
  - `POST /api/sessions`
  - `POST /api/sessions/{code}/join`
  - `GET /api/sessions/{code}`
  - `GET /api/sessions/{id}/players`
- **Game**
  - `POST /api/sessions/{id}/start` (только хост)
  - `POST /api/sessions/{id}/acknowledge-role`
  - `GET /api/sessions/{id}/state`
  - `POST /api/sessions/{id}/night-action`
  - `POST /api/sessions/{id}/vote`

## Seed ролей

После применения миграций:

```bash
cd backend
uv run python -m scripts.seed
```

В Docker (из каталога `backend`):

```bash
docker compose exec backend uv run python -m scripts.seed
```

## Подключение БД

### 1. Запустите контейнер с БД или полностью проект

```
bash
cd backend
docker compose up db -d
```

или 

```
docker-compose up -d
```

### 2. Откройте pgAdmin

Слева: Servers → ПКМ → Register → Server.

- Вкладка General → Name: например `AI-GameMaster`
- Вкладка Connection:
  - Host name/address: `localhost`
  - Port: `5432`
  - Maintenance database: `gamemaster`
  - Username: `gamemaster`
  - Password: `gamemaster`

Включите Save password (по желанию).

## Что уже есть и что ещё не хватает

### Уже сделано (backend, базовый MVP-цикл)

- **Аккаунт и сессия пользователя**: регистрация/логин, JWT access + refresh с ротацией в БД, `GET /api/auth/me` (в т.ч. признак Pro).
- **Игровая сессия**: создание, код приглашения, вход по коду, лобби (список игроков, выход, кик хостом, закрытие сессии).
- **Организатор**: `host_user_id`, старт игры только хостом, **настройки партии до старта** (`PATCH .../settings` — таймеры, `role_config`).
- **Ограничение Free/Pro**: при `player_count > 5` без активной Pro у создателя — отказ при создании сессии.
- **Роли**: мафия, шериф, доктор, мирный; seed в БД (`scripts/seed.py`); случайная раздача при старте; выдача своей роли в `/state` и персональные WS-сообщения.
- **Игровой цикл**: раскрытие ролей с ack, ночь (очередь мафия → доктор → шериф), итог ночи, день (обсуждение → голосование), выбывание, проверка победы, завершение; события в `game_events`.
- **Сервер как источник истины**: все ходы через REST; защита от дублей действий (409), валидация целей и правил доктора; **восстановление после рестарта** (`recovery_service` + таймеры + продолжение ночной очереди).
- **WebSocket**: push по сессии; в payload есть `**announcement.trigger`** для **локальной** озвучки на клиенте (сам аудиофайл сервер не отдаёт).
- **Инфраструктура**: PostgreSQL + Alembic (в т.ч. миграция пересборки схемы), Docker Compose, смоук-тест OpenAPI, скрипт **e2e на 5 игроков** (`scripts/run_e2e_five_players.py`).
- **Подписки**: зачаток API под Pro (`/api/subscriptions`); без полноценной оплаты и вебхуков провайдера.

### Что ещё не хватает для «закрытого» базового MVP (по бэкенду)

- **Монетизация**: привязка Pro к реальному платежу (создание платежа, вебхук, продление `subscriptions`, отзыв при отмене) — сейчас Pro можно только имитировать данными в БД.
- **Политика утечек**: точечный аудит всех ответов API (чтобы в JSON/логах не утекали чужие роли и ночные выборы сверх задуманного).
- **Наблюдатель / реплей**: отдельный `GET` ленты событий для клиента (если нужен офлайн-reconnect без опоры только на WS).
- **AI GameMaster**: модуль под генерацию/подсказки ведущего (сейчас заготовка) — не обязателен для «классической» мафии с триггерами озвучки.
- **Тесты**: интеграционные тесты против тестовой БД (pytest + async engine), а не только smoke OpenAPI.

### Вне backend (клиент / продукт)

Воспроизведение озвучки по `trigger`, реклама, восстановление пароля по почте.

Подробная карта модулей: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.