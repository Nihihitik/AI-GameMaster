## 14.1 Экраны и навигация

### Карта экранов

```
/auth              → Регистрация / Вход
/                  → Главная страница
/sessions/new      → Создание сессии (настройки партии)
/sessions/{code}   → Лобби (ожидание игроков)
/game/{session_id} → Игровой экран (меняет содержимое по фазе)
```

			### Логика навигации

При открытии приложения frontend проверяет наличие токенов:
- Есть валидный `access_token` (или `refresh_token` для обновления) → переход на `/` (главная)
- Нет токенов → переход на `/auth`

---

## 14.2 Экран авторизации (`/auth`)

### Состояние: Регистрация

| Элемент | Тип | Данные |
|---------|-----|--------|
| Поле `email` | input (email) | Валидация формата на клиенте |
| Поле `password` | input (password) | Минимум 8 символов, показать/скрыть |
| Кнопка «Создать аккаунт» | button | Вызывает `POST /api/auth/register` |
| Ссылка «Уже есть аккаунт» | link | Переключает на форму входа |

**При успехе:** сохранить `access_token` (в память) и `refresh_token` (в `localStorage`), переход на `/`.
**При ошибке:** показать `error.message` из ответа.

### Состояние: Вход

| Элемент | Тип | Данные |
|---------|-----|--------|
| Поле `email` | input (email) | — |
| Поле `password` | input (password) | — |
| Кнопка «Войти» | button | Вызывает `POST /api/auth/login` |
| Ссылка «Нет аккаунта» | link | Переключает на форму регистрации |

**При успехе:** сохранить токены, переход на `/`.
**При ошибке `invalid_credentials`:** «Неверный email или пароль».

---

## 14.3 Главная страница (`/`)

| Элемент | Тип | Действие |
|---------|-----|----------|
| Кнопка «Новая сессия» | button | Переход на `/sessions/new` |
| Поле «Код сессии» + кнопка «Присоединиться» | input + button | Ввод 6-символьного кода → вызов `POST /api/sessions/{code}/join` с вводом имени |
| Иконка настроек | button | Открывает настройки приложения (звук, громкость) |

### Присоединение к сессии

При нажатии «Присоединиться»:
1. Показать модал/экран с полем `name` (имя в игре)
2. Вызвать `POST /api/sessions/{code}/join` с `{ name }`
3. При успехе → переход на `/sessions/{code}` (лобби)
4. При ошибке → показать `error.message`:
   - `session_not_found` → «Сессия не найдена»
   - `session_full` → «Все места заняты»
   - `game_already_started` → «Игра уже началась»
   - `already_joined` → «Вы уже в этой сессии»

### Настройки приложения

| Настройка | Тип | Хранение |
|-----------|-----|----------|
| Громкость ведущего | slider (0–100%) | `localStorage` |
| Звуковые эффекты вкл/выкл | toggle | `localStorage` |

---

## 14.4 Создание сессии (`/sessions/new`)

Доступно только организатору. Настройка параметров партии перед созданием.

| Элемент | Тип | Значение | Маппинг на API |
|---------|-----|----------|----------------|
| Количество игроков | stepper (5–20) | default: 5 | `player_count` |
| Таймер ознакомления | slider (10–30 сек) | default: 15 | `settings.role_reveal_timer_seconds` |
| Таймер обсуждения | slider (30–300 сек) | default: 120 | `settings.discussion_timer_seconds` |
| Таймер голосования | slider (15–120 сек) | default: 60 | `settings.voting_timer_seconds` |
| Таймер ночных действий | slider (15–60 сек) | default: 30 | `settings.night_action_timer_seconds` |
| Кол-во мафии | stepper | auto | `settings.role_config.mafia` |
| Шериф (вкл/выкл) | toggle | default: вкл | `settings.role_config.sheriff` (1/0) |
| Доктор (вкл/выкл) | toggle | default: вкл | `settings.role_config.doctor` (1/0) |
| Кнопка «Создать сессию» | button | — | `POST /api/sessions` |

**Валидация на клиенте (до отправки):**
- `player_count` в диапазоне 5–20; если > 5 и нет Pro → показать «Нужна подписка Pro»
- Сумма ролей (`mafia` + `sheriff` + `doctor` + оставшиеся мирные) = `player_count`
- `mafia` < количество city-ролей

**При успехе:** переход на `/sessions/{code}` (лобби).

---

## 14.5 Лобби (`/sessions/{code}`)

### Для организатора

| Элемент | Данные | Источник |
|---------|--------|----------|
| Код сессии (крупно) | `session.code` | `GET /api/sessions/{code}` |
| Кнопка «Скопировать код» | — | Копирует `code` в буфер обмена |
| Список игроков | `players[].name`, `join_order` | `GET /api/sessions/{id}/players` + WS: `player_joined` / `player_left` |
| Счётчик игроков | «4 / 8 игроков» | `players.length` / `player_count` |
| Кнопка «Кикнуть» (у каждого игрока) | — | `DELETE /api/sessions/{id}/players/{player_id}` |
| Кнопка «Начать игру» | disabled если `players.length` < минимума для `role_config` | `POST /api/sessions/{id}/start` |
| Кнопка «Настройки» | — | `PATCH /api/sessions/{id}/settings` |

### Для обычного игрока

Тот же экран, но **без** кнопок «Начать игру», «Кикнуть» и «Настройки». Видит код сессии, список игроков, ожидает старта.

### WS-подключение

Frontend подключается к `ws://{host}/ws/sessions/{session_id}?token={access_token}` при входе в лобби.

| WS-событие | Действие на UI |
|-----------|---------------|
| `player_joined` | Добавить игрока в список, обновить счётчик |
| `player_left` | Удалить из списка, обновить счётчик |
| `kicked` | Показать сообщение «Вы были исключены», переход на `/` |
| `settings_updated` | Обновить отображение настроек |
| `game_started` | Переход на `/game/{session_id}` |

---

## 14.6 Игровой экран (`/game/{session_id}`)

Единый URL — содержимое экрана определяется текущей фазой и ролью игрока. Данные получаются из `GET /api/sessions/{id}/state` при загрузке и обновляются через WS.

### Экран: Ознакомление с ролью (`phase: role_reveal`)

| Элемент | Данные | Источник |
|---------|--------|----------|
| Карточка роли (название, команда, описание способностей) | `my_player.role` | WS: `role_assigned` |
| Таймер обратного отсчёта | `role_reveal_timer_seconds` | WS: `game_started` (timer_seconds) |
| Кнопка «Ознакомлен» | — | `POST /api/sessions/{id}/acknowledge-role` |
| Счётчик «3/8 ознакомились» | `players_acknowledged / players_total` | WS: `role_acknowledged` |

**После нажатия «Ознакомлен»:** кнопка заменяется на «Ожидание остальных...»
**WS `all_acknowledged`:** переход к экрану ведущего → ночь.

### Экран: Ведущий (между фазами)

Показывается при каждом `phase_changed`, `night_result`, `vote_result` на время `announcement.duration_ms`.

| Элемент | Данные |
|---------|--------|
| Анимация/изображение ведущего | Статичное или анимированное |
| Текст объявления | `announcement.text` |
| Аудио | Автовоспроизведение `announcement.audio_url` |

Frontend блокирует переход к следующему экрану на `duration_ms`. После — показывает экран действия или ожидания.

### Экран: Ночь — ход спецроли (`phase: night`, `awaiting_action: true`)

Показывается **только** игроку, чей сейчас ход (WS: `action_required`).

| Элемент | Данные | Источник |
|---------|--------|----------|
| Таймер | обратный отсчёт | `action_required.timer_seconds` |
| Текст «Выберите жертву» / «Кого лечить?» / «Кого проверить?» | зависит от `action_type` | `action_required.action_type` |
| Список целей (кнопки с именами) | живые игроки | `action_required.available_targets` |
| Кнопка «Подтвердить» | активна после выбора | `POST /api/sessions/{id}/night-action` |

**WS `action_confirmed`:** экран меняется на «Ваш выбор принят. Ожидание...»
**WS `action_timeout`:** экран меняется на «Время вышло. Действие пропущено»
**Для Шерифа:** после подтверждения показать результат проверки из `check_result` (команда цели).

### Экран: Ночь — ожидание (`phase: night`, `awaiting_action: false`)

Для мирных жителей и спецролей, чей ход ещё не наступил или уже прошёл.

| Элемент | Данные |
|---------|--------|
| Анимация ночи | Атмосферный фон |
| Текст «Город спит...» | Статичный |

### Экран: День — обсуждение (`phase: day`, `sub_phase: discussion`)

| Элемент | Данные | Источник |
|---------|--------|----------|
| Таймер обсуждения | обратный отсчёт | `phase_changed.timer_seconds` |
| Список игроков (живые/мёртвые) | `players[]` | `GET /state` |
| Результат ночи (кто погиб) | показывается сверху | WS: `night_result` |

### Экран: День — голосование (`phase: day`, `sub_phase: voting`)

| Элемент | Данные | Источник |
|---------|--------|----------|
| Таймер голосования | обратный отсчёт | `phase_changed.timer_seconds` |
| Список живых игроков (кнопки) | доступные цели | `available_targets` из `GET /state` |
| Кнопка «Пропустить голос» | — | `POST /api/sessions/{id}/vote` с `target_player_id: null` |
| Счётчик голосов «5/8 проголосовали» | — | WS: `vote_update` |
| Кнопка «Подтвердить» | активна после выбора | `POST /api/sessions/{id}/vote` |

**WS `vote_result`:** показать экран ведущего с результатом → переход к ночи или финалу.

### Экран: Выбывший игрок (`my_player.status: dead`)

| Элемент | Данные |
|---------|--------|
| Сообщение «Вы выбыли» | — |
| Наблюдение за игрой | Текущая фаза, таймер, объявления ведущего |
| Без кнопок действий | Голосование и ночные действия недоступны |

### Экран: Финал (`session_status: finished`)

| Элемент | Данные | Источник |
|---------|--------|----------|
| Победитель | «Город победил» / «Мафия победила» | WS: `game_finished.winner` |
| Таблица всех игроков с ролями | имя, роль, статус | WS: `game_finished.players[]` |
| Кнопка «Сыграть ещё» (только хост) | — | `POST /api/sessions/{id}/rematch` |
| Кнопка «Выйти» | — | Переход на `/` |

---

## 14.7 Маппинг WS-событий → UI-переходы

| WS-событие | Текущий экран | Действие на UI |
|-----------|--------------|---------------|
| `game_started` + `role_assigned` | Лобби | → Игровой экран, показать карточку роли |
| `role_acknowledged` | Ознакомление | Обновить счётчик ознакомившихся |
| `all_acknowledged` | Ознакомление | → Экран ведущего (начало ночи) |
| `phase_changed` | Любой | → Экран ведущего на `duration_ms`, затем экран фазы |
| `action_required` | Ночь (ожидание) | → Экран выбора цели с таймером |
| `action_confirmed` | Ночь (выбор) | → «Выбор принят, ожидание…» |
| `action_timeout` | Ночь (выбор) | → «Время вышло» |
| `check_result` | Ночь (шериф) | Показать результат проверки |
| `night_result` | Ночь | → Экран ведущего (итог ночи) |
| `phase_changed (discussion)` | После ведущего | → Экран обсуждения с таймером |
| `phase_changed (voting)` | Обсуждение | → Экран голосования с таймером |
| `vote_update` | Голосование | Обновить счётчик голосов |
| `vote_result` | Голосование | → Экран ведущего (итог голосования) |
| `player_eliminated` | Любой | Обновить список игроков; если это текущий игрок → экран выбывшего |
| `game_finished` | Любой | → Экран финала |
| `session_closed` | Любой | → Сообщение + переход на `/` |
| `rematch_proposed` | Финал | Показать «Организатор предлагает сыграть ещё» + кнопка «Присоединиться». При нажатии → переход на `/sessions/{code}` из payload |
| `mafia_choice_made` | Ночь (мафия, выбор) | Другой мафиози выбрал жертву → экран «Жертва выбрана: {target_name}. Ожидание...» |
| `error` | Любой | Показать toast-уведомление с `message` |

---

## 14.8 Поток `{code}` → `{id}` и хранение данных

Frontend работает с двумя идентификаторами сессии:
- `code` (6 символов) — используется в URL для лобби `/sessions/{code}` и для подключения по коду
- `id` (UUID) — используется для всех API-вызовов (`/api/sessions/{id}/...`) и WS-подключения

**Поток получения `id`:**
1. Организатор: `POST /api/sessions` → ответ содержит `id` и `code`
2. Игрок: `POST /api/sessions/{code}/join` → ответ содержит `session_id`
3. При переходе на лобби: `GET /api/sessions/{code}` → ответ содержит `id`

Frontend сохраняет `session_id` в состоянии (React state/context) после первого API-вызова и использует его для всех последующих запросов и WS-подключения.

---

## 14.9 Стратегия реконнекта

При потере WS-соединения frontend выполняет:

1. **Автоматическая переподключение** — попытка reconnect через 1, 2, 4, 8 секунд (exponential backoff, max 30 сек)
2. **При получении кода `4001`** (невалидный токен) — вызвать `POST /api/auth/refresh`, получить новый access_token, переподключиться с новым токеном
3. **При успешном reconnect** — вызвать `GET /api/sessions/{id}/state` для синхронизации состояния. Frontend сравнивает полученную фазу с текущим экраном и переключается на актуальный
4. **Если refresh_token тоже истёк** — редирект на `/auth`
5. **Во время reconnect** — показывать overlay «Восстановление соединения...»

---

## 14.10 Поток рематча

**Организатор (хост):**
1. На экране финала нажимает «Сыграть ещё»
2. Frontend вызывает `POST /api/sessions/{id}/rematch` с `{ keep_players: true }`
3. Получает `{ new_session_id, code, status, players_kept }`
4. Переходит на `/sessions/{code}` (лобби новой сессии)

**Другие игроки:**
1. Получают WS-событие `rematch_proposed` с `{ host_name, new_session_id, code }`
2. Видят сообщение «{host_name} предлагает сыграть ещё» + кнопка «Присоединиться»
3. При нажатии: если `keep_players: true`, игрок уже в новой сессии → переход на `/sessions/{code}`
4. Если нет — вызывается `POST /api/sessions/{code}/join`

---

## 14.11 Mock-данные для Frontend

Примеры ответов API для разработки frontend без готового backend.

### Mock: `GET /api/auth/me`
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "player@example.com",
  "has_pro": false,
  "created_at": "2026-04-01T10:00:00Z"
}
```

### Mock: `POST /api/sessions` (создание)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "AX7K2M",
  "host_user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "player_count": 8,
  "status": "waiting",
  "settings": {
    "role_reveal_timer_seconds": 15,
    "discussion_timer_seconds": 120,
    "voting_timer_seconds": 60,
    "night_action_timer_seconds": 30,
    "role_config": {
      "mafia": 2,
      "sheriff": 1,
      "doctor": 1
    }
  },
  "created_at": "2026-04-08T12:00:00Z"
}
```

### Mock: `GET /api/sessions/{id}/state` (ночь, ход мафии)
```json
{
  "session_status": "active",
  "phase": {
    "id": "phase-uuid-001",
    "type": "night",
    "number": 1,
    "sub_phase": null,
    "started_at": "2026-04-08T12:05:00Z",
    "timer_seconds": 30,
    "timer_started_at": "2026-04-08T12:05:00Z"
  },
  "my_player": {
    "id": "player-uuid-001",
    "name": "Саша",
    "status": "alive",
    "role": {
      "name": "Мафия",
      "team": "mafia",
      "abilities": { "night_action": "kill" }
    }
  },
  "players": [
    { "id": "player-uuid-001", "name": "Саша", "status": "alive", "join_order": 1 },
    { "id": "player-uuid-002", "name": "Петя", "status": "alive", "join_order": 2 },
    { "id": "player-uuid-003", "name": "Маша", "status": "alive", "join_order": 3 },
    { "id": "player-uuid-004", "name": "Вася", "status": "alive", "join_order": 4 },
    { "id": "player-uuid-005", "name": "Оля", "status": "alive", "join_order": 5 },
    { "id": "player-uuid-006", "name": "Дима", "status": "alive", "join_order": 6 },
    { "id": "player-uuid-007", "name": "Катя", "status": "alive", "join_order": 7 },
    { "id": "player-uuid-008", "name": "Игорь", "status": "alive", "join_order": 8 }
  ],
  "role_reveal": null,
  "awaiting_action": true,
  "action_type": "kill",
  "available_targets": [
    { "player_id": "player-uuid-002", "name": "Петя" },
    { "player_id": "player-uuid-003", "name": "Маша" },
    { "player_id": "player-uuid-004", "name": "Вася" },
    { "player_id": "player-uuid-005", "name": "Оля" },
    { "player_id": "player-uuid-006", "name": "Дима" },
    { "player_id": "player-uuid-007", "name": "Катя" },
    { "player_id": "player-uuid-008", "name": "Игорь" }
  ],
  "my_action_submitted": false,
  "votes": null,
  "result": null
}
```

### Mock: `GET /api/sessions/{id}/state` (день, голосование)
```json
{
  "session_status": "active",
  "phase": {
    "id": "phase-uuid-002",
    "type": "day",
    "number": 1,
    "sub_phase": "voting",
    "started_at": "2026-04-08T12:08:00Z",
    "timer_seconds": 60,
    "timer_started_at": "2026-04-08T12:10:00Z"
  },
  "my_player": {
    "id": "player-uuid-002",
    "name": "Петя",
    "status": "alive",
    "role": {
      "name": "Мирный",
      "team": "city",
      "abilities": { "night_action": null }
    }
  },
  "players": [
    { "id": "player-uuid-001", "name": "Саша", "status": "alive", "join_order": 1 },
    { "id": "player-uuid-002", "name": "Петя", "status": "alive", "join_order": 2 },
    { "id": "player-uuid-003", "name": "Маша", "status": "dead", "join_order": 3 },
    { "id": "player-uuid-004", "name": "Вася", "status": "alive", "join_order": 4 },
    { "id": "player-uuid-005", "name": "Оля", "status": "alive", "join_order": 5 },
    { "id": "player-uuid-006", "name": "Дима", "status": "alive", "join_order": 6 },
    { "id": "player-uuid-007", "name": "Катя", "status": "alive", "join_order": 7 },
    { "id": "player-uuid-008", "name": "Игорь", "status": "alive", "join_order": 8 }
  ],
  "role_reveal": null,
  "awaiting_action": true,
  "action_type": "vote",
  "available_targets": [
    { "player_id": "player-uuid-001", "name": "Саша" },
    { "player_id": "player-uuid-004", "name": "Вася" },
    { "player_id": "player-uuid-005", "name": "Оля" },
    { "player_id": "player-uuid-006", "name": "Дима" },
    { "player_id": "player-uuid-007", "name": "Катя" },
    { "player_id": "player-uuid-008", "name": "Игорь" }
  ],
  "my_action_submitted": false,
  "votes": {
    "total_expected": 7,
    "cast": 3
  },
  "result": null
}
```

### Mock: `GET /api/sessions/{id}/state` (финал)
```json
{
  "session_status": "finished",
  "phase": {
    "id": "phase-uuid-005",
    "type": "night",
    "number": 3,
    "sub_phase": null,
    "started_at": "2026-04-08T12:25:00Z",
    "timer_seconds": null,
    "timer_started_at": null
  },
  "my_player": {
    "id": "player-uuid-002",
    "name": "Петя",
    "status": "alive",
    "role": {
      "name": "Мирный",
      "team": "city",
      "abilities": { "night_action": null }
    }
  },
  "players": [],
  "role_reveal": null,
  "awaiting_action": false,
  "action_type": null,
  "available_targets": null,
  "my_action_submitted": false,
  "votes": null,
  "result": {
    "winner": "city",
    "announcement": {
      "audio_url": "/audio/city_wins_01.mp3",
      "text": "Город победил! Все мафиози обезврежены.",
      "duration_ms": 5000
    },
    "players": [
      { "id": "player-uuid-001", "name": "Саша", "role": { "name": "Мафия", "team": "mafia" }, "status": "dead" },
      { "id": "player-uuid-002", "name": "Петя", "role": { "name": "Мирный", "team": "city" }, "status": "alive" },
      { "id": "player-uuid-003", "name": "Маша", "role": { "name": "Доктор", "team": "city" }, "status": "dead" },
      { "id": "player-uuid-004", "name": "Вася", "role": { "name": "Мирный", "team": "city" }, "status": "alive" },
      { "id": "player-uuid-005", "name": "Оля", "role": { "name": "Мафия", "team": "mafia" }, "status": "dead" },
      { "id": "player-uuid-006", "name": "Дима", "role": { "name": "Мирный", "team": "city" }, "status": "alive" },
      { "id": "player-uuid-007", "name": "Катя", "role": { "name": "Шериф", "team": "city" }, "status": "alive" },
      { "id": "player-uuid-008", "name": "Игорь", "role": { "name": "Мирный", "team": "city" }, "status": "dead" }
    ]
  }
}
```

### Mock: WS-события (примеры)

**`phase_changed` (начало ночи):**
```json
{
  "type": "phase_changed",
  "payload": {
    "phase": { "type": "night", "number": 2 },
    "sub_phase": null,
    "timer_seconds": null,
    "timer_started_at": null,
    "announcement": {
      "audio_url": "/audio/night_start_02.mp3",
      "text": "Город засыпает. Наступает ночь.",
      "duration_ms": 5000
    }
  }
}
```

**`action_required` (ход доктора):**
```json
{
  "type": "action_required",
  "payload": {
    "action_type": "heal",
    "available_targets": [
      { "player_id": "player-uuid-001", "name": "Саша" },
      { "player_id": "player-uuid-002", "name": "Петя" },
      { "player_id": "player-uuid-004", "name": "Вася" }
    ],
    "timer_seconds": 30,
    "timer_started_at": "2026-04-08T12:15:10Z"
  }
}
```

**`night_result` (кто-то погиб):**
```json
{
  "type": "night_result",
  "payload": {
    "died": [{ "player_id": "player-uuid-004", "name": "Вася" }],
    "announcement": {
      "audio_url": "/audio/night_death_01.mp3",
      "text": "Этой ночью был убит Вася.",
      "duration_ms": 4000
    }
  }
}
```

**`night_result` (никто не погиб):**
```json
{
  "type": "night_result",
  "payload": {
    "died": null,
    "announcement": {
      "audio_url": "/audio/night_safe_01.mp3",
      "text": "Этой ночью никто не погиб.",
      "duration_ms": 3500
    }
  }
}
```

---

## 14.12 Соглашения об именовании

Единый глоссарий для backend и frontend:

| Термин | Где используется | Описание |
|--------|-----------------|----------|
| `player_id` | Везде | UUID игрока в контексте сессии (таблица `players.id`) |
| `user_id` | Auth, sessions | UUID аккаунта (таблица `users.id`) |
| `session_id` | API, WS | UUID сессии (таблица `sessions.id`) |
| `code` | API, UI | 6-символьный код подключения |
| `slug` | roles, role_config | Программный ключ роли: `mafia`, `sheriff`, `doctor`, `civilian` |
| `name` (роли) | UI | Отображаемое имя: `Мафия`, `Шериф`, `Доктор`, `Мирный` |
| `voter_player_id` | DB, REST, WS | Кто голосует (везде одинаково) |
| `target_player_id` | DB, REST, WS | За кого / против кого (везде одинаково) |
| `actor_player_id` | DB | Кто совершает ночное действие |
| `role` (в ответах) | REST, WS | Всегда **объект** `{ name, team }` (или `{ name, team, abilities }` для `my_player`) |
| `died` | WS `night_result` | Массив погибших `[{ player_id, name }]` или `null` (никто не погиб). Не пустой массив `[]` |
| `eliminated` | WS `vote_result` | Объект `{ player_id, name }` или `null` (ничья / никто не исключён) |
| `player_eliminated` | WS, DB event | Единое название для выбытия (вместо `player_died`). Причина в поле `cause: "vote" \| "night"` |
| `phase_changed` | WS, DB event | Единое название для смены фазы (вместо `phase_started`) |
| Голосование | Дизайн | **Открытое** — `vote_result.votes[]` показывает кто за кого голосовал |
| Принудительное закрытие | Дизайн | При `DELETE /sessions/{id}` роли **не раскрываются** — приходит только `session_closed`, не `game_finished` |
| `is_host` | REST | Вычисляемое поле: `true` когда `players.user_id == sessions.host_user_id` |
