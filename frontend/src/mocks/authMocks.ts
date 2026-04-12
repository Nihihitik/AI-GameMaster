import { AuthResponse, UserProfile } from '../types/api';

export const mockRegisterResponse: AuthResponse = {
  user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'player@example.com',
  access_token: 'mock-access-token-register',
  refresh_token: 'mock-refresh-token-register',
};

export const mockLoginResponse: AuthResponse = {
  user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'player@example.com',
  access_token: 'mock-access-token-login',
  refresh_token: 'mock-refresh-token-login',
};

export const mockUserProfile: UserProfile = {
  user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'player@example.com',
  has_pro: false,
  created_at: '2026-04-01T10:00:00Z',
};

export const mockRefreshResponse = {
  access_token: 'mock-access-token-refreshed',
  refresh_token: 'mock-refresh-token-refreshed',
};

// Ошибки
export const mockInvalidCredentials = {
  error: { code: 'invalid_credentials', message: 'Неверный email или пароль' },
};

export const mockEmailAlreadyExists = {
  error: { code: 'validation_error', message: 'Пользователь с таким email уже существует' },
};
