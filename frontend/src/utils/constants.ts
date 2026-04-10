export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
export const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || 'ws://localhost:8000';
export const USE_MOCKS = process.env.REACT_APP_USE_MOCKS === 'true';

export const ROLE_LABELS: Record<string, string> = {
  mafia: 'Мафия',
  sheriff: 'Шериф',
  doctor: 'Доктор',
  civilian: 'Мирный',
};

export const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Неверный email или пароль',
  validation_error: 'Ошибка валидации',
  session_not_found: 'Сессия не найдена',
  session_full: 'Все места заняты',
  game_already_started: 'Игра уже началась',
  already_joined: 'Вы уже в этой сессии',
  pro_required: 'Для этого количества игроков нужна подписка Pro',
  invalid_role_config: 'Сумма ролей не равна количеству игроков',
  internal_error: 'Нет связи с сервером',
};
