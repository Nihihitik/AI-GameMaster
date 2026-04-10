## 1. Инициализация проекта

### 1.1 Создание проекта Vite + React + TypeScript

**Что сделать:** Инициализировать проект через Vite, настроить TypeScript, установить зависимости.

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Зависимости (установить сразу):**

```bash
npm install react-router-dom zustand axios
npm install -D tailwindcss @tailwindcss/vite
```

| Пакет | Назначение |
|-------|-----------|
| `react-router-dom` | Маршрутизация (`/auth`, `/`, `/sessions/new`, `/sessions/:code`, `/game/:sessionId`) |
| `zustand` | Глобальное состояние (auth, session, game) |
| `axios` | HTTP-клиент с interceptors для auto-refresh |
| `tailwindcss` + `@tailwindcss/vite` | Утилитарные CSS-классы |

**Файлы конфигурации:**

- `vite.config.ts` — добавить plugin `@tailwindcss/vite`, настроить proxy для `/api` и `/ws` на `http://localhost:8000` (backend dev server)
- `src/index.css` — добавить `@import "tailwindcss";`
- `tsconfig.json` — убедиться, что `"strict": true`, `"baseUrl": "src"`, добавить `"paths": { "@/*": ["./*"] }`

### 1.2 Переменные окружения

**Файл:** `.env.development`

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
VITE_USE_MOCKS=true
```

**Файл:** `.env.production`

```env
VITE_API_BASE_URL=https://api.production.com
VITE_WS_BASE_URL=wss://api.production.com
VITE_USE_MOCKS=false
```

Доступ: `import.meta.env.VITE_API_BASE_URL`.

### 1.3 Структура папок

```
src/
├── api/                    # HTTP-клиент, эндпоинты, WebSocket-клиент
│   ├── httpClient.ts       # Axios-инстанс + interceptors
│   ├── authApi.ts          # POST /auth/register, login, refresh, logout; GET /auth/me
│   ├── sessionsApi.ts      # CRUD сессий, join, start, settings
│   ├── gameApi.ts          # night-action, vote, acknowledge-role, state
│   └── wsClient.ts         # WebSocket-класс с реконнектом
├── types/                  # TypeScript-интерфейсы
│   ├── api.ts              # Request/Response типы для всех эндпоинтов
│   ├── ws.ts               # WS-события (type + payload)
│   ├── game.ts             # Игровые сущности (Player, Phase, Role...)
│   └── errors.ts           # Коды ошибок, ApiError
├── stores/                 # Zustand-хранилища
│   ├── authStore.ts        # Токены, user, isAuthenticated
│   ├── sessionStore.ts     # Текущая сессия, players, settings
│   └── gameStore.ts        # Фаза, my_player, targets, votes, result
├── pages/                  # Страницы (по маршрутам)
│   ├── AuthPage.tsx
│   ├── HomePage.tsx
│   ├── SessionNewPage.tsx
│   ├── LobbyPage.tsx
│   └── GamePage.tsx
├── components/             # Переиспользуемые компоненты
│   ├── ui/                 # Кнопки, инпуты, слайдеры, степперы, таймеры, модалки
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Slider.tsx
│   │   ├── Stepper.tsx
│   │   ├── Timer.tsx
│   │   ├── Toggle.tsx
│   │   ├── Modal.tsx
│   │   └── Toast.tsx
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── lobby/
│   │   ├── PlayerList.tsx
│   │   ├── SessionCode.tsx
│   │   └── LobbySettings.tsx
│   └── game/
│       ├── RoleRevealScreen.tsx
│       ├── NarratorScreen.tsx
│       ├── NightActionScreen.tsx
│       ├── NightWaitingScreen.tsx
│       ├── DayDiscussionScreen.tsx
│       ├── DayVotingScreen.tsx
│       ├── EliminatedScreen.tsx
│       └── FinaleScreen.tsx
├── hooks/                  # Кастомные хуки
│   ├── useTimer.ts         # Обратный отсчёт по timer_seconds + timer_started_at
│   ├── useWebSocket.ts     # Подключение/отключение WS, обработка событий
│   └── useAuth.ts          # Проверка авторизации, редирект
├── mocks/                  # Mock-данные (JSON-файлы + mock-обработчики)
│   ├── authMocks.ts
│   ├── sessionMocks.ts
│   ├── gameMocks.ts
│   └── wsMocks.ts
├── utils/
│   ├── tokenStorage.ts     # Работа с access_token (память) и refresh_token (localStorage)
│   └── constants.ts        # Коды ошибок, текстовые метки ролей
├── App.tsx                 # Маршрутизатор
└── main.tsx                # Точка входа
```

### 1.4 Маршрутизация

**Файл:** `src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import SessionNewPage from './pages/SessionNewPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import { useAuthStore } from './stores/authStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/sessions/new" element={<ProtectedRoute><SessionNewPage /></ProtectedRoute>} />
        <Route path="/sessions/:code" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/game/:sessionId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 2. API-клиент и типы

### 2.1 TypeScript-интерфейсы

**Файл:** `src/types/errors.ts`

```ts
/** Единый формат ошибки от backend */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Все известные коды ошибок.
 * Используются для условной логики на клиенте (показ конкретного сообщения, редирект).
 */
export type ErrorCode =
  | 'validation_error'
  | 'invalid_role_config'
  | 'insufficient_players'
  | 'invalid_target'
  | 'token_expired'
  | 'token_invalid'
  | 'invalid_credentials'
  | 'not_host'
  | 'pro_required'
  | 'wrong_phase'
  | 'player_dead'
  | 'session_not_found'
  | 'player_not_found'
  | 'already_joined'
  | 'session_full'
  | 'game_already_started'
  | 'action_already_submitted'
  | 'game_not_finished'
  | 'internal_error';
```

**Файл:** `src/types/game.ts`

```ts
export interface Role {
  name: string;          // "Мафия", "Шериф", "Доктор", "Мирный"
  team: 'mafia' | 'city';
  abilities?: {
    night_action: 'kill' | 'check' | 'heal' | null;
  };
}

export interface Player {
  id: string;            // UUID (player_id)
  name: string;
  status: 'alive' | 'dead';
  join_order: number;
}

export interface PlayerWithRole extends Player {
  role: { name: string; team: 'mafia' | 'city' };
}

export interface Phase {
  id: string;
  type: 'role_reveal' | 'night' | 'day';
  number: number;
  sub_phase: 'discussion' | 'voting' | null;
  started_at: string;         // ISO 8601
  timer_seconds: number | null;
  timer_started_at: string | null; // ISO 8601
}

export interface Announcement {
  audio_url: string;
  text: string;
  duration_ms: number;
}

export interface MyPlayer {
  id: string;
  name: string;
  status: 'alive' | 'dead';
  role: Role;
}

export interface Target {
  player_id: string;
  name: string;
}

export interface RoleRevealInfo {
  my_acknowledged: boolean;
  players_acknowledged: number;
  players_total: number;
}

export interface VoteInfo {
  total_expected: number;
  cast: number;
}

export interface GameResult {
  winner: 'mafia' | 'city' | null;
  announcement: Announcement;
  players: PlayerWithRole[];
}

export interface RoleConfig {
  mafia: number;
  sheriff: number; // 0 или 1
  doctor: number;  // 0 или 1
}

export interface SessionSettings {
  role_reveal_timer_seconds: number;
  discussion_timer_seconds: number;
  voting_timer_seconds: number;
  night_action_timer_seconds: number;
  role_config: RoleConfig;
}

export interface Session {
  id: string;
  code: string;
  host_user_id: string;
  player_count: number;
  status: 'waiting' | 'active' | 'finished';
  settings: SessionSettings;
  created_at: string;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  join_order: number;
  is_host: boolean;
}
```

**Файл:** `src/types/api.ts`

```ts
import { Session, SessionSettings, LobbyPlayer, Phase, MyPlayer, Player, RoleRevealInfo, Target, VoteInfo, GameResult } from './game';

// ---- Auth ----

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  has_pro: boolean;
  created_at: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

// ---- Sessions ----

export interface CreateSessionRequest {
  player_count: number;
  settings: SessionSettings;
}

export interface CreateSessionResponse extends Session {}

export interface GetSessionResponse extends Session {
  players: LobbyPlayer[];
}

export interface JoinSessionRequest {
  name: string;
}

export interface JoinSessionResponse {
  player_id: string;
  session_id: string;
  join_order: number;
}

export interface GetPlayersResponse {
  players: LobbyPlayer[];
}

export interface UpdateSettingsRequest {
  role_reveal_timer_seconds?: number;
  discussion_timer_seconds?: number;
  voting_timer_seconds?: number;
  night_action_timer_seconds?: number;
  role_config?: {
    mafia: number;
    sheriff: number;
    doctor: number;
  };
}

export interface UpdateSettingsResponse {
  settings: SessionSettings;
}

export interface StartSessionResponse {
  status: 'active';
  phase: {
    type: 'role_reveal';
    number: 0;
  };
}

// ---- Game ----

export interface GameStateResponse {
  session_status: 'active' | 'finished';
  phase: Phase;
  my_player: MyPlayer;
  players: Player[];
  role_reveal: RoleRevealInfo | null;
  awaiting_action: boolean;
  action_type: 'kill' | 'check' | 'heal' | 'vote' | null;
  available_targets: Target[] | null;
  my_action_submitted: boolean;
  votes: VoteInfo | null;
  result: GameResult | null;
}

export interface AcknowledgeRoleResponse {
  acknowledged: true;
  players_acknowledged: number;
  players_total: number;
}

export interface NightActionRequest {
  target_player_id: string;
}

export interface NightActionResponse {
  action_type: 'kill' | 'check' | 'heal';
  target_player_id: string;
  confirmed: true;
  check_result?: {
    team: 'mafia' | 'city';
  };
}

export interface VoteRequest {
  target_player_id: string | null;
}

export interface VoteResponse {
  voter_player_id: string;
  target_player_id: string | null;
  confirmed: true;
}

export interface RematchRequest {
  keep_players: boolean;
  settings?: Partial<SessionSettings>;
}

export interface RematchResponse {
  new_session_id: string;
  code: string;
  status: 'waiting' | 'active';
  players_kept: number;
}
```

**Файл:** `src/types/ws.ts`

```ts
import { Announcement, Role, Target } from './game';

// --- Лобби ---

export interface WsPlayerJoined {
  type: 'player_joined';
  payload: { player_id: string; name: string; join_order: number };
}

export interface WsPlayerLeft {
  type: 'player_left';
  payload: { player_id: string };
}

export interface WsSettingsUpdated {
  type: 'settings_updated';
  payload: { settings: import('./game').SessionSettings };
}

// --- Старт игры ---

export interface WsGameStarted {
  type: 'game_started';
  payload: {
    phase: { type: 'role_reveal'; number: 0 };
    timer_seconds: number;
    started_at: string;
  };
}

export interface WsRoleAssigned {
  type: 'role_assigned';
  payload: { role: Role };
}

export interface WsRoleAcknowledged {
  type: 'role_acknowledged';
  payload: { player_id: string; players_acknowledged: number; players_total: number };
}

export interface WsAllAcknowledged {
  type: 'all_acknowledged';
  payload: {};
}

// --- Игровой цикл ---

export interface WsPhaseChanged {
  type: 'phase_changed';
  payload: {
    phase: { type: 'night' | 'day'; number: number };
    sub_phase: 'discussion' | 'voting' | null;
    timer_seconds: number | null;
    timer_started_at: string | null;
    announcement: Announcement;
  };
}

export interface WsActionRequired {
  type: 'action_required';
  payload: {
    action_type: 'kill' | 'check' | 'heal';
    available_targets: Target[];
    timer_seconds: number;
    timer_started_at: string;
  };
}

export interface WsActionConfirmed {
  type: 'action_confirmed';
  payload: { action_type: 'kill' | 'check' | 'heal' };
}

export interface WsMafiaChoiceMade {
  type: 'mafia_choice_made';
  payload: { target_player_id: string; target_name: string; chosen_by: string };
}

export interface WsActionTimeout {
  type: 'action_timeout';
  payload: { action_type: 'kill' | 'check' | 'heal' };
}

export interface WsCheckResult {
  type: 'check_result';
  payload: { target_player_id: string; team: 'mafia' | 'city' };
}

export interface WsNightResult {
  type: 'night_result';
  payload: {
    died: { player_id: string; name: string }[] | null;
    announcement: Announcement;
  };
}

export interface WsVoteUpdate {
  type: 'vote_update';
  payload: { votes_cast: number; votes_total: number };
}

export interface WsVoteResult {
  type: 'vote_result';
  payload: {
    eliminated: { player_id: string; name: string } | null;
    votes: { voter_player_id: string; target_player_id: string | null }[];
    announcement: Announcement;
  };
}

export interface WsPlayerEliminated {
  type: 'player_eliminated';
  payload: { player_id: string; name: string; cause: 'vote' | 'night' };
}

export interface WsKicked {
  type: 'kicked';
  payload: { reason: 'host_kicked' };
}

// --- Завершение ---

export interface WsGameFinished {
  type: 'game_finished';
  payload: {
    winner: 'mafia' | 'city';
    players: { id: string; name: string; role: { name: string; team: string }; status: string }[];
    announcement: Announcement;
  };
}

export interface WsRematchProposed {
  type: 'rematch_proposed';
  payload: { host_name: string; new_session_id: string; code: string };
}

export interface WsSessionClosed {
  type: 'session_closed';
  payload: {};
}

// --- Служебные ---

export interface WsError {
  type: 'error';
  payload: { code: string; message: string };
}

export interface WsPong {
  type: 'pong';
  payload: {};
}

/** Дискриминированное объединение всех WS-событий от сервера */
export type WsServerMessage =
  | WsPlayerJoined
  | WsPlayerLeft
  | WsSettingsUpdated
  | WsGameStarted
  | WsRoleAssigned
  | WsRoleAcknowledged
  | WsAllAcknowledged
  | WsPhaseChanged
  | WsActionRequired
  | WsActionConfirmed
  | WsMafiaChoiceMade
  | WsActionTimeout
  | WsCheckResult
  | WsNightResult
  | WsVoteUpdate
  | WsVoteResult
  | WsPlayerEliminated
  | WsKicked
  | WsGameFinished
  | WsRematchProposed
  | WsSessionClosed
  | WsError
  | WsPong;
```

### 2.2 HTTP-клиент с auto-refresh

**Файл:** `src/api/httpClient.ts`

**Что сделать:** Создать инстанс axios с:
- `baseURL` из `import.meta.env.VITE_API_BASE_URL` + `/api`
- Request interceptor: добавляет `Authorization: Bearer {access_token}` из `authStore`
- Response interceptor: при получении `401` (кроме эндпоинтов `/auth/login`, `/auth/register`, `/auth/refresh`) — вызывает `POST /api/auth/refresh` с `refresh_token` из localStorage, обновляет оба токена, повторяет исходный запрос. Если refresh тоже не удался — очистить токены и редирект на `/auth`
- Все ошибки парсятся в `ApiErrorResponse`: `{ error: { code, message } }`

**Ключевая логика interceptor:**

```ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const httpClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Флаг, предотвращающий параллельные refresh-запросы
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

// Request interceptor — добавляет токен
httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor — auto-refresh при 401
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const skipUrls = ['/auth/login', '/auth/register', '/auth/refresh'];

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !skipUrls.some((url) => originalRequest.url?.includes(url))
    ) {
      if (isRefreshing) {
        // Ждать завершения текущего refresh
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(httpClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`,
          { refresh_token: refreshToken }
        );

        useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
        processQueue(null, data.access_token);

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return httpClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/auth';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default httpClient;
```

**Хелпер для извлечения ошибки:**

```ts
// src/utils/parseApiError.ts
import { AxiosError } from 'axios';
import { ApiErrorResponse, ErrorCode } from '../types/errors';

export interface ParsedApiError {
  code: ErrorCode | string;
  message: string;
  httpStatus: number;
}

export function parseApiError(err: unknown): ParsedApiError {
  if (err instanceof AxiosError && err.response) {
    const body = err.response.data as ApiErrorResponse;
    if (body?.error) {
      return {
        code: body.error.code,
        message: body.error.message,
        httpStatus: err.response.status,
      };
    }
    return {
      code: 'internal_error',
      message: 'Неизвестная ошибка сервера',
      httpStatus: err.response.status,
    };
  }
  return { code: 'internal_error', message: 'Нет связи с сервером', httpStatus: 0 };
}
```

### 2.3 API-модули

**Файл:** `src/api/authApi.ts`

```ts
import httpClient from './httpClient';
import { RegisterRequest, LoginRequest, AuthResponse, RefreshRequest, RefreshResponse, UserProfile, LogoutRequest } from '../types/api';

export const authApi = {
  register: (data: RegisterRequest) =>
    httpClient.post<AuthResponse>('/auth/register', data),

  login: (data: LoginRequest) =>
    httpClient.post<AuthResponse>('/auth/login', data),

  refresh: (data: RefreshRequest) =>
    httpClient.post<RefreshResponse>('/auth/refresh', data),

  me: () =>
    httpClient.get<UserProfile>('/auth/me'),

  logout: (data: LogoutRequest) =>
    httpClient.post('/auth/logout', data),
};
```

**Файл:** `src/api/sessionsApi.ts`

```ts
import httpClient from './httpClient';
import {
  CreateSessionRequest, CreateSessionResponse,
  GetSessionResponse, JoinSessionRequest, JoinSessionResponse,
  GetPlayersResponse, UpdateSettingsRequest, UpdateSettingsResponse,
  StartSessionResponse, RematchRequest, RematchResponse,
} from '../types/api';

export const sessionsApi = {
  create: (data: CreateSessionRequest) =>
    httpClient.post<CreateSessionResponse>('/sessions', data),

  getByCode: (code: string) =>
    httpClient.get<GetSessionResponse>(`/sessions/${code}`),

  join: (code: string, data: JoinSessionRequest) =>
    httpClient.post<JoinSessionResponse>(`/sessions/${code}/join`, data),

  getPlayers: (sessionId: string) =>
    httpClient.get<GetPlayersResponse>(`/sessions/${sessionId}/players`),

  kick: (sessionId: string, playerId: string) =>
    httpClient.delete(`/sessions/${sessionId}/players/${playerId}`),

  leave: (sessionId: string) =>
    httpClient.delete(`/sessions/${sessionId}/players/me`),

  delete: (sessionId: string) =>
    httpClient.delete(`/sessions/${sessionId}`),

  updateSettings: (sessionId: string, data: UpdateSettingsRequest) =>
    httpClient.patch<UpdateSettingsResponse>(`/sessions/${sessionId}/settings`, data),

  start: (sessionId: string) =>
    httpClient.post<StartSessionResponse>(`/sessions/${sessionId}/start`),

  rematch: (sessionId: string, data: RematchRequest) =>
    httpClient.post<RematchResponse>(`/sessions/${sessionId}/rematch`, data),
};
```

**Файл:** `src/api/gameApi.ts`

```ts
import httpClient from './httpClient';
import {
  GameStateResponse, AcknowledgeRoleResponse,
  NightActionRequest, NightActionResponse,
  VoteRequest, VoteResponse,
} from '../types/api';

export const gameApi = {
  getState: (sessionId: string) =>
    httpClient.get<GameStateResponse>(`/sessions/${sessionId}/state`),

  acknowledgeRole: (sessionId: string) =>
    httpClient.post<AcknowledgeRoleResponse>(`/sessions/${sessionId}/acknowledge-role`),

  nightAction: (sessionId: string, data: NightActionRequest) =>
    httpClient.post<NightActionResponse>(`/sessions/${sessionId}/night-action`, data),

  vote: (sessionId: string, data: VoteRequest) =>
    httpClient.post<VoteResponse>(`/sessions/${sessionId}/vote`, data),
};
```

### 2.4 WebSocket-клиент

**Файл:** `src/api/wsClient.ts`

**Что сделать:** Класс `GameWebSocket` с:
- Подключение: `ws://{host}/ws/sessions/{session_id}?token={access_token}`
- Ping каждые 30 секунд: `{ type: "ping", payload: {} }`
- Exponential backoff при разрыве: 1, 2, 4, 8, 16, 30 секунд (max 30)
- При close code `4001` — вызвать refresh токена, переподключиться с новым
- Колбэк `onMessage(event: WsServerMessage)` — диспатчит в store
- Overlay «Восстановление соединения...» при `reconnecting` статусе

```ts
import { WsServerMessage } from '../types/ws';
import { useAuthStore } from '../stores/authStore';

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export class GameWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  public onMessage: ((msg: WsServerMessage) => void) | null = null;
  public onStatusChange: ((status: ConnectionStatus) => void) | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  connect() {
    const accessToken = useAuthStore.getState().accessToken;
    const wsBase = import.meta.env.VITE_WS_BASE_URL;
    const url = `${wsBase}/ws/sessions/${this.sessionId}?token=${accessToken}`;

    this.onStatusChange?.('connecting');
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.onStatusChange?.('connected');
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsServerMessage = JSON.parse(event.data);
        this.onMessage?.(msg);
      } catch { /* ignore parse errors */ }
    };

    this.ws.onclose = (event) => {
      this.stopPing();
      if (this.intentionalClose) return;

      if (event.code === 4001) {
        // Невалидный токен — попробовать refresh
        this.handleTokenRefresh();
      } else {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose будет вызван автоматически
    };
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', payload: {} });
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect() {
    this.onStatusChange?.('reconnecting');
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay);
    this.reconnectAttempt++;
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  private async handleTokenRefresh() {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }
      );

      if (!response.ok) throw new Error('Refresh failed');

      const data = await response.json();
      useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
      this.connect(); // Переподключение с новым токеном
    } catch {
      useAuthStore.getState().logout();
      window.location.href = '/auth';
    }
  }

  disconnect() {
    this.intentionalClose = true;
    this.stopPing();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
    this.ws = null;
    this.onStatusChange?.('disconnected');
  }
}
```

---

## 3. Auth-страницы (`/auth`)

### 3.1 Auth Store

**Файл:** `src/stores/authStore.ts`

```ts
import { create } from 'zustand';
import { UserProfile } from '../types/api';

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserProfile) => void;
  logout: () => void;
  initialize: () => boolean; // Проверка наличия refresh_token при старте
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('refresh_token', refreshToken);
    set({ accessToken, isAuthenticated: true });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('refresh_token');
    set({ accessToken: null, user: null, isAuthenticated: false });
  },

  initialize: () => {
    const refreshToken = localStorage.getItem('refresh_token');
    return !!refreshToken;
  },
}));
```

### 3.2 Хук проверки авторизации при загрузке приложения

**Файл:** `src/hooks/useAuth.ts`

**Что сделать:** При монтировании `App` — проверить наличие `refresh_token` в localStorage. Если есть — вызвать `POST /api/auth/refresh`, затем `GET /api/auth/me`. Если нет или refresh не удался — редирект на `/auth`.

Логика:
1. Проверить `localStorage.getItem('refresh_token')`
2. Если нет — `isAuthenticated = false`, перенаправить на `/auth`
3. Если есть — вызвать `POST /api/auth/refresh` с телом `{ refresh_token }`:
   - Успех (200): получить `{ access_token, refresh_token }`, сохранить через `setTokens`
   - Ошибка (401): вызвать `logout()`, перенаправить на `/auth`
4. После получения токена — вызвать `GET /api/auth/me`:
   - Успех: сохранить профиль в `authStore.setUser()`
   - Ошибка: не критична, продолжить работу

### 3.3 Страница авторизации

**Файл:** `src/pages/AuthPage.tsx`

**Что сделать:** Страница с двумя состояниями — «Регистрация» и «Вход». Переключение через ссылку внизу формы. Если пользователь уже авторизован (`isAuthenticated`) — редирект на `/`.

**Состояние компонента:**
```ts
const [mode, setMode] = useState<'login' | 'register'>('login');
```

### 3.4 Форма регистрации

**Файл:** `src/components/auth/RegisterForm.tsx`

**Элементы UI:**
- Поле email — `<Input type="email">`, валидация формата email регулярным выражением
- Поле password — `<Input type="password">`, кнопка показать/скрыть пароль, минимум 8 символов
- Кнопка «Создать аккаунт» — disabled пока форма невалидна или идёт запрос
- Ссылка «Уже есть аккаунт» — вызывает `onToggle()` для переключения на LoginForm

**Вызов API:**

```
POST /api/auth/register
Body: { "email": "player@example.com", "password": "securepass123" }
```

Успешный ответ (201):
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "player@example.com",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

Ошибки:
- HTTP 400, `code: "validation_error"` — показать `message` («Пароль должен быть не короче 8 символов»)
- HTTP 409, `code: "already_joined"` — показать «Пользователь с таким email уже существует» (примечание: backend вернёт 409 при дублировании email)

**При успехе:**
1. `authStore.setTokens(data.access_token, data.refresh_token)`
2. `navigate('/')`

### 3.5 Форма входа

**Файл:** `src/components/auth/LoginForm.tsx`

**Элементы UI:**
- Поле email — `<Input type="email">`
- Поле password — `<Input type="password">`
- Кнопка «Войти» — disabled пока форма пуста или идёт запрос
- Ссылка «Нет аккаунта» — переключает на RegisterForm

**Вызов API:**

```
POST /api/auth/login
Body: { "email": "player@example.com", "password": "securepass123" }
```

Успешный ответ (200):
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "player@example.com",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

Ошибки:
- HTTP 401, `code: "invalid_credentials"` — показать «Неверный email или пароль»

**При успехе:** аналогично регистрации — `setTokens` + `navigate('/')`.

### 3.6 Утилита хранения токенов

**Файл:** `src/utils/tokenStorage.ts`

```ts
// access_token хранится ТОЛЬКО в памяти (через zustand store).
// refresh_token хранится в localStorage.

export const TOKEN_KEY = 'refresh_token';

export function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeRefreshToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
```

### 3.7 Mock-данные для тестирования Auth

**Файл:** `src/mocks/authMocks.ts`

```ts
import { AuthResponse, UserProfile } from '../types/api';

export const mockRegisterResponse: AuthResponse = {
  user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'player@example.com',
  access_token: 'mock-access-token-register',
  refresh_token: 'mock-refresh-token-register',
};

export const mockLoginResponse: AuthResponse = {
  user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'player@example.com',
  access_token: 'mock-access-token-login',
  refresh_token: 'mock-refresh-token-login',
};

export const mockUserProfile: UserProfile = {
  user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'player@example.com',
  has_pro: false,
  created_at: '2026-04-01T10:00:00Z',
};

export const mockRefreshResponse = {
  access_token: 'mock-access-token-refreshed',
  refresh_token: 'mock-refresh-token-refreshed',
};

// Ошибки
export const mockInvalidCredentials = {
  error: { code: 'invalid_credentials', message: 'Неверный email или пароль' },
};

export const mockEmailAlreadyExists = {
  error: { code: 'validation_error', message: 'Пользователь с таким email уже существует' },
};
```

---

## 4. Главная страница (`/`)

### 4.1 Компонент страницы

**Файл:** `src/pages/HomePage.tsx`

**Что сделать:** Главная страница приложения. При монтировании проверяет авторизацию через `GET /api/auth/me`.

**Элементы UI:**
1. **Кнопка «Новая сессия»** — `navigate('/sessions/new')`
2. **Блок «Присоединиться»:**
   - Поле ввода `<Input>` для 6-символьного кода сессии (uppercase, только буквы и цифры)
   - Кнопка «Присоединиться» — при нажатии открывает модальное окно ввода имени
3. **Иконка настроек** — открывает модал/drawer с настройками приложения

**Состояние:**
```ts
const [sessionCode, setSessionCode] = useState('');
const [showNameModal, setShowNameModal] = useState(false);
const [showSettings, setShowSettings] = useState(false);
const [playerName, setPlayerName] = useState('');
const [joinError, setJoinError] = useState<string | null>(null);
const [isJoining, setIsJoining] = useState(false);
```

### 4.2 Проверка авторизации при монтировании

При монтировании `HomePage`:

```
GET /api/auth/me
Headers: Authorization: Bearer {access_token}
```

Успешный ответ (200):
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "player@example.com",
  "has_pro": false,
  "created_at": "2026-04-01T10:00:00Z"
}
```

Сохранить в `authStore.setUser(data)`.

При ошибке 401 — interceptor автоматически попробует refresh. Если и refresh не удался — редирект на `/auth`.

### 4.3 Модал ввода имени и присоединение к сессии

Когда пользователь нажимает «Присоединиться»:
1. Показать модальное окно (`<Modal>`) с полем `name` (1-32 символа)
2. При подтверждении вызвать:

```
POST /api/sessions/{code}/join
Body: { "name": "Саша" }
```

Успешный ответ (200):
```json
{
  "player_id": "player-uuid-001",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "join_order": 3
}
```

**При успехе:**
1. Сохранить `session_id` в `sessionStore`
2. `navigate('/sessions/{code}')`

**При ошибке — показать сообщение в модале:**

| `error.code` | Текст пользователю |
|---|---|
| `session_not_found` | «Сессия не найдена» |
| `session_full` | «Все места заняты» |
| `game_already_started` | «Игра уже началась» |
| `already_joined` | «Вы уже в этой сессии» |
| `validation_error` | Показать `error.message` |

### 4.4 Настройки приложения

**Компонент:** `src/components/ui/SettingsPanel.tsx` (или отдельный модал внутри `HomePage.tsx`)

| Настройка | Элемент | localStorage key | Значение по умолчанию |
|---|---|---|---|
| Громкость ведущего | `<Slider min={0} max={100}>` | `settings_narrator_volume` | 80 |
| Звуковые эффекты | `<Toggle>` | `settings_sfx_enabled` | true |

Чтение и запись в `localStorage` при изменении.

### 4.5 Mock-данные для Home

**Файл:** `src/mocks/sessionMocks.ts` (частично)

```ts
import { JoinSessionResponse } from '../types/api';

export const mockJoinResponse: JoinSessionResponse = {
  player_id: 'player-uuid-009',
  session_id: '550e8400-e29b-41d4-a716-446655440000',
  join_order: 3,
};

export const mockJoinErrors = {
  session_not_found: {
    error: { code: 'session_not_found', message: 'Сессия не найдена' },
  },
  session_full: {
    error: { code: 'session_full', message: 'Все места заняты' },
  },
  game_already_started: {
    error: { code: 'game_already_started', message: 'Игра уже началась' },
  },
  already_joined: {
    error: { code: 'already_joined', message: 'Вы уже подключены к этой сессии' },
  },
};
```

---

## 5. Создание сессии (`/sessions/new`)

### 5.1 Компонент страницы

**Файл:** `src/pages/SessionNewPage.tsx`

**Что сделать:** Форма настроек для создания новой игровой сессии. Доступна только авторизованным пользователям.

### 5.2 Состояние формы

```ts
interface SessionForm {
  playerCount: number;        // 5-20, default 5
  roleRevealTimer: number;    // 10-30, default 15
  discussionTimer: number;    // 30-300, default 120
  votingTimer: number;        // 15-120, default 60
  nightActionTimer: number;   // 15-60, default 30
  mafiaCount: number;         // auto-calculated or manual
  sheriffEnabled: boolean;    // default true
  doctorEnabled: boolean;     // default true
}
```

### 5.3 Элементы UI

| Элемент | Компонент | Props | API-маппинг |
|---|---|---|---|
| Количество игроков | `<Stepper min={5} max={20}>` | value, onChange | `player_count` |
| Таймер ознакомления | `<Slider min={10} max={30} step={1}>` | Показывать значение в секундах | `settings.role_reveal_timer_seconds` |
| Таймер обсуждения | `<Slider min={30} max={300} step={10}>` | Показывать мин:сек | `settings.discussion_timer_seconds` |
| Таймер голосования | `<Slider min={15} max={120} step={5}>` | Показывать мин:сек | `settings.voting_timer_seconds` |
| Таймер ночи | `<Slider min={15} max={60} step={5}>` | Показывать в секундах | `settings.night_action_timer_seconds` |
| Количество мафии | `<Stepper min={1} max={...}>` | Макс = `playerCount / 2 - 1` | `settings.role_config.mafia` |
| Шериф | `<Toggle>` | checked, onChange | `settings.role_config.sheriff` (1 или 0) |
| Доктор | `<Toggle>` | checked, onChange | `settings.role_config.doctor` (1 или 0) |
| Кнопка «Создать сессию» | `<Button>` | disabled при ошибках валидации | Вызов API |

### 5.4 Клиентская валидация

Выполняется перед отправкой запроса. Ошибки показываются inline рядом с полем.

**Правило 1: Сумма ролей = player_count**
```
civilians = playerCount - mafiaCount - (sheriffEnabled ? 1 : 0) - (doctorEnabled ? 1 : 0)
```
Если `civilians < 0` — показать «Слишком много спецролей для выбранного количества игроков».

**Правило 2: mafia < city**
```
cityCount = playerCount - mafiaCount
mafiaCount < cityCount  →  mafiaCount < playerCount / 2
```
Если нарушено — показать «Мафии должно быть меньше, чем мирных жителей».

**Правило 3: Pro-ограничение**
```
if (playerCount > 5 && !authStore.user.has_pro) → показать «Нужна подписка Pro»
```
Кнопка «Создать» disabled. Показать ссылку на страницу подписки.

**Автоматический расчёт мафии при смене player_count:**
При изменении `playerCount` автоматически пересчитать допустимый `mafiaCount`:
- При `playerCount` 5-6: рекомендуемая мафия = 1
- При `playerCount` 7-10: рекомендуемая мафия = 2
- При `playerCount` 11-15: рекомендуемая мафия = 3
- При `playerCount` 16-20: рекомендуемая мафия = 4

### 5.5 Вызов API при создании

```
POST /api/sessions
Headers: Authorization: Bearer {access_token}
Body:
{
  "player_count": 8,
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
  }
}
```

Успешный ответ (201):
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

**При успехе:**
1. Сохранить сессию в `sessionStore` (id, code, settings, host_user_id)
2. `navigate('/sessions/AX7K2M')` — используя `code` из ответа

**Ошибки:**

| HTTP | `error.code` | Действие |
|---|---|---|
| 400 | `validation_error` | Показать `message` |
| 400 | `invalid_role_config` | Показать «Сумма ролей не равна количеству игроков» |
| 403 | `pro_required` | Показать «Для этого количества игроков нужна подписка Pro» |

### 5.6 Mock-данные

**Файл:** `src/mocks/sessionMocks.ts` (дополнить)

```ts
import { CreateSessionResponse } from '../types/api';

export const mockCreateSessionResponse: CreateSessionResponse = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  code: 'AX7K2M',
  host_user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  player_count: 8,
  status: 'waiting',
  settings: {
    role_reveal_timer_seconds: 15,
    discussion_timer_seconds: 120,
    voting_timer_seconds: 60,
    night_action_timer_seconds: 30,
    role_config: { mafia: 2, sheriff: 1, doctor: 1 },
  },
  created_at: '2026-04-08T12:00:00Z',
};

export const mockProRequiredError = {
  error: { code: 'pro_required', message: 'Для этого количества игроков нужна подписка Pro' },
};

export const mockInvalidRoleConfigError = {
  error: { code: 'invalid_role_config', message: 'Сумма ролей не равна количеству игроков' },
};
```

---

## 6. Лобби (`/sessions/{code}`)

### 6.1 Session Store

**Файл:** `src/stores/sessionStore.ts`

```ts
import { create } from 'zustand';
import { Session, SessionSettings, LobbyPlayer } from '../types/game';

interface SessionState {
  session: Session | null;
  sessionId: string | null;     // UUID для API-вызовов
  code: string | null;          // 6-символьный код для URL
  players: LobbyPlayer[];
  isHost: boolean;

  setSession: (session: Session) => void;
  setSessionId: (id: string) => void;
  setCode: (code: string) => void;
  setPlayers: (players: LobbyPlayer[]) => void;
  addPlayer: (player: LobbyPlayer) => void;
  removePlayer: (playerId: string) => void;
  updateSettings: (settings: SessionSettings) => void;
  setIsHost: (value: boolean) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  sessionId: null,
  code: null,
  players: [],
  isHost: false,

  setSession: (session) => set({
    session,
    sessionId: session.id,
    code: session.code,
  }),
  setSessionId: (sessionId) => set({ sessionId }),
  setCode: (code) => set({ code }),
  setPlayers: (players) => set({ players }),
  addPlayer: (player) => set((s) => ({ players: [...s.players, player] })),
  removePlayer: (playerId) => set((s) => ({
    players: s.players.filter((p) => p.id !== playerId),
  })),
  updateSettings: (settings) => set((s) => ({
    session: s.session ? { ...s.session, settings } : null,
  })),
  setIsHost: (isHost) => set({ isHost }),
  reset: () => set({
    session: null, sessionId: null, code: null, players: [], isHost: false,
  }),
}));
```

### 6.2 Компонент страницы

**Файл:** `src/pages/LobbyPage.tsx`

**Что сделать:** Экран ожидания перед началом игры. Показывает код сессии, список игроков, кнопки управления (для хоста). Подключается к WebSocket при монтировании.

**При монтировании:**

1. Получить `code` из URL-параметра (`useParams`)
2. Вызвать `GET /api/sessions/{code}`:
   ```
   GET /api/sessions/AX7K2M
   ```
   Ответ (200):
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
       "role_config": { "mafia": 2, "sheriff": 1, "doctor": 1 }
     },
     "players": [
       { "id": "player-uuid-001", "name": "Саша", "join_order": 1, "is_host": true },
       { "id": "player-uuid-002", "name": "Петя", "join_order": 2, "is_host": false }
     ],
     "created_at": "2026-04-08T12:00:00Z"
   }
   ```

3. Сохранить в `sessionStore`: `setSession(data)`, `setPlayers(data.players)`
4. Определить, хост ли текущий пользователь: `data.host_user_id === authStore.user.user_id` → `setIsHost(true/false)`
5. Подключить WebSocket: `new GameWebSocket(data.id)` → `.connect()`

### 6.3 WebSocket-подключение и обработка событий

**Файл:** `src/hooks/useWebSocket.ts` (используется в `LobbyPage` и `GamePage`)

```ts
// При монтировании LobbyPage:
const ws = new GameWebSocket(sessionId);
ws.onMessage = (msg) => handleLobbyMessage(msg);
ws.onStatusChange = (status) => setConnectionStatus(status);
ws.connect();

// При размонтировании:
ws.disconnect();
```

**Обработка WS-событий в лобби:**

| WS-событие | Поля payload | Действие |
|---|---|---|
| `player_joined` | `{ player_id, name, join_order }` | `sessionStore.addPlayer({ id: player_id, name, join_order, is_host: false })` |
| `player_left` | `{ player_id }` | `sessionStore.removePlayer(player_id)` |
| `kicked` | `{ reason: "host_kicked" }` | Показать toast «Вы были исключены организатором», через 2 сек `navigate('/')` |
| `settings_updated` | `{ settings: {...} }` | `sessionStore.updateSettings(settings)` |
| `game_started` | `{ phase, timer_seconds, started_at }` | Сохранить в `gameStore`, `navigate('/game/{sessionId}')` |
| `role_assigned` | `{ role: { name, team, abilities } }` | Сохранить роль в `gameStore.setMyRole(role)` |
| `error` | `{ code, message }` | Показать toast с `message` |

**Mock WS-сообщения для лобби:**

```ts
// src/mocks/wsMocks.ts

export const mockWsPlayerJoined = {
  type: 'player_joined',
  payload: { player_id: 'player-uuid-003', name: 'Маша', join_order: 3 },
};

export const mockWsPlayerLeft = {
  type: 'player_left',
  payload: { player_id: 'player-uuid-003' },
};

export const mockWsKicked = {
  type: 'kicked',
  payload: { reason: 'host_kicked' },
};

export const mockWsSettingsUpdated = {
  type: 'settings_updated',
  payload: {
    settings: {
      role_reveal_timer_seconds: 20,
      discussion_timer_seconds: 180,
      voting_timer_seconds: 90,
      night_action_timer_seconds: 45,
      role_config: { mafia: 3, sheriff: 1, doctor: 1 },
    },
  },
};

export const mockWsGameStarted = {
  type: 'game_started',
  payload: {
    phase: { type: 'role_reveal', number: 0 },
    timer_seconds: 15,
    started_at: '2026-04-08T12:05:00Z',
  },
};

export const mockWsRoleAssigned = {
  type: 'role_assigned',
  payload: {
    role: { name: 'Мафия', team: 'mafia', abilities: { night_action: 'kill' } },
  },
};
```

### 6.4 UI-элементы лобби

**Компонент:** `src/components/lobby/SessionCode.tsx`

- Код сессии крупным шрифтом: `AX7K2M`
- Кнопка «Копировать» — `navigator.clipboard.writeText(code)`, показать tooltip «Скопировано!» на 2 сек

**Компонент:** `src/components/lobby/PlayerList.tsx`

- Список игроков с порядковым номером, именем
- У хоста — иконка короны
- Для организатора: кнопка «Кикнуть» у каждого игрока (кроме себя)
- Счётчик: «{players.length} / {player_count} игроков»

**Кик игрока (только хост):**

```
DELETE /api/sessions/{session_id}/players/{player_id}
```

Ответ: 204 No Content (игрок удалится также через WS-событие `player_left`).

**Кнопка «Начать игру» (только хост):**
- Disabled если `players.length < minPlayers`
  - `minPlayers` = `mafiaCount + sheriffCount + doctorCount + 1` (минимум один мирный)
  - Или проще: `players.length >= role_config.mafia + role_config.sheriff + role_config.doctor + 1`
  - Точнее: кнопка disabled если `players.length != session.player_count` (все слоты должны быть заняты)

```
POST /api/sessions/{session_id}/start
```

Ответ (200):
```json
{
  "status": "active",
  "phase": { "type": "role_reveal", "number": 0 }
}
```

Переход произойдёт через WS-событие `game_started` (которое придёт всем игрокам), поэтому после успешного REST-ответа дополнительных действий не нужно — WS-обработчик навигирует.

**Кнопка «Настройки» (только хост):**
- Открывает модал с теми же полями, что на `SessionNewPage` (слайдеры, степперы, тогглы)
- При сохранении:

```
PATCH /api/sessions/{session_id}/settings
Body: {
  "discussion_timer_seconds": 180,
  "role_config": { "mafia": 3, "sheriff": 1, "doctor": 1 }
}
```

Ответ (200):
```json
{
  "settings": {
    "role_reveal_timer_seconds": 15,
    "discussion_timer_seconds": 180,
    "voting_timer_seconds": 60,
    "night_action_timer_seconds": 30,
    "role_config": { "mafia": 3, "sheriff": 1, "doctor": 1 }
  }
}
```

Остальные игроки получат `settings_updated` через WS.

### 6.5 Overlay реконнекта

Во время `connectionStatus === 'reconnecting'` показывать полупрозрачный overlay:

```tsx
{connectionStatus === 'reconnecting' && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 text-center">
      <Spinner />
      <p>Восстановление соединения...</p>
    </div>
  </div>
)}
```

---

## 7. Игровой экран (`/game/{session_id}`)

### 7.1 Game Store

**Файл:** `src/stores/gameStore.ts`

```ts
import { create } from 'zustand';
import {
  Phase, MyPlayer, Player, Target, Announcement,
  RoleRevealInfo, VoteInfo, GameResult, Role,
} from '../types/game';

/**
 * Все возможные визуальные состояния экрана.
 * Определяют, какой sub-компонент рендерится внутри GamePage.
 */
type GameScreen =
  | 'role_reveal'        // Карточка роли + кнопка «Ознакомлен»
  | 'narrator'           // Экран ведущего (блокирует на duration_ms)
  | 'night_action'       // Выбор цели (мафия/доктор/шериф)
  | 'night_waiting'      // «Город спит...»
  | 'day_discussion'     // Обсуждение
  | 'day_voting'         // Голосование
  | 'eliminated'         // Наблюдатель (мёртвый игрок)
  | 'finale';            // Финальный экран

interface GameState {
  // Текущее состояние
  screen: GameScreen;
  phase: Phase | null;
  myPlayer: MyPlayer | null;
  myRole: Role | null;
  players: Player[];

  // Role reveal
  roleReveal: RoleRevealInfo | null;
  roleAcknowledged: boolean;

  // Narrator
  currentAnnouncement: Announcement | null;
  pendingScreen: GameScreen | null;   // Экран после завершения narrator

  // Night action
  awaitingAction: boolean;
  actionType: 'kill' | 'check' | 'heal' | null;
  availableTargets: Target[];
  selectedTarget: string | null;
  actionSubmitted: boolean;
  checkResult: { team: 'mafia' | 'city' } | null;
  mafiaChoiceInfo: { target_name: string } | null;

  // Day
  nightResultDied: { player_id: string; name: string }[] | null;
  votes: VoteInfo | null;
  voteSubmitted: boolean;

  // Finale
  result: GameResult | null;

  // Connection
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

  // Actions
  setScreen: (screen: GameScreen) => void;
  setPhase: (phase: Phase) => void;
  setMyPlayer: (player: MyPlayer) => void;
  setMyRole: (role: Role) => void;
  setPlayers: (players: Player[]) => void;
  setRoleReveal: (info: RoleRevealInfo) => void;
  setRoleAcknowledged: (value: boolean) => void;
  showNarrator: (announcement: Announcement, pendingScreen: GameScreen) => void;
  setAwaitingAction: (value: boolean) => void;
  setActionType: (type: 'kill' | 'check' | 'heal' | null) => void;
  setAvailableTargets: (targets: Target[]) => void;
  setSelectedTarget: (targetId: string | null) => void;
  setActionSubmitted: (value: boolean) => void;
  setCheckResult: (result: { team: 'mafia' | 'city' } | null) => void;
  setMafiaChoiceInfo: (info: { target_name: string } | null) => void;
  setNightResultDied: (died: { player_id: string; name: string }[] | null) => void;
  setVotes: (votes: VoteInfo | null) => void;
  setVoteSubmitted: (value: boolean) => void;
  setResult: (result: GameResult) => void;
  setConnectionStatus: (status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void;
  updatePlayerStatus: (playerId: string, status: 'alive' | 'dead') => void;
  reset: () => void;
}
```

### 7.2 Основной компонент

**Файл:** `src/pages/GamePage.tsx`

**Что сделать:** Единый роутинг внутри одной страницы. Содержимое определяется полем `gameStore.screen`.

**При монтировании:**
1. Получить `sessionId` из URL-параметра
2. Вызвать `GET /api/sessions/{sessionId}/state` для начальной синхронизации
3. Подключить WebSocket
4. Определить начальный `screen` на основе ответа `state`

```
GET /api/sessions/550e8400-e29b-41d4-a716-446655440000/state
```

**Маппинг state → screen (при инициализации и реконнекте):**

```ts
function determineScreen(state: GameStateResponse): GameScreen {
  // Финал
  if (state.session_status === 'finished') return 'finale';

  // Мёртвый игрок
  if (state.my_player.status === 'dead') return 'eliminated';

  // Role reveal
  if (state.phase.type === 'role_reveal') return 'role_reveal';

  // Ночь
  if (state.phase.type === 'night') {
    if (state.awaiting_action && !state.my_action_submitted) return 'night_action';
    return 'night_waiting';
  }

  // День
  if (state.phase.type === 'day') {
    if (state.phase.sub_phase === 'voting') return 'day_voting';
    return 'day_discussion';
  }

  return 'night_waiting'; // fallback
}
```

**Рендеринг по screen:**

```tsx
function GamePage() {
  const screen = useGameStore((s) => s.screen);

  const screenComponents: Record<GameScreen, React.ReactNode> = {
    role_reveal: <RoleRevealScreen />,
    narrator: <NarratorScreen />,
    night_action: <NightActionScreen />,
    night_waiting: <NightWaitingScreen />,
    day_discussion: <DayDiscussionScreen />,
    day_voting: <DayVotingScreen />,
    eliminated: <EliminatedScreen />,
    finale: <FinaleScreen />,
  };

  return (
    <div className="min-h-screen">
      {screenComponents[screen]}
      {/* Overlay реконнекта поверх всего */}
      <ReconnectOverlay />
    </div>
  );
}
```

### 7.3 Обработка WS-событий в GamePage (стейт-машина)

**Файл:** Функция `handleGameMessage(msg: WsServerMessage)` — вызывается из `ws.onMessage`.

```ts
function handleGameMessage(msg: WsServerMessage) {
  const store = useGameStore.getState();

  switch (msg.type) {
    // --- Role Reveal ---
    case 'role_acknowledged':
      store.setRoleReveal({
        my_acknowledged: store.roleReveal?.my_acknowledged ?? false,
        players_acknowledged: msg.payload.players_acknowledged,
        players_total: msg.payload.players_total,
      });
      break;

    case 'all_acknowledged':
      // Ждём phase_changed (night, 1), который придёт следом
      break;

    // --- Смена фазы ---
    case 'phase_changed': {
      const { phase, sub_phase, timer_seconds, timer_started_at, announcement } = msg.payload;

      // Обновить фазу в store
      store.setPhase({
        id: '',  // заполнится из GET /state при реконнекте
        type: phase.type,
        number: phase.number,
        sub_phase: sub_phase,
        started_at: timer_started_at ?? new Date().toISOString(),
        timer_seconds: timer_seconds,
        timer_started_at: timer_started_at,
      });

      // Сбросить состояния предыдущей фазы
      store.setActionSubmitted(false);
      store.setSelectedTarget(null);
      store.setCheckResult(null);
      store.setMafiaChoiceInfo(null);
      store.setVoteSubmitted(false);
      store.setAvailableTargets([]);

      // Определить экран после narrator
      let nextScreen: GameScreen;
      if (store.myPlayer?.status === 'dead') {
        nextScreen = 'eliminated';
      } else if (phase.type === 'night') {
        nextScreen = 'night_waiting'; // action_required придёт отдельно, если нужно
      } else if (phase.type === 'day') {
        nextScreen = sub_phase === 'voting' ? 'day_voting' : 'day_discussion';
      } else {
        nextScreen = 'night_waiting';
      }

      // Показать narrator на duration_ms, затем переключить на nextScreen
      store.showNarrator(announcement, nextScreen);
      break;
    }

    // --- Ночные действия ---
    case 'action_required':
      store.setAwaitingAction(true);
      store.setActionType(msg.payload.action_type);
      store.setAvailableTargets(msg.payload.available_targets);
      store.setActionSubmitted(false);
      store.setSelectedTarget(null);
      // Обновить таймер фазы
      store.setPhase({
        ...store.phase!,
        timer_seconds: msg.payload.timer_seconds,
        timer_started_at: msg.payload.timer_started_at,
      });
      store.setScreen('night_action');
      break;

    case 'action_confirmed':
      store.setActionSubmitted(true);
      store.setAwaitingAction(false);
      // Экран переключается на «Выбор принят, ожидание...»
      // (внутри NightActionScreen — условный рендер по actionSubmitted)
      break;

    case 'mafia_choice_made':
      store.setMafiaChoiceInfo({ target_name: msg.payload.target_name });
      // Показать «Жертва выбрана: {target_name}. Ожидание...»
      break;

    case 'action_timeout':
      store.setAwaitingAction(false);
      store.setActionSubmitted(false);
      // Экран переключается на «Время вышло. Действие пропущено.»
      store.setScreen('night_waiting');
      break;

    case 'check_result':
      store.setCheckResult({ team: msg.payload.team });
      break;

    // --- Итоги ночи ---
    case 'night_result': {
      store.setNightResultDied(msg.payload.died);
      // Показать narrator, затем day_discussion
      const nextAfterNight = store.myPlayer?.status === 'dead' ? 'eliminated' : 'day_discussion';
      store.showNarrator(msg.payload.announcement, nextAfterNight);
      break;
    }

    // --- Голосование ---
    case 'vote_update':
      store.setVotes({
        total_expected: msg.payload.votes_total,
        cast: msg.payload.votes_cast,
      });
      break;

    case 'vote_result': {
      const nextAfterVote = store.myPlayer?.status === 'dead' ? 'eliminated' : 'night_waiting';
      store.showNarrator(msg.payload.announcement, nextAfterVote);
      break;
    }

    // --- Выбытие ---
    case 'player_eliminated':
      store.updatePlayerStatus(msg.payload.player_id, 'dead');
      if (msg.payload.player_id === store.myPlayer?.id) {
        store.setMyPlayer({ ...store.myPlayer!, status: 'dead' });
        // Экран переключится на 'eliminated' после текущего narrator
      }
      break;

    // --- Финал ---
    case 'game_finished':
      store.setResult({
        winner: msg.payload.winner,
        announcement: msg.payload.announcement,
        players: msg.payload.players.map((p) => ({
          ...p,
          status: p.status as 'alive' | 'dead',
          role: { name: p.role.name, team: p.role.team as 'mafia' | 'city' },
          join_order: 0,
        })),
      });
      // Показать narrator с финальной озвучкой, затем finale
      store.showNarrator(msg.payload.announcement, 'finale');
      break;

    // --- Служебные ---
    case 'session_closed':
      // Показать toast «Сессия закрыта организатором»
      // navigate('/')
      break;

    case 'error':
      // Показать toast с msg.payload.message
      break;
  }
}
```

### 7.4 Экран: Ознакомление с ролью (`role_reveal`)

**Файл:** `src/components/game/RoleRevealScreen.tsx`

**Элементы UI:**
- Карточка роли: название роли (`myRole.name`), команда (`myRole.team`), описание способностей
- Таймер обратного отсчёта (хук `useTimer`)
- Кнопка «Ознакомлен» → после нажатия заменяется на «Ожидание остальных...»
- Счётчик «{players_acknowledged} / {players_total} ознакомились»

**Текстовые описания ролей (захардкодить на клиенте):**

```ts
// src/utils/constants.ts
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  'Мафия': 'Каждую ночь мафия выбирает жертву для устранения. Цель — устранить всех мирных жителей.',
  'Шериф': 'Каждую ночь шериф может проверить одного игрока и узнать, принадлежит ли он к мафии.',
  'Доктор': 'Каждую ночь доктор может защитить одного игрока от устранения мафией.',
  'Мирный': 'Днём обсуждайте и голосуйте за исключение подозрительных. Найдите и устраните всю мафию.',
};
```

**Вызов API при нажатии «Ознакомлен»:**

```
POST /api/sessions/{sessionId}/acknowledge-role
```

Ответ (200):
```json
{
  "acknowledged": true,
  "players_acknowledged": 5,
  "players_total": 8
}
```

Обновить `gameStore.setRoleAcknowledged(true)` и `setRoleReveal(...)`.

WS `role_acknowledged` от других игроков обновит счётчик.
WS `all_acknowledged` → ждать `phase_changed` → `narrator` → `night_waiting`/`night_action`.

### 7.5 Хук таймера

**Файл:** `src/hooks/useTimer.ts`

```ts
import { useState, useEffect, useRef } from 'react';

/**
 * Вычисляет оставшееся время на основе серверных данных.
 * remaining = timer_seconds - (Date.now() - Date.parse(timer_started_at)) / 1000
 *
 * @param timerSeconds - Длительность таймера в секундах
 * @param timerStartedAt - ISO 8601 время старта таймера (серверное)
 * @returns remainingSeconds (>= 0), isExpired
 */
export function useTimer(
  timerSeconds: number | null,
  timerStartedAt: string | null
): { remaining: number; isExpired: boolean } {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerSeconds == null || timerStartedAt == null) {
      setRemaining(0);
      return;
    }

    function calc() {
      const elapsed = (Date.now() - new Date(timerStartedAt!).getTime()) / 1000;
      const left = Math.max(0, timerSeconds! - elapsed);
      setRemaining(Math.ceil(left));
    }

    calc();
    intervalRef.current = setInterval(calc, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerSeconds, timerStartedAt]);

  return { remaining, isExpired: remaining <= 0 };
}
```

### 7.6 Экран: Ведущий (Narrator)

**Файл:** `src/components/game/NarratorScreen.tsx`

**Что сделать:** Показывается между фазами на `announcement.duration_ms` миллисекунд. Блокирует переход к следующему экрану.

**Элементы UI:**
- Изображение/анимация ведущего (статичная картинка-заглушка)
- Текст объявления: `currentAnnouncement.text`
- Аудио: автовоспроизведение `currentAnnouncement.audio_url`
  - Громкость из `localStorage.getItem('settings_narrator_volume')` (0-100 → 0.0-1.0)
  - Если звук выключен (`settings_sfx_enabled === 'false'`) — не воспроизводить

**Логика блокировки:**

```ts
useEffect(() => {
  if (!currentAnnouncement) return;

  const timer = setTimeout(() => {
    // Перейти к pendingScreen
    gameStore.setScreen(gameStore.pendingScreen ?? 'night_waiting');
    gameStore.setCurrentAnnouncement(null);
    gameStore.setPendingScreen(null);
  }, currentAnnouncement.duration_ms);

  return () => clearTimeout(timer);
}, [currentAnnouncement]);
```

**Воспроизведение аудио:**

```ts
useEffect(() => {
  if (!currentAnnouncement?.audio_url) return;

  const sfxEnabled = localStorage.getItem('settings_sfx_enabled') !== 'false';
  if (!sfxEnabled) return;

  const volume = parseInt(localStorage.getItem('settings_narrator_volume') ?? '80', 10) / 100;
  const audio = new Audio(currentAnnouncement.audio_url);
  audio.volume = volume;
  audio.play().catch(() => {}); // Браузер может заблокировать autoplay

  return () => {
    audio.pause();
    audio.currentTime = 0;
  };
}, [currentAnnouncement]);
```

### 7.7 Экран: Ночь — ход спецроли (`night_action`)

**Файл:** `src/components/game/NightActionScreen.tsx`

**Показывается:** Только игроку с активной ночной ролью, когда пришло WS-событие `action_required`.

**Элементы UI:**

1. **Таймер** — `useTimer(phase.timer_seconds, phase.timer_started_at)`
2. **Заголовок** (зависит от `actionType`):
   - `kill` → «Выберите жертву»
   - `heal` → «Кого вы хотите спасти?»
   - `check` → «Кого вы хотите проверить?»
3. **Список целей** — кнопки с именами из `availableTargets`. При нажатии: `setSelectedTarget(player_id)`, кнопка подсвечивается
4. **Кнопка «Подтвердить»** — disabled пока `selectedTarget === null`
5. **Состояние после подтверждения** (`actionSubmitted === true`): «Ваш выбор принят. Ожидание...»
6. **Результат проверки шерифа** (`checkResult !== null`): «Игрок {name} — {team === 'mafia' ? 'Мафия' : 'Мирный'}»
7. **Информация для мафии** (`mafiaChoiceInfo !== null`): «Жертва выбрана: {target_name}. Ожидание...»

**Вызов API при подтверждении:**

```
POST /api/sessions/{sessionId}/night-action
Body: { "target_player_id": "player-uuid-004" }
```

Успешный ответ (200):
```json
{
  "action_type": "kill",
  "target_player_id": "player-uuid-004",
  "confirmed": true
}
```

Для шерифа — дополнительно:
```json
{
  "action_type": "check",
  "target_player_id": "player-uuid-001",
  "confirmed": true,
  "check_result": { "team": "mafia" }
}
```

После получения ответа: `setActionSubmitted(true)`. Также придёт WS `action_confirmed`. Для шерифа — `check_result` тоже придёт через WS.

**Ошибки:**

| `error.code` | Действие |
|---|---|
| `wrong_phase` | Toast «Действие недоступно в текущей фазе» |
| `invalid_target` | Toast «Этот игрок уже выбыл» |
| `action_already_submitted` | Toast «Вы уже сделали выбор» |
| `player_dead` | Toast «Выбывшие игроки не могут совершать действия» |

### 7.8 Экран: Ночь — ожидание (`night_waiting`)

**Файл:** `src/components/game/NightWaitingScreen.tsx`

**Элементы UI:**
- Атмосферный фон (тёмный градиент, луна, звёзды — через CSS)
- Текст «Город спит...» по центру
- Никаких интерактивных элементов

Показывается мирным жителям всю ночь, а спецролям — до и после их хода.

### 7.9 Экран: День — обсуждение (`day_discussion`)

**Файл:** `src/components/game/DayDiscussionScreen.tsx`

**Элементы UI:**
1. **Таймер обсуждения** — `useTimer(phase.timer_seconds, phase.timer_started_at)`
2. **Результат ночи** (сверху, если `nightResultDied !== null`):
   - Если `died` не null и не пуст: «Этой ночью был убит: {имена погибших}»
   - Если `died === null`: «Этой ночью никто не погиб»
3. **Список игроков** — все игроки, живые и мёртвые (мёртвые зачёркнуты или затемнены)

**Данные из store:** `gameStore.players`, `gameStore.nightResultDied`, `gameStore.phase`.

Обсуждение — пассивная фаза, интерактивных элементов нет. Когда таймер истекает, сервер пришлёт `phase_changed` с `sub_phase: "voting"`.

### 7.10 Экран: День — голосование (`day_voting`)

**Файл:** `src/components/game/DayVotingScreen.tsx`

**Элементы UI:**
1. **Таймер голосования** — `useTimer(phase.timer_seconds, phase.timer_started_at)`
2. **Список живых игроков** (кнопки) — из `availableTargets`. Исключает текущего игрока (нельзя голосовать за себя)
3. **Кнопка «Пропустить голос»** — голос «воздержался»
4. **Кнопка «Подтвердить»** — disabled пока цель не выбрана
5. **Счётчик голосов** — «{votes.cast} / {votes.total_expected} проголосовали»
6. **После голосования** (`voteSubmitted === true`): «Ваш голос принят. Ожидание...»

**Вызов API при подтверждении:**

```
POST /api/sessions/{sessionId}/vote
Body: { "target_player_id": "player-uuid-001" }
```

Для пропуска:
```
POST /api/sessions/{sessionId}/vote
Body: { "target_player_id": null }
```

Ответ (200):
```json
{
  "voter_player_id": "player-uuid-002",
  "target_player_id": "player-uuid-001",
  "confirmed": true
}
```

WS `vote_update` обновляет счётчик в реальном времени.
WS `vote_result` → показать narrator с результатом → переход к ночи или финалу.

**Ошибки:**

| `error.code` | Действие |
|---|---|
| `wrong_phase` | Toast «Голосование сейчас недоступно» |
| `action_already_submitted` | Toast «Вы уже проголосовали» |
| `player_dead` | Toast «Выбывшие игроки не голосуют» |
| `invalid_target` | Toast «Этот игрок уже выбыл» |

### 7.11 Экран: Выбывший игрок (`eliminated`)

**Файл:** `src/components/game/EliminatedScreen.tsx`

**Элементы UI:**
- Сообщение «Вы выбыли из игры»
- Текущая фаза и таймер (наблюдение)
- Список игроков (живые/мёртвые)
- Объявления ведущего продолжают показываться
- Никаких кнопок действий (голосование, ночные действия недоступны)

Мёртвый игрок продолжает получать WS-события и видит происходящее, но без возможности влиять.

### 7.12 Экран: Финал (`finale`)

**Файл:** `src/components/game/FinaleScreen.tsx`

**Элементы UI:**
1. **Победитель**: «Город победил!» или «Мафия победила!» — из `result.winner`
2. **Таблица всех игроков с ролями**:

   | Имя | Роль | Команда | Статус |
   |-----|------|---------|--------|
   | Саша | Мафия | mafia | Убит |
   | Петя | Мирный | city | Жив |
   | ... | ... | ... | ... |

   Данные: `result.players[]` — каждый объект содержит `name`, `role.name`, `role.team`, `status`

3. **Кнопка «Сыграть ещё»** — только для хоста (`sessionStore.isHost`)
4. **Кнопка «Выйти»** — для всех, `navigate('/')`

**Кнопка «Сыграть ещё» (хост):** см. раздел 9 (Рематч).

### 7.13 Mock WS-события для Game

**Файл:** `src/mocks/wsMocks.ts` (дополнить)

```ts
// phase_changed — начало ночи
export const mockWsPhaseChangedNight = {
  type: 'phase_changed',
  payload: {
    phase: { type: 'night', number: 2 },
    sub_phase: null,
    timer_seconds: null,
    timer_started_at: null,
    announcement: {
      audio_url: '/audio/night_start_02.mp3',
      text: 'Город засыпает. Наступает ночь.',
      duration_ms: 5000,
    },
  },
};

// phase_changed — обсуждение
export const mockWsPhaseChangedDiscussion = {
  type: 'phase_changed',
  payload: {
    phase: { type: 'day', number: 1 },
    sub_phase: 'discussion',
    timer_seconds: 120,
    timer_started_at: '2026-04-08T12:08:00Z',
    announcement: {
      audio_url: '/audio/day_start_01.mp3',
      text: 'Город просыпается. Время для обсуждения.',
      duration_ms: 4000,
    },
  },
};

// phase_changed — голосование
export const mockWsPhaseChangedVoting = {
  type: 'phase_changed',
  payload: {
    phase: { type: 'day', number: 1 },
    sub_phase: 'voting',
    timer_seconds: 60,
    timer_started_at: '2026-04-08T12:10:00Z',
    announcement: {
      audio_url: '/audio/voting_start_01.mp3',
      text: 'Время голосования. Выберите, кого вы хотите исключить.',
      duration_ms: 3000,
    },
  },
};

// action_required — ход доктора
export const mockWsActionRequiredDoctor = {
  type: 'action_required',
  payload: {
    action_type: 'heal',
    available_targets: [
      { player_id: 'player-uuid-001', name: 'Саша' },
      { player_id: 'player-uuid-002', name: 'Петя' },
      { player_id: 'player-uuid-004', name: 'Вася' },
    ],
    timer_seconds: 30,
    timer_started_at: '2026-04-08T12:15:10Z',
  },
};

// action_required — ход мафии
export const mockWsActionRequiredMafia = {
  type: 'action_required',
  payload: {
    action_type: 'kill',
    available_targets: [
      { player_id: 'player-uuid-002', name: 'Петя' },
      { player_id: 'player-uuid-003', name: 'Маша' },
      { player_id: 'player-uuid-004', name: 'Вася' },
      { player_id: 'player-uuid-005', name: 'Оля' },
      { player_id: 'player-uuid-006', name: 'Дима' },
      { player_id: 'player-uuid-007', name: 'Катя' },
      { player_id: 'player-uuid-008', name: 'Игорь' },
    ],
    timer_seconds: 30,
    timer_started_at: '2026-04-08T12:05:10Z',
  },
};

// action_required — ход шерифа
export const mockWsActionRequiredSheriff = {
  type: 'action_required',
  payload: {
    action_type: 'check',
    available_targets: [
      { player_id: 'player-uuid-001', name: 'Саша' },
      { player_id: 'player-uuid-003', name: 'Маша' },
      { player_id: 'player-uuid-004', name: 'Вася' },
      { player_id: 'player-uuid-005', name: 'Оля' },
    ],
    timer_seconds: 30,
    timer_started_at: '2026-04-08T12:15:40Z',
  },
};

// action_confirmed
export const mockWsActionConfirmed = {
  type: 'action_confirmed',
  payload: { action_type: 'kill' },
};

// action_timeout
export const mockWsActionTimeout = {
  type: 'action_timeout',
  payload: { action_type: 'kill' },
};

// check_result — шериф проверил мафию
export const mockWsCheckResultMafia = {
  type: 'check_result',
  payload: { target_player_id: 'player-uuid-001', team: 'mafia' },
};

// check_result — шериф проверил мирного
export const mockWsCheckResultCity = {
  type: 'check_result',
  payload: { target_player_id: 'player-uuid-004', team: 'city' },
};

// mafia_choice_made
export const mockWsMafiaChoiceMade = {
  type: 'mafia_choice_made',
  payload: {
    target_player_id: 'player-uuid-004',
    target_name: 'Вася',
    chosen_by: 'player-uuid-005',
  },
};

// night_result — кто-то погиб
export const mockWsNightResultDeath = {
  type: 'night_result',
  payload: {
    died: [{ player_id: 'player-uuid-004', name: 'Вася' }],
    announcement: {
      audio_url: '/audio/night_death_01.mp3',
      text: 'Этой ночью был убит Вася.',
      duration_ms: 4000,
    },
  },
};

// night_result — никто не погиб
export const mockWsNightResultSafe = {
  type: 'night_result',
  payload: {
    died: null,
    announcement: {
      audio_url: '/audio/night_safe_01.mp3',
      text: 'Этой ночью никто не погиб.',
      duration_ms: 3500,
    },
  },
};

// vote_update
export const mockWsVoteUpdate = {
  type: 'vote_update',
  payload: { votes_cast: 5, votes_total: 7 },
};

// vote_result — кого-то исключили
export const mockWsVoteResultEliminated = {
  type: 'vote_result',
  payload: {
    eliminated: { player_id: 'player-uuid-001', name: 'Саша' },
    votes: [
      { voter_player_id: 'player-uuid-002', target_player_id: 'player-uuid-001' },
      { voter_player_id: 'player-uuid-004', target_player_id: 'player-uuid-001' },
      { voter_player_id: 'player-uuid-005', target_player_id: 'player-uuid-003' },
      { voter_player_id: 'player-uuid-006', target_player_id: 'player-uuid-001' },
      { voter_player_id: 'player-uuid-007', target_player_id: null },
    ],
    announcement: {
      audio_url: '/audio/vote_eliminated_01.mp3',
      text: 'По итогам голосования исключён Саша.',
      duration_ms: 4000,
    },
  },
};

// vote_result — ничья, никто не исключён
export const mockWsVoteResultTie = {
  type: 'vote_result',
  payload: {
    eliminated: null,
    votes: [
      { voter_player_id: 'player-uuid-002', target_player_id: 'player-uuid-004' },
      { voter_player_id: 'player-uuid-004', target_player_id: 'player-uuid-002' },
    ],
    announcement: {
      audio_url: '/audio/vote_tie_01.mp3',
      text: 'Голоса разделились поровну. Никто не исключён.',
      duration_ms: 3500,
    },
  },
};

// player_eliminated
export const mockWsPlayerEliminated = {
  type: 'player_eliminated',
  payload: { player_id: 'player-uuid-001', name: 'Саша', cause: 'vote' },
};

// game_finished — победа города
export const mockWsGameFinishedCityWins = {
  type: 'game_finished',
  payload: {
    winner: 'city',
    players: [
      { id: 'player-uuid-001', name: 'Саша', role: { name: 'Мафия', team: 'mafia' }, status: 'dead' },
      { id: 'player-uuid-002', name: 'Петя', role: { name: 'Мирный', team: 'city' }, status: 'alive' },
      { id: 'player-uuid-003', name: 'Маша', role: { name: 'Доктор', team: 'city' }, status: 'dead' },
      { id: 'player-uuid-004', name: 'Вася', role: { name: 'Мирный', team: 'city' }, status: 'alive' },
      { id: 'player-uuid-005', name: 'Оля', role: { name: 'Мафия', team: 'mafia' }, status: 'dead' },
      { id: 'player-uuid-006', name: 'Дима', role: { name: 'Мирный', team: 'city' }, status: 'alive' },
      { id: 'player-uuid-007', name: 'Катя', role: { name: 'Шериф', team: 'city' }, status: 'alive' },
      { id: 'player-uuid-008', name: 'Игорь', role: { name: 'Мирный', team: 'city' }, status: 'dead' },
    ],
    announcement: {
      audio_url: '/audio/city_wins_01.mp3',
      text: 'Город победил! Все мафиози обезврежены.',
      duration_ms: 5000,
    },
  },
};

// game_finished — победа мафии
export const mockWsGameFinishedMafiaWins = {
  type: 'game_finished',
  payload: {
    winner: 'mafia',
    players: [
      { id: 'player-uuid-001', name: 'Саша', role: { name: 'Мафия', team: 'mafia' }, status: 'alive' },
      { id: 'player-uuid-002', name: 'Петя', role: { name: 'Мирный', team: 'city' }, status: 'dead' },
      { id: 'player-uuid-003', name: 'Маша', role: { name: 'Доктор', team: 'city' }, status: 'dead' },
      { id: 'player-uuid-004', name: 'Вася', role: { name: 'Мирный', team: 'city' }, status: 'dead' },
      { id: 'player-uuid-005', name: 'Оля', role: { name: 'Мафия', team: 'mafia' }, status: 'alive' },
      { id: 'player-uuid-006', name: 'Дима', role: { name: 'Мирный', team: 'city' }, status: 'alive' },
    ],
    announcement: {
      audio_url: '/audio/mafia_wins_01.mp3',
      text: 'Мафия победила! Город пал.',
      duration_ms: 5000,
    },
  },
};

// rematch_proposed
export const mockWsRematchProposed = {
  type: 'rematch_proposed',
  payload: {
    host_name: 'Саша',
    new_session_id: '660e8400-e29b-41d4-a716-446655440001',
    code: 'BK9L3N',
  },
};

// session_closed
export const mockWsSessionClosed = {
  type: 'session_closed',
  payload: {},
};
```

### 7.14 Mock-данные GET /state

**Файл:** `src/mocks/gameMocks.ts`

```ts
import { GameStateResponse } from '../types/api';

export const mockStateNightMafia: GameStateResponse = {
  session_status: 'active',
  phase: {
    id: 'phase-uuid-001',
    type: 'night',
    number: 1,
    sub_phase: null,
    started_at: '2026-04-08T12:05:00Z',
    timer_seconds: 30,
    timer_started_at: '2026-04-08T12:05:00Z',
  },
  my_player: {
    id: 'player-uuid-001',
    name: 'Саша',
    status: 'alive',
    role: { name: 'Мафия', team: 'mafia', abilities: { night_action: 'kill' } },
  },
  players: [
    { id: 'player-uuid-001', name: 'Саша', status: 'alive', join_order: 1 },
    { id: 'player-uuid-002', name: 'Петя', status: 'alive', join_order: 2 },
    { id: 'player-uuid-003', name: 'Маша', status: 'alive', join_order: 3 },
    { id: 'player-uuid-004', name: 'Вася', status: 'alive', join_order: 4 },
    { id: 'player-uuid-005', name: 'Оля', status: 'alive', join_order: 5 },
    { id: 'player-uuid-006', name: 'Дима', status: 'alive', join_order: 6 },
    { id: 'player-uuid-007', name: 'Катя', status: 'alive', join_order: 7 },
    { id: 'player-uuid-008', name: 'Игорь', status: 'alive', join_order: 8 },
  ],
  role_reveal: null,
  awaiting_action: true,
  action_type: 'kill',
  available_targets: [
    { player_id: 'player-uuid-002', name: 'Петя' },
    { player_id: 'player-uuid-003', name: 'Маша' },
    { player_id: 'player-uuid-004', name: 'Вася' },
    { player_id: 'player-uuid-005', name: 'Оля' },
    { player_id: 'player-uuid-006', name: 'Дима' },
    { player_id: 'player-uuid-007', name: 'Катя' },
    { player_id: 'player-uuid-008', name: 'Игорь' },
  ],
  my_action_submitted: false,
  votes: null,
  result: null,
};

export const mockStateDayVoting: GameStateResponse = {
  session_status: 'active',
  phase: {
    id: 'phase-uuid-002',
    type: 'day',
    number: 1,
    sub_phase: 'voting',
    started_at: '2026-04-08T12:08:00Z',
    timer_seconds: 60,
    timer_started_at: '2026-04-08T12:10:00Z',
  },
  my_player: {
    id: 'player-uuid-002',
    name: 'Петя',
    status: 'alive',
    role: { name: 'Мирный', team: 'city', abilities: { night_action: null } },
  },
  players: [
    { id: 'player-uuid-001', name: 'Саша', status: 'alive', join_order: 1 },
    { id: 'player-uuid-002', name: 'Петя', status: 'alive', join_order: 2 },
    { id: 'player-uuid-003', name: 'Маша', status: 'dead', join_order: 3 },
    { id: 'player-uuid-004', name: 'Вася', status: 'alive', join_order: 4 },
    { id: 'player-uuid-005', name: 'Оля', status: 'alive', join_order: 5 },
    { id: 'player-uuid-006', name: 'Дима', status: 'alive', join_order: 6 },
    { id: 'player-uuid-007', name: 'Катя', status: 'alive', join_order: 7 },
    { id: 'player-uuid-008', name: 'Игорь', status: 'alive', join_order: 8 },
  ],
  role_reveal: null,
  awaiting_action: true,
  action_type: 'vote',
  available_targets: [
    { player_id: 'player-uuid-001', name: 'Саша' },
    { player_id: 'player-uuid-004', name: 'Вася' },
    { player_id: 'player-uuid-005', name: 'Оля' },
    { player_id: 'player-uuid-006', name: 'Дима' },
    { player_id: 'player-uuid-007', name: 'Катя' },
    { player_id: 'player-uuid-008', name: 'Игорь' },
  ],
  my_action_submitted: false,
  votes: { total_expected: 7, cast: 3 },
  result: null,
};

export const mockStateFinale: GameStateResponse = {
  session_status: 'finished',
  phase: {
    id: 'phase-uuid-005',
    type: 'night',
    number: 3,
    sub_phase: null,
    started_at: '2026-04-08T12:25:00Z',
    timer_seconds: null,
    timer_started_at: null,
  },
  my_player: {
    id: 'player-uuid-002',
    name: 'Петя',
    status: 'alive',
    role: { name: 'Мирный', team: 'city', abilities: { night_action: null } },
  },
  players: [],
  role_reveal: null,
  awaiting_action: false,
  action_type: null,
  available_targets: null,
  my_action_submitted: false,
  votes: null,
  result: {
    winner: 'city',
    announcement: {
      audio_url: '/audio/city_wins_01.mp3',
      text: 'Город победил! Все мафиози обезврежены.',
      duration_ms: 5000,
    },
    players: [
      { id: 'player-uuid-001', name: 'Саша', role: { name: 'Мафия', team: 'mafia' }, status: 'dead', join_order: 0 },
      { id: 'player-uuid-002', name: 'Петя', role: { name: 'Мирный', team: 'city' }, status: 'alive', join_order: 0 },
      { id: 'player-uuid-003', name: 'Маша', role: { name: 'Доктор', team: 'city' }, status: 'dead', join_order: 0 },
      { id: 'player-uuid-004', name: 'Вася', role: { name: 'Мирный', team: 'city' }, status: 'alive', join_order: 0 },
      { id: 'player-uuid-005', name: 'Оля', role: { name: 'Мафия', team: 'mafia' }, status: 'dead', join_order: 0 },
      { id: 'player-uuid-006', name: 'Дима', role: { name: 'Мирный', team: 'city' }, status: 'alive', join_order: 0 },
      { id: 'player-uuid-007', name: 'Катя', role: { name: 'Шериф', team: 'city' }, status: 'alive', join_order: 0 },
      { id: 'player-uuid-008', name: 'Игорь', role: { name: 'Мирный', team: 'city' }, status: 'dead', join_order: 0 },
    ],
  },
};

export const mockStateRoleReveal: GameStateResponse = {
  session_status: 'active',
  phase: {
    id: 'phase-uuid-000',
    type: 'role_reveal',
    number: 0,
    sub_phase: null,
    started_at: '2026-04-08T12:04:00Z',
    timer_seconds: 15,
    timer_started_at: '2026-04-08T12:04:00Z',
  },
  my_player: {
    id: 'player-uuid-002',
    name: 'Петя',
    status: 'alive',
    role: { name: 'Шериф', team: 'city', abilities: { night_action: 'check' } },
  },
  players: [
    { id: 'player-uuid-001', name: 'Саша', status: 'alive', join_order: 1 },
    { id: 'player-uuid-002', name: 'Петя', status: 'alive', join_order: 2 },
    { id: 'player-uuid-003', name: 'Маша', status: 'alive', join_order: 3 },
    { id: 'player-uuid-004', name: 'Вася', status: 'alive', join_order: 4 },
    { id: 'player-uuid-005', name: 'Оля', status: 'alive', join_order: 5 },
  ],
  role_reveal: {
    my_acknowledged: false,
    players_acknowledged: 0,
    players_total: 5,
  },
  awaiting_action: false,
  action_type: null,
  available_targets: null,
  my_action_submitted: false,
  votes: null,
  result: null,
};
```

---

## 8. Реконнекция

### 8.1 Стратегия

Реализована внутри `GameWebSocket` (раздел 2.4). Дополнительная логика на уровне `GamePage`:

**При успешном реконнекте (WS status → `connected` после `reconnecting`):**

1. Вызвать `GET /api/sessions/{sessionId}/state`
2. Сравнить полученную фазу с текущим `gameStore.screen`
3. Обновить весь `gameStore` данными из ответа (players, phase, my_player, targets, votes)
4. Определить правильный `screen` через `determineScreen(state)` (функция из раздела 7.2)
5. Переключить экран

```ts
// В GamePage, внутри обработчика ws.onStatusChange:
if (status === 'connected' && previousStatus === 'reconnecting') {
  const { data } = await gameApi.getState(sessionId);
  // Обновить все данные в store
  gameStore.setPhase(data.phase);
  gameStore.setMyPlayer(data.my_player);
  gameStore.setPlayers(data.players);
  if (data.available_targets) gameStore.setAvailableTargets(data.available_targets);
  if (data.votes) gameStore.setVotes(data.votes);
  if (data.result) gameStore.setResult(data.result);
  if (data.role_reveal) gameStore.setRoleReveal(data.role_reveal);
  gameStore.setActionSubmitted(data.my_action_submitted);

  // Определить экран
  const screen = determineScreen(data);
  gameStore.setScreen(screen);
}
```

### 8.2 Exponential Backoff (детали)

| Попытка | Задержка |
|---|---|
| 1 | 1 сек |
| 2 | 2 сек |
| 3 | 4 сек |
| 4 | 8 сек |
| 5 | 16 сек |
| 6+ | 30 сек (максимум) |

Формула: `delay = min(1000 * 2^attempt, 30000)`

### 8.3 Обработка кода 4001

При закрытии WS с кодом `4001` (невалидный/истёкший токен):

1. Вызвать `POST /api/auth/refresh` с `refresh_token` из localStorage
2. При успехе: обновить оба токена в `authStore`, переподключить WS с новым access_token
3. При неуспехе: `authStore.logout()`, `navigate('/auth')`

### 8.4 Overlay

**Компонент:** `src/components/ui/ReconnectOverlay.tsx`

```tsx
export function ReconnectOverlay() {
  const connectionStatus = useGameStore((s) => s.connectionStatus);

  if (connectionStatus !== 'reconnecting') return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white rounded-2xl p-8 text-center max-w-sm">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-lg font-medium">Восстановление соединения...</p>
        <p className="text-sm text-gray-400 mt-2">Пожалуйста, подождите</p>
      </div>
    </div>
  );
}
```

---

## 9. Поток рематча

### 9.1 Хост: запрос рематча

На экране финала (`FinaleScreen.tsx`), при нажатии кнопки «Сыграть ещё»:

```
POST /api/sessions/{sessionId}/rematch
Body: { "keep_players": true }
```

Ответ (201):
```json
{
  "new_session_id": "660e8400-e29b-41d4-a716-446655440001",
  "code": "BK9L3N",
  "status": "waiting",
  "players_kept": 6
}
```

**Действия при успехе:**
1. Отключить текущий WebSocket
2. Сбросить `gameStore.reset()`
3. Обновить `sessionStore` с новыми данными
4. `navigate('/sessions/BK9L3N')` — перейти в лобби новой сессии

**Ошибки:**

| `error.code` | Действие |
|---|---|
| `not_host` | Toast «Только организатор может запустить рематч» |
| `game_not_finished` | Toast «Игра ещё не завершена» |

### 9.2 Другие игроки: получение предложения

Через WS приходит событие:

```json
{
  "type": "rematch_proposed",
  "payload": {
    "host_name": "Саша",
    "new_session_id": "660e8400-e29b-41d4-a716-446655440001",
    "code": "BK9L3N"
  }
}
```

**Действие на UI:**
1. На экране финала показать баннер/модал: «{host_name} предлагает сыграть ещё»
2. Кнопка «Присоединиться»
3. При нажатии:
   - Если `keep_players: true` — игрок уже в новой сессии, просто перейти: `navigate('/sessions/BK9L3N')`
   - Если нет — вызвать `POST /api/sessions/BK9L3N/join` (потребуется имя)
4. Отключить текущий WS, сбросить `gameStore`, перейти в новое лобби

### 9.3 Mock-данные рематча

```ts
// src/mocks/sessionMocks.ts (дополнить)

export const mockRematchResponse = {
  new_session_id: '660e8400-e29b-41d4-a716-446655440001',
  code: 'BK9L3N',
  status: 'waiting',
  players_kept: 6,
};
```

---

## 10. Mock-слой данных

### 10.1 Архитектура

**Цель:** Возможность разрабатывать и тестировать frontend без запущенного backend. Переключение через переменную окружения `VITE_USE_MOCKS`.

**Подход:** Условный импорт API-модулей. Если `VITE_USE_MOCKS === 'true'`, API-функции возвращают захардкоженные данные с задержкой (имитация сети).

### 10.2 Файлы mock-данных

Все mock-данные собраны в папке `src/mocks/`:

| Файл | Содержимое |
|---|---|
| `src/mocks/authMocks.ts` | Ответы register, login, me, refresh; ошибки invalid_credentials |
| `src/mocks/sessionMocks.ts` | Ответы create, join, getByCode, getPlayers, start, rematch; ошибки session_not_found, session_full и др. |
| `src/mocks/gameMocks.ts` | Ответы GET /state для разных фаз (role_reveal, night, day_voting, finale) |
| `src/mocks/wsMocks.ts` | Все WS-события (полный набор из раздела 7.13) |

### 10.3 Mock API-обёртка

**Файл:** `src/mocks/mockApi.ts`

```ts
const MOCK_DELAY = 300; // ms

function delay(ms: number = MOCK_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockResponse<T>(data: T, status = 200) {
  return { data, status, statusText: 'OK', headers: {}, config: {} as any };
}

export const mockAuthApi = {
  register: async (data: any) => {
    await delay();
    if (data.password.length < 8) {
      throw {
        response: {
          status: 400,
          data: { error: { code: 'validation_error', message: 'Пароль должен быть не короче 8 символов' } },
        },
      };
    }
    return mockResponse(mockRegisterResponse);
  },
  login: async (data: any) => {
    await delay();
    if (data.email !== 'player@example.com' || data.password !== 'password123') {
      throw {
        response: {
          status: 401,
          data: { error: { code: 'invalid_credentials', message: 'Неверный email или пароль' } },
        },
      };
    }
    return mockResponse(mockLoginResponse);
  },
  me: async () => {
    await delay();
    return mockResponse(mockUserProfile);
  },
  // ... аналогично для refresh, logout
};

// Аналогичные mockSessionsApi, mockGameApi
```

### 10.4 Условное переключение

**Файл:** `src/api/index.ts`

```ts
import { authApi as realAuthApi } from './authApi';
import { sessionsApi as realSessionsApi } from './sessionsApi';
import { gameApi as realGameApi } from './gameApi';

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true';

export const authApi = useMocks
  ? (await import('../mocks/mockApi')).mockAuthApi
  : realAuthApi;

export const sessionsApi = useMocks
  ? (await import('../mocks/mockApi')).mockSessionsApi
  : realSessionsApi;

export const gameApi = useMocks
  ? (await import('../mocks/mockApi')).mockGameApi
  : realGameApi;
```

Или альтернативный вариант без dynamic import — через единый фабричный метод, который проверяет `useMocks` и возвращает нужную реализацию.

### 10.5 Mock WebSocket

**Файл:** `src/mocks/mockWsClient.ts`

Mock-класс `MockGameWebSocket`, совместимый по интерфейсу с `GameWebSocket`, но вместо реального WS-подключения воспроизводит последовательность WS-событий с задержками.

```ts
export class MockGameWebSocket {
  public onMessage: ((msg: WsServerMessage) => void) | null = null;
  public onStatusChange: ((status: string) => void) | null = null;

  private timers: ReturnType<typeof setTimeout>[] = [];

  connect() {
    this.onStatusChange?.('connected');

    // Эмуляция сценария: игра стартует → роль → ночь → день → финал
    this.schedule(1000, mockWsGameStarted);
    this.schedule(1100, mockWsRoleAssigned);
    this.schedule(5000, mockWsPhaseChangedNight);
    this.schedule(7000, mockWsActionRequiredMafia);
    // ... и т.д.
  }

  private schedule(delayMs: number, event: WsServerMessage) {
    const timer = setTimeout(() => {
      this.onMessage?.(event);
    }, delayMs);
    this.timers.push(timer);
  }

  disconnect() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.onStatusChange?.('disconnected');
  }
}
```

При `VITE_USE_MOCKS === 'true'` в `useWebSocket.ts` использовать `MockGameWebSocket` вместо `GameWebSocket`.

---

## Порядок реализации (рекомендуемый)

| Этап | Задача | Зависимости |
|---|---|---|
| 1 | Проект + структура + маршрутизация (раздел 1) | — |
| 2 | Типы (раздел 2.1) | — |
| 3 | Token storage + Auth Store (разделы 3.1, 3.6) | Типы |
| 4 | HTTP-клиент + API-модули (разделы 2.2, 2.3) | Типы, Auth Store |
| 5 | Auth страница + формы (разделы 3.3-3.5) | HTTP-клиент, Auth Store |
| 6 | Главная страница (раздел 4) | Auth, API |
| 7 | Mock-слой (раздел 10) | Типы, API-модули |
| 8 | Создание сессии (раздел 5) | API, Auth |
| 9 | Session Store (раздел 6.1) | Типы |
| 10 | WebSocket-клиент (раздел 2.4) | Auth Store |
| 11 | Лобби (раздел 6) | Session Store, WS-клиент |
| 12 | Game Store (раздел 7.1) | Типы |
| 13 | Хук таймера (раздел 7.5) | — |
| 14 | GamePage + стейт-машина (разделы 7.2-7.3) | Game Store, WS-клиент |
| 15 | Экран role_reveal (раздел 7.4) | GamePage, таймер |
| 16 | Экран narrator (раздел 7.6) | GamePage |
| 17 | Экран night_action + night_waiting (разделы 7.7-7.8) | GamePage, таймер |
| 18 | Экран day_discussion + day_voting (разделы 7.9-7.10) | GamePage, таймер |
| 19 | Экран eliminated + finale (разделы 7.11-7.12) | GamePage |
| 20 | Реконнекция (раздел 8) | WS-клиент, GamePage |
| 21 | Рематч (раздел 9) | Finale, API |