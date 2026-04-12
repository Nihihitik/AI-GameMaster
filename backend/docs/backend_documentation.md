# AI-GameMaster Backend — Техническая документация

Сводный технический справочник по актуальному состоянию backend-кода. Дополняет, а не заменяет:

- [`backend_specs.md`](./backend_specs.md) — детальная спецификация схемы БД и API-контрактов
- [`backend_plan.md`](./backend_plan.md) — дорожная карта и чек-листы реализации
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — карта модулей и зависимостей
- [`../README.md`](../README.md) — быстрый старт

---

## 1. Обзор проекта

**AI-GameMaster Backend** — асинхронный FastAPI-сервер многопользовательской «Мафии» с:

- классическим набором ролей (мафия, шериф, доктор, мирный житель)
- серверным игровым движком как источником истины
- REST + WebSocket API (REST меняет состояние, WS рассылает push-уведомления)
- JWT-аутентификацией с ротацией refresh-токенов
- фоновым восстановлением активных игр после перезапуска процесса (event-sourcing через `game_events`)
- подпиской Pro для сессий больше 5 игроков

### Tech stack

| Компонент | Версия | Назначение |
|---|---|---|
| Python | 3.12+ | Runtime |
| FastAPI | >=0.135.3 | HTTP/WebSocket фреймворк |
| uvicorn | >=0.44.0 | ASGI-сервер |
| SQLAlchemy | >=2.0.0 | ORM (async) |
| asyncpg | >=0.30.0 | Драйвер PostgreSQL |
| Alembic | >=1.14.0 | Миграции БД |
| pydantic | >=2.0.0 | Валидация/схемы |
| pydantic-settings | >=2.0.0 | Загрузка конфигурации из `.env` |
| python-jose | >=3.3.0 | JWT (HS256) |
| bcrypt | >=4.0.0 | Хеш паролей |
| python-multipart | >=0.0.0 | Формы/multipart |
| pytest / pytest-asyncio | >=8.0 / >=0.23 | Тесты |
| httpx | >=0.27.0 | Тестовый клиент |
| uv | — | Менеджер зависимостей |
| PostgreSQL | 16 (Docker) | БД |

---

## 2. Архитектура и структура каталогов

```
backend/
├── main.py                     # Точка входа FastAPI
├── alembic/                    # Миграции
│   └── versions/
├── api/
│   ├── deps.py                 # FastAPI-зависимости (get_db, get_current_user)
│   ├── routers/                # REST-роуты
│   │   ├── auth.py
│   │   ├── sessions.py
│   │   ├── lobby.py
│   │   ├── game.py
│   │   ├── subscriptions.py
│   │   └── users.py            # ⚠ не зарегистрирован в main.py
│   └── websockets/
│       ├── ws.py               # /ws/sessions/{session_id}
│       ├── chat.py             # черновик (не подключён)
│       └── game.py             # черновик (не подключён)
├── core/
│   ├── config.py               # Settings из .env
│   ├── database.py             # async engine, Base, session factory
│   ├── exceptions.py           # GameError + handler
│   ├── security.py             # пустой файл
│   └── logging/
│       └── middleware.py       # пустой (не подключён)
├── models/                     # SQLAlchemy ORM
│   ├── user.py, session.py, player.py, role.py
│   ├── game_phase.py, game_event.py
│   ├── night_action.py, day_vote.py
│   ├── subscription.py, payment.py, refresh_token.py
│   └── __init__.py             # импорт всех моделей для Alembic
├── schemas/                    # Pydantic DTO
│   ├── auth.py, session.py, game.py, subscription.py
│   ├── role.py, user.py, ai.py # заготовки
│   └── __init__.py
├── services/                   # Бизнес-логика
│   ├── auth_service.py
│   ├── session_service.py
│   ├── game_engine.py          # ядро игрового цикла
│   ├── phase_manager.py
│   ├── night_action_resolver.py
│   ├── timer_service.py
│   ├── runtime_state.py
│   ├── state_service.py
│   ├── recovery_service.py
│   ├── pause_service.py
│   ├── ws_manager.py
│   ├── ai_service.py           # заготовка
│   ├── chat_service.py         # заготовка
│   └── websocket_manager/      # вспомогательный пакет
├── scripts/
│   ├── seed.py                 # Идемпотентный seed ролей
│   └── run_e2e_five_players.py # Живой smoke для 5 игроков
├── tests/
│   ├── conftest.py             # задаёт SECRET_KEY для окружения тестов
│   ├── test_smoke_openapi.py   # единственный живой тест
│   ├── integration/            # stubs
│   └── unit/                   # stubs
├── docs/                       # Документация (этот файл здесь)
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── uv.lock
└── .env.example
```

### Порядок инициализации в `main.py`

1. Загрузка настроек из `core/config.py`
2. Создание `FastAPI(title="AI-GameMaster")`
3. Регистрация CORS (`allow_origins=settings.cors_origins`, `allow_credentials=True`, все методы/хедеры)
4. Регистрация обработчиков ошибок: `GameError`, `RequestValidationError`, общий `Exception`
5. Подключение роутеров (auth, sessions, lobby, game, subscriptions, ws)
6. Startup-хук `_startup_recovery` — запускает `recovery_loop()` из `services/recovery_service.py`
7. Health-check `GET /` → `{"status": "ok"}`

---

## 3. Конфигурация и переменные окружения

Файл: `core/config.py`. Все значения читаются из `.env` (pydantic-settings, `case_sensitive=False`, `extra="ignore"`).

| Переменная | Тип | По умолчанию | Назначение |
|---|---|---|---|
| `DATABASE_URL` | str | `postgresql+asyncpg://postgres:postgres@localhost:5432/gamemaster` | DSN для asyncpg |
| `SECRET_KEY` | str | `change-me-to-a-random-string-at-least-32-chars` | Подпись JWT (HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | int | 15 | TTL access-токена |
| `REFRESH_TOKEN_EXPIRE_DAYS` | int | 30 | TTL refresh-токена |
| `CORS_ORIGINS` | list[str] | `["http://localhost:5173"]` | Origin'ы CORS; принимается как JSON-массив или CSV |
| `DEBUG` | bool | `False` | Включает echo SQL в SQLAlchemy |

Свойство `settings.cors_origins` парсит строку (JSON или CSV) и возвращает `list[str]` для обратной совместимости.

### `.env.example` (Docker)

```
POSTGRES_USER=gamemaster
POSTGRES_PASSWORD=gamemaster
POSTGRES_DB=gamemaster
```

В `docker-compose.yml` эти переменные проксируются в контейнер `db`, а для контейнера `backend` `DATABASE_URL` переопределяется на host `db` (а не `localhost`).

---

## 4. Модели данных

Движок: `core/database.py::engine` — `create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)`.
Фабрика сессий: `async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)`.
Базовый класс: `Base(DeclarativeBase)`.

### 4.1 `User` — `models/user.py` (таблица `users`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK, default `uuid4` |
| `email` | String(255) | unique, not null, index |
| `display_name` | String(32) | not null |
| `password_hash` | String(255) | not null |
| `created_at` | TIMESTAMPTZ | server_default `now()`, not null |

Связи: `sessions` (как host), `players`, `subscriptions`.

### 4.2 `Session` — `models/session.py` (таблица `sessions`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `code` | String(6) | unique, not null, index |
| `host_user_id` | UUID | FK → `users.id`, index `idx_sessions_host` |
| `player_count` | int | not null, check `5..20` |
| `status` | String(20) | default `waiting`, check in (`waiting`,`active`,`finished`) |
| `settings` | JSONB | default `{}`, not null |
| `created_at` | TIMESTAMPTZ | server_default `now()` |
| `ended_at` | TIMESTAMPTZ | nullable |

Связи: `host_user`, `players` (cascade delete-orphan), `phases` (cascade), `events` (cascade).

### 4.3 `Player` — `models/player.py` (таблица `players`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `session_id` | UUID | FK → `sessions.id` ON DELETE CASCADE, index |
| `user_id` | UUID | FK → `users.id`, index |
| `name` | String(32) | not null |
| `role_id` | UUID | FK → `roles.id`, nullable |
| `status` | String(10) | default `alive`, check in (`alive`,`dead`) |
| `join_order` | int | not null |

Уникальный ключ: `(session_id, user_id)` — один пользователь не может занять два слота в одной сессии.

### 4.4 `Role` — `models/role.py` (таблица `roles`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `slug` | String(20) | unique, not null |
| `name` | String(50) | unique, not null |
| `team` | String(10) | not null, check in (`mafia`,`city`,`maniac`) |
| `abilities` | JSONB | default `{}` |

Справочник, заполняется `scripts/seed.py`. Поддерживаемые слаги: `mafia`, `don`, `sheriff`, `doctor`, `lover`, `maniac`, `civilian`. `abilities.night_action` задаёт тип ночного действия роли: `kill` | `check` | `heal` | `don_check` | `lover_visit` | `maniac_kill` (у мирного — `null`).

### 4.5 `GamePhase` — `models/game_phase.py` (таблица `game_phases`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `session_id` | UUID | FK → `sessions.id` ON DELETE CASCADE |
| `phase_type` | String(15) | check in (`role_reveal`,`day`,`night`) |
| `phase_number` | int | not null |
| `started_at` | TIMESTAMPTZ | server_default `now()` |
| `ended_at` | TIMESTAMPTZ | nullable |

Уникальный ключ: `(session_id, phase_number, phase_type)` — защита от дубликата фазы.

### 4.6 `GameEvent` — `models/game_event.py` (таблица `game_events`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `session_id` | UUID | FK → `sessions.id` ON DELETE CASCADE |
| `phase_id` | UUID | FK → `game_phases.id`, nullable |
| `event_type` | String(30) | check (см. ниже) |
| `payload` | JSONB | default `{}` |
| `created_at` | TIMESTAMPTZ | server_default `now()` |

Индекс: `idx_game_events_session_created (session_id, created_at)`.

Допустимые значения `event_type`:
```
player_joined | player_left | game_started |
role_acknowledged | all_acknowledged | phase_changed |
night_action_submitted | night_result | player_eliminated |
vote_cast | vote_result | game_finished | session_closed
```

### 4.7 `NightAction` — `models/night_action.py` (таблица `night_actions`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `phase_id` | UUID | FK → `game_phases.id` ON DELETE CASCADE |
| `actor_player_id` | UUID | FK → `players.id` |
| `target_player_id` | UUID | FK → `players.id` |
| `action_type` | String(10) | check in (`kill`,`check`,`heal`) |
| `was_blocked` | bool | default `false` |

Уникальный ключ: `(phase_id, actor_player_id)` — один выбор на фазу.

### 4.8 `DayVote` — `models/day_vote.py` (таблица `day_votes`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `phase_id` | UUID | FK → `game_phases.id` ON DELETE CASCADE |
| `voter_player_id` | UUID | FK → `players.id` |
| `target_player_id` | UUID | FK → `players.id`, nullable (воздержание) |

Уникальный ключ: `(phase_id, voter_player_id)`.
Check: `voter_player_id != target_player_id` — нельзя голосовать за себя.

### 4.9 `Subscription` — `models/subscription.py` (таблица `subscriptions`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id`, index |
| `plan` | String(10) | check in (`free`,`pro`) |
| `period_start` | TIMESTAMPTZ | not null |
| `period_end` | TIMESTAMPTZ | not null |
| `cancel_at_period_end` | bool | default `false` |
| `status` | String(15) | check in (`active`,`cancelled`,`expired`) |

### 4.10 `Payment` — `models/payment.py` (таблица `payments`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `subscription_id` | UUID | FK → `subscriptions.id` |
| `amount_kopecks` | int | check `> 0` |
| `provider` | String(20) | not null |
| `provider_payment_id` | String(255) | nullable, уникален среди non-null (partial unique index) |
| `idempotency_key` | String(255) | unique, not null |
| `status` | String(15) | default `pending`, check in (`pending`,`succeeded`,`failed`,`refunded`) |
| `created_at` / `updated_at` | TIMESTAMPTZ | server_default `now()`; `updated_at` обновляется на update |

Интеграция с реальным платёжным провайдером не реализована (в модели комментарий: «провайдеры будут позже»).

### 4.11 `RefreshToken` — `models/refresh_token.py` (таблица `refresh_tokens`)

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id` ON DELETE CASCADE, index |
| `token_hash` | String(255) | unique, not null, index |
| `expires_at` | TIMESTAMPTZ | not null |
| `created_at` | TIMESTAMPTZ | server_default `now()` |

В БД хранится `sha256(token)` — сам refresh виден только клиенту.

### 4.12 Диаграмма связей

```
User ─┬─▶ Session (host) ─┬─▶ Player ─▶ Role
      │                   ├─▶ GamePhase ─┬─▶ NightAction
      │                   │              └─▶ DayVote
      │                   └─▶ GameEvent (optionally ─▶ GamePhase)
      ├─▶ Player
      ├─▶ Subscription ─▶ Payment
      └─▶ RefreshToken
```

---

## 5. REST API

Все защищённые эндпоинты используют `HTTPBearer` через зависимость `api/deps.py::get_current_user`. Ошибки возвращаются в формате `{"error": {"code": ..., "message": ...}}` (см. §10).

### 5.1 Auth — `/api/auth` (`api/routers/auth.py`)

| Метод | Путь | Auth | Request | Response | Описание |
|---|---|---|---|---|---|
| POST | `/register` | — | `RegisterRequest` | `AuthResponse` (201) | Создать пользователя, выдать access+refresh |
| POST | `/login` | — | `LoginRequest` | `AuthResponse` | Проверить пароль (bcrypt), выдать пару токенов |
| POST | `/refresh` | — | `RefreshRequest` | `TokenResponse` | Ротация: удалить старый refresh, выдать новую пару |
| GET | `/me` | Bearer | — | `MeResponse` | Профиль + флаг активного Pro |
| PATCH | `/me` | Bearer | `UpdateNicknameRequest` | `MeResponse` | Сменить `display_name` |
| DELETE | `/me` | Bearer | `DeleteAccountRequest` | 204 | Удалить аккаунт (подтверждение паролем), каскад подписок/токенов/сессий/игроков |
| POST | `/logout` | Bearer | `LogoutRequest` | 204 | Удалить конкретный refresh-токен текущего пользователя |

Схемы (`schemas/auth.py`):

- `RegisterRequest`: `email: EmailStr`, `password: str` (≥8), `nickname: str` (1..32, strip)
- `LoginRequest`: `email`, `password`
- `AuthResponse`: `user_id`, `email`, `nickname`, `access_token`, `refresh_token`
- `RefreshRequest`: `refresh_token`
- `TokenResponse`: `access_token`, `refresh_token`
- `MeResponse`: `user_id`, `email`, `nickname`, `has_pro`, `created_at`
- `UpdateNicknameRequest`: `nickname: str` (1..32, strip)
- `DeleteAccountRequest`: `password: str`
- `LogoutRequest`: `refresh_token: str`

Ошибки: `email_already_registered` (409), `invalid_credentials` (401), `token_invalid` (401), `token_expired` (401).

### 5.2 Sessions — `/api/sessions` (`api/routers/sessions.py`)

| Метод | Путь | Auth | Request | Response | Описание |
|---|---|---|---|---|---|
| POST | `` | Bearer | `CreateSessionRequest` | `SessionResponse` (201) | Создать лобби |
| GET | `/{code}` | Bearer | — | `SessionDetailResponse` | Получить сессию по 6-символьному коду |
| POST | `/{code}/join` | Bearer | `JoinRequest` | `JoinResponse` | Войти в сессию по коду |

**Создание** валидирует `role_config` (`mafia + sheriff + doctor ≤ player_count`, `mafia < city`) и проверяет Pro-подписку при `player_count > 5` (иначе `403 pro_required`). Автоматически вычисляет `civilian = player_count - mafia - sheriff - doctor` и дополняет `settings.role_config`. Код сессии генерируется через `services/session_service.py::generate_unique_code` (до 10 попыток).

**GET по коду** возвращает сессию с отсортированным списком игроков (`is_host = user_id == session.host_user_id`).

**Join** — если `name` пуст, используется `display_name` профиля (обрезается до 32 символов). Повторный вход того же пользователя возвращает существующий `player_id` без создания дубликата (уникальный ключ `(session_id, user_id)`). При заполнении слотов — `409 session_full`. Эмитит событие `player_joined` в `game_events` и WS-сообщение.

Схемы (`schemas/session.py`):

- `RoleConfig`: `mafia: int ≥ 1`, `sheriff: int 0..1`, `doctor: int 0..1`
- `SessionSettings`: `role_reveal_timer_seconds (10..30, default 15)`, `discussion_timer_seconds (30..300, default 120)`, `voting_timer_seconds (15..120, default 60)`, `night_action_timer_seconds (15..60, default 30)`, `role_config: RoleConfig`
- `CreateSessionRequest`: `player_count: int 5..20`, `settings: SessionSettings`
- `SessionResponse` / `SessionDetailResponse`: `id`, `code`, `host_user_id`, `player_count`, `status`, `settings`, `created_at` (+ `players: list[PlayerInList]` в detail)
- `PlayerInList`: `id`, `name`, `join_order`, `is_host`
- `JoinRequest`: `name: str | None` (≤32)
- `JoinResponse`: `player_id`, `session_id`, `join_order`
- `UpdateSettingsRequest`: все поля `SessionSettings` опциональны

Ошибки: `invalid_role_config` (400), `pro_required` (403), `session_not_found` (404), `wrong_phase` (403), `session_full` (409).

### 5.3 Lobby — `/api/sessions` (`api/routers/lobby.py`)

| Метод | Путь | Auth | Request | Response | Описание |
|---|---|---|---|---|---|
| GET | `/{session_id}/players` | Bearer | — | `{players: [PlayerInList]}` | Список игроков по UUID сессии |
| DELETE | `/{session_id}/players/me` | Bearer | — | 204 | Игрок покидает лобби (только `status=waiting`) |
| DELETE | `/{session_id}/players/{player_id}?confirm=bool` | Bearer | — | 204 | Хост кикает игрока; во время `active` требуется `confirm=true` |
| DELETE | `/{session_id}` | Bearer | — | 204 | Хост закрывает сессию (`finished`, таймеры сброшены, runtime очищен) |
| PATCH | `/{session_id}/settings` | Bearer | `UpdateSettingsRequest` | `{settings}` | Хост меняет настройки (только в `waiting`) |
| POST | `/{session_id}/pause` | Bearer | — | (из `pause_service`) | Хост ставит игру на паузу |
| POST | `/{session_id}/resume` | Bearer | — | `{resumed: true}` | Хост снимает паузу (только `active`) |

**Kick** в `active` вызывает `services/game_engine.apply_host_kick`, шлёт `player_kicked` в сессию и `kicked` лично игроку, закрывает его WS с кодом `4000`.
**Close** помечает `ended_at`, убирает `game_pause` из `settings`, отменяет таймеры, очищает `runtime_state`, пишет `session_closed` событие, закрывает WS сессии.
**Update settings** валидирует новый `role_config` и эмитит WS `settings_updated`.

Ошибки: `session_not_found` (404), `not_host` (403), `player_not_found` (404), `game_already_started` (409), `confirmation_required` (400), `wrong_phase` (409 при `resume` не-active).

### 5.4 Game — `/api/sessions` (`api/routers/game.py`)

| Метод | Путь | Auth | Request | Response | Описание |
|---|---|---|---|---|---|
| POST | `/{session_id}/start` | Bearer | — | `{status, phase}` | Хост стартует игру: раздача ролей, `role_reveal`, таймер |
| POST | `/{session_id}/acknowledge-role` | Bearer | — | Результат `acknowledge_role` | Игрок подтверждает показ своей роли |
| POST | `/{session_id}/night-action` | Bearer | `{target_player_id}` | Подтверждение + опц. `check_result` | Ночное действие (kill/check/heal/don_check/lover_visit/maniac_kill) |
| POST | `/{session_id}/vote` | Bearer | `{target_player_id?}` | Подтверждение голоса | Дневное голосование (null = воздержание) |
| GET | `/{session_id}/state` | Bearer | — | Снимок состояния | Фаза, моя роль, цели, голоса; для `finished` — winner и final_roster |

Все мутирующие эндпоинты запрещены, если `settings.game_pause.paused == true` (ошибка `game_paused`).

**Старт** (только хост): валидирует `status`, вызывает `services/game_engine.start_game`.

**Ночное действие**:
- Требует `phase_type == "night"`
- Игрок должен быть `alive`
- Игрок не должен быть в `runtime_state.blocked_tonight` (блокировка любовницей) — иначе `403 blocked_by_lover`
- У роли должно быть `abilities.night_action`
- Для `kill`/`check`/`don_check`/`lover_visit`/`maniac_kill` запрещено целиться в себя
- Для `kill` запрещено атаковать мафию
- Для `don_check` запрещено проверять мафию/дона; результат — `{is_sheriff: bool}` (не раскрывает полный `team`)
- Для `lover_visit`: нельзя повторять одну и ту же цель две ночи подряд (`runtime_state.lover_last_target`)
- Для `heal`: нельзя лечить одну и ту же цель две ночи подряд; доктор может вылечить сам себя только один раз за игру
- Идемпотентность по `(phase_id, actor_player_id)`: повторная попытка — `409 action_already_submitted`
- Для мафии: первый выбор фиксирует общий target в `runtime_state`, остальные — `409`
- После успешной записи отправляется WS `action_confirmed`, а для `check`/`don_check` — `check_result` конкретному игроку. Очередь ночи: `lover → mafia → don → sheriff → doctor → maniac`. Резолюция: жертвы = `{mafia_target} ∪ {maniac_target}` за вычетом `{doctor_target}`.

**Голосование**:
- Требует `phase_type == "day"` и `rt.day_sub_phase == "voting"`
- Игрок жив
- `target_player_id` может быть `null` (воздержание) или ссылаться на живого игрока сессии (не себя)
- Идемпотентность по `(phase_id, voter_player_id)`
- После записи: WS `vote_update` (`votes_cast`, `votes_total`); если все живые проголосовали — досрочно отменяется таймер `voting` и вызывается `resolve_votes`

**`GET /state`** собирает снимок для клиента: `session_status`, `game_paused`, `phase` (`id`, `type`, `number`, `sub_phase`, `night_turn`, `started_at`, `timer_seconds`, `timer_started_at`), `my_player` (с `role` и `is_blocked_tonight`), список `players`, `awaiting_action`, `action_type`, `available_targets`, `my_action_submitted`. Для `role_reveal` добавляет `role_reveal.{my_acknowledged, players_acknowledged, players_total}`; для дневного голосования — `votes.{total_expected, cast}`; для фазы `day` — `day_blocked_player` (UUID игрока, заблокированного любовницей прошлой ночью, или `null`); для `finished` — последнюю закрытую фазу, `winner` и `final_roster` из последнего `game_finished`.

Если `runtime_state` потерян (рестарт), он докачивается через `services/state_service.restore_runtime_like_fields`.

Ошибки: `wrong_phase` (403), `player_not_found` (404), `player_dead` (403), `game_paused` (403), `invalid_target` (400), `action_already_submitted` (409), `validation_error` (400).

### 5.5 Subscriptions — `/api/subscriptions` (`api/routers/subscriptions.py`)

| Метод | Путь | Auth | Request | Response | Описание |
|---|---|---|---|---|---|
| GET | `/me` | Bearer | — | `SubscriptionStatusResponse` | Последняя подписка по `period_end desc`; при отсутствии — `plan=free` |
| POST | `` | Bearer | `CreateSubscriptionRequest` | `CreateSubscriptionResponse` (201) | Создать активную Pro-подписку на 30 дней |

Валидация `plan == "pro"`, иначе `400 validation_error`. Создание — **заготовка**: не ходит в платёжный провайдер, просто пишет запись в БД на 30 дней. Pro фактически можно сейчас имитировать прямо в БД.

Схемы (`schemas/subscription.py`):

- `SubscriptionStatusResponse`: `plan`, `status`, `period_end`, `cancel_at_period_end`
- `CreateSubscriptionRequest`: `plan: str` (ожидается `"pro"`)
- `CreateSubscriptionResponse`: `subscription_id`, `plan`, `status`, `period_start`, `period_end`

### 5.6 Health

| Метод | Путь | Response |
|---|---|---|
| GET | `/` | `{"status": "ok"}` |

---

## 6. WebSocket API

**Endpoint**: `GET /ws/sessions/{session_id}?token={access_token}` — `api/websockets/ws.py`.

**Авторизация**:
1. JWT передаётся query-параметром `token`
2. `decode_access_token` → `payload.sub` (UUID пользователя)
3. Проверка: пользователь должен быть игроком в указанной сессии

**Коды закрытия**:

| Код | Причина |
|---|---|
| `4000` | Кик хостом |
| `4001` | Невалидный/отсутствующий токен |
| `4003` | Пользователь не участвует в сессии |

**Сообщения от клиента**: только `{"type": "ping"}` — сервер отвечает `{"type": "pong", "payload": {}}`. Все игровые действия идут через REST.

**Сообщения от сервера** (тип → payload):

| Тип | Контекст |
|---|---|
| `player_joined` | Новый игрок вошёл |
| `player_left` | Игрок покинул лобби / кикнут в waiting |
| `player_kicked` | Кик во время игры |
| `kicked` | Персонально кикнутому игроку перед закрытием сокета |
| `settings_updated` | Хост обновил настройки |
| `session_closed` | Сессия закрыта |
| `game_started` | Старт игры |
| `role_assigned` | Персональная роль игрока |
| `phase_changed` | Смена фазы |
| `night_result` | Итог ночи |
| `vote_update` | Прогресс голосования |
| `vote_result` | Итог голосования |
| `player_eliminated` | Выбывание |
| `action_confirmed` | Подтверждение ночного действия игрока |
| `check_result` | Результат проверки шерифа (лично шерифу) |
| `announcement` | Триггер для локальной озвучки на клиенте |

**Менеджер соединений**: `services/ws_manager.py` — in-memory `dict[session_id][user_id] → WebSocket` с методами `connect`, `disconnect`, `send_to_session`, `send_to_user`, `close_connection(code)`, `close_session()`.

Поле `announcement.trigger` в payload используется клиентом для выбора локализованного аудиофайла — сервер аудио не отдаёт.

---

## 7. Игровой движок и сервисы

### `services/game_engine.py`

Ядро игрового цикла (891 строка):

- `start_game(db, session)` — валидирует состояние, раздаёт роли случайным образом, переводит в `role_reveal`, эмитит `game_started`, персональные `role_assigned`, ставит таймер `role_reveal_timer_seconds`
- `acknowledge_role(db, session, player)` — записывает событие `role_acknowledged`; при подтверждении всеми живыми игроками досрочно отменяет таймер `role_reveal` и переходит в ночь (защита от двойного запуска фазы)
- `transition_to_night` / `execute_night_sequence` — очередь действий `mafia → doctor → sheriff`, идемпотентность по уже записанным `night_actions` (для resume после рестарта), `phase_changed` в `game_events` для восстановления
- `resolve_night` — применяет блокировку heal к kill, помечает выбывших, эмитит `night_result`
- `transition_to_day` / `transition_to_voting` — подфазы дневного цикла (`discussion` → `voting`)
- `resolve_votes` — подсчёт, выбывание, `vote_result`
- `check_win_condition` — мафия ≥ город → победа мафии; мафия = 0 → победа города
- `finish_game` — `game_finished` с `winner` и `final_roster`
- `apply_host_kick` — принудительное удаление игрока во время активной игры
- Защита от гонок: проверка уже существующей фазы в БД + ловля `IntegrityError` на `(session_id, phase_number, phase_type)`

### Сопутствующие сервисы

| Файл | Назначение |
|---|---|
| `services/session_service.py` | `generate_unique_code` — 6-символьный код сессии, до 10 попыток |
| `services/auth_service.py` | bcrypt, JWT, ротация refresh-токенов, `delete_user_account` (каскадное удаление) |
| `services/phase_manager.py` | тонкая обёртка конечного автомата фаз |
| `services/night_action_resolver.py` | резолюция ночных действий (вспомогательная) |
| `services/timer_service.py` | `asyncio.Task` на сессию; методы `cancel_timer`, `cancel_all` |
| `services/runtime_state.py` | in-memory per-session state: `day_sub_phase`, `night_turn`, `timer_*`, `night_action_event`, `mafia_choice_*`, `game_paused` |
| `services/state_service.py` | `restore_runtime_like_fields` — восстановление подфаз/ходов из `game_events.phase_changed` |
| `services/recovery_service.py` | фоновой `recovery_loop`: пересоздание таймеров активных сессий, возобновление ночной очереди в отдельной DB-сессии, флаг `night_sequence_running` против двойного запуска |
| `services/pause_service.py` | `pause_game` / `resume_game` через `session.settings["game_pause"]` |
| `services/ws_manager.py` | in-memory WebSocket менеджер (см. §6) |
| `services/ai_service.py` | заготовка под AI-озвучку/нарратив |
| `services/chat_service.py` | заготовка |

Роли раздаются из seed-справочника (`scripts/seed.py` — «мафия», «шериф», «доктор», «мирный житель»).

---

## 8. Аутентификация и безопасность

### Потоки

```
register → hash_password (bcrypt) → User + RefreshToken (sha256) → {access, refresh}
login    → verify_password        → RefreshToken (sha256)         → {access, refresh}
refresh  → найти по sha256 → удалить старый → выдать новую пару (rotation)
logout   → delete RefreshToken by (user_id, sha256(refresh))
delete_me → verify_password → каскадно удалить Subscription/Payment/RefreshToken/Session/Player/User
```

### Токены

- **Access JWT**: HS256, payload `{sub, email, exp, iat}`, TTL `ACCESS_TOKEN_EXPIRE_MINUTES` (по умолчанию 15)
- **Refresh**: случайные `secrets.token_hex(32)` (64 hex), возвращаются клиенту; в БД хранится `sha256(token)`; TTL `REFRESH_TOKEN_EXPIRE_DAYS` (30)
- **Ротация**: каждый успешный `/refresh` удаляет старый токен и выдаёт новый

### Защита эндпоинтов

`api/deps.py::get_current_user` используется в `Depends` во всех защищённых роутерах:

```python
credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
→ decode_access_token (jose)
→ User.get(payload.sub)
→ 401 token_invalid при любой ошибке
```

`api/deps.py::get_db` — генератор-зависимость с `async_session_factory`, rollback при исключении.

### Ограничения

- Rate limiting **отсутствует**
- `core/logging/middleware.py` существует, но пуст — структурированное логирование не подключено
- `core/security.py` — пустой файл (вся криптография в `services/auth_service.py`)
- Политика утечек ролей и ночных выборов не аудитирована (отмечено в `README.md` как задача)

---

## 9. Middleware

Зарегистрированы в `main.py`:

- **CORS** (`CORSMiddleware`): `allow_origins=settings.cors_origins`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`

Не подключено:

- Rate limiting
- Structured logging (`core/logging/middleware.py` пуст)
- Request ID / tracing

---

## 10. Обработка ошибок

### Доменный эксепшн

`core/exceptions.py::GameError(status_code, code, message)` — кидается в бизнес-логике.

### Глобальные обработчики (`main.py`)

| Обработчик | Выход |
|---|---|
| `GameError` | `status_code`, `{"error": {"code": code, "message": message}}` |
| `RequestValidationError` | `400`, `{"error": {"code": "validation_error", "message": "<field>: <msg>"}}` |
| `Exception` | `500`, `{"error": {"code": "internal_error", "message": "Внутренняя ошибка сервера"}}` |

### Каталог ошибок

Встреченные в коде коды (не исчерпывающий, но покрывает REST):

| Код | Статус | Где |
|---|---|---|
| `email_already_registered` | 409 | Регистрация |
| `invalid_credentials` | 401 | Login, удаление аккаунта |
| `token_invalid` | 401 | Refresh, get_current_user |
| `token_expired` | 401 | Refresh |
| `validation_error` | 400 | Валидация входа / невалидный UUID / неверный plan |
| `session_not_found` | 404 | Все роуты по session |
| `player_not_found` | 404 | Lobby, Game |
| `session_full` | 409 | Join |
| `game_already_started` | 409 | Leave, kick в waiting, update_settings |
| `not_host` | 403 | Hostonly операции |
| `wrong_phase` | 403/409 | Фазные ограничения |
| `confirmation_required` | 400 | Kick во время active без `confirm=true` |
| `invalid_role_config` | 400 | Создание/обновление настроек |
| `pro_required` | 403 | Создание сессии >5 игроков без Pro |
| `player_dead` | 403 | Ночные/дневные действия выбывших |
| `invalid_target` | 400 | Некорректная цель действия/голоса |
| `action_already_submitted` | 409 | Повтор действия в той же фазе |
| `game_paused` | 403 | Все мутирующие action-роуты при активной паузе |
| `internal_error` | 500 | Непойманные исключения |

### WebSocket

Закрытие коннекта с кодами `4000` / `4001` / `4003` (см. §6).

---

## 11. База данных и миграции

**Движок**: PostgreSQL 16 (Docker) + asyncpg. SQLAlchemy `async_session_factory` с `expire_on_commit=False`. При исключении в зависимостях выполняется `session.rollback()`.

**Alembic**: каталог `alembic/`, версии в `alembic/versions/`:

- `2001c4cd71c8_initial_models.py`
- `20260408_rebuild_schema_v2.py` (пересборка таблиц под актуальные ORM-модели)
- `20260409_users_display_name.py` (добавление `display_name`)

**Команды**:

```bash
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "описание_изменений"
uv run alembic downgrade -1
```

**Seed ролей**:

```bash
uv run python -m scripts.seed
# или в Docker:
docker compose exec backend uv run python -m scripts.seed
```

**Сводка уникальных ключей**:

| Таблица | Уникальный ключ |
|---|---|
| `users` | `email` |
| `sessions` | `code` |
| `players` | `(session_id, user_id)` |
| `game_phases` | `(session_id, phase_number, phase_type)` |
| `night_actions` | `(phase_id, actor_player_id)` |
| `day_votes` | `(phase_id, voter_player_id)` |
| `refresh_tokens` | `token_hash` |
| `payments` | `idempotency_key`, partial unique `provider_payment_id` WHERE NOT NULL |
| `roles` | `slug`, `name` |

---

## 12. Тестирование

- Фреймворк: `pytest` + `pytest-asyncio` в `asyncio_mode = "auto"` (`pyproject.toml`)
- `tests/conftest.py` задаёт `SECRET_KEY` для окружения тестов
- Фактическое покрытие: только `tests/test_smoke_openapi.py` (валидация `/openapi.json` через `httpx.ASGITransport` без живой БД)
- Каталоги `tests/integration/` и `tests/unit/` существуют, но файлы-stubs
- **E2E-smoke** вне pytest: `scripts/run_e2e_five_players.py` — прогон полного цикла на 5 пользователей через HTTP

Запуск:

```bash
cd backend
uv run pytest
```

---

## 13. Фоновые задачи

- Внешних планировщиков (Celery, APScheduler) **нет**
- Всё фоновое — через `asyncio.create_task`
- **Startup-хук** `main.py::_startup_recovery` запускает `services/recovery_service.recovery_loop()` — он периодически обходит активные сессии, пересоздаёт таймеры фаз и при ночной фазе возобновляет `execute_night_sequence` в отдельной DB-сессии (флаг `night_sequence_running` защищает от двойного запуска)
- Таймеры фаз хранятся в `services/timer_service.py::timer_service` как `asyncio.Task` per (session_id, timer_name)

---

## 14. Сборка и развёртывание

### Dockerfile

- База: `python:3.12-slim`
- `UV_LINK_MODE=copy`
- Устанавливает `uv` из `ghcr.io/astral-sh/uv:latest`
- `uv sync --frozen --no-dev`
- Порт 8000
- CMD: `uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload`

### docker-compose.yml

- `db` — `postgres:16-alpine`, пробрасывает `5432:5432`, том `postgres_data`, healthcheck `pg_isready`
- `backend` — `build: .`, `env_file: .env`, `DATABASE_URL` переопределяется на `postgresql+asyncpg://...@db:5432/...`, `depends_on: db (service_healthy)`, монтирует код в `/app`

### Локальный запуск (dev)

```bash
docker compose up db -d
uv sync
uv run uvicorn main:app --reload
```

CI/CD в каталоге `backend/` не настроен.

---

## 15. AI / LLM интеграция

**Статус: заготовка, не реализована.**

- `schemas/ai.py` и `services/ai_service.py` существуют как плейсхолдеры
- В зависимостях нет SDK Anthropic/OpenAI
- Нарратив ведущего сейчас идёт через `announcement.trigger` в WebSocket-payload — клиент сам выбирает локализованную озвучку, серверной генерации голоса нет

Это направление помечено в `README.md` и `ARCHITECTURE.md` как «не обязательно для классической Мафии, но запланировано».

---

## 16. Скрипты и утилиты

| Файл | Как запустить | Что делает |
|---|---|---|
| `scripts/seed.py` | `uv run python -m scripts.seed` | Идемпотентный seed ролей в `roles` |
| `scripts/run_e2e_five_players.py` | `uv run python -m scripts.run_e2e_five_players` | Полный smoke: 5 юзеров, создание сессии, join, старт, ночь, день, голосование |

---

## 17. Что сознательно не подключено

- **`api/routers/users.py`** — файл может присутствовать в репозитории, но **не регистрируется** в `main.py`; публичный профиль получается через `/api/auth/me`
- **`api/websockets/chat.py`**, **`api/websockets/game.py`** — черновики
- **`services/ai_service.py`**, **`services/chat_service.py`** — заготовки
- **`core/logging/middleware.py`**, **`core/security.py`** — пустые файлы

---

## 18. Известные пробелы (из README/ARCHITECTURE)

- Монетизация: нет интеграции с платёжным провайдером; подписка Pro создаётся прямой записью в БД
- Политика утечек: нет аудита ответов API на предмет выдачи чужих ролей/ночных выборов
- Реплей событий: нет `GET /events` для клиентского восстановления без WS
- Структурированное логирование и метрики отсутствуют
- Интеграционные тесты против тестовой БД отсутствуют
- `@app.on_event("startup")` помечен как устаревший — рекомендуется миграция на `lifespan`
- Глобальный админ-API (не хост) отсутствует

---

## 19. Подсказки по чтению кода

- **Точка входа**: `main.py` → `api/routers/*` → `services/game_engine.py`
- **Игровой цикл**: `game_engine.py` → `phase_manager.py` → `night_action_resolver.py` → `timer_service.py`
- **Состояние и восстановление**: `runtime_state.py` + `state_service.py` + `recovery_service.py`
- **WebSocket**: `api/websockets/ws.py` + `services/ws_manager.py`
- **Модели**: `models/*.py` — по одной на таблицу
- **Контракты**: `schemas/*.py` — по модулю API
