import { create } from 'zustand';
import { UserProfile } from '../types/api';

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserProfile) => void;
  logout: () => void;
  initialize: () => boolean; // Проверка наличия refresh_token при старте
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  // We don't automatically set isAuthenticated to true on boot unless tokens are actually provided
  // or until initialize() confirms it. For now it defaults to false.
  isAuthenticated: false,

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('refresh_token', refreshToken);
    set({ accessToken, isAuthenticated: true });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('refresh_token');
    set({ accessToken: null, user: null, isAuthenticated: false });
  },

  initialize: () => {
    const refreshToken = localStorage.getItem('refresh_token');
    return !!refreshToken;
  },
}));
