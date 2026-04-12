# Frontend TODO

Список известных проблем и недоработок фронта, требующих ручного исправления. По каждой — описание симптома, источник и план починки со ссылками на файлы.

---

## 1. 🔴 403 на `POST /api/sessions` показывается как «Request failed with status code 403»

### Симптом

При попытке создать сессию с `player_count > 5` у аккаунта без Pro-подписки backend возвращает:

```
HTTP 403 Forbidden
{
  "error": {
    "code": "pro_required",
    "message": "Для этого количества игроков нужна подписка Pro"
  }
}
```

На UI в модалке «Создать сессию» вместо человеческого сообщения всплывает техническая строка `Request failed with status code 403` (стандартный `AxiosError.message`). Игрок не понимает, что ему делать.

Такая же проблема на любом другом бизнес-коде бэка, пришедшем в этой модалке: `invalid_role_config`, `validation_error`, `session_not_found` (для join) — всё показывается как «Request failed with status code XXX».

### Корень проблемы

В `frontend/src/pages/HomePage.tsx` обработка ошибки в `handleConfirmCreate` и `handleConfirmJoin` читает `err?.message` напрямую с `AxiosError`, вместо того чтобы прогонять через уже существующий `utils/parseApiError.ts`.

**`frontend/src/pages/HomePage.tsx:72-74`** (создание сессии):
```tsx
} catch (err: any) {
  setCreateError(err?.message || 'Не удалось создать сессию');
}
```

**`frontend/src/pages/HomePage.tsx:106-108`** (присоединение):
```tsx
} catch (err: any) {
  setJoinError(err?.message || 'Не удалось присоединиться');
}
```

Почему это не работает:
- `err.message` у `AxiosError` — это всегда автогенерированный текст вида `Request failed with status code 403`.
- Backend шлёт структурированный JSON в `err.response.data.error.{code, message}`, и именно его нужно парсить.
- Утилита `utils/parseApiError.ts` уже это делает: возвращает `{ code, message, httpStatus }`.
- Словарь русских сообщений `utils/constants.ts::ERROR_MESSAGES` уже содержит ключ `pro_required: 'Для этого количества игроков нужна подписка Pro'`.

То есть вся инфраструктура готова — она просто не подключена в HomePage.

### Что должно происходить

Сценарий A (общий — для всех ошибок кроме `pro_required`):
1. `parseApiError(err)` вытаскивает `code` и `message`.
2. Ищем `ERROR_MESSAGES[code]` — если есть, показываем русское сообщение; иначе fallback на `message` от бэка.
3. Показываем в `create-modal__error` / `joinError` как сейчас.

Сценарий B (особый — для `pro_required`):
1. Не показываем текстовую ошибку в модалке.
2. Вместо этого открываем отдельную **модалку «Обновитесь до Pro»** с заголовком, описанием преимуществ (число игроков 6–20) и двумя кнопками:
   - **«Оформить Pro»** — вызывает мокап покупки (см. §1.3 ниже).
   - **«Отмена»** — закрывает модалку.
3. После успешной покупки:
   - Закрываем модалку Pro.
   - Обновляем `authStore.user.has_pro` (через `authApi.me()` или вручную).
   - Повторяем исходный запрос `sessionStore.createSession(...)` автоматически, или даём пользователю ещё раз нажать «Создать».

### Мокап покупки Pro (вариант реализации)

Настоящего платёжного провайдера нет (см. backend README: «Подписки — заготовка API под Pro (/api/subscriptions); без полноценной оплаты»). Но на бэке уже есть эндпоинт, который просто пишет активную запись Pro в БД на 30 дней без реального платежа:

```
POST /api/subscriptions
Authorization: Bearer <access_token>
{ "plan": "pro" }
```

Ответ 201:
```json
{
  "subscription_id": "uuid",
  "plan": "pro",
  "status": "active",
  "period_start": "2026-04-12T...",
  "period_end": "2026-05-12T..."
}
```

Обёртка над этим уже есть: `frontend/src/api/subscriptionsApi.ts::subscriptionsApi.create({ plan: 'pro' })`.

**План действий кнопки «Оформить Pro» в мокап-модалке:**

```tsx
const handleUpgradeToPro = async () => {
  setUpgrading(true);
  try {
    await subscriptionsApi.create({ plan: 'pro' });
    // Обновить профиль, чтобы has_pro стал true
    const me = await authApi.me();
    useAuthStore.getState().setUser(me.data);
    setShowProModal(false);
    // Повторяем создание сессии автоматически
    await handleConfirmCreate();
  } catch (err) {
    const parsed = parseApiError(err);
    setUpgradeError(ERROR_MESSAGES[parsed.code] ?? parsed.message);
  } finally {
    setUpgrading(false);
  }
};
```

UI модалки должен явно говорить пользователю, что **это мокап, реальной оплаты нет**, чтобы никого не ввести в заблуждение. Например:

```
┌─────────────────────────────────────────────┐
│  🎭  Нужна подписка Pro                     │
│                                             │
│  Бесплатно: до 5 игроков в сессии           │
│  Pro: до 20 игроков + расширенные роли      │
│       (дон, любовница, маньяк)              │
│                                             │
│  ⚠️ Это dev-мокап — оплата не проводится.   │
│     Pro на 30 дней выдаётся бесплатно.      │
│                                             │
│  [  Оформить Pro  ]  [  Отмена  ]          │
└─────────────────────────────────────────────┘
```

### План реализации (шаги)

1. **`frontend/src/pages/HomePage.tsx`**:
   - Импортировать `parseApiError`, `ERROR_MESSAGES`, `subscriptionsApi`, `authApi`.
   - Завести локальный стейт `showProModal`, `upgrading`, `upgradeError`.
   - В `handleConfirmCreate` в catch:
     ```tsx
     } catch (err) {
       const parsed = parseApiError(err);
       if (parsed.code === 'pro_required') {
         setShowCreateModal(false);
         setShowProModal(true);
         return;
       }
       setCreateError(ERROR_MESSAGES[parsed.code] ?? parsed.message);
     }
     ```
   - В `handleConfirmJoin` — тот же паттерн (но для join код `pro_required` не прилетит, остальные коды — через словарь).
   - Добавить JSX модалки Pro (использовать существующий `components/ui/Modal`).
   - Добавить `handleUpgradeToPro` (см. пример выше).

2. **Стили**: `frontend/src/pages/HomePage.scss` — добавить класс `.pro-modal` и его элементы (заголовок, список бенефитов, предупреждение про мокап, кнопки).

3. **Проверить другие места** с тем же антипаттерном `err?.message`:
   - `frontend/src/pages/LobbyPage.tsx` — кнопки «Начать игру», «Изменить настройки», «Покинуть/кикнуть».
   - `frontend/src/pages/GamePage.tsx` — вызовы `acknowledgeRole`, `submitNightAction`, `submitVote` (но это уже внутри gameStore — там ловить через try/catch и показывать через тост/инлайн).
   - `frontend/src/components/game/NightActionScreen.tsx`, `DayVotingScreen.tsx` — вызовы `submitNightAction` / `submitVote`.
   - `frontend/src/pages/ProfilePage.tsx` — `updateNickname`, `deleteAccount`, upgrade Pro.
   - Везде: `const parsed = parseApiError(err); setError(ERROR_MESSAGES[parsed.code] ?? parsed.message);`.

4. **Тестирование**:
   - Зарегистрироваться свежим аккаунтом (без Pro).
   - Создать сессию на 6+ игроков → должна открыться модалка Pro (а не «Request failed»).
   - Нажать «Оформить Pro» → модалка закрывается, сессия создаётся, переход в лобби.
   - Для регресс-проверки: создать сессию на 5 игроков → должна создаваться сразу без модалки.
   - Отдельно: для ручного сбросa Pro в dev:
     ```bash
     docker compose exec db psql -U gamemaster -d gamemaster \
       -c "UPDATE subscriptions SET status='expired', period_end=NOW() WHERE user_id=(SELECT id FROM users WHERE email='test@test.com');"
     ```

### Критерии готовности

- [ ] При 403 `pro_required` в HomePage показывается модалка Pro, а не строка «Request failed with status code 403».
- [ ] При нажатии «Оформить Pro» мокап-модалка вызывает `POST /api/subscriptions`, обновляет `authStore.user` и повторяет создание сессии.
- [ ] При других кодах ошибок (`invalid_role_config`, `session_not_found` и т.д.) показывается локализованный текст из `ERROR_MESSAGES`, а не дефолт Axios.
- [ ] Мокап-модалка явно говорит, что оплата не проводится (dev-режим).
- [ ] `npx tsc --noEmit` проходит без ошибок.

### Связанные файлы

- `frontend/src/pages/HomePage.tsx` — главное место исправления.
- `frontend/src/pages/HomePage.scss` — стили модалки Pro.
- `frontend/src/utils/parseApiError.ts` — уже реализован, не трогать.
- `frontend/src/utils/constants.ts::ERROR_MESSAGES` — уже содержит ключ `pro_required`, не трогать.
- `frontend/src/api/subscriptionsApi.ts` — уже готов (`create({ plan: 'pro' })`).
- `frontend/src/api/authApi.ts` — `me()` для обновления профиля после покупки.
- `frontend/src/stores/authStore.ts::setUser` — для обновления `has_pro`.
- `backend/api/routers/sessions.py:86` — источник 403 `pro_required`.
- `backend/api/routers/subscriptions.py` — эндпоинт мокап-покупки.

### Почему это важно

1. **UX**: пользователь не понимает, что случилось и что делать.
2. **Монетизация (будущая)**: этот флоу будет фактически на продакшн-пути, когда появится реальный платёжный провайдер. Лучше сразу сделать инфраструктуру правильно.
3. **Отладка**: скрытые технические сообщения Axios мешают QA.
