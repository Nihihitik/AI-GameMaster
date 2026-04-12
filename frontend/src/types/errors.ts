/** Единый формат ошибки от backend */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Все известные коды ошибок (синхронизировано с backend §10).
 * Используются для условной логики на клиенте (показ конкретного сообщения, редирект).
 */
export type ErrorCode =
  | 'email_already_registered'
  | 'invalid_credentials'
  | 'token_invalid'
  | 'token_expired'
  | 'validation_error'
  | 'session_not_found'
  | 'player_not_found'
  | 'session_full'
  | 'game_already_started'
  | 'not_host'
  | 'wrong_phase'
  | 'confirmation_required'
  | 'invalid_role_config'
  | 'pro_required'
  | 'player_dead'
  | 'invalid_target'
  | 'action_already_submitted'
  | 'game_paused'
  | 'internal_error'
  | 'already_joined';
