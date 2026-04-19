// access_token хранится ТОЛЬКО в памяти (через zustand store).
// refresh_token хранится либо в localStorage (обычный режим),
// либо в sessionStorage для dev player tabs.

export type AuthStorageMode = 'local' | 'session';

export const TOKEN_KEY = 'refresh_token';
const MODE_KEY = 'auth_storage_mode';
const DEV_PLAYER_ROUTE_RE = /^\/sessions\/[^/]+\/player\d+$/i;

function canUseWebStorage(): boolean {
  return typeof window !== 'undefined';
}

export function getAuthStorageMode(): AuthStorageMode {
  if (!canUseWebStorage()) {
    return 'local';
  }
  return window.sessionStorage.getItem(MODE_KEY) === 'session' ? 'session' : 'local';
}

export function prepareAuthStorageFromLocation(pathname: string, search: string): void {
  if (!canUseWebStorage()) {
    return;
  }
  const hasDevKey = new URLSearchParams(search).has('devKey');
  if (DEV_PLAYER_ROUTE_RE.test(pathname) && hasDevKey) {
    window.sessionStorage.setItem(MODE_KEY, 'session');
  }
}

export function setAuthStorageMode(mode: AuthStorageMode): void {
  if (!canUseWebStorage()) {
    return;
  }
  if (mode === 'session') {
    window.sessionStorage.setItem(MODE_KEY, 'session');
    return;
  }
  window.sessionStorage.removeItem(MODE_KEY);
}

export function getRefreshToken(): string | null {
  if (!canUseWebStorage()) {
    return null;
  }
  if (getAuthStorageMode() === 'session') {
    return window.sessionStorage.getItem(TOKEN_KEY);
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setRefreshToken(token: string, mode: AuthStorageMode): void {
  if (!canUseWebStorage()) {
    return;
  }
  if (mode === 'session') {
    setAuthStorageMode('session');
    window.sessionStorage.setItem(TOKEN_KEY, token);
    return;
  }
  window.sessionStorage.removeItem(TOKEN_KEY);
  setAuthStorageMode('local');
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function removeRefreshToken(): void {
  if (!canUseWebStorage()) {
    return;
  }
  if (getAuthStorageMode() === 'session') {
    window.sessionStorage.removeItem(TOKEN_KEY);
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
  setAuthStorageMode('local');
}
