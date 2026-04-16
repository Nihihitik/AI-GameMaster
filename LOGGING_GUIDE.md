# Руководство по логированию

## Назначение

Этот документ описывает текущую схему логирования в проекте:

- какие уровни логов используются
- какие event-теги есть в `backend` и `frontend`
- какие поля контекста пишутся в лог
- как правильно добавлять новые логи
- как читать логи в `development` и `production`

Логирование в проекте построено без отдельной таблицы в БД:

- `backend` пишет свои логи в stdout/stderr
- `frontend` пишет локально в browser console
- в `development` весь frontend-поток (включая `debug` и нативные `console.*`) форвардится на `backend`
- в `production` на `backend` уходят только важные frontend-события (`info`/`warn`/`error`)
- `backend` пишет принятые frontend-события в общий log stream с `source=frontend`
- для просмотра в `development` поднимается отдельный `logs-frontend` (порт 3100), который тянет stdout `gamemaster-backend` через docker.sock и разделяет поток на секции Backend / Frontend по полю `source`

## Где лежит логика

### Backend

- [backend/core/logging.py](/Users/nihihitik/Projects/AI-GameMaster/backend/core/logging.py)
- [backend/core/logging_middleware.py](/Users/nihihitik/Projects/AI-GameMaster/backend/core/logging_middleware.py)
- [backend/api/routers/logs.py](/Users/nihihitik/Projects/AI-GameMaster/backend/api/routers/logs.py)

### Frontend

- [frontend/src/services/logger.ts](/Users/nihihitik/Projects/AI-GameMaster/frontend/src/services/logger.ts) — logger API, console-bridge, batched ingest
- [frontend/src/services/logRedaction.ts](/Users/nihihitik/Projects/AI-GameMaster/frontend/src/services/logRedaction.ts) — redaction sensitive-полей перед отправкой
- [frontend/src/components/app/AppErrorBoundary.tsx](/Users/nihihitik/Projects/AI-GameMaster/frontend/src/components/app/AppErrorBoundary.tsx)
- [frontend/src/hooks/usePageViewLogger.ts](/Users/nihihitik/Projects/AI-GameMaster/frontend/src/hooks/usePageViewLogger.ts)

### Logs viewer (dev)

- [logs-frontend/](/Users/nihihitik/Projects/AI-GameMaster/logs-frontend) — отдельный Next.js на порту 3100, читает docker.sock и стримит логи в браузер по SSE

## Уровни логирования

- `debug`
  - подробная техническая трасса
  - используется в основном в `development`
  - пример: запуск/отмена таймера, подготовка HTTP request

- `info`
  - нормальные ключевые бизнес-события
  - пример: успешный логин, создание сессии, старт игры, смена фазы

- `warn`
  - аномалии, конфликты, деградация, recoverable ошибки
  - пример: refresh не удался, websocket reconnect, blocked action, runtime восстановлен из persisted state

- `error`
  - неожиданные ошибки, падения, необработанные исключения
  - пример: unhandled exception, app bootstrap failure, websocket loop failed

## Основные поля лога

### Общие backend-поля

- `timestamp` — время события
- `level` — уровень (`debug` / `info` / `warn` / `error`)
- `logger` — имя python logger
- `message` — человекочитаемое описание
- `event` — машинно-читаемый tag события
- `source`
  - `backend` для серверных событий
  - `frontend` для событий, пришедших с клиента
- `request_id` — request correlation id
- `client_request_id` — id клиентского запроса
- `user_id` — id пользователя, если известен
- `session_id` — id игровой сессии, если известен
- `route` — HTTP route
- `details` — структурированные дополнительные данные

### Общие frontend-поля

- `timestamp`
- `level`
- `event`
- `message`
- `context`
  - `route`
  - `page`
  - `userId`
  - `sessionId`
  - `clientRequestId`
  - `clientSessionId`
  - `buildEnv`
- `details`

## Request correlation

Для HTTP используется связка:

- `X-Request-ID` — создаётся или принимается backend
- `X-Client-Request-ID` — создаётся frontend и пробрасывается в backend

Использование:

- искать серверную цепочку по `request_id`
- связывать frontend request и backend request по `client_request_id`

## Поведение по окружениям

## Development

### Backend

- формат логов: читаемый текст
- sink: stdout/stderr контейнера
- просмотр:
  ```bash
  cd /Users/nihihitik/Projects/AI-GameMaster/backend
  docker compose logs -f backend
  ```

### Frontend

- sink #1: viewer на http://localhost:3100 (секция Frontend)
- sink #2: browser console
- sink #3: backend docker logs (`docker compose logs -f backend`) — frontend события приходят туда же с `source=frontend`
- в dev на backend форвардятся **все** уровни (включая `debug`) и нативные `console.*` (через console-bridge в `logger.ts`). Для контроля: env-флаги `REACT_APP_REMOTE_LOG_MIN_LEVEL=debug` и `REACT_APP_LOG_CAPTURE_CONSOLE=true`

## Production

- backend пишет структурированный JSON в stdout
- frontend отправляет только `info` / `warn` / `error` на backend (debug остаётся в браузере)
- console-bridge в production выключен (`REACT_APP_LOG_CAPTURE_CONSOLE=false` или unset)
- viewer (`logs-frontend`) поднимается только в dev и не используется в production
- отдельной таблицы логов в БД нет

## Event-теги backend

Ниже перечислены текущие backend event-теги и их назначение.

### App / request

- `app.started`
  - backend успешно стартовал

- `http.request_completed`
  - завершён HTTP request
  - содержит method, path, status, duration

- `request.validation_failed`
  - ошибка валидации входного payload

- `request.handled_error`
  - обработанная бизнес-ошибка (`GameError`)

- `request.unhandled_exception`
  - необработанная серверная ошибка

### Auth

- `auth.register_succeeded`
  - успешная регистрация

- `auth.login_succeeded`
  - успешный логин

- `auth.token_refreshed`
  - refresh token rotation выполнен успешно

- `auth.refresh_failed`
  - refresh token невалиден/просрочен/не найден

- `auth.profile_updated`
  - обновлён профиль пользователя

- `auth.logout_succeeded`
  - успешный logout

- `auth.account_deleted`
  - аккаунт удалён

### Session / lobby

- `session.created`
  - создана игровая сессия

- `session.joined`
  - игрок присоединился к сессии

- `session.left`
  - игрок вышел из лобби

- `session.settings_updated`
  - изменены настройки сессии

- `session.player_kicked`
  - игрок исключён хостом

- `session.closed`
  - сессия закрыта

### Game flow

- `game.started`
  - игра стартовала

- `game.role_acknowledged`
  - игрок подтвердил ознакомление с ролью

- `night.action_submitted`
  - принято ночное действие

- `vote.submitted`
  - принят голос

- `vote.resolved`
  - дневное голосование разрешено

- `game.vote_tie`
  - ничья в голосовании, назначен revote

- `game.paused`
  - игра поставлена на паузу

- `game.resumed`
  - игра снята с паузы

- `game.finished`
  - игра завершена

- `game.action_blocked`
  - действие заблокировано текущим состоянием игры

- `game.duplicate_action`
  - попытка повторно отправить действие

### Phases / runtime

- `phase.changed`
  - смена фазы или подфазы игры
  - типично содержит `phase`, `sub_phase`, `night_turn`, `vote_round`

- `runtime_state_mismatch`
  - runtime state был восстановлен из persisted events и отличался от памяти

### Recovery

- `recovery.skipped`
  - recovery сознательно пропущен
  - причины: paused session, inactive session, busy runtime, missing history

- `recovery.session_restored`
  - recovery восстановил игру/таймер/подфазу

- `recovery.loop_failed`
  - упал сам фоновый recovery loop

### Timers

- `timer.started`
  - таймер запущен

- `timer.cancelled`
  - таймер отменён

- `timer.cancelled_all`
  - отменены все таймеры сессии

- `timer.callback_failed`
  - упал callback таймера

### WebSocket

- `ws.connected`
  - websocket подключён

- `ws.disconnected`
  - websocket отключён

- `ws.stale_connection`
  - попытка отправки/закрытия на битом websocket соединении

- `ws.invalid_message`
  - невалидный websocket payload, токен, user id или неизвестное сообщение

- `ws.loop_failed`
  - необработанная ошибка в websocket loop

## Event-теги frontend

Ниже перечислены текущие frontend event-теги и их назначение.

### UI / app

- `page.view`
  - открыта страница

- `ui.unhandled_error`
  - глобальная browser error

- `ui.unhandled_rejection`
  - необработанный rejected promise

- `app.bootstrap_failed`
  - ошибка во время bootstrap приложения или в error boundary

### Auth

- `auth.login_submit`
  - отправлена форма логина

- `auth.login_success`
  - логин успешен

- `auth.register_submit`
  - отправлена форма регистрации

- `auth.register_success`
  - регистрация успешна

- `auth.refresh_retry`
  - начата попытка refresh после 401

- `auth.force_logout_after_refresh_failure`
  - после провала refresh пользователь разлогинен принудительно

- `auth.logout_submit`
  - завершён logout из профиля

- `auth.logout_success`
  - frontend logout завершён

- `auth.initialize_success`
  - auth session восстановлена при bootstrap

- `auth.initialize_failed`
  - не удалось восстановить auth session

### Session / lobby

- `session.create_submit`
  - отправлен запрос на создание сессии

- `session.create_success`
  - сессия успешно создана

- `session.join_submit`
  - отправлен запрос на вход в сессию

- `session.join_success`
  - вход в сессию успешен

- `session.load_success`
  - состояние сессии загружено

- `session.settings_updated`
  - настройки сессии обновлены на frontend

### Game

- `game.start_submit`
  - хост нажал старт игры

- `game.state_load`
  - состояние игры загружено

- `game.role_acknowledged`
  - локальный игрок подтвердил роль

- `game.night_action_submit`
  - отправлено ночное действие

- `game.vote_submit`
  - отправлен голос

- `game.pause_submit`
  - отправлена команда pause

- `game.resume_submit`
  - отправлена команда resume

- `game.result_received`
  - получен финальный результат игры

- `game.critical_load_failed`
  - критически не удалось загрузить страницу игры

### Story selection

- `story.vote_submit`
  - отправлен голос за сюжет

- `story.selection_completed`
  - сюжет выбран и подтверждён

### Profile

- `profile.nickname_updated`
  - никнейм обновлён

### API / network

- `api.request_prepared`
  - frontend подготовил HTTP request
  - `debug`-событие

- `api.nonfatal_failure`
  - нефатальная ошибка запроса/деградация сценария

### Console (только dev)

- `console.captured`
  - перехвачен нативный `console.log/info/warn/debug/error`
  - `details.consoleMethod` — имя оригинального метода
  - `details.args` — сериализованные аргументы (через `describeArg`: Error → name/message/stack, DOM-узлы → теги, циклические ссылки → `[Circular]`)
  - level записи соответствует методу: `console.log` → `debug`, `console.info` → `info`, `console.warn` → `warn`, `console.error` → `error`, `console.debug` → `debug`
  - включается флагом `REACT_APP_LOG_CAPTURE_CONSOLE=true`

### WebSocket

- `ws.connected`
  - websocket подключён

- `ws.resync_completed`
  - после reconnect/open состояние игры успешно пересинхронизировано

- `ws.state_resync_failed`
  - resync не удался

- `ws.parse_failed`
  - websocket message не удалось распарсить

- `ws.invalid_message`
  - получено неожиданное или неизвестное сообщение

- `ws.socket_error`
  - браузер сообщил websocket error event

- `ws.heartbeat_failed`
  - не удалось отправить ping

- `ws.reconnect_scheduled`
  - поставлен reconnect с backoff

## Как правильно добавлять новые логи

### Общие правила

- лог должен описывать событие, а не строчку кода
- `event` должен быть коротким, стабильным и машинно-читаемым
- `message` должен быть читаем человеком
- в `details` класть только то, что помогает расследовать проблему
- не писать чувствительные данные

### Именование event

Используем формат:

```text
domain.action
```

Примеры:

- `session.created`
- `game.started`
- `phase.changed`
- `ws.reconnect_scheduled`
- `auth.refresh_failed`

### Что логировать

Логируем:

- начало или успешное завершение ключевого бизнес-сценария
- смену состояния, важную для игры
- recoverable деградации
- неожиданные ошибки

Не логируем:

- каждый keystroke
- каждый локальный toggle
- временные косметические UI state
- payload с паролями, токенами и полными авторизационными заголовками

## Как выбирать уровень

### Используй `info`, если

- сценарий завершился штатно
- это важное событие для чтения истории игры

Примеры:

- игра началась
- игрок присоединился
- смена фазы
- голос принят

### Используй `warn`, если

- произошло что-то нештатное, но система продолжает работу
- нужна повышенная заметность в логах

Примеры:

- websocket reconnect
- refresh failure
- blocked action
- runtime восстановлен из persisted state

### Используй `error`, если

- сценарий сорвался полностью
- есть stack trace или исключение
- пользователь/сервер не может продолжить нормальный поток

## Безопасность логов

Никогда не логировать:

- `password`
- `password_hash`
- `access_token`
- `refresh_token`
- `Authorization`
- `token`
- `token_hash`

Backend и frontend делают redaction автоматически по совпадающему черному списку (см. `backend/core/logging.py:_SENSITIVE_KEYS` и `frontend/src/services/logRedaction.ts`), но на это нельзя полагаться как на единственную защиту. Не добавляй такие поля в `details`, если они не нужны.

### Ограничение console-bridge

Console-bridge сериализует аргументы `console.*` через `describeArg`, который рекурсивно прогоняет объекты через redaction. Однако:

- `console.log('token=' + accessToken)` — токен попадает в строковый аргумент, redaction по ключам не сработает
- `console.log` форвардится как `event=console.captured` со всем содержимым `args` — это видно в backend stdout

Правило: не подставляй секреты напрямую в строки `console.*`. Если нужно логировать действие со связкой к токену — пользуйся обычным `logger.info('event', 'message', { token: '...' })`, redaction отработает.

## Как читать логи

### Viewer (logs-frontend, dev primary sink)

```bash
cd /Users/nihihitik/Projects/AI-GameMaster/logs-frontend
docker compose up --build
# затем http://localhost:3100
```

Sidebar разделяет поток на Backend (события с `source=backend`) и Frontend (`source=frontend`). Доступны фильтры по level, domain, event, free-text, session_id, user_id, request correlation, time range. Pause/Resume замораживает добавление в DOM, не теряя приходящие события.

### Backend в Docker (fallback)

```bash
cd /Users/nihihitik/Projects/AI-GameMaster/backend
docker compose logs -f backend
```

### Frontend в dev (fallback)

- открывать browser console
- при необходимости искать дублирующее событие в backend logs по `source=frontend`

### Что искать первым делом при проблеме

1. `request_id`
2. `client_request_id`
3. `session_id`
4. `user_id`
5. `event`

## Рекомендуемый порядок расследования

### Проблема в API

Ищи:

- `http.request_completed`
- `request.validation_failed`
- `request.handled_error`
- `request.unhandled_exception`

### Проблема в игре

Ищи:

- `game.started`
- `phase.changed`
- `night.action_submitted`
- `vote.submitted`
- `vote.resolved`
- `game.finished`

### Проблема в reconnect / websocket

Ищи:

- `ws.connected`
- `ws.invalid_message`
- `ws.parse_failed`
- `ws.reconnect_scheduled`
- `ws.state_resync_failed`
- `ws.loop_failed`

### Проблема после рестарта backend

Ищи:

- `recovery.skipped`
- `recovery.session_restored`
- `runtime_state_mismatch`

## Минимальный шаблон добавления backend-лога

```python
from core.logging import log_event
import logging

logger = logging.getLogger(__name__)

log_event(
    logger,
    logging.INFO,
    "domain.action",
    "Human readable message",
    session_id=str(session_id),
    user_id=str(user_id),
    some_field=value,
)
```

## Минимальный шаблон добавления frontend-лога

```ts
import { logger } from '../services/logger';

logger.info('domain.action', 'Human readable message', {
  sessionId,
  extraField,
}, {
  sessionId,
});
```

## Примечание по совместимости

Список событий в этом документе должен обновляться вместе с кодом. Если добавляется новый важный `event`, его нужно:

- добавить в код
- описать в этом файле
- по возможности использовать уже существующий `domain`

