// access_token хранится ТОЛЬКО в памяти (через zustand store).
// refresh_token хранится в localStorage.

export const TOKEN_KEY = 'refresh_token';

export function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeRefreshToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
