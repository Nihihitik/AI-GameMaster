export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
export const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || 'ws://localhost:8000';
export const USE_MOCKS = process.env.REACT_APP_USE_MOCKS === 'true';

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
  invalid_role_config: 'Сумма ролей не равна количеству игроков',
  not_host: 'Действие доступно только хосту',
  confirmation_required: 'Требуется подтверждение',
  wrong_phase: 'Действие сейчас недоступно',
  player_dead: 'Вы выбыли из игры',
  invalid_target: 'Нельзя выбрать эту цель',
  action_already_submitted: 'Вы уже совершили действие',
  game_paused: 'Игра на паузе',
  internal_error: 'Нет связи с сервером',
};
