## Backend: карта модулей и связей

Актуальное описание `backend/` — точка входа, слои, роуты и сервисы.

### 1) Точка входа и инфраструктура

- `**main.py**`
  - `FastAPI(title="AI-GameMaster")`, CORS из `core/config.py`.
  - Обработчики ошибок: `GameError`, `RequestValidationError` (400 `validation_error`), общий `Exception` → 500.
  - Роутеры (см. ниже); **WebSocket** отдельным префиксом `/ws`.
  - `**startup`**: фоновая задача `recovery_loop()` из `services/recovery_service.py` — продолжение активных игр после рестарта процесса.
- `**core/config.py`** — `DATABASE_URL`, `SECRET_KEY`, TTL access/refresh, `CORS_ORIGINS`, `DEBUG` и т.д.
- `**core/database.py**` — async engine, `async_session_factory`, `Base`; сессии с rollback при ошибках.
- `**core/exceptions.py**` — `GameError` + единый JSON-ответ.
- `**alembic/**` — миграции; целевая схема в т.ч. через `versions/20260408_rebuild_schema_v2.py` (пересборка таблиц под ORM-модели).

### 2) ORM-модели (`models/`)

Импорт пакета через `models/__init__.py` (Alembic `env.py`).


| Модель                    | Назначение                                                                  |
| ------------------------- | --------------------------------------------------------------------------- |
| `user`                    | Пользователи (email, password_hash)                                         |
| `session`                 | Игровая сессия: код, хост, число мест, статус, `settings` (JSONB)           |
| `player`                  | Участник сессии: имя, `user_id`, `role_id`, статус, порядок входа           |
| `role`                    | Роль (slug, team, abilities) — заполняется `scripts/seed.py`                |
| `game_phase`              | Фазы: `role_reveal` / `night` / `day`                                       |
| `night_action`            | Ночные действия по фазе                                                     |
| `day_vote`                | Голоса в дневной фазе                                                       |
| `game_event`              | Журнал: join, phase_changed, night_result, vote_result, game_finished и др. |
| `subscription`, `payment` | Подписки / заготовка платежей                                               |
| `refresh_token`           | Refresh-токены (хеш в БД, rotation)                                         |


### 3) Pydantic-схемы (`schemas/`)


| Файл                          | Назначение                                                              |
| ----------------------------- | ----------------------------------------------------------------------- |
| `auth.py`                     | регистрация/ вход / refresh / me / logout                               |
| `session.py`                  | создание сессии, вход в сессию, список игроков, `UpdateSettingsRequest` |
| `subscription.py`             | подписка                                                                |
| `user.py`                     | минимальные DTO пользователя                                            |
| `game.py`, `role.py`, `ai.py` | контракты под игру / роли / AI (по мере использования в роутерах)       |


### 4) Auth

- `**services/auth_service.py**` — bcrypt, JWT access, случайный refresh, SHA-256 хеш refresh для БД.
- `**api/deps.py**` — `get_db`, `get_current_user` (Bearer JWT).
- `**api/routers/auth.py**` — `register`, `login`, `refresh` (rotation), `me` (в т.ч. флаг Pro), `logout`.

### 5) Сессии и лобби

- `**services/session_service.py**` — генерация уникального 6-символьного кода.
- `**api/routers/sessions.py**` — создание сессии (валидация `role_config`, Pro при `player_count > 5`), `GET` по коду, `join` (+ событие `player_joined`, WS).
- `**api/routers/lobby.py**` — список игроков, выход, кик (хост), закрытие сессии, `**PATCH /{session_id}/settings**` (только хост, до старта игры) + WS `settings_updated`.

**Организатор партии** = `sessions.host_user_id`; отдельного «глобального админа» в API пока нет.

### 6) WebSocket

- `**services/ws_manager.py`** — подключения по `session_id` и `user_id`, рассылка в сессию / пользователю, закрытие.
- `**api/websockets/ws.py`** — `ws://.../ws/sessions/{session_id}?token=<access_jwt>`; проверка JWT и членства в сессии; ping/pong.

События игры часто содержат `**announcement.trigger**` — клиент по нему выбирает локальную озвучку (сервер аудио не отдаёт).

### 7) Состояние, таймеры, recovery

- `**services/runtime_state.py**` — in-memory на время процесса: подфаза дня, ночной ход, таймеры, `night_action_event`, выбор мафии и т.д.
- `**services/timer_service.py**` — `asyncio.Task` на сессию (role_reveal, discussion, voting, ночные ходы).
- `**services/state_service.py**` — восстановление подфазы / ночного хода / таймера из последнего `game_events.phase_changed` (reconnect и согласование с БД).
- `**services/recovery_service.py**` — периодический обход активных сессий: пересоздание таймеров, при ночи — возобновление `execute_night_sequence` в отдельной DB-сессии; флаг `night_sequence_running` против двойного запуска.

### 8) Игровой движок (`services/game_engine.py`)

Основная серверная логика MVP:

- `**start_game**` — раздача ролей, фаза `role_reveal`, WS `game_started` / `role_assigned`, таймер → переход в ночь (если не все нажали ack раньше).
- `**acknowledge_role**` — события ack; при полном составе — **отмена таймера `role_reveal`** и переход в ночь (защита от дубля фазы с таймером).
- `**transition_to_night` / `execute_night_sequence**` — очередь mafia → doctor → sheriff; идемпотентность по уже записанным `night_actions` (resume после рестарта); `phase_changed` в `game_events` для восстановления.
- `**resolve_night**`, `**transition_to_day**`, `**transition_to_voting**`, `**resolve_votes**` — день, голосование, итог; при полном наборе голосов таймер голосования может быть отменён досрочно.
- `**finish_game**`, проверка победы `**check_win_condition**`.
- Защита от гонок: проверка уже существующей фазы в БД + `IntegrityError` при вставке дубликата `(session_id, phase_number, phase_type)`.

Вспомогательные модули в `services/` (**заготовки или тонкие обёртки**, не ядро цикла): `phase_manager.py`, `night_action_resolver.py`, `chat_service.py`, `ai_service.py`, пакет `websocket_manager/` — при необходимости расширять или удалять мёртвое.

### 9) REST игры (`api/routers/game.py`)


| Метод                       | Назначение                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST .../start`            | Старт (только хост)                                                                                                                                                     |
| `POST .../acknowledge-role` | Подтверждение роли                                                                                                                                                      |
| `POST .../night-action`     | Ночной ход                                                                                                                                                              |
| `POST .../vote`             | Голосование                                                                                                                                                             |
| `GET .../state`             | Снимок для клиента: фаза, `phase.night_turn` в ночи, своя роль, цели, голоса; для `**finished`** — последняя закрытая фаза, `winner`, `final_roster` из `game_finished` |


### 10) Подписки

- `**api/routers/subscriptions.py`** — MVP-эндпоинты под Pro (интеграция с оплатой — по мере готовности).

### 11) Скрипты и тесты

- `**scripts/seed.py**` — `python -m scripts.seed`, idempotent seed ролей.
- `**scripts/run_e2e_five_players.py**` — смоук через HTTP (5 пользователей, полный цикл).
- `**tests/**` — pytest; `test_smoke_openapi.py` проверяет сборку OpenAPI без живой БД (`httpx.ASGITransport`).

### 12) Что сознательно не подключено к `main.py`

- `**api/routers/users.py**` — файл может лежать в репозитории, но **роутер не зарегистрирован**; публичный профиль сейчас через `/api/auth/me`.

### 13) Направления на будущее (не обязатель текущий код)

- Глобальный админ-панельный API.
- Полноценные платежи и вебхуки провайдера.
- Отдельный каталог триггеров озвучки и контракт `GET /events` для replay.
- Рефакторинг: разбиение `game_engine.py` на несколько модулей по желанию.
- Замена `@app.on_event("startup")` на **lifespan** (рекомендация FastAPI).

