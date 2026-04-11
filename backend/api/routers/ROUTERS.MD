## Основные API

Префиксы в приложении:

- авторизация: `/api/auth`
- сессии, лобби и игровой цикл (разные роутеры, один mount): `/api/sessions`

---

### Папка авторизации (auth)

Все пути — относительно `/api/auth`.

Регистрация: `POST /register` (тело: `email`, `password`, **`nickname`** — показывается в игре, без уникальности; один и тот же `email` нельзя зарегистрировать повторно)

Вход: `POST /login`

Обновление токена (refresh): `POST /refresh`

Профиль (себе): `GET /me` (в ответе есть `nickname`)

Смена ника: `PATCH /me` (тело JSON: **`nickname`** — те же правила, что при регистрации; уже начатые партии не переименовывают старые записи `players.name`, только профиль для новых join)

Удаление аккаунта (необратимо): `DELETE /me` (тело JSON: `password` — подтверждение; удаляются подписки, платежи, refresh-токены, сессии где пользователь хост, записи игрока в чужих сессиях)

Выход: `POST /logout`

---

### Папка сессий (sessions)

Создание комнаты: `POST /api/sessions` (тело: `player_count`, `settings`)

Комната по коду: `GET /{code}`

Вход / повторный вход тем же пользователем: `POST /{code}/join` (тело: `name` — опционально; если не передать или пусто, в игре подставится **ник из профиля**)

---

### Папка лобби (lobby)

Все пути ниже — относительно `/api/sessions` (полный вид: `/api/sessions/{session_id}/...`).

Список игроков: `GET /{session_id}/players`

Выйти из лобби (только `waiting`): `DELETE /{session_id}/players/me`

Кик игрока (хост; в игре нужен `confirm=true`): `DELETE /{session_id}/players/{player_id}`

Закрыть комнату (хост): `DELETE /{session_id}`

Настройки до старта: `PATCH /{session_id}/settings`

Пауза (хост, активная игра): `POST /{session_id}/pause`

Снять паузу (хост): `POST /{session_id}/resume`

---

### Папка игры (game)

Все пути ниже — относительно `/api/sessions` (полный вид: `/api/sessions/{session_id}/...`).

Старт партии (только хост): `POST /{session_id}/start`

Подтвердить, что роль просмотрена (`role_reveal`): `POST /{session_id}/acknowledge-role`

Ночное действие (JSON body: `target_player_id`): `POST /{session_id}/night-action`

Голосование днём (JSON body: `target_player_id` или `null` — «против всех»): `POST /{session_id}/vote`

Состояние игры для текущего игрока (GET, после старта): `GET /{session_id}/state`

Заметки:

- к `night-action`, `vote`, `acknowledge-role` нельзя обращаться, пока игра на паузе (ошибка `game_paused`);
- в ответе `state` есть поле `game_paused` и сведения о фазе, своей роли, списке игроков (без чужих ролей), целях для ночи, прогрессе голосов и итогах после конца партии.

