import { DEFAULT_SETTINGS } from '../stores/sessionStore';
import { createDefaultSessionSettings, DEFAULT_SESSION_SETTINGS } from './sessionDefaults';

describe('session defaults', () => {
  it('keeps store defaults in sync with shared session defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('creates isolated copies for nested role config', () => {
    const first = createDefaultSessionSettings();
    const second = createDefaultSessionSettings();

    first.role_config.mafia = 2;

    expect(second.role_config.mafia).toBe(DEFAULT_SESSION_SETTINGS.role_config.mafia);
  });
});
