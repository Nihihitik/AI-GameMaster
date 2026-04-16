import { SessionSettings } from '../types/game';

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  role_reveal_timer_seconds: 15,
  discussion_timer_seconds: 120,
  voting_timer_seconds: 60,
  night_action_timer_seconds: 30,
  role_config: {
    mafia: 1,
    don: 0,
    sheriff: 1,
    doctor: 1,
    lover: 0,
    maniac: 0,
  },
};

export function createDefaultSessionSettings(): SessionSettings {
  return {
    ...DEFAULT_SESSION_SETTINGS,
    role_config: { ...DEFAULT_SESSION_SETTINGS.role_config },
  };
}
