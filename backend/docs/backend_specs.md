## 13.1 Database Models

### users

Зарегистрированные пользователи. Авторизация по `email` + пароль.

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `email` | `VARCHAR(255)` | NOT NULL | — | Email пользователя |
| `password_hash` | `VARCHAR(255)` | NOT NULL | — | Bcrypt-хеш пароля |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Дата регистрации |

**Constraints:**
- `PK (id)`
- `UNIQUE (email)`

**Indexes:**
- `idx_users_email ON users(email)` — поиск при логине

---

### sessions

Игровая сессия — точка входа для всех участников.

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `code` | `VARCHAR(6)` | NOT NULL | — | Код подключения (`AX7K2M`). Генерируется при создании |
| `host_user_id` | `UUID` | NOT NULL | — | FK → `users.id`. Организатор сессии |
| `player_count` | `INT` | NOT NULL | — | Макс. кол-во игроков (5–20) |
| `status` | `VARCHAR(20)` | NOT NULL | `'waiting'` | `waiting` → `active` → `finished` |
| `settings` | `JSONB` | NOT NULL | `'{}'` | Настройки партии (таймеры, конфигурация ролей) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Время создания |
| `ended_at` | `TIMESTAMPTZ` | NULL | — | Время завершения |

**Constraints:**
- `PK (id)`
- `UNIQUE (code)`
- `FK (host_user_id) → users(id)`
- `CHECK (status IN ('waiting', 'active', 'finished'))`
- `CHECK (player_count BETWEEN 5 AND 20)`

**Indexes:**
- `idx_sessions_code ON sessions(code)` — поиск при подключении по коду
- `idx_sessions_host ON sessions(host_user_id)` — сессии пользователя

**Формат `settings`:**
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

---

### players

Игрок, подключённый к сессии.

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `session_id` | `UUID` | NOT NULL | — | FK → `sessions.id` |
| `user_id` | `UUID` | NOT NULL | — | FK → `users.id` |
| `name` | `VARCHAR(32)` | NOT NULL | — | Отображаемое имя в партии |
| `role_id` | `UUID` | NULL | — | FK → `roles.id`. NULL до старта игры |
| `status` | `VARCHAR(10)` | NOT NULL | `'alive'` | `alive` / `dead` |
| `join_order` | `INT` | NOT NULL | — | Порядок подключения (1, 2, 3…) |

**Constraints:**
- `PK (id)`
- `FK (session_id) → sessions(id) ON DELETE CASCADE`
- `FK (user_id) → users(id)`
- `FK (role_id) → roles(id)`
- `UNIQUE (session_id, user_id)` — один аккаунт = одно участие в сессии
- `CHECK (status IN ('alive', 'dead'))`

**Indexes:**
- `idx_players_session ON players(session_id)` — все игроки сессии
- `idx_players_user ON players(user_id)` — сессии пользователя

---

### roles

Справочник ролей. Заполняется при инициализации, не зависит от конкретной игры.

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `slug` | `VARCHAR(20)` | NOT NULL | — | Программный ключ: `mafia`, `sheriff`, `doctor`, `civilian`. Используется в `role_config` и API |
| `name` | `VARCHAR(50)` | NOT NULL | — | Отображаемое название: `Мафия`, `Шериф`, `Доктор`, `Мирный` |
| `team` | `VARCHAR(10)` | NOT NULL | — | `mafia` / `city` |
| `abilities` | `JSONB` | NOT NULL | `'{}'` | Описание способностей |

**Constraints:**
- `PK (id)`
- `UNIQUE (slug)`
- `UNIQUE (name)`
- `CHECK (team IN ('mafia', 'city'))`

**Seed data (MVP):**

| slug | name | team | abilities |
|------|------|------|-----------|
| `mafia` | `Мафия` | `mafia` | `{"night_action": "kill"}` |
| `sheriff` | `Шериф` | `city` | `{"night_action": "check"}` |
| `doctor` | `Доктор` | `city` | `{"night_action": "heal"}` |
| `civilian` | `Мирный` | `city` | `{"night_action": null}` |

---

### game_phases

Фиксирует каждую смену дня и ночи.

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `session_id` | `UUID` | NOT NULL | — | FK → `sessions.id` |
| `phase_type` | `VARCHAR(15)` | NOT NULL | — | `role_reveal` / `night` / `day` |
| `phase_number` | `INT` | NOT NULL | — | Номер хода (1, 2, 3…) |
| `started_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Начало фазы |
| `ended_at` | `TIMESTAMPTZ` | NULL | — | Конец фазы |

**Constraints:**
- `PK (id)`
- `FK (session_id) → sessions(id) ON DELETE CASCADE`
- `UNIQUE (session_id, phase_number, phase_type)`
- `CHECK (phase_type IN ('role_reveal', 'day', 'night'))`

---

### night_actions

Ночные действия спецролей.

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `phase_id` | `UUID` | NOT NULL | — | FK → `game_phases.id` |
| `actor_player_id` | `UUID` | NOT NULL | — | FK → `players.id` — кто действует |
| `target_player_id` | `UUID` | NOT NULL | — | FK → `players.id` — цель |
| `action_type` | `VARCHAR(10)` | NOT NULL | — | `kill` / `check` / `heal` |
| `was_blocked` | `BOOLEAN` | NOT NULL | `FALSE` | Доктор вылечил цель мафии |

**Constraints:**
- `PK (id)`
- `FK (phase_id) → game_phases(id) ON DELETE CASCADE`
- `FK (actor_player_id) → players(id)`
- `FK (target_player_id) → players(id)`
- `UNIQUE (phase_id, actor_player_id)` — одно действие за ночь
- `CHECK (action_type IN ('kill', 'check', 'heal'))`

---

### day_votes

Голоса дневного исключения.

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `phase_id` | `UUID` | NOT NULL | — | FK → `game_phases.id` |
| `voter_player_id` | `UUID` | NOT NULL | — | FK → `players.id` — кто голосует |
| `target_player_id` | `UUID` | NULL | — | FK → `players.id` — за кого. NULL = пропуск голоса |

**Constraints:**
- `PK (id)`
- `FK (phase_id) → game_phases(id) ON DELETE CASCADE`
- `FK (voter_player_id) → players(id)`
- `FK (target_player_id) → players(id)`
- `UNIQUE (phase_id, voter_player_id)` — один голос за фазу
- `CHECK (voter_player_id != target_player_id)` — нельзя голосовать за себя (применяется только при `target_player_id IS NOT NULL`)

---

### game_events

Полный лог событий для восстановления состояния при реконнекте.

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `session_id` | `UUID` | NOT NULL | — | FK → `sessions.id` |
| `phase_id` | `UUID` | NULL | — | FK → `game_phases.id`. NULL для событий уровня сессии |
| `event_type` | `VARCHAR(30)` | NOT NULL | — | Тип события |
| `payload` | `JSONB` | NOT NULL | `'{}'` | JSON с деталями |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Время события |

**Constraints:**
- `PK (id)`
- `FK (session_id) → sessions(id) ON DELETE CASCADE`
- `FK (phase_id) → game_phases(id)`
- `CHECK (event_type IN ('player_joined', 'player_left', 'game_started', 'role_acknowledged', 'all_acknowledged', 'phase_changed', 'night_action_submitted', 'night_result', 'player_eliminated', 'vote_cast', 'vote_result', 'game_finished', 'session_closed'))`

> **Не все WS-события персистятся.** Персональные/эфемерные события (`role_assigned`, `action_required`, `action_confirmed`, `action_timeout`, `mafia_choice_made`, `check_result`, `vote_update`, `kicked`, `settings_updated`, `rematch_proposed`, `error`, `pong`) — отправляются только через WS и **не записываются** в `game_events`.

**Indexes:**
- `idx_game_events_session_created ON game_events(session_id, created_at)` — восстановление лога

---

### subscriptions

Подписка пользователя.

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | `UUID` | NOT NULL | — | FK → `users.id` |
| `plan` | `VARCHAR(10)` | NOT NULL | — | `free` / `pro` |
| `period_start` | `TIMESTAMPTZ` | NOT NULL | — | Начало периода |
| `period_end` | `TIMESTAMPTZ` | NOT NULL | — | Конец периода |
| `cancel_at_period_end` | `BOOLEAN` | NOT NULL | `FALSE` | Не продлевать автоматически |
| `status` | `VARCHAR(15)` | NOT NULL | — | `active` / `cancelled` / `expired` |

**Constraints:**
- `PK (id)`
- `FK (user_id) → users(id)`
- `CHECK (plan IN ('free', 'pro'))`
- `CHECK (status IN ('active', 'cancelled', 'expired'))`

**Indexes:**
- `idx_subscriptions_user ON subscriptions(user_id)` — подписка пользователя

---

### payments

Платёжные записи. *Детали реализации — позже.*

| Поле | Тип | Nullable | Default | Описание |
|------|-----|----------|---------|----------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PK |
| `subscription_id` | `UUID` | NOT NULL | — | FK → `subscriptions.id` |
| `amount_kopecks` | `INT` | NOT NULL | — | Сумма в копейках (9900 = 99₽) |
| `provider` | `VARCHAR(20)` | NOT NULL | — | Платёжная система |
| `provider_payment_id` | `VARCHAR(255)` | NULL | — | ID транзакции у провайдера |
| `idempotency_key` | `VARCHAR(255)` | NOT NULL | — | Защита от двойного списания |
| `status` | `VARCHAR(15)` | NOT NULL | `'pending'` | `pending` → `succeeded` / `failed` / `refunded` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Время создания |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Последнее обновление |

**Constraints:**
- `PK (id)`
- `FK (subscription_id) → subscriptions(id)`
- `UNIQUE (provider_payment_id)` — WHERE NOT NULL
- `UNIQUE (idempotency_key)`
- `CHECK (amount_kopecks > 0)`
- `CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded'))`

---

## 13.2 API Routes

Все эндпоинты имеют префикс `/api`. Формат данных — JSON. Авторизация через заголовок `Authorization: Bearer {access_token}`.

**Глобальные коды ошибок** (применяются ко всем эндпоинтам, не дублируются в таблицах):

| Код | Когда возникает |
|-----|----------------|
| `401 Unauthorized` | Заголовок `Authorization` отсутствует, access token невалиден или истёк |
| `500 Internal Server Error` | Необработанная ошибка на сервере |

### Auth

#### `POST /api/auth/register`

Создание нового аккаунта.

**Request:**
```json
{
  "email": "string",
  "password": "string (min 8 chars)"
}
```

**Response `201 Created`:**
```json
{
  "user_id": "uuid",
  "email": "string",
  "access_token": "string",
  "refresh_token": "string"
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `400` | Поле `email` пустое или не соответствует формату email; `password` короче 8 символов |
| `409` | Пользователь с таким `email` уже существует в таблице `users` |

---

#### `POST /api/auth/login`

Вход в существующий аккаунт.

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response `200 OK`:**
```json
{
  "user_id": "uuid",
  "email": "string",
  "access_token": "string",
  "refresh_token": "string"
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `401` | Пользователь с таким `email` не найден, или `password` не совпадает с хешем в БД |

---

#### `POST /api/auth/refresh`

Обновление access token.

**Request:**
```json
{
  "refresh_token": "string"
}
```

**Response `200 OK`:**
```json
{
  "access_token": "string",
  "refresh_token": "string"
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `401` | `refresh_token` не найден в БД (уже использован или отозван), или срок действия истёк (> 30 дней) |

---

#### `GET /api/auth/me`

Профиль текущего пользователя. Требует авторизации.

**Response `200 OK`:**
```json
{
  "user_id": "uuid",
  "email": "string",
  "has_pro": "boolean",
  "created_at": "ISO 8601"
}
```

---

#### `POST /api/auth/logout`

Выход из аккаунта. Инвалидирует refresh token. Требует авторизации.

**Request:**
```json
{
  "refresh_token": "string"
}
```

**Response `204 No Content`**

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `400` | `refresh_token` не передан в теле запроса |

> После вызова: refresh token удаляется из БД, access token продолжает действовать до истечения TTL (15 мин). Клиент должен удалить оба токена из хранилища.

---

### Sessions

#### `POST /api/sessions`

Создание игровой сессии. Требует авторизации.

**Request:**
```json
{
  "player_count": "int (5–20)",
  "settings": {
    "role_reveal_timer_seconds": "int (10–30, default 15)",
    "discussion_timer_seconds": "int (30–300, default 120)",
    "voting_timer_seconds": "int (15–120, default 60)",
    "night_action_timer_seconds": "int (15–60, default 30)",
    "role_config": {
      "mafia": "int",
      "sheriff": "int (0 or 1)",
      "doctor": "int (0 or 1)"
    }
  }
}
```

**Response `201 Created`:**
```json
{
  "id": "uuid",
  "code": "string (6 chars)",
  "host_user_id": "uuid",
  "player_count": "int",
  "status": "waiting",
  "settings": { "..." },
  "created_at": "ISO 8601"
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `400` | `player_count` < 5 или > 20; сумма ролей в `role_config` не равна `player_count`; `mafia` >= количество city-ролей; `sheriff` или `doctor` > 1 |
| `403` | `player_count` > 5, а у текущего пользователя нет активной подписки `Pro` |

---

#### `GET /api/sessions/{code}`

Информация о сессии по коду. Требует авторизации.

**Response `200 OK`:**
```json
{
  "id": "uuid",
  "code": "string",
  "host_user_id": "uuid",
  "player_count": "int",
  "status": "string",
  "settings": { "..." },
  "players": [
    {
      "id": "uuid",
      "name": "string",
      "join_order": "int",
      "is_host": "boolean"
    }
  ],
  "created_at": "ISO 8601"
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `404` | В таблице `sessions` нет записи с переданным `code` |

---

#### `POST /api/sessions/{code}/join`

Подключение к сессии по коду. Требует авторизации.

**Request:**
```json
{
  "name": "string (1–32 chars)"
}
```

**Response `200 OK`:**
```json
{
  "player_id": "uuid",
  "session_id": "uuid",
  "join_order": "int"
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `400` | `name` пустое, только пробелы, или длиннее 32 символов |
| `404` | Сессия с переданным `code` не найдена |
| `409` | Запись `players` с таким `session_id` + `user_id` уже существует |
| `403` | Количество `players` в сессии уже равно `player_count`; или `sessions.status` != `waiting` |

---

### Lobby

#### `GET /api/sessions/{id}/players`

Список игроков в сессии. Требует авторизации.

**Response `200 OK`:**
```json
{
  "players": [
    {
      "id": "uuid",
      "name": "string",
      "join_order": "int",
      "is_host": "boolean"
    }
  ]
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `404` | Сессия с переданным `id` не найдена |

---

#### `DELETE /api/sessions/{id}/players/me`

Выход из лобби. Требует авторизации. Только до старта игры.

**Response `204 No Content`**

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `404` | Нет записи в `players` с `session_id` = переданный `id` и `user_id` = текущий пользователь |
| `409` | `sessions.status` = `active` или `finished` — выход из активной/завершённой игры невозможен |

---

#### `DELETE /api/sessions/{id}/players/{player_id}`

Кик игрока из лобби. Только организатор, только до старта игры.

**Response `204 No Content`**

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `403` | `sessions.host_user_id` != текущий пользователь; или `player_id` принадлежит самому организатору (нельзя кикнуть себя) |
| `404` | Сессия не найдена; или `player_id` не найден среди `players` этой сессии |
| `409` | `sessions.status` != `waiting` — кик возможен только в лобби |

> После кика: запись удаляется из `players`, WS-событие `player_left` отправляется всем участникам, кикнутый игрок получает WS-событие `kicked` и соединение закрывается.

---

#### `DELETE /api/sessions/{id}`

Закрытие сессии организатором. Доступно в любом статусе.

**Response `204 No Content`**

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `403` | `sessions.host_user_id` != текущий пользователь |
| `404` | Сессия с переданным `id` не найдена |

> После закрытия: `sessions.status` → `finished`, `sessions.ended_at` → `NOW()`. Всем подключённым игрокам отправляется WS-событие `session_closed`, WebSocket-соединения закрываются. Если игра была `active` — партия завершается без победителя.

---

#### `PATCH /api/sessions/{id}/settings`

Изменение настроек партии. Только организатор, до старта.

**Request:**
```json
{
  "role_reveal_timer_seconds": "int (optional)",
  "discussion_timer_seconds": "int (optional)",
  "voting_timer_seconds": "int (optional)",
  "night_action_timer_seconds": "int (optional)",
  "role_config": {
    "mafia": "int",
    "sheriff": "int",
    "doctor": "int"
  }
}
```

**Response `200 OK`:**
```json
{
  "settings": {
    "role_reveal_timer_seconds": "int",
    "discussion_timer_seconds": "int",
    "voting_timer_seconds": "int",
    "night_action_timer_seconds": "int",
    "role_config": { "..." }
  }
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `403` | `sessions.host_user_id` != текущий пользователь |
| `400` | Сумма ролей в `role_config` != `player_count`; `mafia` >= city-ролей; `discussion_timer_seconds` < 30 или > 300 |
| `404` | Сессия с переданным `id` не найдена |
| `409` | `sessions.status` != `waiting` — настройки можно менять только до старта |

---

#### `POST /api/sessions/{id}/start`

Запуск партии. Только организатор.

**Response `200 OK`:**
```json
{
  "status": "active",
  "phase": {
    "type": "role_reveal",
    "number": 0
  }
}
```

> После старта сессия переходит в фазу `role_reveal`, а **не сразу в ночь**. Роли раздаются, каждый игрок видит свою карточку и подтверждает ознакомление. Первая ночь начинается после того, как все подтвердили или таймер ознакомления истёк.

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `403` | `sessions.host_user_id` != текущий пользователь |
| `400` | Количество записей в `players` < минимума для выбранной `role_config`; сумма ролей != количество игроков; `mafia` >= city-ролей |
| `409` | `sessions.status` = `active` или `finished` — игра уже запущена или завершена |

---

#### `POST /api/sessions/{id}/acknowledge-role`

Подтверждение ознакомления с ролью. Вызывается каждым игроком после просмотра своей карточки роли. Требует авторизации.

**Response `200 OK`:**
```json
{
  "acknowledged": true,
  "players_acknowledged": "int",
  "players_total": "int"
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `403` | Текущая фаза != `role_reveal`; `players.status` != `alive` |
| `409` | Игрок уже подтвердил ознакомление |
| `404` | Сессия не найдена; пользователь не игрок этой сессии |

> Когда все игроки подтвердили **ИЛИ** `role_reveal_timer_seconds` истёк — сервер автоматически переводит в ночь №1. WS: `all_acknowledged`, затем `phase_changed` (night, 1).

---

### Game

#### `GET /api/sessions/{id}/state`

Текущее состояние партии для конкретного игрока. Данные фильтруются по роли и статусу — игрок получает только разрешённую информацию.

**Response `200 OK`:**
```json
{
  "session_status": "active | finished",
  "phase": {
    "id": "uuid",
    "type": "role_reveal | night | day",
    "number": "int",
    "sub_phase": "discussion | voting | null",
    "started_at": "ISO 8601",
    "timer_seconds": "int",
    "timer_started_at": "ISO 8601"
  },
  "my_player": {
    "id": "uuid",
    "name": "string",
    "status": "alive | dead",
    "role": {
      "name": "string",
      "team": "mafia | city",
      "abilities": { "night_action": "kill | check | heal | null" }
    }
  },
  "players": [
    {
      "id": "uuid",
      "name": "string",
      "status": "alive | dead",
      "join_order": "int"
    }
  ],
  "role_reveal": {
    "my_acknowledged": "boolean",
    "players_acknowledged": "int",
    "players_total": "int"
  },
  "awaiting_action": "boolean",
  "action_type": "kill | check | heal | vote | null",
  "available_targets": [
    { "player_id": "uuid", "name": "string" }
  ],
  "my_action_submitted": "boolean",
  "votes": {
    "total_expected": "int",
    "cast": "int"
  },
  "result": {
    "winner": "mafia | city | null",
    "announcement": { "audio_url": "string", "text": "string", "duration_ms": "int" },
    "players": [
      {
        "id": "uuid",
        "name": "string",
        "role": { "name": "string", "team": "string" },
        "status": "string"
      }
    ]
  }
}
```

**Условия присутствия полей:**
- `role_reveal` — только при `phase.type: "role_reveal"`
- `available_targets`, `action_type` — при `awaiting_action: true` (ночные действия И голосование)
- `votes` — только при `phase.sub_phase: "voting"`
- `result` — только при `session_status: "finished"`. Содержит `announcement` для финальной озвучки (при реконнекте)
- `phase.sub_phase` — только при `phase.type: "day"` (`discussion` или `voting`), иначе `null`
- `phase.timer_seconds` + `phase.timer_started_at` — текущий активный таймер. Во время ночи: таймер текущей спецроли (или `null` если ожидание между ходами)
- Чужие роли **не передаются**, кроме `result` при `finished`
- `available_targets` при голосовании **не содержит текущего игрока** (нельзя голосовать за себя)

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `404` | Сессия с переданным `id` не найдена; или текущий пользователь не является игроком этой сессии |
| `403` | `sessions.status` = `waiting` — игра ещё не началась |

---

#### `POST /api/sessions/{id}/night-action`

Подтверждение ночного действия. Требует авторизации. Только живые игроки с ночной ролью в фазе `night`.

**Request:**
```json
{
  "target_player_id": "uuid"
}
```

**Response `200 OK`:**
```json
{
  "action_type": "kill | check | heal",
  "target_player_id": "uuid",
  "confirmed": true
}
```

**Для Шерифа — дополнительное поле в ответе:**
```json
{
  "action_type": "check",
  "target_player_id": "uuid",
  "confirmed": true,
  "check_result": {
    "team": "mafia | city"
  }
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `400` | `target_player_id` не найден среди живых игроков сессии; мафия указала `target_player_id` = свой `player_id` |
| `403` | Текущая фаза != `night`; у роли игрока нет `night_action`; `players.status` = `dead` |
| `409` | В `night_actions` уже есть запись с `phase_id` текущей фазы и `actor_player_id` этого игрока |
| `404` | Сессия не найдена; пользователь не игрок этой сессии |

---

#### `POST /api/sessions/{id}/vote`

Голосование за исключение. Требует авторизации. Только живые игроки в фазе `day`.

**Request:**
```json
{
  "target_player_id": "uuid | null"
}
```

> `null` — пропуск голоса (воздержался). Запись в `day_votes` создаётся с `target_player_id = NULL`.

**Response `200 OK`:**
```json
{
  "voter_player_id": "uuid",
  "target_player_id": "uuid | null",
  "confirmed": true
}
```

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `400` | `target_player_id` не `null` и не найден среди живых игроков; `target_player_id` = `voter_player_id` (голос за себя) |
| `403` | `phase.sub_phase` != `voting`; `players.status` = `dead` — мёртвые не голосуют |
| `409` | В `day_votes` уже есть запись с `phase_id` текущей фазы и `voter_player_id` этого игрока |
| `404` | Сессия не найдена; пользователь не игрок этой сессии |

---

#### `POST /api/sessions/{id}/rematch`

Запуск повторной игры. Только организатор, после завершения партии.

**Request:**
```json
{
  "keep_players": "boolean",
  "settings": {
    "discussion_timer_seconds": "int (optional)",
    "role_config": { "..." }
  }
}
```

**Response `201 Created`:**
```json
{
  "new_session_id": "uuid",
  "code": "string",
  "status": "waiting | active",
  "players_kept": "int"
}
```

> Если `keep_players: true` и состав валиден — сессия создаётся в статусе `waiting` (для подтверждения настроек) или сразу запускается.
> Если `keep_players: false` — создаётся новое лобби с тем же кодом.

**Errors:**
| Код | Когда возникает |
|-----|----------------|
| `403` | `sessions.host_user_id` != текущий пользователь |
| `400` | `sessions.status` != `finished`; `keep_players: true`, но количество подключённых игроков < минимума для `role_config` |
| `404` | Сессия с переданным `id` не найдена |

---

### Subscriptions

#### `GET /api/subscriptions/me`

Текущий статус подписки. Требует авторизации.

**Response `200 OK`:**
```json
{
  "plan": "free | pro",
  "status": "active | cancelled | expired | null",
  "period_end": "ISO 8601 | null",
  "cancel_at_period_end": "boolean"
}
```

> Если у пользователя нет подписки: `plan: "free"`, `status: null`, `period_end: null`.

---

#### `POST /api/subscriptions`

Создание подписки. *Детали платёжного флоу — позже (провайдеры не в scope MVP).*

**Request:**
```json
{
  "plan": "pro"
}
```

**Response `201 Created`:**
```json
{
  "subscription_id": "uuid",
  "plan": "pro",
  "status": "active",
  "period_start": "ISO 8601",
  "period_end": "ISO 8601"
}
```

---

## 13.3 WebSocket Protocol

### Подключение

```
ws://{host}/ws/sessions/{session_id}?token={access_token}
```

Сервер идентифицирует игрока по JWT из query-параметра. При невалидном токене — соединение отклоняется с кодом `4001`.

### Формат сообщений

Все сообщения — JSON с полем `type`:

```json
{
  "type": "event_name",
  "payload": { "..." }
}
```

### Server → Client

#### Лобби

| Event | Payload | Когда |
|-------|---------|-------|
| `player_joined` | `{ player_id, name, join_order }` | Новый игрок подключился |
| `player_left` | `{ player_id }` | Игрок вышел из лобби |
| `settings_updated` | `{ settings: {...} }` | Организатор изменил настройки |

#### Старт игры

| Event | Payload | Когда |
|-------|---------|-------|
| `game_started` | `{ phase: { type: "role_reveal", number: 0 }, timer_seconds, started_at }` | Организатор запустил партию — начинается ознакомление с ролями |
| `role_assigned` | `{ role: { name, team, abilities } }` | Персональное — роль этого игрока. Приходит одновременно с `game_started` |
| `role_acknowledged` | `{ player_id, players_acknowledged, players_total }` | Игрок подтвердил ознакомление. Отправляется всем для обновления счётчика |
| `all_acknowledged` | `{}` | Все игроки подтвердили ознакомление (или таймер истёк). Следом придёт `phase_changed` (night, 1) |

#### Игровой цикл

| Event | Payload | Когда |
|-------|---------|-------|
| `phase_changed` | `{ phase: { type, number }, sub_phase: "discussion \| voting \| null", timer_seconds: int \| null, timer_started_at: ISO8601 \| null, announcement: { audio_url, text, duration_ms } }` | Смена фазы или подфазы. `duration_ms` — сколько мс показывать экран ведущего. `timer_seconds` = `null` для ночи (таймеры в `action_required`). Frontend: `remaining = timer_seconds - (now - timer_started_at)` |
| `action_required` | `{ action_type, available_targets: [{ player_id, name }], timer_seconds, timer_started_at }` | Персональное — ход передан этой спецроли. Ночью отправляется **последовательно**: сначала Мафии, после её хода — Доктору, затем Шерифу |
| `action_confirmed` | `{ action_type }` | Персональное — действие принято сервером, ход передаётся следующей роли |
| `mafia_choice_made` | `{ target_player_id, target_name, chosen_by }` | Персональное, только мафии — другой мафиози выбрал жертву. Экран переключается на «Жертва выбрана: {target_name}» |
| `action_timeout` | `{ action_type }` | Персональное — таймер истёк, действие пропущено, ход передаётся следующей роли |
| `check_result` | `{ target_player_id, team }` | Персональное, только Шериф — результат проверки (приходит сразу после подтверждения хода Шерифа) |
| `night_result` | `{ died: [{ player_id, name }] \| null, announcement: { audio_url, text, duration_ms } }` | Итог ночи для всех — отправляется после завершения всех ходов. Frontend показывает экран ведущего на `duration_ms` |
| `vote_update` | `{ votes_cast, votes_total }` | Обновление счётчика голосов в реальном времени |
| `vote_result` | `{ eliminated: { player_id, name } \| null, votes: [{ voter_player_id, target_player_id }], announcement: { audio_url, text, duration_ms } }` | Итог голосования (голоса открытые). Frontend показывает экран ведущего на `duration_ms` |
| `player_eliminated` | `{ player_id, name, cause: "vote \| night" }` | Игрок выбыл |
| `kicked` | `{ reason: "host_kicked" }` | Персональное — игрок кикнут из лобби организатором |

#### Завершение

| Event | Payload | Когда |
|-------|---------|-------|
| `game_finished` | `{ winner: "mafia \| city", players: [{ id, name, role: { name, team }, status }], announcement: { audio_url, text, duration_ms } }` | Партия завершена — раскрытие всех ролей. `role` — объект (как в `role_assigned`). `duration_ms` — длительность озвучки |
| `rematch_proposed` | `{ host_name, new_session_id, code }` | Организатор предложил рематч. `code` и `new_session_id` позволяют другим игрокам перейти в новую сессию |
| `session_closed` | `{}` | Сессия закрыта организатором |

#### Служебные

| Event | Payload | Когда |
|-------|---------|-------|
| `error` | `{ code, message }` | Ошибка обработки |
| `pong` | `{}` | Ответ на ping |

### Client → Server

| Event | Payload | Описание |
|-------|---------|----------|
| `ping` | `{}` | Keepalive (каждые 30 сек) |

> Все игровые действия (ночные ходы, голосования) отправляются через **REST-эндпоинты**, а не через WebSocket. Это обеспечивает идемпотентность и надёжную обработку. WebSocket используется только для получения обновлений от сервера и keepalive.

---

## 13.4 Auth Flow

### Механизм

| Параметр | Значение |
|----------|---------|
| **Тип** | JWT (JSON Web Token) |
| **Access token TTL** | 15 минут |
| **Refresh token TTL** | 30 дней |
| **Алгоритм** | HS256 |
| **Хранение на клиенте** | `access_token` — память (переменная), `refresh_token` — `localStorage` |

### Payload access token

```json
{
  "sub": "user_id (uuid)",
  "email": "string",
  "exp": "unix timestamp",
  "iat": "unix timestamp"
}
```

### Схема работы

```
1. Регистрация/Логин → access_token + refresh_token
2. Каждый REST-запрос → Authorization: Bearer {access_token}
3. WebSocket-подключение → ws://host/ws/sessions/{id}?token={access_token}
4. access_token истёк (401) → POST /api/auth/refresh с refresh_token
5. refresh_token истёк → редирект на логин
```

### Refresh-механика

- При получении `401` от любого REST-эндпоинта клиент автоматически вызывает `/api/auth/refresh`
- При успехе — повторяет оригинальный запрос с новым access_token
- При неуспехе — перенаправляет на экран логина
- Refresh token — одноразовый (rotation): при обновлении выдаётся новый refresh_token, старый инвалидируется

---

## 13.5 Формат ответа ошибки

Все эндпоинты при ошибке возвращают единую JSON-структуру. Frontend и Backend обязаны следовать этому контракту.

```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `code` | `string` | Машиночитаемый код ошибки. Используется frontend для логики (показать конкретное сообщение, редирект и т.д.) |
| `message` | `string` | Человекочитаемое описание на русском. Может показываться пользователю как fallback |

**Коды ошибок:**

| HTTP | `code` | `message` (пример) | Когда |
|------|--------|--------------------|----|
| 400 | `validation_error` | «Пароль должен быть не короче 8 символов» | Невалидные входные данные |
| 400 | `invalid_role_config` | «Сумма ролей не равна количеству игроков» | Некорректная конфигурация ролей |
| 400 | `insufficient_players` | «Недостаточно игроков для выбранной конфигурации» | Мало игроков для старта |
| 400 | `invalid_target` | «Этот игрок уже выбыл» | Невалидная цель действия |
| 401 | `token_expired` | «Срок действия токена истёк» | Access token истёк |
| 401 | `token_invalid` | «Невалидный токен авторизации» | Токен повреждён или отозван |
| 401 | `invalid_credentials` | «Неверный email или пароль» | Ошибка при логине |
| 403 | `not_host` | «Только организатор может выполнить это действие» | Не хост пытается управлять сессией |
| 403 | `pro_required` | «Для этого количества игроков нужна подписка Pro» | Превышен лимит Free |
| 403 | `wrong_phase` | «Действие недоступно в текущей фазе» | Ночное действие днём или наоборот |
| 403 | `player_dead` | «Выбывшие игроки не могут совершать действия» | Мёртвый игрок пытается действовать |
| 404 | `session_not_found` | «Сессия не найдена» | Нет сессии с таким id/code |
| 404 | `player_not_found` | «Игрок не найден в этой сессии» | Игрок не в сессии |
| 409 | `already_joined` | «Вы уже подключены к этой сессии» | Повторное подключение |
| 409 | `session_full` | «Все места заняты» | Лобби заполнено |
| 409 | `game_already_started` | «Игра уже началась» | Попытка изменить запущенную игру |
| 409 | `action_already_submitted` | «Вы уже сделали выбор в этой фазе» | Повторная отправка действия |
| 409 | `game_not_finished` | «Игра ещё не завершена» | Рематч до окончания партии |
| 500 | `internal_error` | «Внутренняя ошибка сервера» | Необработанное исключение |

---

## 13.6 Поток игры (Game Flow)

### Состояния сессии

Сессия может находиться в одном из трёх состояний:

**1. `waiting` (ожидание)** — сессия создана, игроки подключаются в лобби. Организатор настраивает параметры. Новые игроки могут заходить по коду. Это состояние длится до тех пор, пока организатор не нажмёт «Старт».

**2. `active` (игра идёт)** — партия запущена, роли розданы. Внутри этого состояния игра циклически проходит через фазы: ночь → день (обсуждение) → день (голосование) → ночь → … Новые игроки подключиться не могут. Выход из сессии невозможен.

**3. `finished` (завершена)** — партия окончена. Определён победитель (или сессия закрыта принудительно). Игровые действия больше невозможны. Доступен рематч.

### Что переводит сессию между состояниями

**`waiting` → `active`**: организатор вызывает `POST /sessions/{id}/start`. Сервер проверяет количество игроков и конфигурацию ролей, случайно раздаёт роли и переводит сессию в фазу `role_reveal`. Каждый игрок видит карточку своей роли и подтверждает ознакомление (`POST /sessions/{id}/acknowledge-role`). Когда все подтвердили или таймер `role_reveal_timer_seconds` истёк — начинается ночь №1. WS-события: `game_started`, `role_assigned` (каждому свою), затем `all_acknowledged`, `phase_changed` (night, 1).

**`active` → `finished`**: происходит автоматически, когда после любого изменения состава живых игроков (смерть ночью или исключение голосованием) выполняется одно из условий победы. Сервер отправляет WS-событие `game_finished` с раскрытием всех ролей.

**Принудительное завершение**: организатор в любой момент может вызвать `DELETE /sessions/{id}`. Сессия переходит в `finished` без победителя. Все получают WS-событие `session_closed`.

### Фазы внутри активной игры

Внутри `active` игра проходит через фазы. Каждая фаза — это запись в таблице `game_phases`.

**Фаза ознакомления с ролью** (`role_reveal`) — промежуточная фаза между стартом и первой ночью. Каждый игрок видит карточку с названием роли, командой и описанием способностей. Нажимает «Ознакомлен». Когда все подтвердили или таймер истёк — переход в первую ночь.

**Ночная фаза** состоит из последовательных ходов спецролей (подробнее в 13.7):

1. Ход Мафии → Мафия видит экран выбора жертвы, остальные — экран ожидания
2. Ход Доктора → Доктор видит экран выбора цели лечения, остальные ждут
3. Ход Шерифа → Шериф видит экран выбора цели проверки, остальные ждут
4. Сервер резолвит итог ночи → все получают результат

**Дневная фаза** состоит из двух подфаз:

1. **Обсуждение** — длится `discussion_timer_seconds`. Игроки обсуждают (голосом или текстом, за пределами приложения). Frontend показывает обратный отсчёт. Когда таймер истекает, сервер автоматически переводит в голосование.

2. **Голосование** — длится `voting_timer_seconds`. Каждый живой игрок голосует за исключение или пропускает голос. Завершается когда все проголосовали или таймер истёк.

После голосования сервер подсчитывает результат, применяет его (исключение игрока или никто не исключён), проверяет условия победы. Если победитель не определён — начинается следующая ночь.

### Условия победы

Сервер проверяет условия после каждой смерти (ночью или днём):

- **Город побеждает** — когда среди живых не осталось ни одного игрока с `role.team = 'mafia'`
- **Мафия побеждает** — когда количество живых мафиози больше или равно количеству живых мирных (`alive_mafia >= alive_city`)
- **Игра продолжается** — во всех остальных случаях

### WS-события при переходах

| Момент | WS-событие | Кому |
|--------|-----------|------|
| Игра запущена | `game_started` | Всем |
| Роль назначена | `role_assigned` | Каждому лично (только его роль) |
| Смена фазы | `phase_changed` | Всем |
| Ход передан спецроли | `action_required` | Только этой спецроли |
| Действие подтверждено | `action_confirmed` | Только этой спецроли |
| Результат проверки | `check_result` | Только Шерифу |
| Итог ночи | `night_result` | Всем |
| Игрок выбыл | `player_eliminated` | Всем |
| Обновление голосов | `vote_update` | Всем |
| Итог голосования | `vote_result` | Всем |
| Игра завершена | `game_finished` | Всем (с раскрытием ролей) |

---

## 13.7 Порядок ночных действий

### Принцип: последовательные ходы, каждый на своём экране

Ночная фаза — это **последовательность ходов спецролей**. В каждый момент времени только один игрок видит экран выбора цели, остальные видят экран ожидания. Порядок фиксированный:

**1. Ход Мафии** — сервер отправляет WS-событие `action_required` **всем** живым игрокам с ролью `Мафия`. Каждый мафиози видит экран выбора жертвы. **Первый подтвердивший** фиксирует выбор для всей мафии:

- Подтвердивший мафиози получает WS: `action_confirmed { action_type: "kill" }`
- **Остальные мафиози** получают WS: `mafia_choice_made { target_player_id, target_name, chosen_by }` — их экран меняется на «Выбрана жертва: {имя}. Ожидание...». Они **не могут** изменить выбор.
- Если таймер истёк и никто из мафии не выбрал — действие пропущено, никто не погибает. Все мафиози получают `action_timeout`.

**2. Ход Доктора** — сервер отправляет `action_required` Доктору. Доктор выбирает кого лечить и подтверждает. Если таймер истёк — никто не вылечен. После подтверждения — `action_confirmed`.

**3. Ход Шерифа** — сервер отправляет `action_required` Шерифу. Шериф выбирает кого проверить и подтверждает. Сервер сразу возвращает результат проверки в ответе на `POST /night-action` (поле `check_result`) и дублирует через WS-событие `check_result`. Если таймер истёк — проверка не проведена.

**4. Резолв ночи** — после завершения всех ходов (или истечения всех таймеров) сервер обрабатывает результаты.

### Алгоритм резолва ночи

Сервер выполняет следующие шаги строго по порядку:

**Шаг 1 — Определение жертвы.** Если Мафия выбрала цель и Доктор вылечил ту же цель — `was_blocked = TRUE`, никто не погибает. Если Мафия выбрала цель и Доктор лечил другого (или не лечил) — жертва погибает, `players.status` → `dead`. Если Мафия не выбрала цель (таймер) — никто не погибает.

**Шаг 2 — Результат проверки Шерифа.** Шериф уже получил результат на шаге 3 ночи (сразу после своего хода). На этом этапе ничего дополнительного не происходит.

**Шаг 3 — Объявление итога ночи.** Сервер отправляет WS-событие `night_result` всем игрокам: кто погиб (или «этой ночью никто не погиб»). Если кто-то погиб — дополнительно `player_eliminated`.

**Шаг 4 — Проверка условий победы.** Если условие выполнено — `game_finished`. Если нет — переход в дневную фазу (`phase_changed`).

### Таймер ночных действий

Таймер `night_action_timer_seconds` применяется **к каждому ходу отдельно**. Каждая спецроль получает свой отсчёт. Если роль не отправила действие за отведённое время:

- **Мафия не выбрала** → никто не погибает этой ночью
- **Доктор не выбрал** → никто не вылечен
- **Шериф не выбрал** → проверка не проведена, результата нет

Сервер автоматически переходит к следующему ходу после истечения таймера текущей роли.

---

## 13.8 Голосование и разрешение ничьей

### Механика голосования

1. После истечения таймера обсуждения начинается фаза голосования
2. Каждый **живой** игрок может:
   - Проголосовать за одного из живых игроков (`POST /sessions/{id}/vote`)
   - **Пропустить голос** — отправить `{ "target_player_id": null }` (явный пропуск)
3. Голосование завершается когда:
   - Все живые игроки проголосовали или пропустили **ИЛИ**
   - Таймер голосования истёк

### Обновление эндпоинта `POST /sessions/{id}/vote`

`target_player_id` теперь принимает `null` (пропуск голоса):

```json
{
  "target_player_id": "uuid | null"
}
```

При `null`: голос засчитывается как «воздержался», запись в `day_votes` создаётся с `target_player_id = NULL`.

### Алгоритм подсчёта

```
INPUT: все записи day_votes текущей фазы (включая NULL-голоса и отсутствующие)

STEP 1 — Подсчёт голосов за каждого кандидата (NULL не считается)
STEP 2 — Определение максимума:
  IF один игрок набрал строго больше голосов, чем все остальные:
    → Этот игрок исключён (status = 'dead')
    → WS: vote_result { eliminated: { player_id, name } }
  ELSE (ничья между двумя и более ИЛИ никто не получил голосов):
    → Никто не исключён
    → WS: vote_result { eliminated: null }

STEP 3 — Проверка условий победы
STEP 4 — Переход в night ИЛИ game_finished
```

### Обновление таблицы `day_votes`

| Поле | Изменение |
|------|-----------|
| `target_player_id` | Теперь **NULLABLE** — NULL означает пропуск голоса |

Constraint `CHECK (voter_player_id != target_player_id)` остаётся — применяется только когда `target_player_id IS NOT NULL`.

---

## 13.9 Ограничения целей

| Роль | Ограничение | Правило |
|------|------------|---------|
| **Мафия** | Себя | Нельзя — `CHECK actor_player_id != target_player_id` для `action_type = 'kill'` |
| **Мафия** | Мёртвого | Нельзя — цель должна быть `players.status = 'alive'` |
| **Мафия** | Другую мафию | Нельзя — цель должна быть `role.team = 'city'` |
| **Мафия** | Пропуск | Можно — если таймер истёк и действие не отправлено, никто не погибает |
| **Доктор** | Себя | Можно — доктор может выбрать себя целью `heal` |
| **Доктор** | Одного и того же два раза подряд | Можно — для MVP без ограничения на повторное лечение |
| **Доктор** | Мёртвого | Нельзя — цель должна быть `alive` |
| **Шериф** | Себя | Нельзя — проверка себя бессмысленна, сервер отклоняет |
| **Шериф** | Того же игрока повторно | Можно — сервер вернёт тот же результат, ограничение не вводится |
| **Шериф** | Мёртвого | Нельзя — цель должна быть `alive` |

### Обновление валидации `POST /sessions/{id}/night-action`

Сервер проверяет при получении действия:

```
1. Игрок alive?                         → 403 player_dead
2. Текущая фаза = night?                → 403 wrong_phase
3. У роли есть night_action?            → 403 wrong_phase
4. Действие уже отправлено?             → 409 action_already_submitted
5. Цель alive?                          → 400 invalid_target
6. Мафия → цель не из team=mafia?       → 400 invalid_target
7. Мафия → цель не сам?                 → 400 invalid_target
8. Шериф → цель не сам?                 → 400 invalid_target
```

---

## 13.10 Таймеры и автопереходы

### Конфигурация таймеров

Все таймеры настраиваются организатором в `sessions.settings`:

```json
{
  "role_reveal_timer_seconds": 15,
  "discussion_timer_seconds": 120,
  "voting_timer_seconds": 60,
  "night_action_timer_seconds": 30,
  "role_config": { "..." }
}
```

| Таймер | Поле | Диапазон | Default | Фаза |
|--------|------|----------|---------|------|
| Ознакомление с ролью | `role_reveal_timer_seconds` | 10–30 | 15 | `role_reveal` (после старта, до первой ночи) |
| Обсуждение | `discussion_timer_seconds` | 30–300 | 120 | `day/discussion` |
| Голосование | `voting_timer_seconds` | 15–120 | 60 | `day/voting` |
| Ночные действия | `night_action_timer_seconds` | 15–60 | 30 | `night` (на **каждый ход** спецроли отдельно) |

### Поведение при истечении

| Таймер | Что происходит |
|--------|---------------|
| **Обсуждение** | Сервер автоматически переводит в фазу голосования. WS: `phase_changed { sub_phase: "voting" }` |
| **Голосование** | Голоса не подавших игроков пропускаются. Сервер подсчитывает только собранные голоса и резолвит результат |
| **Ночные действия** | Таймер запускается для **каждой спецроли отдельно**. Когда таймер одной роли истекает, её действие пропускается (WS: `action_timeout`), и ход переходит к следующей роли. После последней роли — резолв ночи (см. 13.7) |

### Кто отвечает за таймер

**Сервер** — единственный источник истины. Frontend показывает обратный отсчёт на основе `started_at` + длительность из `settings`, но **переход триггерит только сервер**. Если клиент рассинхронизирован — WS-событие `phase_changed` корректирует его состояние.

### WS-события с таймерами

**При смене фазы** сервер отправляет всем:

```json
{
  "type": "phase_changed",
  "payload": {
    "phase": { "type": "day", "number": 1 },
    "sub_phase": "discussion | voting | null",
    "timer_seconds": 120,
    "timer_started_at": "ISO 8601",
    "announcement": {
      "audio_url": "/audio/day_start_01.mp3",
      "text": "Город просыпается. Наступает день.",
      "duration_ms": 4000
    }
  }
}
```

**При передаче хода спецроли** (ночью) сервер отправляет персонально:

```json
{
  "type": "action_required",
  "payload": {
    "action_type": "kill | heal | check",
    "available_targets": [{ "player_id": "uuid", "name": "string" }],
    "timer_seconds": 30,
    "started_at": "ISO 8601"
  }
}
```

Frontend вычисляет оставшееся время: `timer_seconds - (now - timer_started_at)`.

---
