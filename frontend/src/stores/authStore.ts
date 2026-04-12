import { create } from 'zustand';
import { UserProfile } from '../types/api';
import { authApi } from '../api/authApi';

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isInitializing: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserProfile) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>; // Auto-login по refresh-токену при старте приложения
}

/** Внутренний флаг против рекурсии logout (httpClient interceptor → logout → logout → ...). */
let logoutInProgress = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  // Пока идёт первичный restore (refresh + me) — рендерим splash, чтобы ProtectedRoute
  // не отправил пользователя на /auth раньше времени.
  isInitializing: true,

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('refresh_token', refreshToken);
    set({ accessToken, isAuthenticated: true });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    if (logoutInProgress) return;
    logoutInProgress = true;
    try {
      // Попытаться честно инвалидировать refresh-токен на бэке (не критично, ошибки глушим).
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          await authApi.logout({ refresh_token: refreshToken });
        } catch {
          // ignore — локальный логаут всё равно должен сработать
        }
      }
      localStorage.removeItem('refresh_token');
      set({ accessToken: null, user: null, isAuthenticated: false });
    } finally {
      logoutInProgress = false;
    }
  },

  initialize: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      set({ isInitializing: false });
      return;
    }
    try {
      const refreshResponse = await authApi.refresh({ refresh_token: refreshToken });
      const { access_token, refresh_token: newRefresh } = refreshResponse.data;
      localStorage.setItem('refresh_token', newRefresh);
      set({ accessToken: access_token, isAuthenticated: true });

      const meResponse = await authApi.me();
      set({ user: meResponse.data });
    } catch {
      // Невалидный/истёкший refresh — чистим всё и отправляем на /auth.
      localStorage.removeItem('refresh_token');
      set({ accessToken: null, user: null, isAuthenticated: false });
    } finally {
      set({ isInitializing: false });
    }
  },
}));
