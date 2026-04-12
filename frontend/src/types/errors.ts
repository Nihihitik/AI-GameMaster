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
