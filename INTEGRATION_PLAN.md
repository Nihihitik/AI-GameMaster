# План: интеграция Backend ↔ Frontend в AI-GameMaster

## Контекст

Фронт и бэк сейчас живут почти независимо:
- **Backend** — полноценный FastAPI + REST + WebSocket с классической четвёркой ролей (мафия, шериф, доктор, мирный), восстановлением, JWT + refresh-ротацией, in-memory менеджером WS.
- **Frontend (CRA + React 19 + Zustand)** — из реального API работает только `authApi` (и тот с mock-fallback). Все остальные сценарии (сессии, лобби, игровой цикл, ночные действия, голосование) имитируются `mockGameEngine.ts` (803 строки) и локальными мутациями сторов. WebSocket объявлен в `constants.ts`, но нигде не используется.

Задача — полноценно соединить их: расширить бэк до набора ролей, который уже нарисован на фронте (мафия / дон / шериф / доктор / любовница / маньяк / мирный), подключить WebSocket как единый источник игрового состояния и убрать mock-заглушки.

## Решения, принятые перед планированием

| Вопрос | Решение |
|---|---|
| Расширенные роли (don / lover / maniac) | **Расширить backend** — добавить роли в БД и игровой движок |
| Синхронизация игры между клиентами | **Полноценный WebSocket** — события из бэка обновляют frontend-сторы |
| Mock-fallback в LoginForm / RegisterForm | **Убрать совсем** — показывать реальную ошибку |
| Страница выбора сюжета и `withStory` | **Оставить как локальную фичу** — только клиентское состояние, в API не передавать |

---

## Найденные расхождения

### 1. Auth-контракт (BLOCKER)

| Поле | Backend `schemas/auth.py` | Frontend `types/api.ts` |
|---|---|---|
| `RegisterRequest.nickname` | обязательный (1–32, strip) | **отсутствует** |
| `AuthResponse.nickname` | возвращается | **не читается** |
| `MeResponse.nickname` (≈`UserProfile`) | возвращается | **отсутствует** |

Регистрация упадёт с 400 `validation_error`.

### 2. CORS (BLOCKER)

- `backend/core/config.py:50` — дефолт `CORS_ORIGINS = ["http://localhost:5173"]` (Vite).
- `backend/.env` — `CORS_ORIGINS` не задан, дефолт активен.
- CRA поднимается на `http://localhost:3000` → preflight отклонён.

### 3. Ролевой набор (крупный разрыв)

| Компонент | Набор ролей |
|---|---|
| Backend (`scripts/seed.py`, `models/role.py`, `night_action_resolver.py`) | `mafia`, `sheriff`, `doctor`, `civilian` |
| Frontend (`types/game.ts`, `gameStore.ts`, `components/game/NightActionScreen`) | `mafia`, `don`, `sheriff`, `doctor`, `lover`, `maniac`, `civilian` |

Во frontend:
- `RoleConfig`: `{mafia, don, sheriff, doctor, lover, maniac}` (все 0–2)
- `gameStore.actionType`: `kill | check | heal | don_check | lover_visit | maniac_kill`
- Mock-движок знает: `nightKills`, `nightHealed`, `loverTarget`, `loverBlocked`, `dayBlockedPlayer`
- `mockGameEngine` проигрывает очередь `lover → mafia → don → sheriff → doctor → maniac`

### 4. Отсутствующие API-модули в frontend

Реализован только `authApi`. Нет (хотя типы частично объявлены):
- `sessionApi` — create / get by code / join / players / leave / kick / close / settings / pause / resume
- `gameApi` — start / acknowledge-role / night-action / vote / state
- `subscriptionsApi` — me / create
- WebSocket-клиент

### 5. Мелочи

- `authStore.logout()` не зовёт `POST /api/auth/logout` — refresh-токен остаётся валиден на бэке.
- `authStore.initialize()` не делает auto-login по refresh.
- Mock-fallback в `LoginForm`/`RegisterForm` маскирует реальные ошибки (при 500/сети пускает с фейковыми токенами).
- `LobbyPage` авто-добавляет мок-игроков таймерами.
- `WS_BASE_URL` объявлен, не используется.
- Нет `frontend/.env.example`.
- `ROLE_LABELS` содержит только 4 классические роли.
- `withStory` / `selectedStoryId` / `mockStories` — чисто клиентская косметика без бэка.

---

# Стратегия реализации

План разбит на две большие ветки — **Backend-расширение** (стадии B1–B7) и **Frontend-интеграция** (стадии F1–F10). В идеале они выполняются параллельно, но F6+ зависят от B1–B4.

---

## Backend: расширение ролей и поддержка новых механик

### Стадия B1. Конфиг, CORS, окружение

- `backend/.env` — добавить строку `CORS_ORIGINS=http://localhost:3000,http://localhost:5173`.
- `backend/.env.example` — актуализировать: добавить `CORS_ORIGINS` и `SECRET_KEY` как пример.
- Ничего больше в `core/config.py` менять не нужно — `_parse_json_list` корректно парсит CSV.

### Стадия B2. Новые роли в БД

**Файл**: `backend/scripts/seed.py`
- Добавить в список ролей записи:
  - `{"slug": "don", "name": "Дон", "team": "mafia", "abilities": {"night_action": "don_check"}}`
  - `{"slug": "lover", "name": "Любовница", "team": "city", "abilities": {"night_action": "lover_visit"}}`
  - `{"slug": "maniac", "name": "Маньяк", "team": "maniac", "abilities": {"night_action": "maniac_kill"}}`
- Seed **идемпотентен** — `ON CONFLICT DO NOTHING` или upsert по `slug`, так что миграция не нужна, только re-run.

**Файл**: `backend/models/role.py`
- Расширить `CHECK team IN (...)`: `('mafia','city')` → `('mafia','city','maniac')`.
- Это требует **новой Alembic-миграции**: `20260412_role_team_check.py`:
  ```python
  op.drop_constraint("ck_roles_team", "roles")
  op.create_check_constraint("ck_roles_team", "roles", "team IN ('mafia','city','maniac')")
  ```
- Для `night_actions.action_type` check аналогично: был `IN ('kill','check','heal')`, становится `IN ('kill','check','heal','don_check','lover_visit','maniac_kill')`. Та же миграция.

### Стадия B3. Pydantic-схемы

**Файл**: `backend/schemas/session.py::RoleConfig`
- Добавить поля: `don: int = Field(0, ge=0, le=1)`, `lover: int = Field(0, ge=0, le=1)`, `maniac: int = Field(0, ge=0, le=1)`.
- Оставить `mafia: int ≥ 1`, `sheriff: 0..1`, `doctor: 0..1`.
- В `CreateSessionRequest` / валидаторе роутера пересчитать мирных: `civilian = player_count - sum(всех специальных)`.
- Валидация: мафия (включая дона) строго меньше города (включая маньяка — это спорно, но классическая трактовка: маньяк мешает и тем, и тем, считать как город).
- Решение по балансу: `mafia_count = mafia + don`; `city_count = player_count - mafia_count - maniac`; требуется `mafia_count < city_count` и `mafia_count ≥ 1`.

**Файл**: `backend/schemas/game.py` (если есть) — добавить `action_type: Literal["kill","check","heal","don_check","lover_visit","maniac_kill"]` там, где он валидируется.

### Стадия B4. Игровой движок — новая ночная очередь

**Файл**: `backend/services/game_engine.py` — ключевое изменение.

Новый порядок обработки ночи:
1. **Lover** (если есть в игре, жив) → выбирает `target`. Эффект: `target` и `lover` помечаются `blocked_tonight=True` (runtime). Ограничения: нельзя выбирать себя; нельзя выбирать одну цель две ночи подряд.
2. **Mafia kill** (общая) → первый голос фиксирует `mafia_choice_target` (как уже есть). Действие не срабатывает, если убийца `blocked_tonight`.
3. **Don** (если жив) → `don_check`: узнать, является ли цель шерифом. WS `check_result` лично дону (`{team_like: "sheriff" | "other"}`). Выдать через `check_result` новую полезную нагрузку, **не раскрывать полный `team`**. Дон не может проверять себя и мафию.
4. **Sheriff** (если жив) → `check`: узнать `team` цели. Результат приходит лично шерифу. Шериф `blocked_tonight` → проверка пропускается.
5. **Doctor** (если жив) → `heal`: цель не умирает этой ночью. Существующие ограничения сохраняются (нельзя лечить одну цель две ночи подряд; можно лечить себя один раз за игру).
6. **Maniac** (если жив) → `maniac_kill`: параллельно с мафией, своя цель. Маньяк не учитывается в цепочке мафии. Маньяк `blocked_tonight` → пропуск.

**Резолюция ночи (`resolve_night`)**:
- Собираем сет жертв: `{mafia_target} ∪ {maniac_target}`.
- Вычитаем тех, кого вылечил доктор.
- Помечаем оставшихся `status=dead`.
- Эмитим `night_result` (WS) с именами убитых.
- Днём: все `blocked_tonight` сбрасываются; `dayBlockedPlayer` = цель lover этой ночи (если задано) — для фронта это поле нужно передать в `game_state`.

**Файл**: `backend/services/night_action_resolver.py`
- Добавить хэндлеры для `don_check`, `lover_visit`, `maniac_kill`.
- Единый механизм блокировки через `runtime_state.blocked_tonight: set[player_id]`.

**Файл**: `backend/services/runtime_state.py`
- Расширить dataclass / dict: добавить `blocked_tonight: set[UUID]`, `lover_last_target: UUID | None`, `doctor_last_heal: UUID | None`, `doctor_self_heals: int`.
- В `recovery_service` / `state_service.restore_runtime_like_fields` — восстановить из `game_events`.

**Файл**: `backend/services/game_engine.py::check_win_condition`
- Было: `mafia_team ≥ city` → мафия; `mafia_team == 0` → город.
- Становится:
  - Живые = `city_alive + mafia_alive + maniac_alive`
  - **Maniac wins**: `maniac_alive == 1` и `city_alive + mafia_alive ≤ 1` (классика — маньяк с одним выжившим).
  - **Mafia wins**: `maniac_alive == 0` и `mafia_alive ≥ city_alive`.
  - **City wins**: `mafia_alive == 0` и `maniac_alive == 0`.
  - Иначе игра продолжается.

**Файл**: `backend/api/routers/game.py::night-action`
- В валидации `target_player_id`:
  - `don_check`: нельзя себя, нельзя мафию/дона.
  - `lover_visit`: нельзя себя; нельзя повторять цель подряд (через `runtime_state.lover_last_target`).
  - `maniac_kill`: нельзя себя.
- В ответе: для `don_check` возвращать `{check_result: {is_sheriff: bool}}` (или, безопаснее, `{check_result: {match: bool}}`). Для `check` — как было, `{team}`.

### Стадия B5. GameState и WS-контракт

**Файл**: `backend/api/routers/game.py::GET /state`
- Добавить в `my_player`:
  - `is_blocked_tonight: bool` (для ночного экрана — если true, клиент показывает «вас заблокировала любовница»).
- Добавить в корень (если текущая фаза `day/discussion`):
  - `day_blocked_player: UUID | null` — кого заблокировала lover прошлой ночью (для фронта, чтобы отключить голосование).
- `action_type` в `awaiting_action` может быть любой из новых типов (`don_check`, `lover_visit`, `maniac_kill`).

**Файл**: `backend/api/websockets/ws.py` и `services/ws_manager.py`
- Никаких новых каналов не нужно — достаточно новых `type` в уже существующих сообщениях.
- Дополнительные исходящие события:
  - `action_confirmed` — расширить payload `action_type` новыми значениями.
  - `check_result` — отдельный payload для `don_check` (не leak'ать полный `team`).
  - `phase_changed` — без изменений.

### Стадия B6. Тесты

- **Smoke OpenAPI** (`tests/test_smoke_openapi.py`) — должен продолжать проходить без изменений (кроме новых типов — проверить).
- **E2E-смоук** (`scripts/run_e2e_five_players.py`):
  - Обновить, чтобы учитывать возможность включения новых ролей.
  - Добавить вариант на 7 игроков с `{mafia:1, don:1, sheriff:1, doctor:1, lover:1, maniac:1, civilian:1}`.

### Стадия B7. Обновление backend-документации

- `backend/README.md` — упомянуть, что после применения миграций нужно заново запустить `seed.py` для добавления новых ролей.
- `backend/docs/backend_documentation.md` — обновить разделы 4.4 (роли), 5.4 (night-action action_type), 6 (WS), 7 (очередь ночи), 10 (new error codes если появятся).

---

## Frontend: интеграция с реальным API

### Стадия F1. Конфиг и .env

**Создать `frontend/.env.example`** (основной артефакт этой задачи):
```
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_WS_BASE_URL=ws://localhost:8000
REACT_APP_USE_MOCKS=false
```

**Создать `frontend/.env`** (копия) либо проинструктировать пользователя сделать `cp .env.example .env`.

Проверить `frontend/src/utils/constants.ts` — там уже есть правильные дефолты, трогать не нужно.

### Стадия F2. Auth-контракт

**`frontend/src/types/api.ts`**:
```ts
export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
}
export interface AuthResponse {
  user_id: string;
  email: string;
  nickname: string;
  access_token: string;
  refresh_token: string;
}
export interface UserProfile {
  user_id: string;
  email: string;
  nickname: string;
  has_pro: boolean;
  created_at: string;
}
export interface UpdateNicknameRequest { nickname: string }
export interface DeleteAccountRequest { password: string }
```

**`frontend/src/api/authApi.ts`** — добавить:
```ts
updateNickname: (data: UpdateNicknameRequest) => httpClient.patch<UserProfile>('/auth/me', data),
deleteAccount:  (data: DeleteAccountRequest)  => httpClient.delete('/auth/me', { data }),
```

**`frontend/src/stores/authStore.ts`**:
- `setUser(user)` принимает `nickname`.
- `logout()` → вызвать `authApi.logout({ refresh_token })` **до** очистки state; ошибку игнорировать (всё равно логаут локальный). Затем `localStorage.removeItem('refresh_token')` + `set({ accessToken: null, user: null, isAuthenticated: false })`.
- `initialize()` — оставляем как есть (без auto-login) либо отдельным шагом: при наличии refresh попытаться `authApi.me()` после refresh-прокачки. **Не блокирующий шаг**; сделаем позже если будет время.

**`frontend/src/components/auth/RegisterForm.tsx`**:
- Добавить `<Input label="Никнейм" />`, валидация: 1–32 символов, `.trim()`.
- В `authApi.register({ email, password, nickname })`.
- **Убрать mock-fallback** в catch-блоке; вместо этого показать `parseApiError(err).message`.

**`frontend/src/components/auth/LoginForm.tsx`**:
- **Убрать mock-fallback**. При ошибке — `parseApiError`.

**`frontend/src/pages/ProfilePage.tsx`**:
- Показывать `user.nickname` рядом с email.
- (nice-to-have) inline-edit nickname через `authApi.updateNickname`.
- Logout зовёт обновлённый `authStore.logout()`.

### Стадия F3. RoleConfig и константы

**`frontend/src/types/game.ts`** — `RoleConfig` уже содержит все 6 полей, менять не нужно. Проверить, что `don, lover, maniac` остаются `number`.

**`frontend/src/utils/constants.ts::ROLE_LABELS`** — добавить:
```ts
don: 'Дон',
lover: 'Любовница',
maniac: 'Маньяк',
```

**`ERROR_MESSAGES`** — добавить недостающие:
```ts
token_invalid: 'Сессия истекла, войдите заново',
token_expired: 'Сессия истекла, войдите заново',
wrong_phase: 'Действие сейчас недоступно',
player_dead: 'Вы выбыли из игры',
invalid_target: 'Нельзя выбрать эту цель',
action_already_submitted: 'Вы уже совершили действие',
game_paused: 'Игра на паузе',
not_host: 'Действие доступно только хосту',
confirmation_required: 'Требуется подтверждение',
```

**`frontend/src/types/errors.ts`** — синхронизировать `ErrorCode` с бэковыми кодами из `backend/docs/backend_documentation.md §10`.

### Стадия F4. `sessionApi.ts`

**Создать `frontend/src/api/sessionApi.ts`**:
```ts
import { httpClient } from './httpClient';
import type {
  CreateSessionRequest, SessionResponse, SessionDetailResponse,
  JoinSessionRequest, JoinSessionResponse, UpdateSettingsRequest,
  PlayerInList,
} from '../types/api';

export const sessionApi = {
  create:         (data: CreateSessionRequest)           => httpClient.post<SessionResponse>('/sessions', data),
  getByCode:      (code: string)                          => httpClient.get<SessionDetailResponse>(`/sessions/${code}`),
  join:           (code: string, data: JoinSessionRequest)=> httpClient.post<JoinSessionResponse>(`/sessions/${code}/join`, data),
  getPlayers:     (sessionId: string)                     => httpClient.get<{ players: PlayerInList[] }>(`/sessions/${sessionId}/players`),
  leave:          (sessionId: string)                     => httpClient.delete(`/sessions/${sessionId}/players/me`),
  kick:           (sessionId: string, playerId: string, confirm?: boolean) =>
                                                             httpClient.delete(`/sessions/${sessionId}/players/${playerId}`, { params: { confirm } }),
  close:          (sessionId: string)                     => httpClient.delete(`/sessions/${sessionId}`),
  updateSettings: (sessionId: string, data: UpdateSettingsRequest) =>
                                                             httpClient.patch(`/sessions/${sessionId}/settings`, data),
  pause:          (sessionId: string)                     => httpClient.post(`/sessions/${sessionId}/pause`),
  resume:         (sessionId: string)                     => httpClient.post(`/sessions/${sessionId}/resume`),
};
```

Синхронизировать типы `SessionDetailResponse`, `PlayerInList` в `types/api.ts` с бэком.

### Стадия F5. `gameApi.ts`

**Создать `frontend/src/api/gameApi.ts`**:
```ts
export const gameApi = {
  start:           (sessionId: string) => httpClient.post(`/sessions/${sessionId}/start`),
  acknowledgeRole: (sessionId: string) => httpClient.post(`/sessions/${sessionId}/acknowledge-role`),
  nightAction:     (sessionId: string, target_player_id: string) =>
                     httpClient.post<NightActionResponse>(`/sessions/${sessionId}/night-action`, { target_player_id }),
  vote:            (sessionId: string, target_player_id: string | null) =>
                     httpClient.post<VoteResponse>(`/sessions/${sessionId}/vote`, { target_player_id }),
  getState:        (sessionId: string) => httpClient.get<GameStateResponse>(`/sessions/${sessionId}/state`),
};
```

Обновить `GameStateResponse` в `types/api.ts` до актуального формата ответа `/state` (см. §5.4 backend_documentation.md + изменения из B5).

### Стадия F6. `subscriptionsApi.ts`

**Создать `frontend/src/api/subscriptionsApi.ts`**:
```ts
export const subscriptionsApi = {
  me:     ()                                => httpClient.get<SubscriptionStatusResponse>('/subscriptions/me'),
  create: (data: CreateSubscriptionRequest) => httpClient.post<CreateSubscriptionResponse>('/subscriptions', data),
};
```

Использовать в `ProfilePage` для отображения плана и кнопки «Апгрейд до Pro».

### Стадия F7. WebSocket-клиент

**Создать `frontend/src/api/wsClient.ts`** — синглтон:

```ts
class WsClient {
  private socket: WebSocket | null = null;
  private heartbeatId: number | null = null;
  private reconnectAttempts = 0;
  private currentSessionId: string | null = null;

  connect(sessionId: string) {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    const url = `${WS_BASE_URL}/ws/sessions/${sessionId}?token=${encodeURIComponent(token)}`;
    this.currentSessionId = sessionId;
    this.socket = new WebSocket(url);
    this.socket.onmessage = (e) => this.dispatch(JSON.parse(e.data));
    this.socket.onopen    = () => { this.reconnectAttempts = 0; this.startHeartbeat(); };
    this.socket.onclose   = (e) => this.handleClose(e);
  }

  disconnect() {
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.currentSessionId = null;
  }

  private dispatch(msg: { type: string; payload: any }) {
    switch (msg.type) {
      case 'player_joined':      return useSessionStore.getState().upsertPlayer(msg.payload);
      case 'player_left':
      case 'player_kicked':      return useSessionStore.getState().removePlayer(msg.payload.player_id);
      case 'settings_updated':   return useSessionStore.getState().setSettings(msg.payload.settings);
      case 'session_closed':     return useSessionStore.getState().reset(); // + redirect
      case 'kicked':             return handleKicked(msg.payload);
      case 'game_started':       return useGameStore.getState().onGameStarted(msg.payload);
      case 'role_assigned':      return useGameStore.getState().setMyRole(msg.payload);
      case 'phase_changed':      return useGameStore.getState().applyPhase(msg.payload);
      case 'night_result':       return useGameStore.getState().applyNightResult(msg.payload);
      case 'vote_update':        return useGameStore.getState().setVoteCounts(msg.payload);
      case 'vote_result':        return useGameStore.getState().applyVoteResult(msg.payload);
      case 'player_eliminated':  return useGameStore.getState().markEliminated(msg.payload.player_id);
      case 'action_confirmed':   return useGameStore.getState().setActionSubmitted(true);
      case 'check_result':       return useGameStore.getState().addCheckResult(msg.payload);
      case 'announcement':       return useGameStore.getState().queueAnnouncement(msg.payload);
      case 'game_finished':      return useGameStore.getState().setResult(msg.payload);
      case 'pong':               return; // heartbeat reply
    }
  }

  private startHeartbeat() {
    this.heartbeatId = window.setInterval(() => {
      this.socket?.readyState === WebSocket.OPEN && this.socket.send(JSON.stringify({ type: 'ping' }));
    }, 30_000);
  }
  private stopHeartbeat() { this.heartbeatId && window.clearInterval(this.heartbeatId); this.heartbeatId = null; }

  private handleClose(e: CloseEvent) {
    this.stopHeartbeat();
    // 4000 (kick), 4001 (bad token), 4003 (not in session) — не переподключаемся.
    if ([4000, 4001, 4003].includes(e.code)) return;
    const sessionId = this.currentSessionId;
    if (!sessionId) return;
    const delay = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    window.setTimeout(() => this.connect(sessionId), delay);
  }
}
export const wsClient = new WsClient();
```

### Стадия F8. Рефакторинг сторов

**`frontend/src/stores/sessionStore.ts`**:
- `createSession(data)` → `await sessionApi.create(data)` → `setState({ session, isHost: true, myPlayerId })`.
- `joinSession(code, name)` → `await sessionApi.join(code, { name })`, затем `await sessionApi.getByCode(code)` для полного стейта.
- `loadByCode(code)` — новый метод для лобби-страницы.
- `setSettings(settings)` → `await sessionApi.updateSettings(sessionId, settings)` → локальный setState из ответа.
- `upsertPlayer(p)` / `removePlayer(id)` / `setPlayers(list)` — хуки для wsClient.
- Удалить локальный shuffle ролей, удалить таймеры автодобавления игроков.
- **Сохранить** `withStory`, `selectedStoryId` как чисто клиентские поля. Не передавать их в `sessionApi.create` / `updateSettings`.

**`frontend/src/stores/gameStore.ts`**:
- `loadState(sessionId)` → `await gameApi.getState(sessionId)` → нормализация в текущие поля (`screen`, `phase`, `myRole`, `players`, `awaitingAction`, …).
- `submitNightAction(targetId)` → `await gameApi.nightAction(...)` → `setActionSubmitted(true)`. WS пришлёт `check_result` для шерифа/дона.
- `submitVote(targetId)` → `await gameApi.vote(...)`.
- `acknowledgeRole()` → `await gameApi.acknowledgeRole(...)`.
- Методы-хуки для WS: `onGameStarted`, `applyPhase`, `applyNightResult`, `applyVoteResult`, `setVoteCounts`, `markEliminated`, `addCheckResult`, `queueAnnouncement`, `setResult`.
- `actionType` расширить литералом (он уже поддерживает новые значения).
- **Удалить** вызовы `startGameCycle`, `beginNightSequence`, `advanceNightAction`, `resolveNight`, `resolveDay`, `cleanupEngine` из `mockGameEngine`. Все эти эффекты теперь приходят из WS.

### Стадия F9. Рефакторинг страниц и компонентов

| Файл | Изменения |
|---|---|
| `pages/HomePage.tsx` | «Создать» → `await sessionStore.createSession(formData)` + navigate(`/sessions/${code}`). «Присоединиться» → `await sessionStore.joinSession(code, name)` + navigate. Формы CreateSession должны включать `settings.role_config` (в модалке). |
| `pages/LobbyPage.tsx` | На mount: `sessionStore.loadByCode(code)` + `wsClient.connect(sessionId)`. На unmount: `wsClient.disconnect()`. **Удалить** `useEffect` с авто-мок-игроками. Кнопка «Начать игру» → `gameApi.start(sessionId)` (WS затем пришлёт `game_started` / `role_assigned` / `phase_changed`). Модалка настроек → `sessionStore.setSettings` (через API). Модалка должна показывать 6 ролевых слотов (`mafia, don, sheriff, doctor, lover, maniac`). |
| `pages/GamePage.tsx` | На mount: `gameStore.loadState(sessionId)` + `wsClient.connect(sessionId)`. На unmount: `wsClient.disconnect()`. **Удалить** вызов `startGameCycle()`. Скрин теперь полностью управляется WS-событиями (`applyPhase` устанавливает правильный `screen`). |
| `pages/ProfilePage.tsx` | `subscriptionsApi.me()` для плана; `authApi.updateNickname` для inline-edit; `authStore.logout()` (теперь с вызовом `/auth/logout`). |
| `pages/StorySelectionPage.tsx` | **Оставляем**. Чисто клиентская логика: голосование сюжета — локальный таймер + мок-голоса от других игроков (обёрнуты в `USE_MOCKS` или оставлены как fake-UX, как сейчас). После выбора — `navigate('/game/...')`. Никаких API-вызовов. |
| `components/game/NightActionScreen.tsx` | `onConfirm()` → `gameStore.submitNightAction(selectedTarget)` → `gameApi.nightAction`. Поле `actionType` читается из `gameStore` (теперь приходит из WS `phase_changed.payload.action_type`). Для `check` / `don_check` ждём `check_result` WS, показываем результат. |
| `components/game/DayVotingScreen.tsx` | `onConfirm()` → `gameStore.submitVote(selectedTarget)` → `gameApi.vote`. Прогресс голосования обновляется из `vote_update`. |
| `components/game/DayDiscussionScreen.tsx` | Отображает `nightResult` из WS. Блокирует голосование для `dayBlockedPlayer`. Таймер берёт из `phase.timer_seconds`. |
| `components/game/NarratorScreen.tsx` | Оставляем как клиентский «озвучиватель» — читает `announcement.trigger` из WS и выбирает локальный текст/аудио. |
| `components/game/FinaleScreen.tsx` | `result` формируется из WS-события `game_finished` (winner, final_roster). |

### Стадия F10. Очистка моков

- `frontend/src/mocks/mockGameEngine.ts` — **удалить** или обернуть весь файл в `if (!USE_MOCKS) { throw... }`. Удалить все импорты во frontend.
- `frontend/src/mocks/sessionMocks.ts` — оставить только моки для StorySelectionPage (сюжеты). Удалить `mockLobbyPlayers`, `mockSession`, `mockDefaultSettings`.
- `frontend/src/mocks/authMocks.ts` — удалить (больше не используется после удаления fallback).
- `frontend/src/mocks/gameMocks.ts` — оставить `roleImages`, `roleDescriptions`, `cardBackImage` (визуальные ассеты). Удалить `mockRoles`.
- `frontend/src/pages/RoleRevealPage.tsx` — удалить (по docs уже не используется маршрутом).
- `frontend/src/pages/LobbyPage.tsx` — удалить таймеры автодобавления игроков и массив `mockNames`.

---

## Критические файлы

### Создать (frontend)
- `frontend/.env.example` ← **главный артефакт этой задачи**
- `frontend/src/api/sessionApi.ts`
- `frontend/src/api/gameApi.ts`
- `frontend/src/api/subscriptionsApi.ts`
- `frontend/src/api/wsClient.ts`

### Создать (backend)
- `backend/alembic/versions/20260412_extend_roles.py` — новая миграция CHECK-ограничений для `roles.team` и `night_actions.action_type`

### Изменить (frontend)
- `frontend/src/types/api.ts` — добавить `nickname`, sync session/game-типов
- `frontend/src/types/errors.ts` — sync ErrorCode с бэком
- `frontend/src/utils/constants.ts` — ROLE_LABELS (don/lover/maniac), ERROR_MESSAGES
- `frontend/src/api/authApi.ts` — `updateNickname`, `deleteAccount`
- `frontend/src/stores/authStore.ts` — `logout` → API, `setUser` с nickname
- `frontend/src/stores/sessionStore.ts` — API-вызовы вместо локальных мутаций, WS-хуки
- `frontend/src/stores/gameStore.ts` — `loadState`, WS-хуки, удалить mock-циклы
- `frontend/src/components/auth/RegisterForm.tsx` — поле `nickname`, убрать fallback
- `frontend/src/components/auth/LoginForm.tsx` — убрать fallback
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/LobbyPage.tsx`
- `frontend/src/pages/GamePage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/StorySelectionPage.tsx` — только отвязать от API
- `frontend/src/components/game/NightActionScreen.tsx`
- `frontend/src/components/game/DayVotingScreen.tsx`
- `frontend/src/components/game/DayDiscussionScreen.tsx`
- `frontend/src/components/game/FinaleScreen.tsx`

### Изменить (backend)
- `backend/.env` — `CORS_ORIGINS=http://localhost:3000,http://localhost:5173`
- `backend/.env.example` — добавить `CORS_ORIGINS`, `SECRET_KEY`
- `backend/models/role.py` — расширить `CHECK(team)` до `IN ('mafia','city','maniac')`
- `backend/models/night_action.py` — расширить `CHECK(action_type)` до новых типов
- `backend/scripts/seed.py` — добавить `don`, `lover`, `maniac`
- `backend/schemas/session.py::RoleConfig` — `don`, `lover`, `maniac`
- `backend/api/routers/sessions.py` — пересчёт баланса `civilian` и валидация мафии vs города с учётом новых ролей
- `backend/api/routers/game.py::night-action` — валидация новых `action_type`, ответ `check_result` для `don_check`, `is_blocked_tonight` в `/state`, `day_blocked_player`
- `backend/services/game_engine.py` — новая очередь ночи, `check_win_condition` с учётом маньяка
- `backend/services/night_action_resolver.py` — хэндлеры `don_check`, `lover_visit`, `maniac_kill`
- `backend/services/runtime_state.py` — `blocked_tonight`, `lover_last_target`
- `backend/services/state_service.py` — восстановление новых runtime-полей
- `backend/scripts/run_e2e_five_players.py` — обновить / добавить тест на 7 игроков
- `backend/docs/backend_documentation.md` — актуализировать разделы 4–7, 10

### Удалить (frontend, опционально)
- `frontend/src/mocks/mockGameEngine.ts`
- `frontend/src/mocks/authMocks.ts`
- `frontend/src/pages/RoleRevealPage.tsx`
- Из `frontend/src/mocks/sessionMocks.ts` — всё кроме `mockStories`

---

## Верификация (end-to-end)

```bash
# 1. Backend
cd backend
docker compose down -v                                    # чистый старт (опционально)
docker compose up -d
docker compose exec backend uv run alembic upgrade head   # применить новые миграции
docker compose exec backend uv run python -m scripts.seed # seed новых ролей
docker compose exec backend uv run pytest                 # smoke тест

# 2. Frontend
cd ../frontend
cp .env.example .env
npm install
npm start
```

Сценарии (две вкладки, обычная + incognito — два разных аккаунта):

1. **Регистрация**: в Tab1 регистрируем `host@test.com` с ником `Host`; в Tab2 — `player@test.com` с ником `Player`.
2. **Проверка nickname**: на `/profile` оба показывают свой ник, лобби/игра тоже.
3. **Создание сессии**: Tab1 создаёт сессию (7 игроков, `{mafia:1, don:1, sheriff:1, doctor:1, lover:1, maniac:1, civilian:1}`). Получает код.
4. **Join**: Tab2 вводит код → входит → в Tab1 через WS появляется новый игрок.
5. **Настройки**: Tab1 открывает модалку настроек, меняет таймер обсуждения → в Tab2 через WS `settings_updated` обновляются настройки. 
6. **5 ботов**: для теста `player_count=7` можно зарегистрировать ещё 5 аккаунтов в доп.вкладках или использовать `scripts/run_e2e_five_players.py` как шаблон.
7. **Старт игры**: Tab1 жмёт «Начать игру» → `phase_changed(role_reveal)` на всех вкладках → каждый видит свою роль.
8. **Ack ролей**: все подтверждают → `phase_changed(night)`.
9. **Ночь**:
   - Lover выбирает цель → `action_confirmed` лично; цель на фронте получает `is_blocked_tonight=true` при следующем `/state`.
   - Mafia kill → обычная логика.
   - Don → `don_check` → `check_result {is_sheriff: bool}` лично дону.
   - Sheriff → `check` → `check_result {team}` лично шерифу.
   - Doctor → `heal`.
   - Maniac → `maniac_kill`.
10. **День**:
    - `night_result` показывает кого убили.
    - Заблокированный lover'ом не может голосовать (UI скрывает кнопку).
    - Голосование → `vote_update` по мере кастов → авто-резолв при полном явке.
11. **Win condition**: после нескольких циклов — один из трёх исходов (city/mafia/maniac) → `game_finished` → `FinaleScreen` с `winner` и `final_roster`.
12. **Negative smoke**:
    - Неправильный код → `session_not_found` (русское сообщение).
    - Попытка действовать не в свою фазу → `wrong_phase`.
    - Повторное ночное действие → `action_already_submitted`.
    - Невалидный JWT (подменить в localStorage) → редирект на `/auth`.
    - Закрыть вкладку во время ночи → после реconnect'а стейт восстанавливается из `/state`.

Если все 12 шагов проходят — интеграция считается завершённой.

---

## Оценка объёма

- **Backend расширение**: ~4 дня (миграция + движок + тесты + доки).
- **Frontend интеграция**: ~3–4 дня (5 новых файлов + переписывание 10+ существующих).
- **Итого**: ~1 неделя аккуратной работы для одного разработчика.

Если хочется быстрее и попроще — можно откатить решение по ролям на «урезать фронт», тогда бэк трогать не нужно и задача ужимается до 2–3 дней чисто frontend-работы.
