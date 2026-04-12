# AI-GameMaster Frontend — Техническая документация

Документ описывает **фактическое текущее состояние** фронтенд-приложения (SPA игры «Мафия»). В отличие от файлов `Frontend Plan.md` и `FRONTEND_SPEC.md`, которые описывают проектные намерения, этот документ отражает то, что реализовано в коде.

---

## 1. Обзор проекта

AI-GameMaster Frontend — одностраничное React-приложение для ведения онлайн-партии в «Мафию» через единое устройство (passing-the-phone) или распределённую сессию. Приложение поддерживает регистрацию/вход пользователей, создание и присоединение к игровым сессиям, настройку ролей и таймеров, а также полный игровой цикл: раскрытие ролей → ночные действия → дневные обсуждения и голосование → финал.

### Технологии

| Слой | Технология | Версия |
|---|---|---|
| UI-библиотека | React | 19.2.4 |
| Язык | TypeScript | 4.9.5 |
| Сборка | Create React App (react-scripts, Webpack 5) | 5.0.1 |
| Маршрутизация | react-router-dom | 7.14.0 |
| Управление состоянием | Zustand | 5.0.12 |
| HTTP-клиент | Axios | 1.15.0 |
| Стили | SCSS (sass) | 1.99.0 |
| Тестирование | Jest + React Testing Library | 16.3.2 |
| Метрики | web-vitals | 2.1.4 |

> **Примечание.** В `Frontend Plan.md` декларируется стек Vite + Tailwind, однако фактическая реализация использует Create React App и SCSS. WebSocket-интеграция из плана не реализована — вместо неё используется клиентский мок-движок (`mocks/mockGameEngine.ts`).

---

## 2. Архитектура

### Дерево `src/`

```
src/
├── api/                    HTTP-клиент и модули API
│   ├── httpClient.ts       Axios-инстанс + интерсепторы (авто-рефреш токена)
│   └── authApi.ts          Обёртки над /auth/*
│
├── assets/                 Изображения, импортируемые из кода
│   ├── auth-hero.jpg
│   └── images.d.ts
│
├── components/             Переиспользуемые компоненты
│   ├── auth/               LoginForm, RegisterForm
│   ├── game/               Экраны игровых фаз (Narrator, NightAction, …)
│   └── ui/                 Дизайн-система (Button, Input, Modal, …)
│
├── mocks/                  Мок-данные и клиентский игровой движок
│   ├── authMocks.ts
│   ├── gameMocks.ts
│   ├── mockGameEngine.ts
│   └── sessionMocks.ts
│
├── pages/                  Страницы — цели маршрутов
│   ├── AuthPage.tsx
│   ├── HomePage.tsx
│   ├── LobbyPage.tsx
│   ├── StorySelectionPage.tsx
│   ├── GamePage.tsx
│   ├── ProfilePage.tsx
│   └── RoleRevealPage.tsx
│
├── stores/                 Zustand-сторы
│   ├── authStore.ts        Авторизация, токены, профиль
│   ├── sessionStore.ts     Текущая сессия, игроки, настройки
│   └── gameStore.ts        Состояние активной партии
│
├── types/                  TypeScript-типы
│   ├── api.ts              Request/Response для REST
│   ├── game.ts             Доменные типы (Role, Player, Phase, …)
│   └── errors.ts           ErrorCode и ApiErrorResponse
│
├── utils/                  Утилиты
│   ├── constants.ts        API_BASE_URL, USE_MOCKS, ROLE_LABELS
│   ├── parseApiError.ts    Разбор ошибок Axios → ParsedApiError
│   └── tokenStorage.ts     get/set/remove refresh_token
│
├── App.tsx                 Маршрутизация + ProtectedRoute
├── App.scss                Глобальные стили уровня приложения
├── index.tsx               React-точка входа (createRoot → <App/>)
├── index.scss              Глобальные CSS-сбросы и типографика
├── react-app-env.d.ts      Декларации CRA
├── reportWebVitals.ts      Сбор метрик
└── setupTests.ts           Конфигурация Jest
```

### Принципы организации

- **По функциональному слою, а не по фиче.** Все сторы в `stores/`, все типы в `types/`, все API в `api/`.
- **Парные файлы `.tsx` + `.scss`.** Каждый компонент/страница имеет свой SCSS-файл рядом. CSS-модулей и CSS-in-JS нет.
- **Страницы тонкие, экраны толстые.** `GamePage.tsx` — диспетчер: в зависимости от текущего `screen` в `gameStore` рендерит один из экранов из `components/game/`.
- **Публичные эндпоинты внутри `api/*Api.ts`.** `httpClient.ts` инкапсулирует только транспорт — авторизацию и обработку 401.

---

## 3. Точки входа и загрузка приложения

### Последовательность загрузки

1. **`public/index.html`** — статический шаблон с `<div id="root">`, PWA-манифестом и подключёнными шрифтами Google (Montserrat Alternates).
2. **`src/index.tsx`** — создаёт React-root через `createRoot`, рендерит `<App/>` внутри `<React.StrictMode>`.
3. **`src/App.tsx`** — оборачивает приложение в `BrowserRouter`, объявляет все маршруты и `ProtectedRoute`-гард.

### Код `App.tsx`

```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/sessions/:code" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/sessions/:code/stories" element={<ProtectedRoute><StorySelectionPage /></ProtectedRoute>} />
        <Route path="/game/:sessionId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

> **Особенность.** При старте `isAuthenticated` равен `false`. `authStore.initialize()` возвращает лишь *наличие* refresh-токена в localStorage, но не выполняет авто-логин — флаг `isAuthenticated` устанавливается в `true` только после явного вызова `setTokens(...)` (после успешного `/auth/login` или `/auth/register`). На практике это означает, что после перезагрузки страницы пользователь попадает на `/auth`, даже если у него есть валидный refresh-токен.

---

## 4. Конфигурация

### `tsconfig.json`

| Опция | Значение | Зачем |
|---|---|---|
| `target` | `es5` | Совместимость с устаревшими браузерами (требование CRA) |
| `lib` | `dom, dom.iterable, esnext` | Типы DOM + современный JS |
| `jsx` | `react-jsx` | Новый JSX-transform React 17+ (без явного `import React`) |
| `strict` | `true` | Полный строгий режим TypeScript |
| `module` | `esnext` | ES-модули, бандлит Webpack |
| `moduleResolution` | `node` | Разрешение модулей как в Node.js |
| `noEmit` | `true` | Типизация без эмита — сборку делает CRA |
| `resolveJsonModule` | `true` | Импорт `.json`-файлов |
| `isolatedModules` | `true` | Каждый файл транспилируется независимо |

Область компиляции: `include: ["src"]`.

### Переменные окружения

Используется префикс CRA `REACT_APP_*`, читаются из `process.env` в `src/utils/constants.ts`:

| Переменная | Значение по умолчанию | Назначение |
|---|---|---|
| `REACT_APP_API_BASE_URL` | `http://localhost:8000` | Корень REST-API (к нему добавляется `/api`) |
| `REACT_APP_WS_BASE_URL` | `ws://localhost:8000` | Корень WebSocket (объявлен, не используется) |
| `REACT_APP_USE_MOCKS` | `false` | Строка `"true"` включает клиентский мок-движок |

Файлы `.env.development` / `.env.production` в репозитории отсутствуют — переменные следует задавать при сборке.

### npm-скрипты (`package.json`)

| Скрипт | Команда | Назначение |
|---|---|---|
| `npm start` | `react-scripts start` | Dev-сервер на `http://localhost:3000` с HMR |
| `npm run build` | `react-scripts build` | Продакшен-сборка в `build/` |
| `npm test` | `react-scripts test` | Jest в watch-режиме |
| `npm run eject` | `react-scripts eject` | Необратимый exit из CRA |

ESLint-конфиг встроен в `package.json` и расширяет `react-app` + `react-app/jest`.

---

## 5. Маршрутизация и страницы

### Таблица маршрутов

| Путь | Компонент | Защищён | Назначение |
|---|---|---|---|
| `/auth` | `AuthPage` | — | Вход и регистрация (переключаются внутри страницы) |
| `/` | `HomePage` | ✓ | Главный экран: создание сессии или присоединение по коду |
| `/profile` | `ProfilePage` | ✓ | Профиль: email, смена пароля, подписка, выход |
| `/sessions/:code` | `LobbyPage` | ✓ | Лобби: список игроков, настройки игры, старт (для хоста) |
| `/sessions/:code/stories` | `StorySelectionPage` | ✓ | Голосование за сюжет перед стартом партии |
| `/game/:sessionId` | `GamePage` | ✓ | Активная партия — диспетчер игровых экранов |
| `*` | `<Navigate to="/">` | — | Перехват несуществующих маршрутов |

### `ProtectedRoute`

Простой HOC: читает `isAuthenticated` из `authStore` и либо редиректит на `/auth`, либо отдаёт children. Никакой проверки токена, ролей или доступа к конкретной сессии — это чисто булев гард.

### Страницы

| Страница | Ключевое поведение |
|---|---|
| `AuthPage` | Переключает `LoginForm` ↔ `RegisterForm`. На фоне — `MatrixBackground` (анимация падающих символов). |
| `HomePage` | Кнопки «Создать сессию» и «Присоединиться». Модалка присоединения: ввод кода → ввод имени. В хедере логотип и иконка профиля. |
| `ProfilePage` | Email, кнопка смены пароля, блок подписки (Free/PRO), кнопка выхода. |
| `LobbyPage` | Карточка с кодом сессии, список игроков с бейджем порядка вступления, модалка настроек (таймеры, `RoleConfig`, тумблер сюжета). Кнопка «Начать игру» видна только хосту. |
| `StorySelectionPage` | Три фазы: голосование с таймером → ожидание → реveal результата → кнопка «Продолжить». |
| `GamePage` | Оркестратор: читает `screen` из `gameStore` и рендерит соответствующий экран из `components/game/`. |
| `RoleRevealPage` | Отдельный экран раскрытия роли — **не используется в маршрутах**, логика перенесена внутрь `GamePage`. |

---

## 6. Компоненты

### 6.1. UI-примитивы (`components/ui/`)

Дизайн-система уровня приложения. Все компоненты имеют парный `.scss` и следуют BEM-подобной конвенции (`.mafia-btn__glow`, `.mafia-btn__content`).

| Компонент | Основные props | Назначение |
|---|---|---|
| `Button` | `children`, `onClick`, `disabled`, `loading`, `type` | Основная CTA-кнопка с эффектом свечения, стрелкой и спиннером в состоянии загрузки |
| `LinkButton` (экспорт из `Button.tsx`) | `text`, `linkText`, `onClick` | Текст со встроенной ссылкой (используется в формах авторизации) |
| `Input` | `type`, `label`, `value`, `onChange`, `error`, `disabled`, `autoComplete` | Текстовое поле с плавающим лейблом, тогглом видимости пароля, отображением ошибки |
| `Modal` | `isOpen`, `onClose`, `title`, `children` | Модальное окно; блокирует скролл body, закрывается по крестику/оверлею |
| `Checkbox` | `checked`, `onChange`, `disabled` | Стилизованный чекбокс |
| `Slider` | `value`, `min`, `max`, `step`, `onChange`, `label`, `unit` | Range-слайдер с подписью (для таймеров) |
| `Toggle` | `checked`, `onChange`, `label`, `disabled` | Свитч on/off |
| `Stepper` | `value`, `min`, `max`, `onChange`, `label` | Плюс/минус для целочисленного значения (конфиг ролей) |
| `Loader` | `size` | Анимированный waveform-лоадер |
| `MatrixBackground` | — | Фоновая анимация «цифрового дождя» для `AuthPage` |

### 6.2. Компоненты авторизации (`components/auth/`)

| Компонент | Props | Назначение |
|---|---|---|
| `LoginForm` | `onToggle` | Форма входа: email + password. Валидация email по regex, пароль ≥ 8 символов. В fallback-режиме (ошибка бэкенда) выполняет мок-логин для отладки. |
| `RegisterForm` | `onToggle` | Форма регистрации: email + password + confirm-password. Та же валидация, тот же fallback. |

### 6.3. Игровые экраны (`components/game/`)

Рендерятся внутри `GamePage` в зависимости от поля `screen` в `gameStore`.

| Экран | Screen-значение | Назначение |
|---|---|---|
| `NarratorScreen` | `narrator` | Посимвольный вывод текста ведущего, индикатор прогресса, регулировка громкости, авто-продвижение |
| `NightActionScreen` | `night_action` | Выбор цели для действий `kill`, `check`, `heal`, `lover_visit`, `maniac_kill`. Отображение результата проверки для шерифа/дона |
| `NightWaitingScreen` | `night_waiting` | Анимированное ночное небо со звёздами, сообщение «город спит» |
| `DayDiscussionScreen` | `day_discussion` | Результаты ночи (кто убит), список живых/мёртвых, уведомление для зрителей, кнопка перехода к голосованию |
| `DayVotingScreen` | `day_voting` | Выбор цели дневного голосования, счётчик поданных голосов, блокировка для заблокированных игроков |
| `FinaleScreen` | `finale` | Итог партии: победитель, раскрытие ролей всех игроков (с оверлеем для мёртвых), кнопка «На главную» |
| `RulesModal` | — (модалка) | Модалка с тремя вкладками: общие правила, роли, условия победы. Доступна с любого игрового экрана через `RulesButton` |

---

## 7. Управление состоянием (Zustand)

Глобальное состояние разделено на три независимых стора. Компоненты подписываются через селекторы (`useAuthStore((s) => s.isAuthenticated)`), чтобы избежать лишних ре-рендеров.

### 7.1. `authStore` (`stores/authStore.ts`)

```ts
interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserProfile) => void;
  logout: () => void;
  initialize: () => boolean;
}
```

**Стратегия хранения токенов:**

- `accessToken` хранится **только в памяти** (в Zustand-состоянии). При перезагрузке страницы теряется.
- `refreshToken` пишется в `localStorage` под ключом `refresh_token`.
- `setTokens(access, refresh)` одновременно сохраняет refresh в localStorage и access в стор, выставляя `isAuthenticated: true`.
- `logout()` удаляет `refresh_token` из localStorage и сбрасывает стор.
- `initialize()` возвращает `true`, если в localStorage есть refresh-токен. **Сам флаг `isAuthenticated` при этом не выставляется** — это просто хелпер для UI-индикации.

### 7.2. `sessionStore` (`stores/sessionStore.ts`)

Состояние текущей сессии/лобби:

| Поле | Тип | Описание |
|---|---|---|
| `session` | `Session \| null` | Метаданные сессии |
| `players` | `LobbyPlayer[]` | Список игроков в лобби |
| `settings` | `SessionSettings` | Таймеры и конфиг ролей |
| `isHost` | `boolean` | Флаг хоста |
| `myPlayerId` | `string \| null` | Идентификатор текущего игрока |
| `myRole` | `Role \| null` | Назначенная роль (до старта) |
| `withStory` | `boolean` | Включён ли выбор сюжета |
| `selectedStoryId` | `string \| null` | Выбранный сюжет |
| `timerPaused` | `boolean` | Пауза таймера |

Ключевые действия:

- `createSession()` — генерирует 6-значный код и UUID сессии, создаёт хост-игрока.
- `joinSession(code, name)` — добавляет игрока в существующую сессию (в мок-режиме).
- `startGame()` — перемешивает роли и переводит сессию в статус `active`.
- `setSettings(settings)` — обновляет таймеры и конфиг ролей.

### 7.3. `gameStore` (`stores/gameStore.ts`)

Состояние активной партии. Объёмный стор с несколькими группами полей:

**Экран:** `screen: 'role_reveal' | 'narrator' | 'night_action' | 'night_waiting' | 'day_discussion' | 'day_voting' | 'eliminated' | 'finale'`.

**Группы полей:**

- **Игрок и сессия:** `myPlayerId`, `myRole`, `myStatus`, `players`, `sessionId`, `nightNumber`, `dayNumber`.
- **Раскрытие ролей:** `acknowledged`, `acknowledgedCount`, `totalPlayers`.
- **Ведущий:** `currentAnnouncement`, `narratorTexts`, `narratorIndex`, `pendingScreen`.
- **Ночные действия:** `actionType` (`kill` / `check` / `heal` / `don_check` / `lover_visit` / `maniac_kill`), `availableTargets`, `selectedTarget`, `checkResults`, `mafiaCanSkip`, `doctorLastHealed`.
- **Дневное голосование:** `votes`, `voteCounts`, `voteSubmitted`, `voteTarget`.
- **Результаты:** `result: GameResult | null`, `activeRoles`, `allRolesAssignment`.

Стор предоставляет множество гранулярных сеттеров, а также батч-операции `resetNightState()`, `resetDayState()`, `reset()` для очистки состояния между фазами и партиями.

---

## 8. Интеграция с API

### HTTP-клиент (`api/httpClient.ts`)

Axios-инстанс с базовым URL `${API_BASE_URL}/api` и `Content-Type: application/json`.

**Request-интерсептор.** Подставляет `Authorization: Bearer <accessToken>` из `authStore`, если токен есть.

**Response-интерсептор.** Ловит 401 и пытается автоматически обновить токен:

1. Пропускает URL'ы `/auth/login`, `/auth/register`, `/auth/refresh` (на них рефрешить бессмысленно).
2. Если рефреш уже идёт — добавляет запрос в очередь `failedQueue` и ждёт.
3. Иначе ставит флаг `isRefreshing`, читает refresh-токен из localStorage и вызывает `POST /api/auth/refresh`.
4. При успехе обновляет токены через `authStore.setTokens(...)`, повторяет исходный запрос и разбирает очередь.
5. При любой ошибке вызывает `authStore.logout()` и редиректит на `/auth` через `window.location.href`.

Пропуск `/auth/refresh` из скипа и обработка очереди — единая логика, унаследованная от стандартного паттерна CRA + Axios.

### Модуль `api/authApi.ts`

Тонкая обёртка над `httpClient`:

```ts
export const authApi = {
  register: (data) => httpClient.post<AuthResponse>('/auth/register', data),
  login:    (data) => httpClient.post<AuthResponse>('/auth/login', data),
  refresh:  (data) => httpClient.post<RefreshResponse>('/auth/refresh', data),
  me:       ()     => httpClient.get<UserProfile>('/auth/me'),
  logout:   (data) => httpClient.post('/auth/logout', data),
};
```

### Таблица эндпоинтов

| Метод | Путь | Запрос | Ответ | Назначение |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | `RegisterRequest` | `AuthResponse` | Регистрация нового пользователя |
| `POST` | `/api/auth/login` | `LoginRequest` | `AuthResponse` | Вход по email/паролю |
| `POST` | `/api/auth/refresh` | `RefreshRequest` | `RefreshResponse` | Обновление пары токенов по refresh |
| `GET` | `/api/auth/me` | — | `UserProfile` | Профиль текущего пользователя |
| `POST` | `/api/auth/logout` | `LogoutRequest` | — | Инвалидация refresh-токена на бэкенде |

> **Игровые эндпоинты не реализованы в HTTP-слое.** Типы `CreateSessionRequest`, `GameStateResponse`, `NightActionRequest` и другие объявлены в `types/api.ts`, но API-модулей `sessionApi` / `gameApi` в коде нет. Всё игровое состояние эмулируется клиентским мок-движком (`mocks/mockGameEngine.ts`).

---

## 9. Типы и модели

### Auth-типы (`types/api.ts`)

```ts
interface RegisterRequest  { email: string; password: string }
interface LoginRequest     { email: string; password: string }
interface AuthResponse     { user_id: string; email: string; access_token: string; refresh_token: string }
interface RefreshRequest   { refresh_token: string }
interface RefreshResponse  { access_token: string; refresh_token: string }
interface LogoutRequest    { refresh_token: string }
interface UserProfile      { user_id: string; email: string; has_pro: boolean; created_at: string }
```

### Игровые типы (`types/game.ts`)

```ts
interface Role {
  name: string;                          // "Мафия", "Шериф", "Доктор", "Мирный"
  team: 'mafia' | 'city';
  abilities?: { night_action: 'kill' | 'check' | 'heal' | null };
}

interface Player {
  id: string;                            // UUID
  name: string;
  status: 'alive' | 'dead';
  join_order: number;
}

interface PlayerWithRole extends Player {
  role: { name: string; team: 'mafia' | 'city' };
}

interface Phase {
  id: string;
  type: 'role_reveal' | 'night' | 'day';
  number: number;
  sub_phase: 'discussion' | 'voting' | null;
  started_at: string;                    // ISO 8601
  timer_seconds: number | null;
  timer_started_at: string | null;
}

interface RoleConfig {
  mafia: number;      // 0–2
  don: number;        // 0–2
  sheriff: number;    // 0–2
  doctor: number;     // 0–2
  lover: number;      // 0–2
  maniac: number;     // 0–2
}

interface SessionSettings {
  role_reveal_timer_seconds: number;
  discussion_timer_seconds: number;
  voting_timer_seconds: number;
  night_action_timer_seconds: number;
  role_config: RoleConfig;
}

interface Session {
  id: string;
  code: string;
  host_user_id: string;
  player_count: number;
  status: 'waiting' | 'active' | 'finished';
  settings: SessionSettings;
  created_at: string;
}

interface LobbyPlayer {
  id: string;
  name: string;
  join_order: number;
  is_host: boolean;
}

interface GameResult {
  winner: 'mafia' | 'city' | null;
  announcement: Announcement;
  players: PlayerWithRole[];
}
```

### Ошибки (`types/errors.ts`)

```ts
interface ApiErrorResponse {
  error: { code: string; message: string };
}

type ErrorCode =
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

---

## 10. Аутентификация и безопасность

### Flow регистрации/входа

1. Пользователь заполняет форму в `LoginForm` / `RegisterForm` — клиентская валидация: email regex, пароль ≥ 8 символов.
2. Вызывается `authApi.login(...)` или `authApi.register(...)`.
3. На успех бэкенд возвращает `{ user_id, email, access_token, refresh_token }`.
4. `authStore.setTokens(access, refresh)` сохраняет access в памяти, refresh в localStorage, выставляет `isAuthenticated: true`.
5. Роут-обёртка `ProtectedRoute` разрешает переход на `/` (HomePage).
6. В случае недоступности бэкенда формы используют fallback-мок: выставляют фиктивные токены и профиль для отладки интерфейса без сервера.

### Хранение токенов

| Токен | Хранилище | Время жизни |
|---|---|---|
| `access_token` | Zustand (память) | До перезагрузки страницы |
| `refresh_token` | `localStorage.refresh_token` | До явного logout или очистки браузера |

**Следствие:** после F5 access-токен теряется и приложение сбрасывает `isAuthenticated` в `false`. Функция `authStore.initialize()` *обнаруживает* наличие refresh-токена, но автоматического восстановления сессии не происходит — пользователь снова попадает на `/auth`. Это поведение отличается от типового SPA и является зоной для доработки.

### Обновление токена по 401

Полностью автоматическое, выполняется в `httpClient.ts` (см. §8). Параллельные запросы, пришедшие на 401 во время идущего рефреша, буферизуются в `failedQueue` и повторяются с новым токеном.

### Защищённые маршруты

Все маршруты, кроме `/auth`, обёрнуты в `ProtectedRoute`. Гард проверяет только `isAuthenticated`; никаких проверок принадлежности сессии или ролей нет.

### Logout

`authStore.logout()` удаляет refresh-токен из localStorage и очищает стор. **Backend-endpoint `/auth/logout` при этом из `authStore` не вызывается** — его нужно звать отдельно через `authApi.logout(...)` там, где это необходимо.

---

## 11. Стилизация

### Подход

- **SCSS на компонент.** Для каждого `.tsx` есть парный `.scss`. Без CSS-модулей и CSS-in-JS.
- **Глобальные стили:** `src/index.scss` — сбросы, типографика, скроллбар, выбор текста. `src/App.scss` — стили уровня приложения.
- **Без дизайн-токенов.** Цвета и размеры задаются прямо в SCSS-файлах (токенного SCSS-файла нет).

### Цветовая палитра

| Токен | Значение | Использование |
|---|---|---|
| Фон | `#000000` | Основной фон приложения |
| Текст | `#ffffff` | Основной цвет текста |
| Акцент (мафия-красный) | `rgba(200, 30, 30, …)` | Скроллбары, выделение, CTA-эффекты |
| Подсветка выбора | `rgba(200, 30, 30, 0.4)` | `::selection` |
| Альтернативный акцент | `#8b5cf6` (фиолетовый) | Исторический, использован в некоторых формах (наследие `codedisign.md`) |

### Типографика

```
font-family: 'Inter', 'Segoe UI', Roboto, sans-serif;
font-family: 'Montserrat Alternates', sans-serif; /* Google Fonts, 400/500/600/700 */
font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New'; /* код */

-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### Layout-конвенции

- `box-sizing: border-box` глобально.
- Корневая высота: `min-height: 100vh` / `100dvh` (учитывает динамический viewport на мобильных).
- `overflow-x: hidden` на `body`.
- **Mobile-first:** дизайн оптимизирован под телефоны в первую очередь (см. `codedisign.md`).

### Именование классов

BEM-подобное: `.mafia-btn`, `.mafia-btn__glow`, `.mafia-btn__content`, `.mafia-input`. Модификаторы — через доп.классы или data-атрибуты.

---

## 12. Моки и разработка без бэкенда

Для разработки фронтенда без поднятого бэкенда предусмотрен механизм моков.

### Флаг `USE_MOCKS`

Определён в `src/utils/constants.ts`:

```ts
export const USE_MOCKS = process.env.REACT_APP_USE_MOCKS === 'true';
```

### Мок-модули

| Файл | Содержимое |
|---|---|
| `mocks/authMocks.ts` | Фиктивные `AuthResponse` и `UserProfile` для логина/регистрации |
| `mocks/sessionMocks.ts` | Моковые сессии, списки игроков, настройки |
| `mocks/gameMocks.ts` | Игровые состояния по фазам: роли, голосования, результаты |
| `mocks/mockGameEngine.ts` | Клиентский «движок» партии: `startGameCycle()`, `beginNightSequence()`, `cleanupEngine()`. Напрямую обновляет Zustand-сторы, эмулируя поведение бэкенда |

### Fallback в формах авторизации

Даже без флага `USE_MOCKS` формы `LoginForm` / `RegisterForm` при сетевой ошибке переключаются на мок-логин — это удобно для демонстраций и UI-разработки, но в продакшене требует внимания (неверный пароль не отличается от недоступного сервера).

---

## 13. Сборка и развёртывание

### Сборка

- **Команда:** `npm run build`
- **Инструмент:** `react-scripts build` (Webpack 5, Babel, PostCSS, оптимизации CRA)
- **Вывод:** директория `build/` с минифицированным JS/CSS, хешами в именах файлов, source-map'ами
- **Target:** ES5 (для широкой браузерной поддержки)

### Деплой

Приложение — статический SPA, его можно разворачивать на любом статик-хостинге (Nginx, S3+CloudFront, Vercel, Netlify и т.п.). Важно настроить fallback на `index.html` для клиентского роутинга.

### PWA

В `public/manifest.json` объявлены иконки, `display: standalone`, стартовый URL и цвета темы. Приложение устанавливаемо как PWA, однако название в манифесте по-прежнему стандартное CRA-шаблонное («Create React App Sample») — это стоит обновить.

### Browserslist

| Окружение | Targets |
|---|---|
| production | `>0.2%`, `not dead`, `not op_mini all` |
| development | `last 1 chrome version`, `last 1 firefox version`, `last 1 safari version` |

---

## 14. Тестирование

### Стек

- **Jest** — запускается через `react-scripts test`
- **@testing-library/react** — рендер и взаимодействие с компонентами
- **@testing-library/jest-dom** — дополнительные матчеры (`toBeInTheDocument`, …)
- **@testing-library/user-event** — симуляция пользовательских событий

### Конфигурация

- `src/setupTests.ts` импортирует `@testing-library/jest-dom`.
- Отдельного jest-конфига нет — используются настройки CRA по умолчанию (`jsdom`-окружение, трансформация через Babel).

### Покрытие

В репозитории присутствует единственный тестовый файл: `src/App.test.tsx` — шаблонный CRA-тест. **Фактическое покрытие практически отсутствует** — ни сторы, ни API-клиент, ни игровые экраны не покрыты тестами. Это заметный технический долг.

### Запуск

```bash
npm test                  # watch-режим
CI=true npm test          # однократный прогон
CI=true npm test -- --coverage  # с отчётом покрытия
```

---

## 15. Обработка ошибок

### Формат ошибок от бэкенда

Ожидается единый формат:

```json
{ "error": { "code": "invalid_credentials", "message": "..." } }
```

### `parseApiError` (`utils/parseApiError.ts`)

Принимает `unknown` (обычно `AxiosError`) и возвращает `ParsedApiError`:

```ts
interface ParsedApiError {
  code: string;        // из response.data.error.code или 'internal_error'
  message: string;     // из response.data.error.message или fallback
  httpStatus: number;  // из response.status или 0
}
```

Если ответ отсутствует или не соответствует формату — возвращается `internal_error` с fallback-сообщением.

### Пользовательские сообщения (`utils/constants.ts`)

Ключ `ERROR_MESSAGES` — словарь русскоязычных сообщений для частых кодов:

| Код | Сообщение |
|---|---|
| `invalid_credentials` | Неверный email или пароль |
| `validation_error` | Ошибка валидации |
| `session_not_found` | Сессия не найдена |
| `session_full` | Все места заняты |
| `game_already_started` | Игра уже началась |
| `already_joined` | Вы уже в этой сессии |
| `pro_required` | Для этого количества игроков нужна подписка Pro |
| `invalid_role_config` | Сумма ролей не равна количеству игроков |
| `internal_error` | Нет связи с сервером |

Коды, которых нет в словаре, должны обрабатываться компонентом явно либо отображать `message` напрямую.

### Полный список кодов

Тип `ErrorCode` в `types/errors.ts` перечисляет 19 кодов (см. §9). Не все они имеют человекочитаемые сообщения в `ERROR_MESSAGES` — при появлении новых кодов на бэкенде необходимо синхронизировать словарь.

---

## Приложение A. Технический долг и расхождения с планом

Заметные расхождения между `Frontend Plan.md` и фактической реализацией:

| Область | План | Реальность |
|---|---|---|
| Сборка | Vite | Create React App (Webpack) |
| Стили | Tailwind CSS | SCSS на компонент |
| Транспорт | REST + WebSocket | Только REST auth; игра — клиентский мок-движок |
| API-модули | `sessionApi`, `gameApi` | Только `authApi` |
| Сохранение сессии | Авто-восстановление по refresh | `initialize()` не логинит; после F5 — редирект на `/auth` |
| Тесты | Покрытие ключевой логики | Только шаблонный `App.test.tsx` |
| PWA-манифест | Корректное имя приложения | Дефолтное «Create React App Sample» |
| Logout | Уведомление бэкенда | `authStore.logout()` не вызывает `authApi.logout` |

Эти пункты — естественные цели для следующих итераций.
