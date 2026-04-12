import { create } from 'zustand';
import { Session, SessionSettings, LobbyPlayer, Role, RoleConfig } from '../types/game';
import { mockSession, mockLobbyPlayers, mockDefaultSettings } from '../mocks/sessionMocks';
import { mockRoles } from '../mocks/gameMocks';

export const MAX_PLAYERS = 12;
export const MIN_PLAYERS = 5;

export function getSpecialRolesCount(rc: RoleConfig): number {
  return rc.mafia + rc.don + rc.sheriff + rc.doctor + rc.lover + rc.maniac;
}

export function getCiviliansCount(playerCount: number, rc: RoleConfig): number {
  return Math.max(0, playerCount - getSpecialRolesCount(rc));
}

interface SessionState {
  session: Session | null;
  players: LobbyPlayer[];
  settings: SessionSettings;
  isHost: boolean;
  myPlayerId: string | null;
  myRole: Role | null;
  acknowledged: boolean;
  acknowledgedCount: number;
  totalPlayers: number;
  withStory: boolean;
  selectedStoryId: string | null;
  timerPaused: boolean;

  createSession: () => void;
  joinSession: (code: string, name: string) => boolean;
  setSettings: (settings: Partial<SessionSettings>) => void;
  addPlayer: (player: LobbyPlayer) => void;
  removePlayer: (playerId: string) => void;
  setWithStory: (value: boolean) => void;
  setSelectedStory: (storyId: string) => void;
  startGame: () => void;
  assignRole: (role: Role) => void;
  acknowledgeRole: () => void;
  addAcknowledgment: () => void;
  setTimerPaused: (paused: boolean) => void;
  reset: () => void;
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildRoleList(rc: RoleConfig): string[] {
  const list: string[] = [];
  for (let i = 0; i < rc.mafia; i++) list.push('mafia');
  for (let i = 0; i < rc.don; i++) list.push('don');
  for (let i = 0; i < rc.sheriff; i++) list.push('sheriff');
  for (let i = 0; i < rc.doctor; i++) list.push('doctor');
  for (let i = 0; i < rc.lover; i++) list.push('lover');
  for (let i = 0; i < rc.maniac; i++) list.push('maniac');
  return list;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  players: [],
  settings: mockDefaultSettings,
  isHost: false,
  myPlayerId: null,
  myRole: null,
  acknowledged: false,
  acknowledgedCount: 0,
  totalPlayers: 0,
  withStory: false,
  selectedStoryId: null,
  timerPaused: false,

  createSession: () => {
    const code = generateCode();
    const sessionId = generateUUID();
    const playerId = generateUUID();
    const session: Session = {
      ...mockSession,
      id: sessionId,
      code,
      status: 'waiting',
      player_count: MAX_PLAYERS,
    };
    const hostPlayer: LobbyPlayer = {
      id: playerId,
      name: 'Вы (Организатор)',
      join_order: 1,
      is_host: true,
    };
    set({
      session,
      players: [hostPlayer],
      isHost: true,
      myPlayerId: playerId,
      settings: { ...mockDefaultSettings },
    });
  },

  joinSession: (code: string, name: string) => {
    const state = get();
    if (!state.session || state.session.code !== code) {
      const playerId = generateUUID();
      const session: Session = {
        ...mockSession,
        code,
        status: 'waiting',
        player_count: MAX_PLAYERS,
      };
      const player: LobbyPlayer = {
        id: playerId,
        name,
        join_order: state.players.length + 1,
        is_host: false,
      };
      set({
        session,
        players: [...mockLobbyPlayers, player],
        isHost: false,
        myPlayerId: playerId,
      });
      return true;
    }
    return false;
  },

  setSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  },

  addPlayer: (player) => {
    set((state) => {
      if (state.players.length >= MAX_PLAYERS) return state;
      return { players: [...state.players, player] };
    });
  },

  removePlayer: (playerId) => {
    set((state) => ({
      players: state.players.filter((p) => p.id !== playerId),
    }));
  },

  setWithStory: (value) => {
    set({ withStory: value });
  },

  setSelectedStory: (storyId) => {
    set({ selectedStoryId: storyId });
  },

  startGame: () => {
    const state = get();
    const playerCount = state.players.length;
    const specialRoles = buildRoleList(state.settings.role_config);
    const civCount = getCiviliansCount(playerCount, state.settings.role_config);
    const allRoles = [...specialRoles];
    for (let i = 0; i < civCount; i++) allRoles.push('civilian');
    const shuffled = allRoles.sort(() => Math.random() - 0.5);
    const myIndex = state.players.findIndex((p) => p.id === state.myPlayerId);
    const myRoleKey = shuffled[myIndex] || 'civilian';
    const myRole = mockRoles[myRoleKey] || mockRoles.civilian;

    set({
      session: state.session ? { ...state.session, status: 'active' } : null,
      myRole: myRole,
      acknowledged: false,
      acknowledgedCount: 0,
      totalPlayers: playerCount,
    });
  },

  assignRole: (role) => {
    set({ myRole: role });
  },

  acknowledgeRole: () => {
    set((state) => ({
      acknowledged: true,
      acknowledgedCount: state.acknowledgedCount + 1,
    }));
  },

  addAcknowledgment: () => {
    set((state) => ({
      acknowledgedCount: state.acknowledgedCount + 1,
    }));
  },

  setTimerPaused: (paused) => {
    set({ timerPaused: paused });
  },

  reset: () => {
    set({
      session: null,
      players: [],
      settings: mockDefaultSettings,
      isHost: false,
      myPlayerId: null,
      myRole: null,
      acknowledged: false,
      acknowledgedCount: 0,
      totalPlayers: 0,
      withStory: false,
      selectedStoryId: null,
      timerPaused: false,
    });
  },
}));
