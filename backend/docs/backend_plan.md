## 1. Структура проекта и зависимости

### 1.1 Целевая структура каталогов

```
backend/
├── alembic/                    # Миграции
│   ├── versions/
│   ├── env.py
│   └── alembic.ini
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application factory
│   ├── config.py               # Pydantic Settings (загрузка .env)
│   ├── database.py             # AsyncSession, engine, get_db
│   ├── dependencies.py         # get_current_user, get_current_player
│   ├── exceptions.py           # GameError, обработчики ошибок
│   ├── models/
│   │   ├── __init__.py         # re-export всех моделей
│   │   ├── base.py             # DeclarativeBase
│   │   ├── user.py
│   │   ├── session.py
│   │   ├── player.py
│   │   ├── role.py
│   │   ├── game_phase.py
│   │   ├── night_action.py
│   │   ├── day_vote.py
│   │   ├── game_event.py
│   │   ├── subscription.py
│   │   └── payment.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── session.py
│   │   ├── player.py
│   │   ├── game.py
│   │   └── subscription.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── sessions.py
│   │   ├── lobby.py
│   │   ├── game.py
│   │   ├── subscriptions.py
│   │   └── ws.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── session_service.py
│   │   ├── game_engine.py       # Основная логика игры
│   │   ├── night_resolver.py    # Резолв ночных действий
│   │   ├── vote_resolver.py     # Подсчёт голосов
│   │   ├── timer_service.py     # Управление таймерами (asyncio)
│   │   └── ws_manager.py        # WebSocket connection manager
│   └── seed.py                  # Заполнение таблицы roles
├── tests/
├── .env
├── .env.example
├── requirements.txt
└── pyproject.toml
```

### 1.2 Зависимости (`requirements.txt`)

```
fastapi==0.115.*
uvicorn[standard]==0.34.*
sqlalchemy[asyncio]==2.0.*
asyncpg==0.30.*
alembic==1.14.*
pydantic==2.*
pydantic-settings==2.*
python-jose[cryptography]==3.3.*
bcrypt==4.*
python-multipart==0.0.*
```

### 1.3 Файл конфигурации `app/config.py`

Создать класс `Settings(BaseSettings)` с полями:

| Переменная | Тип | Описание |
|---|---|---|
| `DATABASE_URL` | `str` | `postgresql+asyncpg://user:pass@localhost:5432/gamemaster` |
| `SECRET_KEY` | `str` | Секрет для подписи JWT (HS256). Минимум 32 символа |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `int` | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `int` | `30` |
| `CORS_ORIGINS` | `list[str]` | `["http://localhost:5173"]` |

Загрузка из `.env` через `model_config = SettingsConfigDict(env_file=".env")`.

Экспортировать синглтон: `settings = Settings()`.

### 1.4 Файл `.env.example`

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/gamemaster
SECRET_KEY=change-me-to-a-random-string-at-least-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
CORS_ORIGINS=["http://localhost:5173"]
```

### 1.5 Файл `app/database.py`

- Создать `engine = create_async_engine(settings.DATABASE_URL)`
- Создать `async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)`
- Реализовать dependency `async def get_db() -> AsyncGenerator[AsyncSession, None]` (yield session, автоматический rollback при ошибке)

### 1.6 Файл `app/main.py`

- Создать `app = FastAPI(title="AI-GameMaster")`
- Подключить CORS middleware (origins из `settings.CORS_ORIGINS`)
- Подключить все роутеры с префиксом `/api`:
  - `auth.router` -> `/api/auth`
  - `sessions.router` -> `/api/sessions`
  - `lobby.router` -> `/api/sessions`
  - `game.router` -> `/api/sessions`
  - `subscriptions.router` -> `/api/subscriptions`
- Подключить WebSocket роутер без `/api` префикса:
  - `ws.router` -> `/ws`
- Зарегистрировать обработчик исключений `GameError`

---

## 2. Модели базы данных (SQLAlchemy 2.0, Mapped)

Для каждой таблицы ниже указаны **все поля**, их SQLAlchemy-типы и constraints. Если поле существует в текущих моделях но отличается от спеки, указано явно что менять.

Базовая модель (`app/models/base.py`):

```python
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

---

### 2.1 Таблица `users` — файл `app/models/user.py`

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` (Python-side) | PK |
| `email` | `Mapped[str]` mapped_column(String(255)) | NOT NULL | — | UNIQUE |
| `password_hash` | `Mapped[str]` mapped_column(String(255)) | NOT NULL | — | — |
| `created_at` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | `func.now()` | — |

**Индексы:**
- `idx_users_email` на `email`

**Relationships:**
- `sessions: Mapped[list["Session"]] = relationship(back_populates="host_user")`
- `players: Mapped[list["Player"]] = relationship(back_populates="user")`
- `subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")`

**Что менять относительно существующих моделей:**
- Переименовать `hash_password` -> `password_hash`
- Удалить поле `plan` (Enum FREE/PREMIUM) — подписки теперь в отдельной таблице `subscriptions`
- Удалить поле `updated_at` — спецификация не предусматривает его в таблице users

---

### 2.2 Таблица `sessions` — файл `app/models/session.py`

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `code` | `Mapped[str]` mapped_column(String(6)) | NOT NULL | — | UNIQUE |
| `host_user_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("users.id")) | NOT NULL | — | FK -> users.id |
| `player_count` | `Mapped[int]` mapped_column(Integer) | NOT NULL | — | CHECK(5..20) |
| `status` | `Mapped[str]` mapped_column(String(20)) | NOT NULL | `"waiting"` | CHECK IN ('waiting','active','finished') |
| `settings` | `Mapped[dict]` mapped_column(JSONB) | NOT NULL | `{}` | — |
| `created_at` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | `func.now()` | — |
| `ended_at` | `Mapped[datetime \| None]` mapped_column(TIMESTAMP(timezone=True)) | NULL | `None` | — |

**Индексы:**
- `idx_sessions_code` на `code`
- `idx_sessions_host` на `host_user_id`

**Constraints (table-level):**
```python
__table_args__ = (
    CheckConstraint("status IN ('waiting', 'active', 'finished')", name="ck_sessions_status"),
    CheckConstraint("player_count BETWEEN 5 AND 20", name="ck_sessions_player_count"),
)
```

**Формат поля `settings` (JSONB):**
```json
{
  "role_reveal_timer_seconds": 15,
  "discussion_timer_seconds": 120,
  "voting_timer_seconds": 60,
  "night_action_timer_seconds": 30,
  "role_config": {
    "mafia": 2,
    "sheriff": 1,
    "doctor": 1
  }
}
```

**Relationships:**
- `host_user: Mapped["User"] = relationship(back_populates="sessions")`
- `players: Mapped[list["Player"]] = relationship(back_populates="session", cascade="all, delete-orphan")`
- `phases: Mapped[list["GamePhase"]] = relationship(back_populates="session", cascade="all, delete-orphan")`
- `events: Mapped[list["GameEvent"]] = relationship(back_populates="session", cascade="all, delete-orphan")`

**Что менять относительно существующих моделей:**
- Переименовать `max_players` -> `player_count`
- Переименовать `owner_id` -> `host_user_id`
- Удалить `current_phase_id` — не предусмотрен спецификацией (текущая фаза определяется запросом к `game_phases` с max `phase_number` и `ended_at IS NULL`)
- Удалить `started_at` — нет в спецификации (есть только `created_at` и `ended_at`)
- Добавить `settings` (JSONB) — таймеры и конфигурация ролей
- Добавить `ended_at` (TIMESTAMPTZ, nullable)
- Добавить CHECK constraint на `player_count BETWEEN 5 AND 20`

---

### 2.3 Таблица `players` — файл `app/models/player.py`

**Внимание:** в текущих моделях таблица называется `session_players`. Переименовать в `players`.

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `session_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("sessions.id", ondelete="CASCADE")) | NOT NULL | — | FK -> sessions.id |
| `user_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("users.id")) | NOT NULL | — | FK -> users.id |
| `name` | `Mapped[str]` mapped_column(String(32)) | NOT NULL | — | — |
| `role_id` | `Mapped[uuid.UUID \| None]` mapped_column(UUID, ForeignKey("roles.id")) | NULL | `None` | FK -> roles.id |
| `status` | `Mapped[str]` mapped_column(String(10)) | NOT NULL | `"alive"` | CHECK IN ('alive','dead') |
| `join_order` | `Mapped[int]` mapped_column(Integer) | NOT NULL | — | — |

**Constraints (table-level):**
```python
__table_args__ = (
    UniqueConstraint("session_id", "user_id", name="uq_players_session_user"),
    CheckConstraint("status IN ('alive', 'dead')", name="ck_players_status"),
)
```

**Индексы:**
- `idx_players_session` на `session_id`
- `idx_players_user` на `user_id`

**Relationships:**
- `session: Mapped["Session"] = relationship(back_populates="players")`
- `user: Mapped["User"] = relationship(back_populates="players")`
- `role: Mapped["Role | None"] = relationship()`

**Что менять относительно существующих моделей:**
- Переименовать таблицу `session_players` -> `players`
- Добавить `name` (VARCHAR(32), NOT NULL) — отображаемое имя в партии
- Добавить `role_id` (UUID, FK -> roles.id, nullable) — NULL до старта игры
- Добавить `status` (VARCHAR(10), default 'alive') — alive/dead
- Добавить `join_order` (INT, NOT NULL) — порядок подключения
- Удалить таблицы `session_roles` и `player_roles` — спецификация не предусматривает их, роль назначается напрямую через `players.role_id`

---

### 2.4 Таблица `roles` — файл `app/models/role.py`

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `slug` | `Mapped[str]` mapped_column(String(20)) | NOT NULL | — | UNIQUE |
| `name` | `Mapped[str]` mapped_column(String(50)) | NOT NULL | — | UNIQUE |
| `team` | `Mapped[str]` mapped_column(String(10)) | NOT NULL | — | CHECK IN ('mafia','city') |
| `abilities` | `Mapped[dict]` mapped_column(JSONB) | NOT NULL | `{}` | — |

**Constraints (table-level):**
```python
__table_args__ = (
    CheckConstraint("team IN ('mafia', 'city')", name="ck_roles_team"),
)
```

**Что менять относительно существующих моделей:**
- Переименовать `type` -> `slug`
- Удалить `description` — в спецификации нет такого поля
- Удалить `is_active` — в спецификации нет такого поля
- Добавить `team` (VARCHAR(10), NOT NULL) — 'mafia' / 'city'
- Добавить `abilities` (JSONB, NOT NULL, default '{}')

---

### 2.5 Таблица `game_phases` — файл `app/models/game_phase.py`

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `session_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("sessions.id", ondelete="CASCADE")) | NOT NULL | — | FK -> sessions.id |
| `phase_type` | `Mapped[str]` mapped_column(String(15)) | NOT NULL | — | CHECK IN ('role_reveal','day','night') |
| `phase_number` | `Mapped[int]` mapped_column(Integer) | NOT NULL | — | — |
| `started_at` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | `func.now()` | — |
| `ended_at` | `Mapped[datetime \| None]` mapped_column(TIMESTAMP(timezone=True)) | NULL | `None` | — |

**Constraints (table-level):**
```python
__table_args__ = (
    UniqueConstraint("session_id", "phase_number", "phase_type", name="uq_phases_session_number_type"),
    CheckConstraint("phase_type IN ('role_reveal', 'day', 'night')", name="ck_phases_type"),
)
```

**Relationships:**
- `session: Mapped["Session"] = relationship(back_populates="phases")`
- `night_actions: Mapped[list["NightAction"]] = relationship(back_populates="phase", cascade="all, delete-orphan")`
- `day_votes: Mapped[list["DayVote"]] = relationship(back_populates="phase", cascade="all, delete-orphan")`

**Что менять относительно существующих моделей:**
- Переименовать `phase_order` -> `phase_number`
- Изменить тип `phase_type`: String(100) -> String(15) с CHECK constraint
- Добавить UNIQUE constraint на (session_id, phase_number, phase_type)

---

### 2.6 Таблица `night_actions` — файл `app/models/night_action.py`

**Новая таблица.** В текущих моделях есть только `game_actions` — удалить её, заменить на `night_actions`, `day_votes`, `game_events`.

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `phase_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("game_phases.id", ondelete="CASCADE")) | NOT NULL | — | FK -> game_phases.id |
| `actor_player_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("players.id")) | NOT NULL | — | FK -> players.id |
| `target_player_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("players.id")) | NOT NULL | — | FK -> players.id |
| `action_type` | `Mapped[str]` mapped_column(String(10)) | NOT NULL | — | CHECK IN ('kill','check','heal') |
| `was_blocked` | `Mapped[bool]` mapped_column(Boolean) | NOT NULL | `False` | — |

**Constraints (table-level):**
```python
__table_args__ = (
    UniqueConstraint("phase_id", "actor_player_id", name="uq_night_actions_phase_actor"),
    CheckConstraint("action_type IN ('kill', 'check', 'heal')", name="ck_night_actions_type"),
)
```

**Relationships:**
- `phase: Mapped["GamePhase"] = relationship(back_populates="night_actions")`
- `actor: Mapped["Player"] = relationship(foreign_keys=[actor_player_id])`
- `target: Mapped["Player"] = relationship(foreign_keys=[target_player_id])`

---

### 2.7 Таблица `day_votes` — файл `app/models/day_vote.py`

**Новая таблица** (замена части `game_actions`).

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `phase_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("game_phases.id", ondelete="CASCADE")) | NOT NULL | — | FK -> game_phases.id |
| `voter_player_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("players.id")) | NOT NULL | — | FK -> players.id |
| `target_player_id` | `Mapped[uuid.UUID \| None]` mapped_column(UUID, ForeignKey("players.id")) | NULL | — | FK -> players.id. NULL = пропуск голоса |

**Constraints (table-level):**
```python
__table_args__ = (
    UniqueConstraint("phase_id", "voter_player_id", name="uq_day_votes_phase_voter"),
    CheckConstraint(
        "voter_player_id != target_player_id",
        name="ck_day_votes_no_self_vote"
    ),
    # Этот CHECK применяется только когда target_player_id IS NOT NULL
    # (PostgreSQL автоматически пропускает CHECK при NULL)
)
```

**Relationships:**
- `phase: Mapped["GamePhase"] = relationship(back_populates="day_votes")`
- `voter: Mapped["Player"] = relationship(foreign_keys=[voter_player_id])`
- `target: Mapped["Player | None"] = relationship(foreign_keys=[target_player_id])`

---

### 2.8 Таблица `game_events` — файл `app/models/game_event.py`

**Новая таблица** (замена части `game_actions`).

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `session_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("sessions.id", ondelete="CASCADE")) | NOT NULL | — | FK -> sessions.id |
| `phase_id` | `Mapped[uuid.UUID \| None]` mapped_column(UUID, ForeignKey("game_phases.id")) | NULL | `None` | FK -> game_phases.id |
| `event_type` | `Mapped[str]` mapped_column(String(30)) | NOT NULL | — | CHECK (см. ниже) |
| `payload` | `Mapped[dict]` mapped_column(JSONB) | NOT NULL | `{}` | — |
| `created_at` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | `func.now()` | — |

**CHECK на `event_type`:**
```python
CheckConstraint(
    "event_type IN ("
    "'player_joined', 'player_left', 'game_started', "
    "'role_acknowledged', 'all_acknowledged', 'phase_changed', "
    "'night_action_submitted', 'night_result', 'player_eliminated', "
    "'vote_cast', 'vote_result', 'game_finished', 'session_closed'"
    ")",
    name="ck_game_events_type"
)
```

**Индексы:**
- `idx_game_events_session_created` — составной индекс на `(session_id, created_at)` для восстановления лога при реконнекте

**Relationships:**
- `session: Mapped["Session"] = relationship(back_populates="events")`
- `phase: Mapped["GamePhase | None"] = relationship()`

**Важно:** Не все WS-события записываются в `game_events`. НЕ персистятся (только через WS):
`role_assigned`, `action_required`, `action_confirmed`, `action_timeout`, `mafia_choice_made`, `check_result`, `vote_update`, `kicked`, `settings_updated`, `rematch_proposed`, `error`, `pong`.

---

### 2.9 Таблица `subscriptions` — файл `app/models/subscription.py`

**Новая таблица** (заменяет поле `plan` в `users`).

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `user_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("users.id")) | NOT NULL | — | FK -> users.id |
| `plan` | `Mapped[str]` mapped_column(String(10)) | NOT NULL | — | CHECK IN ('free','pro') |
| `period_start` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | — | — |
| `period_end` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | — | — |
| `cancel_at_period_end` | `Mapped[bool]` mapped_column(Boolean) | NOT NULL | `False` | — |
| `status` | `Mapped[str]` mapped_column(String(15)) | NOT NULL | — | CHECK IN ('active','cancelled','expired') |

**Constraints (table-level):**
```python
__table_args__ = (
    CheckConstraint("plan IN ('free', 'pro')", name="ck_subscriptions_plan"),
    CheckConstraint("status IN ('active', 'cancelled', 'expired')", name="ck_subscriptions_status"),
)
```

**Индексы:**
- `idx_subscriptions_user` на `user_id`

**Relationships:**
- `user: Mapped["User"] = relationship(back_populates="subscriptions")`
- `payments: Mapped[list["Payment"]] = relationship(back_populates="subscription")`

---

### 2.10 Таблица `payments` — файл `app/models/payment.py`

**Новая таблица.**

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `subscription_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("subscriptions.id")) | NOT NULL | — | FK -> subscriptions.id |
| `amount_kopecks` | `Mapped[int]` mapped_column(Integer) | NOT NULL | — | CHECK > 0 |
| `provider` | `Mapped[str]` mapped_column(String(20)) | NOT NULL | — | — |
| `provider_payment_id` | `Mapped[str \| None]` mapped_column(String(255)) | NULL | `None` | UNIQUE WHERE NOT NULL |
| `idempotency_key` | `Mapped[str]` mapped_column(String(255)) | NOT NULL | — | UNIQUE |
| `status` | `Mapped[str]` mapped_column(String(15)) | NOT NULL | `"pending"` | CHECK IN ('pending','succeeded','failed','refunded') |
| `created_at` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | `func.now()` | — |
| `updated_at` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | `func.now()` | onupdate=func.now() |

**Constraints (table-level):**
```python
__table_args__ = (
    CheckConstraint("amount_kopecks > 0", name="ck_payments_amount"),
    CheckConstraint("status IN ('pending', 'succeeded', 'failed', 'refunded')", name="ck_payments_status"),
)
```

Для `provider_payment_id` использовать partial unique index:
```python
Index("uq_payments_provider_payment_id", "provider_payment_id", unique=True, postgresql_where=text("provider_payment_id IS NOT NULL"))
```

**Relationships:**
- `subscription: Mapped["Subscription"] = relationship(back_populates="payments")`

---

### 2.11 Таблица `refresh_tokens` (дополнительная, для механизма ротации)

Спецификация упоминает хранение refresh-токенов в БД с ротацией. Необходима таблица.

**Файл:** `app/models/refresh_token.py`

| Поле | SQLAlchemy тип | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | `Mapped[uuid.UUID]` mapped_column(UUID, primary_key) | NOT NULL | `uuid.uuid4` | PK |
| `user_id` | `Mapped[uuid.UUID]` mapped_column(UUID, ForeignKey("users.id", ondelete="CASCADE")) | NOT NULL | — | FK -> users.id |
| `token_hash` | `Mapped[str]` mapped_column(String(255)) | NOT NULL | — | UNIQUE |
| `expires_at` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | — | — |
| `created_at` | `Mapped[datetime]` mapped_column(TIMESTAMP(timezone=True)) | NOT NULL | `func.now()` | — |

**Индексы:**
- `idx_refresh_tokens_hash` на `token_hash` — поиск при обновлении
- `idx_refresh_tokens_user` на `user_id` — удаление при логауте

Механизм: при refresh запросе старый токен удаляется, выпускается новый (rotation). При logout токен удаляется. Хранить SHA-256 от token value, а не сам token.

---

### 2.12 Удаляемые таблицы / модели

Полностью удалить из кодовой базы:
- `session_roles` — спецификация использует `settings.role_config` (JSONB) вместо отдельной таблицы
- `player_roles` — спецификация хранит `role_id` прямо в `players`
- `game_actions` (одна таблица) — заменена на три: `night_actions`, `day_votes`, `game_events`

---

## 3. Миграции (Alembic)

### 3.1 Инициализация Alembic

```bash
cd backend
alembic init alembic
```

### 3.2 Настройка `alembic/env.py`

- Импортировать `Base` из `app.models.base`
- Импортировать **все модели** из `app.models` (чтобы metadata была заполнена)
- Установить `target_metadata = Base.metadata`
- Настроить `sqlalchemy.url` из `app.config.settings.DATABASE_URL`
- Для async: использовать `run_async_migrations()` через `connectable = create_async_engine(...)` и `async with connectable.connect() as connection: await connection.run_sync(do_run_migrations)`

### 3.3 Первая миграция

```bash
alembic revision --autogenerate -m "initial_schema"
```

Проверить сгенерированный файл вручную:
- Все 11 таблиц (users, sessions, players, roles, game_phases, night_actions, day_votes, game_events, subscriptions, payments, refresh_tokens) созданы
- Все CHECK constraints присутствуют
- Все индексы присутствуют
- Порядок создания учитывает зависимости FK (users -> sessions -> players -> night_actions и т.д.)

```bash
alembic upgrade head
```

### 3.4 Если существуют старые миграции

Если в `alembic/versions/` уже есть миграции для старой схемы, создать новую миграцию, которая:
1. Дропнет таблицы `session_roles`, `player_roles`, `game_actions`
2. Переименует `session_players` -> `players`
3. Изменит колонки в `users`, `sessions`, `game_phases`, `roles`
4. Создаст новые таблицы `night_actions`, `day_votes`, `game_events`, `subscriptions`, `payments`, `refresh_tokens`

---

## 4. Модуль аутентификации

### 4.1 Сервис `app/services/auth_service.py`

**Функции хеширования:**

```python
import bcrypt

def hash_password(password: str) -> str:
    """Bcrypt-хеш пароля. Возвращает строку вида $2b$12$..."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    """Проверка пароля против bcrypt-хеша."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())
```

**Функции JWT:**

```python
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone

def create_access_token(user_id: str, email: str) -> str:
    """
    Создаёт access_token (JWT HS256).
    Payload: { sub: user_id, email: email, exp: now + 15 min, iat: now }
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def create_refresh_token() -> str:
    """
    Генерирует случайный refresh_token (не JWT — просто 64 hex-символа).
    """
    import secrets
    return secrets.token_hex(32)

def decode_access_token(token: str) -> dict:
    """
    Декодирует и верифицирует access_token.
    Raises JWTError при невалидном/истёкшем токене.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
```

**Хранение refresh-токена в БД:**

```python
import hashlib

def hash_refresh_token(token: str) -> str:
    """SHA-256 от refresh_token для хранения в БД."""
    return hashlib.sha256(token.encode()).hexdigest()
```

При регистрации/логине:
1. Создать access_token и refresh_token
2. Вычислить SHA-256 от refresh_token
3. Записать в `refresh_tokens` таблицу: `(user_id, token_hash, expires_at = now + 30 days)`
4. Вернуть оба токена клиенту

При refresh:
1. Получить `refresh_token` из запроса
2. Вычислить SHA-256
3. Найти в `refresh_tokens` по `token_hash`
4. Если не найден или `expires_at < now` -> 401 `token_invalid`
5. Удалить использованный токен из БД (rotation)
6. Создать новую пару access + refresh
7. Записать новый refresh в БД
8. Вернуть оба

При logout:
1. Получить `refresh_token` из тела запроса
2. Удалить из `refresh_tokens` по `token_hash`
3. Вернуть 204

### 4.2 Pydantic-схемы `app/schemas/auth.py`

```python
from pydantic import BaseModel, EmailStr, Field

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    user_id: str  # UUID as string
    email: str
    access_token: str
    refresh_token: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str

class MeResponse(BaseModel):
    user_id: str
    email: str
    has_pro: bool
    created_at: str  # ISO 8601

class LogoutRequest(BaseModel):
    refresh_token: str
```

### 4.3 Роутер `app/routers/auth.py`

Все эндпоинты с префиксом `/api/auth`.

---

**`POST /api/auth/register`**

Файл: `app/routers/auth.py`

1. Валидация: `RegisterRequest` (email формат, password >= 8 символов). При ошибке -> 400 `validation_error`
2. Проверить `SELECT * FROM users WHERE email = :email`. Если найден -> 409 `already_joined` (message: "Пользователь с таким email уже существует")
3. Хешировать пароль: `hash_password(request.password)`
4. Создать запись в `users(email, password_hash)`
5. Создать access_token + refresh_token
6. Сохранить hash refresh_token в `refresh_tokens`
7. Вернуть `201 Created` с `AuthResponse`

---

**`POST /api/auth/login`**

1. Валидация: `LoginRequest`
2. Найти пользователя по email. Если не найден -> 401 `invalid_credentials`
3. Проверить пароль: `verify_password(request.password, user.password_hash)`. Если не совпал -> 401 `invalid_credentials`
4. Создать access_token + refresh_token
5. Сохранить hash refresh_token в `refresh_tokens`
6. Вернуть `200 OK` с `AuthResponse`

---

**`POST /api/auth/refresh`**

1. Валидация: `RefreshRequest`
2. Вычислить `hash_refresh_token(request.refresh_token)`
3. Найти запись в `refresh_tokens` по `token_hash`
4. Если не найдена -> 401 `token_invalid` (message: "Refresh токен не найден или уже использован")
5. Если `expires_at < now` -> удалить запись, вернуть 401 `token_expired`
6. Удалить текущую запись (ротация)
7. Получить user по `user_id`
8. Создать новый access_token + refresh_token
9. Сохранить новый refresh в `refresh_tokens`
10. Вернуть `200 OK` с `TokenResponse`

---

**`GET /api/auth/me`** (требует авторизации)

1. Получить текущего пользователя из dependency `get_current_user`
2. Проверить наличие активной подписки: `SELECT * FROM subscriptions WHERE user_id = :uid AND plan = 'pro' AND status = 'active' AND period_end > now()`
3. Вернуть `200 OK` с `MeResponse { user_id, email, has_pro, created_at }`

---

**`POST /api/auth/logout`** (требует авторизации)

1. Валидация: `LogoutRequest`
2. Если `refresh_token` не передан -> 400 `validation_error`
3. Удалить из `refresh_tokens` по `hash_refresh_token(request.refresh_token)`
4. Вернуть `204 No Content`

---

### 4.4 Dependency `app/dependencies.py`

```python
from fastapi import Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Извлекает пользователя из access_token.
    При невалидном/истёкшем токене -> 401.
    """
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise GameError(status_code=401, code="token_invalid", message="Невалидный токен авторизации")

    user_id = payload.get("sub")
    user = await db.get(User, uuid.UUID(user_id))
    if user is None:
        raise GameError(status_code=401, code="token_invalid", message="Пользователь не найден")
    return user
```

---

## 5. Управление сессиями

### 5.1 Генерация 6-символьного кода

Файл: `app/services/session_service.py`

```python
import random
import string

async def generate_unique_code(db: AsyncSession) -> str:
    """
    Генерирует уникальный 6-символьный код из заглавных букв и цифр.
    Пример: 'AX7K2M'.
    Проверяет уникальность в БД, повторяет при коллизии.
    """
    chars = string.ascii_uppercase + string.digits
    for _ in range(10):  # max 10 попыток
        code = ''.join(random.choices(chars, k=6))
        exists = await db.scalar(
            select(Session).where(Session.code == code)
        )
        if not exists:
            return code
    raise GameError(500, "internal_error", "Не удалось сгенерировать уникальный код")
```

### 5.2 Pydantic-схемы `app/schemas/session.py`

```python
class RoleConfig(BaseModel):
    mafia: int = Field(ge=1)
    sheriff: int = Field(ge=0, le=1)
    doctor: int = Field(ge=0, le=1)

class SessionSettings(BaseModel):
    role_reveal_timer_seconds: int = Field(default=15, ge=10, le=30)
    discussion_timer_seconds: int = Field(default=120, ge=30, le=300)
    voting_timer_seconds: int = Field(default=60, ge=15, le=120)
    night_action_timer_seconds: int = Field(default=30, ge=15, le=60)
    role_config: RoleConfig

class CreateSessionRequest(BaseModel):
    player_count: int = Field(ge=5, le=20)
    settings: SessionSettings

class SessionResponse(BaseModel):
    id: str
    code: str
    host_user_id: str
    player_count: int
    status: str
    settings: dict
    created_at: str

class PlayerInList(BaseModel):
    id: str
    name: str
    join_order: int
    is_host: bool

class SessionDetailResponse(BaseModel):
    id: str
    code: str
    host_user_id: str
    player_count: int
    status: str
    settings: dict
    players: list[PlayerInList]
    created_at: str

class JoinRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)

class JoinResponse(BaseModel):
    player_id: str
    session_id: str
    join_order: int

class UpdateSettingsRequest(BaseModel):
    role_reveal_timer_seconds: int | None = Field(default=None, ge=10, le=30)
    discussion_timer_seconds: int | None = Field(default=None, ge=30, le=300)
    voting_timer_seconds: int | None = Field(default=None, ge=15, le=120)
    night_action_timer_seconds: int | None = Field(default=None, ge=15, le=60)
    role_config: RoleConfig | None = None
```

### 5.3 Роутер `app/routers/sessions.py`

---

**`POST /api/sessions`** (требует авторизации)

1. Получить `current_user` из dependency
2. Валидация `CreateSessionRequest`: `player_count` 5-20, проверить `role_config`:
   - Сумма `mafia + sheriff + doctor + (player_count - mafia - sheriff - doctor)` = `player_count`. Остаток — мирные (`civilian`). По факту надо проверить: `mafia + sheriff + doctor <= player_count` (остальные — мирные)
   - `mafia < (player_count - mafia)`, т.е. мафия должна быть строго меньше горожан. Иначе -> 400 `invalid_role_config`
   - `sheriff` 0 или 1, `doctor` 0 или 1
3. Если `player_count > 5` -> проверить подписку: `SELECT * FROM subscriptions WHERE user_id = :uid AND plan = 'pro' AND status = 'active' AND period_end > now()`. Если нет -> 403 `pro_required`
4. Сгенерировать `code` через `generate_unique_code(db)`
5. Собрать settings JSONB. Автоматически дополнить civilian: `civilian = player_count - mafia - sheriff - doctor`
6. Создать запись `sessions(code, host_user_id=current_user.id, player_count, status='waiting', settings)`
7. Автоматически добавить организатора как первого игрока: `players(session_id, user_id=current_user.id, name=current_user.email, join_order=1)` (имя — email, или потребовать отдельно при join)

**Примечание:** Согласно спецификации, организатор присоединяется к сессии как игрок через отдельный вызов `POST /sessions/{code}/join`. Создание сессии НЕ добавляет организатора в `players` автоматически. Организатор должен сам вызвать join.

8. Вернуть `201 Created` с `SessionResponse`

---

**`GET /api/sessions/{code}`** (требует авторизации)

1. Найти сессию по `code`: `SELECT * FROM sessions WHERE code = :code`
2. Если не найдена -> 404 `session_not_found`
3. Загрузить список игроков с joinedload
4. Для каждого игрока определить `is_host = (player.user_id == session.host_user_id)`
5. Вернуть `200 OK` с `SessionDetailResponse`

---

**`POST /api/sessions/{code}/join`** (требует авторизации)

1. Валидация: `JoinRequest` (name 1-32 символа, не только пробелы). При ошибке -> 400 `validation_error`
2. Найти сессию по `code`. Если не найдена -> 404 `session_not_found`
3. Проверить `session.status == 'waiting'`. Если нет -> 403 (message: "Сессия не принимает новых игроков")
4. Проверить уникальность: `SELECT * FROM players WHERE session_id = :sid AND user_id = :uid`. Если найден -> 409 `already_joined`
5. Подсчитать текущих игроков: `SELECT COUNT(*) FROM players WHERE session_id = :sid`. Если >= `session.player_count` -> 409 `session_full`
6. Определить `join_order = current_count + 1`
7. Создать запись `players(session_id, user_id, name, join_order=join_order)`
8. Записать в `game_events(session_id, event_type='player_joined', payload={player_id, name, join_order})`
9. Отправить WS всем участникам сессии: `{ type: "player_joined", payload: { player_id, name, join_order } }`
10. Вернуть `200 OK` с `JoinResponse`

---

### 5.4 Роутер `app/routers/lobby.py`

---

**`GET /api/sessions/{id}/players`** (требует авторизации)

1. Найти сессию по `id` (UUID). Если не найдена -> 404 `session_not_found`
2. Загрузить всех игроков сессии
3. Для каждого определить `is_host`
4. Вернуть `200 OK` с `{ players: [...] }`

---

**`DELETE /api/sessions/{id}/players/me`** (требует авторизации)

1. Найти сессию по `id`. Если не найдена -> 404 `session_not_found`
2. Найти запись `players` с `session_id = id` и `user_id = current_user.id`. Если не найдена -> 404 `player_not_found`
3. Проверить `session.status == 'waiting'`. Если нет -> 409 `game_already_started`
4. Удалить запись из `players`
5. Записать в `game_events(session_id, event_type='player_left', payload={player_id})`
6. Отправить WS всем: `{ type: "player_left", payload: { player_id } }`
7. Вернуть `204 No Content`

---

**`DELETE /api/sessions/{id}/players/{player_id}`** (требует авторизации — только хост)

1. Найти сессию по `id`. Если не найдена -> 404 `session_not_found`
2. Проверить `session.host_user_id == current_user.id`. Если нет -> 403 `not_host`
3. Проверить `session.status == 'waiting'`. Если нет -> 409 `game_already_started`
4. Найти `player` по `player_id` в этой сессии. Если не найден -> 404 `player_not_found`
5. Проверить `player.user_id != current_user.id` (нельзя кикнуть себя). Если совпадает -> 403 `not_host` (message: "Нельзя кикнуть себя")
6. Удалить запись из `players`
7. Отправить WS всем: `{ type: "player_left", payload: { player_id } }`
8. Отправить WS кикнутому лично: `{ type: "kicked", payload: { reason: "host_kicked" } }`
9. Закрыть WS-соединение кикнутого игрока
10. Вернуть `204 No Content`

---

**`DELETE /api/sessions/{id}`** (требует авторизации — только хост)

1. Найти сессию по `id`. Если не найдена -> 404 `session_not_found`
2. Проверить `session.host_user_id == current_user.id`. Если нет -> 403 `not_host`
3. Обновить: `session.status = 'finished'`, `session.ended_at = now()`
4. Записать в `game_events(session_id, event_type='session_closed', payload={})`
5. Отправить WS всем: `{ type: "session_closed", payload: {} }`
6. Закрыть все WS-соединения сессии
7. Вернуть `204 No Content`

---

**`PATCH /api/sessions/{id}/settings`** (требует авторизации — только хост)

1. Найти сессию по `id`. Если не найдена -> 404 `session_not_found`
2. Проверить `session.host_user_id == current_user.id`. Если нет -> 403 `not_host`
3. Проверить `session.status == 'waiting'`. Если нет -> 409 `game_already_started`
4. Валидировать `UpdateSettingsRequest`. Применить только переданные поля (partial update)
5. Если передан `role_config`: проверить сумму = `player_count`, mafia < city. Если ошибка -> 400 `invalid_role_config`
6. Обновить `session.settings` (merge с текущим JSONB)
7. Отправить WS всем: `{ type: "settings_updated", payload: { settings: {...} } }`
8. Вернуть `200 OK` с `{ settings: {...} }`

---

## 6. Игровой движок

### 6.1 Запуск игры — `POST /api/sessions/{id}/start`

Файл: `app/routers/game.py`, логика в `app/services/game_engine.py`

1. Найти сессию по `id`. Если не найдена -> 404 `session_not_found`
2. Проверить `session.host_user_id == current_user.id`. Если нет -> 403 `not_host`
3. Проверить `session.status == 'waiting'`. Если `active` или `finished` -> 409 `game_already_started`
4. Подсчитать игроков. Если < суммы ролей из `role_config` -> 400 `insufficient_players`
5. Повторно валидировать `role_config`: сумма = кол-во игроков, mafia < city

**Раздача ролей:**

6. Загрузить роли из `roles` таблицы по slug: mafia, sheriff, doctor, civilian
7. Сформировать пул ролей на основе `role_config`:
   - Например: `role_config = { mafia: 2, sheriff: 1, doctor: 1 }`, `player_count = 7`
   - Пул: [mafia, mafia, sheriff, doctor, civilian, civilian, civilian]
8. Перемешать пул: `random.shuffle(role_pool)`
9. Назначить каждому игроку роль: `player.role_id = role_pool[i].id`

**Создание фазы role_reveal:**

10. Создать запись `game_phases(session_id, phase_type='role_reveal', phase_number=0, started_at=now())`
11. Обновить `session.status = 'active'`

**WS-события:**

12. Записать в `game_events(session_id, event_type='game_started', payload={phase: {type: 'role_reveal', number: 0}})`
13. Отправить WS всем: `{ type: "game_started", payload: { phase: { type: "role_reveal", number: 0 }, timer_seconds: settings.role_reveal_timer_seconds, started_at: ISO8601 } }`
14. Отправить WS каждому игроку персонально: `{ type: "role_assigned", payload: { role: { name, team, abilities } } }`

**Запуск таймера role_reveal:**

15. Запустить серверный таймер `asyncio.create_task(role_reveal_timer(session_id, settings.role_reveal_timer_seconds))`
16. Когда таймер истекает (и не все подтвердили) -> автоматический переход в ночь #1

17. Вернуть `200 OK` с `{ status: "active", phase: { type: "role_reveal", number: 0 } }`

---

### 6.2 Подтверждение роли — `POST /api/sessions/{id}/acknowledge-role`

Файл: `app/routers/game.py`

Хранить состояние подтверждений в памяти (dict `session_id -> set of player_id`) или в `game_events`.

1. Найти сессию, проверить `status == 'active'`
2. Найти текущего игрока в этой сессии. Если не найден -> 404 `player_not_found`
3. Найти текущую фазу (последняя незавершённая): `SELECT * FROM game_phases WHERE session_id = :sid AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`
4. Проверить `phase.phase_type == 'role_reveal'`. Если нет -> 403 `wrong_phase`
5. Проверить `player.status == 'alive'`. Если нет -> 403 `player_dead`
6. Проверить, что игрок ещё не подтвердил: посмотреть `game_events` с `event_type='role_acknowledged'` и `payload.player_id == player.id` для этой фазы. Если есть -> 409 `action_already_submitted`
7. Записать `game_events(session_id, phase_id, event_type='role_acknowledged', payload={player_id})`
8. Подсчитать общее кол-во подтверждений и общее кол-во игроков
9. Отправить WS всем: `{ type: "role_acknowledged", payload: { player_id, players_acknowledged, players_total } }`
10. Если все подтвердили -> перейти в ночь #1 (вызвать `transition_to_night(session_id, phase_number=1)`)
11. Вернуть `200 OK` с `{ acknowledged: true, players_acknowledged: N, players_total: M }`

---

### 6.3 Ночная фаза — последовательные ходы

Файл: `app/services/game_engine.py`

**Функция `transition_to_night(session_id, phase_number)`:**

1. Завершить текущую фазу: `phase.ended_at = now()`
2. Создать новую фазу: `game_phases(session_id, phase_type='night', phase_number=phase_number)`
3. Записать `game_events(event_type='phase_changed', payload={phase: {type: 'night', number: phase_number}})`
4. Если все подтвердили -> сначала отправить WS всем: `{ type: "all_acknowledged", payload: {} }`
5. Отправить WS всем: `{ type: "phase_changed", payload: { phase: { type: "night", number: N }, sub_phase: null, timer_seconds: null, timer_started_at: null, announcement: { audio_url, text, duration_ms } } }`
6. Начать последовательные ходы: `await execute_night_sequence(session_id, phase)`

**Функция `execute_night_sequence(session_id, phase)`:**

Порядок фиксированный:
1. **Мафия** (все живые игроки с role.slug = 'mafia')
2. **Доктор** (живой игрок с role.slug = 'doctor', если есть)
3. **Шериф** (живой игрок с role.slug = 'sheriff', если есть)

Для каждой роли:

```
a. Определить живых игроков с этой ролью
b. Если таких нет (мертвы) -> пропустить, перейти к следующей
c. Определить доступные цели (available_targets):
   - Мафия: все живые city-игроки (исключить team='mafia' и мёртвых)
   - Доктор: все живые игроки (включая себя)
   - Шериф: все живые игроки, кроме себя
d. Отправить WS персонально каждому игроку с этой ролью:
   { type: "action_required", payload: {
       action_type: "kill"/"heal"/"check",
       available_targets: [{ player_id, name }],
       timer_seconds: settings.night_action_timer_seconds,
       timer_started_at: ISO8601
   }}
e. Запустить таймер (asyncio) на night_action_timer_seconds
f. Ожидать: action через REST ИЛИ timeout
g. Если timeout -> отправить WS: { type: "action_timeout", payload: { action_type } }
h. Перейти к следующей роли
```

**Для мафии (несколько игроков — первый подтвердивший побеждает):**

- Отправить `action_required` ВСЕМ живым мафиози
- Когда один мафиози отправляет `POST /night-action`:
  - Записать его выбор в `night_actions`
  - Отправить ему WS: `{ type: "action_confirmed", payload: { action_type: "kill" } }`
  - Отправить ОСТАЛЬНЫМ мафиози WS: `{ type: "mafia_choice_made", payload: { target_player_id, target_name, chosen_by } }`
  - Отменить таймер (все мафиози сделали общий выбор)
  - Перейти к Доктору

**После всех ходов -> резолв ночи:**

Вызвать `resolve_night(session_id, phase)`

---

### 6.4 Обработка ночного действия — `POST /api/sessions/{id}/night-action`

Файл: `app/routers/game.py`

**Request:** `{ "target_player_id": "uuid" }`

**Валидация (по порядку):**

1. Найти сессию. 404 если не найдена
2. Найти текущего игрока. 404 если не игрок
3. `player.status == 'alive'`? Если нет -> 403 `player_dead`
4. Текущая фаза = `night`? Если нет -> 403 `wrong_phase`
5. У роли игрока есть `night_action`? (`role.abilities.night_action != null`). Если нет -> 403 `wrong_phase`
6. Уже есть запись в `night_actions` для этой фазы и этого актора? Если да -> 409 `action_already_submitted`
7. Цель (target) жива? `target.status == 'alive'`? Если нет -> 400 `invalid_target`
8. Мафия: цель не из team='mafia'? Если из мафии -> 400 `invalid_target`
9. Мафия: цель не сам игрок? Если сам -> 400 `invalid_target`
10. Шериф: цель не сам? Если сам -> 400 `invalid_target`

**Действие:**

11. Определить `action_type` из `role.abilities.night_action` (kill/check/heal)
12. Создать запись `night_actions(phase_id, actor_player_id, target_player_id, action_type, was_blocked=False)`
13. Записать `game_events(event_type='night_action_submitted', payload={actor_player_id, action_type})`
14. Уведомить game_engine что действие получено (через asyncio.Event или аналог)

**Ответ:**

```json
{
  "action_type": "kill | check | heal",
  "target_player_id": "uuid",
  "confirmed": true
}
```

Для шерифа — дополнительно:
```json
{
  "check_result": { "team": "mafia | city" }
}
```
Определяется так: найти `target.role.team`. Отправить WS шерифу: `{ type: "check_result", payload: { target_player_id, team } }`

15. Вернуть `200 OK`

---

### 6.5 Резолв ночи

Файл: `app/services/night_resolver.py`

**Функция `resolve_night(session_id, phase)`:**

**Шаг 1 — Определение жертвы:**
```
mafia_action = SELECT * FROM night_actions WHERE phase_id = :pid AND action_type = 'kill'
doctor_action = SELECT * FROM night_actions WHERE phase_id = :pid AND action_type = 'heal'

IF mafia_action EXISTS:
    target = mafia_action.target_player_id
    IF doctor_action EXISTS AND doctor_action.target_player_id == target:
        mafia_action.was_blocked = True
        died = None  # Доктор спас
    ELSE:
        died = target
        UPDATE players SET status = 'dead' WHERE id = target
ELSE:
    died = None  # Мафия не выбрала (таймаут)
```

**Шаг 2 — Запись событий и WS:**
```
IF died:
    Записать game_events(event_type='night_result', payload={died: [{player_id, name}]})
    Записать game_events(event_type='player_eliminated', payload={player_id, name, cause: 'night'})
    WS всем: { type: "night_result", payload: { died: [{ player_id, name }], announcement: {...} } }
    WS всем: { type: "player_eliminated", payload: { player_id, name, cause: "night" } }
ELSE:
    Записать game_events(event_type='night_result', payload={died: null})
    WS всем: { type: "night_result", payload: { died: null, announcement: {...} } }
```

**Шаг 3 — Проверка условий победы:**
```
check_win_condition(session_id)
```

**Шаг 4 — Если победитель не определён:**
```
Завершить текущую ночную фазу: phase.ended_at = now()
transition_to_day(session_id, phase_number=current+1)
```

---

### 6.6 Условия победы

Файл: `app/services/game_engine.py`

**Функция `check_win_condition(session_id) -> str | None`:**

```python
alive_players = SELECT * FROM players WHERE session_id = :sid AND status = 'alive'

# Подсчитать живых по командам (через join с roles)
alive_mafia = count where role.team == 'mafia'
alive_city = count where role.team == 'city'

if alive_mafia == 0:
    return "city"    # Город победил — вся мафия мертва
elif alive_mafia >= alive_city:
    return "mafia"   # Мафия победила — мафия >= мирных
else:
    return None      # Игра продолжается
```

**При определении победителя:**

1. Установить `session.status = 'finished'`, `session.ended_at = now()`
2. Завершить текущую фазу: `phase.ended_at = now()`
3. Записать `game_events(event_type='game_finished', payload={winner, players: [{id, name, role: {name, team}, status}]})`
4. Отправить WS всем:
```json
{
  "type": "game_finished",
  "payload": {
    "winner": "mafia | city",
    "players": [
      { "id": "uuid", "name": "str", "role": { "name": "str", "team": "str" }, "status": "str" }
    ],
    "announcement": { "audio_url": "str", "text": "str", "duration_ms": 0 }
  }
}
```
5. Закрыть все серверные таймеры для этой сессии

---

### 6.7 Дневная фаза

**Функция `transition_to_day(session_id, phase_number)`:**

1. Создать фазу: `game_phases(session_id, phase_type='day', phase_number=phase_number)`
2. Записать `game_events(event_type='phase_changed', payload={...})`

**Подфаза обсуждение (discussion):**

3. Отправить WS всем:
```json
{
  "type": "phase_changed",
  "payload": {
    "phase": { "type": "day", "number": N },
    "sub_phase": "discussion",
    "timer_seconds": settings.discussion_timer_seconds,
    "timer_started_at": "ISO8601",
    "announcement": { "audio_url": "...", "text": "Город просыпается. Наступает день.", "duration_ms": 4000 }
  }
}
```
4. Запустить таймер обсуждения
5. По истечении таймера -> переход в подфазу голосования

**Подфаза голосование (voting):**

6. Отправить WS всем:
```json
{
  "type": "phase_changed",
  "payload": {
    "phase": { "type": "day", "number": N },
    "sub_phase": "voting",
    "timer_seconds": settings.voting_timer_seconds,
    "timer_started_at": "ISO8601",
    "announcement": null
  }
}
```
7. Запустить таймер голосования
8. Завершение: когда все живые проголосовали ИЛИ таймер истёк -> резолв голосования

---

### 6.8 Голосование — `POST /api/sessions/{id}/vote`

Файл: `app/routers/game.py`

**Request:** `{ "target_player_id": "uuid | null" }`

**Валидация:**

1. Найти сессию. 404 если не найдена
2. Найти текущего игрока. 404 если не игрок
3. `player.status == 'alive'`? Если нет -> 403 `player_dead`
4. Текущая фаза = `day`, подфаза = `voting`? Если нет -> 403 `wrong_phase`
5. Уже есть запись в `day_votes` для этой фазы и этого voter? Если да -> 409 `action_already_submitted`
6. Если `target_player_id` не null:
   - Цель жива? Если нет -> 400 `invalid_target`
   - `target_player_id != voter_player_id`? Если совпадают -> 400 `invalid_target` (нельзя голосовать за себя)

**Действие:**

7. Создать запись `day_votes(phase_id, voter_player_id=player.id, target_player_id)`
8. Записать `game_events(event_type='vote_cast', payload={voter_player_id, target_player_id})`
9. Подсчитать текущее состояние: `votes_cast = count(day_votes для этой фазы)`, `votes_total = count(alive players)`
10. Отправить WS всем: `{ type: "vote_update", payload: { votes_cast, votes_total } }`
11. Если `votes_cast == votes_total` -> завершить голосование досрочно (отменить таймер), резолвить

**Ответ:**

```json
{
  "voter_player_id": "uuid",
  "target_player_id": "uuid | null",
  "confirmed": true
}
```

---

### 6.9 Резолв голосования

Файл: `app/services/vote_resolver.py`

**Функция `resolve_votes(session_id, phase)`:**

```
Шаг 1 — Подсчёт голосов:
    votes = SELECT target_player_id, COUNT(*) as cnt
            FROM day_votes
            WHERE phase_id = :pid AND target_player_id IS NOT NULL
            GROUP BY target_player_id
            ORDER BY cnt DESC

Шаг 2 — Определение результата:
    IF votes пуст (все пропустили или никто не голосовал):
        eliminated = None
    ELIF votes[0].cnt > votes[1].cnt (если есть второй):
        eliminated = votes[0].target_player_id
        UPDATE players SET status = 'dead' WHERE id = eliminated
    ELSE (ничья):
        eliminated = None

Шаг 3 — WS и события:
    all_votes = SELECT voter_player_id, target_player_id FROM day_votes WHERE phase_id = :pid

    Записать game_events(event_type='vote_result', payload={eliminated, votes: all_votes})

    WS всем: { type: "vote_result", payload: {
        eliminated: { player_id, name } | null,
        votes: [{ voter_player_id, target_player_id }],
        announcement: { audio_url, text, duration_ms }
    }}

    IF eliminated:
        Записать game_events(event_type='player_eliminated', payload={player_id, name, cause: 'vote'})
        WS всем: { type: "player_eliminated", payload: { player_id, name, cause: "vote" } }

Шаг 4 — Проверка условий победы:
    winner = check_win_condition(session_id)
    IF winner:
        finish_game(session_id, winner)
    ELSE:
        Завершить дневную фазу: phase.ended_at = now()
        transition_to_night(session_id, phase_number=current_night_number+1)
```

---

### 6.10 Получение состояния игры — `GET /api/sessions/{id}/state`

Файл: `app/routers/game.py`

**Требует авторизации.** Возвращает текущее состояние, отфильтрованное по роли конкретного игрока.

1. Найти сессию по `id`. 404 если не найдена
2. Найти игрока текущего пользователя в этой сессии. 404 если не найден
3. `session.status == 'waiting'`? -> 403 `wrong_phase` (игра не началась)
4. Загрузить текущую фазу (`ended_at IS NULL`)
5. Загрузить роль игрока через `player.role_id`

**Сборка ответа:**

```python
response = {
    "session_status": session.status,
    "phase": {
        "id": str(phase.id),
        "type": phase.phase_type,
        "number": phase.phase_number,
        "sub_phase": determine_sub_phase(phase),  # "discussion"/"voting"/null
        "started_at": phase.started_at.isoformat(),
        "timer_seconds": get_current_timer_seconds(session, phase),
        "timer_started_at": get_timer_started_at(phase),
    },
    "my_player": {
        "id": str(player.id),
        "name": player.name,
        "status": player.status,
        "role": {
            "name": role.name,
            "team": role.team,
            "abilities": role.abilities,
        }
    },
    "players": [
        {
            "id": str(p.id),
            "name": p.name,
            "status": p.status,
            "join_order": p.join_order,
        }
        for p in all_players
        # Чужие роли НЕ передаются (кроме finished)
    ],
}

# Условные поля:
if phase.phase_type == "role_reveal":
    response["role_reveal"] = {
        "my_acknowledged": check_acknowledged(player.id, phase.id),
        "players_acknowledged": count_acknowledged(phase.id),
        "players_total": len(alive_players),
    }

if is_awaiting_action(player, phase):
    response["awaiting_action"] = True
    response["action_type"] = determine_action_type(player)
    response["available_targets"] = get_targets(player, phase)
    response["my_action_submitted"] = check_action_submitted(player, phase)
else:
    response["awaiting_action"] = False
    response["action_type"] = None
    response["available_targets"] = []
    response["my_action_submitted"] = False

if sub_phase == "voting":
    response["votes"] = {
        "total_expected": count_alive,
        "cast": count_votes_cast(phase.id),
    }

if session.status == "finished":
    response["result"] = {
        "winner": get_winner(session_id),  # из game_events
        "announcement": get_finish_announcement(session_id),
        "players": [
            {
                "id": str(p.id),
                "name": p.name,
                "role": { "name": p.role.name, "team": p.role.team },
                "status": p.status,
            }
            for p in all_players
        ]
    }
```

---

### 6.11 Рематч — `POST /api/sessions/{id}/rematch`

Файл: `app/routers/game.py`

**Request:**
```json
{
  "keep_players": true,
  "settings": { "discussion_timer_seconds": 90, "role_config": { "mafia": 2, "sheriff": 1, "doctor": 1 } }
}
```

1. Найти сессию по `id`. 404 если не найдена
2. `session.host_user_id == current_user.id`? Если нет -> 403 `not_host`
3. `session.status == 'finished'`? Если нет -> 400 `game_not_finished`
4. Создать новую сессию (новый UUID, новый или тот же code)
5. Если `keep_players: true`:
   - Скопировать всех игроков (без ролей) в новую сессию
   - Проверить: если кол-во игроков < минимума для `role_config` -> 400 `insufficient_players`
6. Если `keep_players: false`:
   - Новая пустая сессия, статус `waiting`
7. Отправить WS всем в старой сессии: `{ type: "rematch_proposed", payload: { host_name, new_session_id, code } }`
8. Вернуть `201 Created` с `{ new_session_id, code, status, players_kept }`

---

### 6.12 Управление таймерами

Файл: `app/services/timer_service.py`

Реализовать через `asyncio.Task`. Для каждой сессии хранить dict активных таймеров.

```python
class TimerService:
    def __init__(self):
        # session_id -> { timer_name: asyncio.Task }
        self._timers: dict[uuid.UUID, dict[str, asyncio.Task]] = {}

    async def start_timer(
        self,
        session_id: uuid.UUID,
        timer_name: str,
        seconds: int,
        callback: Callable,
    ):
        """Запускает таймер. По истечении вызывает callback."""
        task = asyncio.create_task(self._run(session_id, timer_name, seconds, callback))
        self._timers.setdefault(session_id, {})[timer_name] = task

    async def cancel_timer(self, session_id: uuid.UUID, timer_name: str):
        """Отменяет таймер (досрочное завершение фазы)."""
        timers = self._timers.get(session_id, {})
        task = timers.pop(timer_name, None)
        if task and not task.done():
            task.cancel()

    async def cancel_all(self, session_id: uuid.UUID):
        """Отменяет все таймеры сессии (при завершении игры)."""
        timers = self._timers.pop(session_id, {})
        for task in timers.values():
            if not task.done():
                task.cancel()

    async def _run(self, session_id, timer_name, seconds, callback):
        try:
            await asyncio.sleep(seconds)
            await callback()
        except asyncio.CancelledError:
            pass
        finally:
            timers = self._timers.get(session_id, {})
            timers.pop(timer_name, None)
```

Создать глобальный синглтон: `timer_service = TimerService()`

**Использование таймеров:**

| Фаза | timer_name | seconds | callback |
|---|---|---|---|
| role_reveal | `"role_reveal"` | `settings.role_reveal_timer_seconds` | `transition_to_night(session_id, 1)` |
| night (каждая роль) | `"night_{role_slug}"` | `settings.night_action_timer_seconds` | `handle_action_timeout(session_id, role_slug)` |
| day discussion | `"discussion"` | `settings.discussion_timer_seconds` | `transition_to_voting(session_id)` |
| day voting | `"voting"` | `settings.voting_timer_seconds` | `resolve_votes(session_id, phase)` |

---

## 7. WebSocket

### 7.1 Connection Manager

Файл: `app/services/ws_manager.py`

```python
from fastapi import WebSocket
from collections import defaultdict

class ConnectionManager:
    def __init__(self):
        # session_id -> { user_id: WebSocket }
        self._connections: dict[uuid.UUID, dict[uuid.UUID, WebSocket]] = defaultdict(dict)

    async def connect(self, session_id: uuid.UUID, user_id: uuid.UUID, ws: WebSocket):
        await ws.accept()
        self._connections[session_id][user_id] = ws

    async def disconnect(self, session_id: uuid.UUID, user_id: uuid.UUID):
        self._connections[session_id].pop(user_id, None)
        if not self._connections[session_id]:
            del self._connections[session_id]

    async def send_to_session(self, session_id: uuid.UUID, message: dict):
        """Отправить всем участникам сессии."""
        for ws in self._connections.get(session_id, {}).values():
            try:
                await ws.send_json(message)
            except Exception:
                pass  # dead connection, будет удалён по disconnect

    async def send_to_user(self, session_id: uuid.UUID, user_id: uuid.UUID, message: dict):
        """Отправить персонально одному игроку."""
        ws = self._connections.get(session_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def send_to_users(self, session_id: uuid.UUID, user_ids: list[uuid.UUID], message: dict):
        """Отправить нескольким конкретным игрокам."""
        for uid in user_ids:
            await self.send_to_user(session_id, uid, message)

    async def close_connection(self, session_id: uuid.UUID, user_id: uuid.UUID, code: int = 1000):
        """Закрыть соединение конкретного игрока (при кике)."""
        ws = self._connections.get(session_id, {}).get(user_id)
        if ws:
            try:
                await ws.close(code=code)
            except Exception:
                pass
            await self.disconnect(session_id, user_id)

    async def close_session(self, session_id: uuid.UUID, code: int = 1000):
        """Закрыть все соединения сессии."""
        connections = self._connections.pop(session_id, {})
        for ws in connections.values():
            try:
                await ws.close(code=code)
            except Exception:
                pass
```

Создать глобальный синглтон: `ws_manager = ConnectionManager()`

### 7.2 WebSocket endpoint

Файл: `app/routers/ws.py`

```
Endpoint: ws://{host}/ws/sessions/{session_id}?token={access_token}
```

```python
@router.websocket("/ws/sessions/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: uuid.UUID,
    token: str = Query(...),
):
    # 1. Верифицировать JWT из query parameter
    try:
        payload = decode_access_token(token)
    except JWTError:
        await websocket.close(code=4001)
        return

    user_id = uuid.UUID(payload["sub"])

    # 2. Проверить, что пользователь — игрок этой сессии
    async with async_session_factory() as db:
        player = await db.scalar(
            select(Player).where(
                Player.session_id == session_id,
                Player.user_id == user_id,
            )
        )
    if not player:
        await websocket.close(code=4003)
        return

    # 3. Подключить
    await ws_manager.connect(session_id, user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "payload": {}})
            # Все игровые действия через REST, WS — push-only
    except WebSocketDisconnect:
        await ws_manager.disconnect(session_id, user_id)
```

### 7.3 Формат всех WS-сообщений

Все сообщения имеют структуру:
```json
{
  "type": "event_name",
  "payload": { ... }
}
```

### 7.4 Полный список Server -> Client событий

**Лобби:**

| type | payload | Получатель | Персистится |
|---|---|---|---|
| `player_joined` | `{ player_id: uuid, name: str, join_order: int }` | Все в сессии | Да |
| `player_left` | `{ player_id: uuid }` | Все в сессии | Да |
| `settings_updated` | `{ settings: {...} }` | Все в сессии | Нет |

**Старт игры:**

| type | payload | Получатель | Персистится |
|---|---|---|---|
| `game_started` | `{ phase: { type: "role_reveal", number: 0 }, timer_seconds: int, started_at: ISO8601 }` | Все | Да |
| `role_assigned` | `{ role: { name: str, team: str, abilities: dict } }` | Каждому лично | Нет |
| `role_acknowledged` | `{ player_id: uuid, players_acknowledged: int, players_total: int }` | Все | Да |
| `all_acknowledged` | `{}` | Все | Да |

**Игровой цикл:**

| type | payload | Получатель | Персистится |
|---|---|---|---|
| `phase_changed` | `{ phase: { type, number }, sub_phase: str\|null, timer_seconds: int\|null, timer_started_at: ISO8601\|null, announcement: { audio_url, text, duration_ms } }` | Все | Да |
| `action_required` | `{ action_type: str, available_targets: [{ player_id, name }], timer_seconds: int, timer_started_at: ISO8601 }` | Лично спецроли | Нет |
| `action_confirmed` | `{ action_type: str }` | Лично спецроли | Нет |
| `mafia_choice_made` | `{ target_player_id: uuid, target_name: str, chosen_by: uuid }` | Лично другим мафиози | Нет |
| `action_timeout` | `{ action_type: str }` | Лично спецроли | Нет |
| `check_result` | `{ target_player_id: uuid, team: str }` | Лично шерифу | Нет |
| `night_result` | `{ died: [{ player_id, name }]\|null, announcement: { audio_url, text, duration_ms } }` | Все | Да |
| `vote_update` | `{ votes_cast: int, votes_total: int }` | Все | Нет |
| `vote_result` | `{ eliminated: { player_id, name }\|null, votes: [{ voter_player_id, target_player_id }], announcement: { audio_url, text, duration_ms } }` | Все | Да |
| `player_eliminated` | `{ player_id: uuid, name: str, cause: "vote\|night" }` | Все | Да |
| `kicked` | `{ reason: "host_kicked" }` | Лично кикнутому | Нет |

**Завершение:**

| type | payload | Получатель | Персистится |
|---|---|---|---|
| `game_finished` | `{ winner: str, players: [{ id, name, role: { name, team }, status }], announcement: { audio_url, text, duration_ms } }` | Все | Да |
| `rematch_proposed` | `{ host_name: str, new_session_id: uuid, code: str }` | Все | Нет |
| `session_closed` | `{}` | Все | Да |

**Служебные:**

| type | payload | Получатель | Персистится |
|---|---|---|---|
| `error` | `{ code: str, message: str }` | Лично | Нет |
| `pong` | `{}` | Лично | Нет |

### 7.5 Client -> Server

| type | payload | Описание |
|---|---|---|
| `ping` | `{}` | Keepalive. Клиент отправляет каждые 30 секунд. Сервер отвечает `pong` |

Все игровые действия идут через REST. WebSocket — только push от сервера и keepalive.

---

## 8. Подписки

### 8.1 Pydantic-схемы `app/schemas/subscription.py`

```python
class SubscriptionStatusResponse(BaseModel):
    plan: str         # "free" | "pro"
    status: str | None  # "active" | "cancelled" | "expired" | None
    period_end: str | None  # ISO 8601 | None
    cancel_at_period_end: bool

class CreateSubscriptionRequest(BaseModel):
    plan: str  # "pro"

class CreateSubscriptionResponse(BaseModel):
    subscription_id: str
    plan: str
    status: str
    period_start: str
    period_end: str
```

### 8.2 Роутер `app/routers/subscriptions.py`

---

**`GET /api/subscriptions/me`** (требует авторизации)

1. Получить `current_user`
2. Запрос: `SELECT * FROM subscriptions WHERE user_id = :uid ORDER BY period_end DESC LIMIT 1`
3. Если нет записи -> `{ plan: "free", status: null, period_end: null, cancel_at_period_end: false }`
4. Если есть -> `{ plan: sub.plan, status: sub.status, period_end: sub.period_end, cancel_at_period_end: sub.cancel_at_period_end }`
5. Вернуть `200 OK`

---

**`POST /api/subscriptions`** (требует авторизации)

Реализация MVP (без реального платёжного провайдера):

1. Получить `current_user`
2. Валидация: `plan == "pro"`
3. Создать запись `subscriptions(user_id, plan='pro', period_start=now(), period_end=now()+30days, cancel_at_period_end=false, status='active')`
4. Вернуть `201 Created` с `CreateSubscriptionResponse`

Платёжные провайдеры и таблица `payments` реализуются позже. Для MVP подписка создаётся мгновенно без оплаты.

---

## 9. Обработка ошибок

### 9.1 Класс исключения `app/exceptions.py`

```python
from fastapi import Request
from fastapi.responses import JSONResponse

class GameError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message

async def game_error_handler(request: Request, exc: GameError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
            }
        },
    )
```

Зарегистрировать в `main.py`:
```python
app.add_exception_handler(GameError, game_error_handler)
```

Также добавить обработчик необработанных исключений:
```python
@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "Внутренняя ошибка сервера",
            }
        },
    )
```

### 9.2 Полная таблица кодов ошибок

| HTTP-код | `code` | `message` (пример) | Когда |
|---|---|---|---|
| 400 | `validation_error` | "Пароль должен быть не короче 8 символов" | Невалидные входные данные (Pydantic ValidationError) |
| 400 | `invalid_role_config` | "Сумма ролей не равна количеству игроков" | Некорректная конфигурация ролей в settings |
| 400 | `insufficient_players` | "Недостаточно игроков для выбранной конфигурации" | Мало игроков для старта |
| 400 | `invalid_target` | "Этот игрок уже выбыл" | Невалидная цель ночного действия или голосования |
| 401 | `token_expired` | "Срок действия токена истёк" | Access token истёк (JWT exp < now) |
| 401 | `token_invalid` | "Невалидный токен авторизации" | Токен повреждён, отозван или не распознан |
| 401 | `invalid_credentials` | "Неверный email или пароль" | Ошибка при логине |
| 403 | `not_host` | "Только организатор может выполнить это действие" | Не хост пытается управлять сессией |
| 403 | `pro_required` | "Для этого количества игроков нужна подписка Pro" | player_count > 5 без Pro-подписки |
| 403 | `wrong_phase` | "Действие недоступно в текущей фазе" | Ночное действие днём, голосование ночью и т.п. |
| 403 | `player_dead` | "Выбывшие игроки не могут совершать действия" | Мёртвый игрок пытается действовать |
| 404 | `session_not_found` | "Сессия не найдена" | Нет сессии с указанным id или code |
| 404 | `player_not_found` | "Игрок не найден в этой сессии" | Пользователь не является игроком сессии |
| 409 | `already_joined` | "Вы уже подключены к этой сессии" | Повторная попытка join |
| 409 | `session_full` | "Все места заняты" | Лобби заполнено до player_count |
| 409 | `game_already_started` | "Игра уже началась" | Попытка менять настройки/кикать во время active/finished |
| 409 | `action_already_submitted` | "Вы уже сделали выбор в этой фазе" | Повторная отправка ночного действия или голоса |
| 409 | `game_not_finished` | "Игра ещё не завершена" | Рематч до окончания партии |
| 500 | `internal_error` | "Внутренняя ошибка сервера" | Необработанное исключение |

### 9.3 Перехват Pydantic ValidationError

Добавить в `main.py`:

```python
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    # Сформировать человекочитаемое сообщение из первой ошибки
    first_error = exc.errors()[0]
    field = ".".join(str(loc) for loc in first_error["loc"] if loc != "body")
    message = f"{field}: {first_error['msg']}"
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "validation_error",
                "message": message,
            }
        },
    )
```

---

## 10. Seed-данные (роли)

### 10.1 Скрипт `app/seed.py`

Этот скрипт заполняет таблицу `roles` четырьмя MVP-ролями. Запускать после миграций.

```python
import asyncio
import uuid
from sqlalchemy import select
from app.database import async_session_factory
from app.models.role import Role

SEED_ROLES = [
    {
        "slug": "mafia",
        "name": "Мафия",
        "team": "mafia",
        "abilities": {"night_action": "kill"},
    },
    {
        "slug": "sheriff",
        "name": "Шериф",
        "team": "city",
        "abilities": {"night_action": "check"},
    },
    {
        "slug": "doctor",
        "name": "Доктор",
        "team": "city",
        "abilities": {"night_action": "heal"},
    },
    {
        "slug": "civilian",
        "name": "Мирный",
        "team": "city",
        "abilities": {"night_action": None},
    },
]

async def seed_roles():
    async with async_session_factory() as db:
        for role_data in SEED_ROLES:
            existing = await db.scalar(
                select(Role).where(Role.slug == role_data["slug"])
            )
            if existing is None:
                db.add(Role(id=uuid.uuid4(), **role_data))
        await db.commit()
        print(f"Seeded {len(SEED_ROLES)} roles.")

if __name__ == "__main__":
    asyncio.run(seed_roles())
```

**Запуск:**
```bash
python -m app.seed
```

### 10.2 Данные ролей (итоговая таблица)

| slug | name | team | abilities |
|---|---|---|---|
| `mafia` | `Мафия` | `mafia` | `{"night_action": "kill"}` |
| `sheriff` | `Шериф` | `city` | `{"night_action": "check"}` |
| `doctor` | `Доктор` | `city` | `{"night_action": "heal"}` |
| `civilian` | `Мирный` | `city` | `{"night_action": null}` |

---

## Порядок реализации (рекомендуемый)

Каждый шаг строится на предыдущем. Порядок минимизирует блокировки.

| Приоритет | Задача | Зависит от |
|---|---|---|
| 1 | Структура проекта, зависимости, config, database.py | — |
| 2 | Все модели (раздел 2) | 1 |
| 3 | Alembic + миграция (раздел 3) | 2 |
| 4 | Seed-данные (раздел 10) | 3 |
| 5 | Обработка ошибок (раздел 9) | 1 |
| 6 | Auth модуль (раздел 4) | 2, 5 |
| 7 | Session management (раздел 5.3 — create, get by code, join) | 6 |
| 8 | WebSocket — connection manager + endpoint (раздел 7) | 6 |
| 9 | Lobby (раздел 5.4 — players list, leave, kick, close, settings) | 7, 8 |
| 10 | Game engine — start + role_reveal + acknowledge (разделы 6.1, 6.2) | 9 |
| 11 | Game engine — ночная фаза + ночные действия (разделы 6.3, 6.4) | 10 |
| 12 | Night resolver (раздел 6.5) | 11 |
| 13 | Day phase + voting (разделы 6.7, 6.8) | 12 |
| 14 | Vote resolver + win check (разделы 6.6, 6.9) | 13 |
| 15 | Game state endpoint (раздел 6.10) | 14 |
| 16 | Rematch (раздел 6.11) | 15 |
| 17 | Timer service (раздел 6.12) | 11, 13 |
| 18 | Subscriptions (раздел 8) | 6 |
