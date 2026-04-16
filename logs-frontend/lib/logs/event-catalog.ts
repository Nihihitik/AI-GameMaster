import type { EventCatalogItem } from "./types";

const BACKEND_EVENTS: EventCatalogItem[] = [
  { source: "backend", domain: "app", event: "app.started", description: "Backend стартовал" },
  { source: "backend", domain: "request", event: "http.request_completed", description: "Завершён HTTP запрос" },
  { source: "backend", domain: "request", event: "request.validation_failed", description: "Ошибка валидации payload" },
  { source: "backend", domain: "request", event: "request.handled_error", description: "Обработанная GameError" },
  { source: "backend", domain: "request", event: "request.unhandled_exception", description: "Необработанное исключение" },
  { source: "backend", domain: "auth", event: "auth.register_succeeded", description: "Успешная регистрация" },
  { source: "backend", domain: "auth", event: "auth.login_succeeded", description: "Успешный логин" },
  { source: "backend", domain: "auth", event: "auth.token_refreshed", description: "Refresh token выполнен" },
  { source: "backend", domain: "auth", event: "auth.refresh_failed", description: "Refresh token невалиден" },
  { source: "backend", domain: "auth", event: "auth.profile_updated", description: "Обновлён профиль" },
  { source: "backend", domain: "auth", event: "auth.logout_succeeded", description: "Logout успешен" },
  { source: "backend", domain: "auth", event: "auth.account_deleted", description: "Аккаунт удалён" },
  { source: "backend", domain: "session", event: "session.created", description: "Сессия создана" },
  { source: "backend", domain: "session", event: "session.joined", description: "Игрок вошёл" },
  { source: "backend", domain: "session", event: "session.left", description: "Игрок вышел" },
  { source: "backend", domain: "session", event: "session.settings_updated", description: "Изменены настройки" },
  { source: "backend", domain: "session", event: "session.player_kicked", description: "Игрок исключён" },
  { source: "backend", domain: "session", event: "session.closed", description: "Сессия закрыта" },
  { source: "backend", domain: "game", event: "game.started", description: "Игра стартовала" },
  { source: "backend", domain: "game", event: "game.role_acknowledged", description: "Роль подтверждена" },
  { source: "backend", domain: "game", event: "night.action_submitted", description: "Ночное действие" },
  { source: "backend", domain: "game", event: "vote.submitted", description: "Голос принят" },
  { source: "backend", domain: "game", event: "vote.resolved", description: "Голосование разрешено" },
  { source: "backend", domain: "game", event: "game.vote_tie", description: "Ничья, revote" },
  { source: "backend", domain: "game", event: "game.paused", description: "Игра на паузе" },
  { source: "backend", domain: "game", event: "game.resumed", description: "Игра снята с паузы" },
  { source: "backend", domain: "game", event: "game.finished", description: "Игра завершена" },
  { source: "backend", domain: "game", event: "game.action_blocked", description: "Действие заблокировано" },
  { source: "backend", domain: "game", event: "game.duplicate_action", description: "Повторное действие" },
  { source: "backend", domain: "phase", event: "phase.changed", description: "Смена фазы" },
  { source: "backend", domain: "phase", event: "runtime_state_mismatch", description: "Runtime восстановлен из persisted" },
  { source: "backend", domain: "recovery", event: "recovery.skipped", description: "Recovery пропущен" },
  { source: "backend", domain: "recovery", event: "recovery.session_restored", description: "Recovery восстановил сессию" },
  { source: "backend", domain: "recovery", event: "recovery.loop_failed", description: "Упал recovery loop" },
  { source: "backend", domain: "timer", event: "timer.started", description: "Таймер запущен" },
  { source: "backend", domain: "timer", event: "timer.cancelled", description: "Таймер отменён" },
  { source: "backend", domain: "timer", event: "timer.cancelled_all", description: "Отменены все таймеры" },
  { source: "backend", domain: "timer", event: "timer.callback_failed", description: "Упал callback таймера" },
  { source: "backend", domain: "ws", event: "ws.connected", description: "WebSocket подключён" },
  { source: "backend", domain: "ws", event: "ws.disconnected", description: "WebSocket отключён" },
  { source: "backend", domain: "ws", event: "ws.stale_connection", description: "Stale WS соединение" },
  { source: "backend", domain: "ws", event: "ws.invalid_message", description: "Невалидное WS сообщение" },
  { source: "backend", domain: "ws", event: "ws.loop_failed", description: "Ошибка в WS loop" },
];

const FRONTEND_EVENTS: EventCatalogItem[] = [
  { source: "frontend", domain: "ui", event: "page.view", description: "Открыта страница" },
  { source: "frontend", domain: "ui", event: "ui.unhandled_error", description: "Глобальная browser ошибка" },
  { source: "frontend", domain: "ui", event: "ui.unhandled_rejection", description: "Необработанный rejection" },
  { source: "frontend", domain: "ui", event: "app.bootstrap_failed", description: "Ошибка bootstrap или error boundary" },
  { source: "frontend", domain: "console", event: "console.captured", description: "Перехваченный native console.* вызов" },
  { source: "frontend", domain: "auth", event: "auth.login_submit", description: "Submit формы логина" },
  { source: "frontend", domain: "auth", event: "auth.login_success", description: "Логин успешен" },
  { source: "frontend", domain: "auth", event: "auth.register_submit", description: "Submit формы регистрации" },
  { source: "frontend", domain: "auth", event: "auth.register_success", description: "Регистрация успешна" },
  { source: "frontend", domain: "auth", event: "auth.refresh_retry", description: "Refresh после 401" },
  { source: "frontend", domain: "auth", event: "auth.force_logout_after_refresh_failure", description: "Force logout" },
  { source: "frontend", domain: "auth", event: "auth.logout_submit", description: "Logout начат" },
  { source: "frontend", domain: "auth", event: "auth.logout_success", description: "Logout завершён" },
  { source: "frontend", domain: "auth", event: "auth.initialize_success", description: "Bootstrap auth успешен" },
  { source: "frontend", domain: "auth", event: "auth.initialize_failed", description: "Bootstrap auth не удался" },
  { source: "frontend", domain: "session", event: "session.create_submit", description: "Submit создания сессии" },
  { source: "frontend", domain: "session", event: "session.create_success", description: "Сессия создана" },
  { source: "frontend", domain: "session", event: "session.join_submit", description: "Submit входа в сессию" },
  { source: "frontend", domain: "session", event: "session.join_success", description: "Вход успешен" },
  { source: "frontend", domain: "session", event: "session.load_success", description: "Сессия загружена" },
  { source: "frontend", domain: "session", event: "session.settings_updated", description: "Настройки обновлены" },
  { source: "frontend", domain: "game", event: "game.start_submit", description: "Хост нажал старт" },
  { source: "frontend", domain: "game", event: "game.state_load", description: "Загружено состояние" },
  { source: "frontend", domain: "game", event: "game.role_acknowledged", description: "Роль подтверждена" },
  { source: "frontend", domain: "game", event: "game.night_action_submit", description: "Ночное действие" },
  { source: "frontend", domain: "game", event: "game.vote_submit", description: "Голос отправлен" },
  { source: "frontend", domain: "game", event: "game.pause_submit", description: "Pause отправлен" },
  { source: "frontend", domain: "game", event: "game.resume_submit", description: "Resume отправлен" },
  { source: "frontend", domain: "game", event: "game.result_received", description: "Финальный результат" },
  { source: "frontend", domain: "game", event: "game.critical_load_failed", description: "Критическая ошибка загрузки игры" },
  { source: "frontend", domain: "story", event: "story.vote_submit", description: "Голос за сюжет" },
  { source: "frontend", domain: "story", event: "story.selection_completed", description: "Сюжет выбран" },
  { source: "frontend", domain: "profile", event: "profile.nickname_updated", description: "Никнейм обновлён" },
  { source: "frontend", domain: "api", event: "api.request_prepared", description: "HTTP запрос подготовлен" },
  { source: "frontend", domain: "api", event: "api.nonfatal_failure", description: "Нефатальная ошибка запроса" },
  { source: "frontend", domain: "ws", event: "ws.connected", description: "WebSocket подключён" },
  { source: "frontend", domain: "ws", event: "ws.resync_completed", description: "Resync после reconnect" },
  { source: "frontend", domain: "ws", event: "ws.state_resync_failed", description: "Resync не удался" },
  { source: "frontend", domain: "ws", event: "ws.parse_failed", description: "Не удалось распарсить WS сообщение" },
  { source: "frontend", domain: "ws", event: "ws.invalid_message", description: "Неизвестное WS сообщение" },
  { source: "frontend", domain: "ws", event: "ws.socket_error", description: "WebSocket error event" },
  { source: "frontend", domain: "ws", event: "ws.heartbeat_failed", description: "Не удалось ping" },
  { source: "frontend", domain: "ws", event: "ws.reconnect_scheduled", description: "Запланирован reconnect" },
];

export const EVENT_CATALOG: EventCatalogItem[] = [...BACKEND_EVENTS, ...FRONTEND_EVENTS];

export function eventsForSource(source: "backend" | "frontend"): EventCatalogItem[] {
  return EVENT_CATALOG.filter((item) => item.source === source);
}

export function domainsForSource(source: "backend" | "frontend"): string[] {
  const seen = new Set<string>();
  for (const item of EVENT_CATALOG) {
    if (item.source === source) seen.add(item.domain);
  }
  return Array.from(seen);
}
