export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
export const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || 'ws://localhost:8000';
export const USE_MOCKS = process.env.REACT_APP_USE_MOCKS === 'true';
export const APP_ENV = process.env.REACT_APP_APP_ENV || process.env.NODE_ENV || 'development';
export const CLIENT_LOG_LEVEL = process.env.REACT_APP_LOG_LEVEL || (APP_ENV === 'development' ? 'debug' : 'info');
export const REMOTE_LOGS_ENABLED = process.env.REACT_APP_REMOTE_LOGS_ENABLED !== 'false';
export const REMOTE_LOG_MIN_LEVEL = process.env.REACT_APP_REMOTE_LOG_MIN_LEVEL || 'info';
export const LOG_CAPTURE_CONSOLE = process.env.REACT_APP_LOG_CAPTURE_CONSOLE === 'true';

export const ROLE_LABELS: Record<string, string> = {
  mafia: 'Мафия',
  don: 'Дон',
  sheriff: 'Шериф',
  doctor: 'Доктор',
  lover: 'Любовница',
  maniac: 'Маньяк',
  civilian: 'Мирный',
};

export const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Неверный email или пароль',
  email_already_registered: 'Пользователь с таким email уже существует',
  validation_error: 'Ошибка валидации',
  token_invalid: 'Сессия истекла, войдите заново',
  token_expired: 'Сессия истекла, войдите заново',
  session_not_found: 'Сессия не найдена',
  player_not_found: 'Игрок не найден',
  session_full: 'Все места заняты',
  game_already_started: 'Игра уже началась',
  already_joined: 'Вы уже в этой сессии',
  pro_required: 'Для этого количества игроков нужна подписка Pro',
  invalid_role_config: 'Проверьте баланс ролей: в партии должна быть хотя бы одна мафия, и мафия должна быть меньше города',
  not_host: 'Действие доступно только хосту',
  confirmation_required: 'Требуется подтверждение',
  wrong_phase: 'Действие сейчас недоступно',
  player_dead: 'Вы выбыли из игры',
  invalid_target: 'Нельзя выбрать эту цель',
  action_already_submitted: 'Вы уже совершили действие',
  game_paused: 'Игра на паузе',
  insufficient_players: 'Недостаточно игроков для выбранной конфигурации ролей',
  internal_error: 'Внутренняя ошибка сервера',
};
