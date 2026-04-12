import { create } from 'zustand';
import { Role, Player, Target, Announcement, VoteInfo, GameResult, Phase } from '../types/game';
import type { GameStateResponse, NightActionCheckResult } from '../types/api';
import { gameApi } from '../api/gameApi';

export type GameScreen =
  | 'role_reveal'
  | 'narrator'
  | 'night_action'
  | 'night_waiting'
  | 'day_discussion'
  | 'day_voting'
  | 'eliminated'
  | 'finale';

export type NightActionType =
  | 'kill'
  | 'check'
  | 'heal'
  | 'don_check'
  | 'lover_visit'
  | 'maniac_kill';

export interface CheckResultEntry {
  targetId: string;
  team?: 'mafia' | 'city' | 'maniac';
  isSheriff?: boolean;
  actionType: NightActionType;
}

export interface NightKill {
  player_id: string;
  name: string;
  killer?: string;
}

interface GameState {
  screen: GameScreen;
  sessionId: string | null;
  phase: Phase | null;
  nightNumber: number;
  dayNumber: number;

  // My player
  myPlayerId: string | null;
  myRole: Role | null;
  myStatus: 'alive' | 'dead';
  myIsBlockedTonight: boolean;

  // Players
  players: Player[];

  // Role reveal
  acknowledged: boolean;
  acknowledgedCount: number;
  totalPlayers: number;

  // Narrator / announcements
  currentAnnouncement: Announcement | null;
  pendingScreen: GameScreen | null;
  narratorTexts: string[];
  narratorIndex: number;

  // Night action
  awaitingAction: boolean;
  actionType: NightActionType | null;
  actionLabel: string;
  availableTargets: Target[];
  selectedTarget: string | null;
  actionSubmitted: boolean;
  checkResults: CheckResultEntry[];

  // Night result tracking
  nightKills: NightKill[];
  nightResultDied: { player_id: string; name: string }[] | null;
  nightResultText: string;

  // Day
  votes: VoteInfo | null;
  voteSubmitted: boolean;
  voteTarget: string | null;
  voteCounts: Record<string, number>;
  dayBlockedPlayer: string | null;

  // Finale
  result: GameResult | null;

  // Actions — loaders / submitters
  loadState: (sessionId: string) => Promise<void>;
  submitNightAction: (targetId: string) => Promise<void>;
  submitVote: (targetId: string | null) => Promise<void>;
  acknowledgeRole: () => Promise<void>;

  // Plain setters (still used by screen-local logic)
  setScreen: (screen: GameScreen) => void;
  setSessionId: (id: string) => void;
  setMyPlayerId: (id: string) => void;
  setPlayers: (players: Player[]) => void;
  updatePlayerStatus: (playerId: string, status: 'alive' | 'dead') => void;
  setSelectedTarget: (targetId: string | null) => void;
  advanceNarrator: () => void;

  // WebSocket hooks
  onGameStarted: (payload: any) => void;
  setMyRole: (payload: any) => void;
  applyPhase: (payload: any) => void;
  applyActionRequired: (payload: any) => void;
  applyActionBlocked: (payload: any) => void;
  applyActionTimeout: (payload: any) => void;
  applyRoleAcknowledged: (payload: any) => void;
  applyAllAcknowledged: () => void;
  applyNightResult: (payload: any) => void;
  setVoteCounts: (payload: any) => void;
  applyVoteResult: (payload: any) => void;
  markEliminated: (playerId: string) => void;
  setActionSubmitted: (value: boolean) => void;
  addCheckResult: (payload: any) => void;
  queueAnnouncement: (payload: any) => void;
  setResult: (payload: any) => void;

  reset: () => void;
}

/**
 * Map backend phase.type/sub_phase + awaiting_action to frontend GameScreen.
 */
function deriveScreen(
  phaseType: Phase['type'] | 'finished' | undefined,
  subPhase: Phase['sub_phase'] | undefined,
  awaitingAction: boolean,
  sessionStatus?: 'active' | 'finished' | 'waiting',
): GameScreen {
  if (sessionStatus === 'finished' || phaseType === ('finished' as any)) {
    return 'finale';
  }
  if (phaseType === 'role_reveal') return 'role_reveal';
  if (phaseType === 'night') {
    return awaitingAction ? 'night_action' : 'night_waiting';
  }
  if (phaseType === 'day') {
    if (subPhase === 'voting') return 'day_voting';
    return 'day_discussion';
  }
  return 'role_reveal';
}

function actionLabelFor(type: NightActionType | null): string {
  switch (type) {
    case 'kill': return 'Выберите цель';
    case 'check': return 'Кого проверить?';
    case 'don_check': return 'Кого проверить на роль шерифа?';
    case 'heal': return 'Кого вылечить?';
    case 'lover_visit': return 'Кого посетить?';
    case 'maniac_kill': return 'Выберите жертву';
    default: return '';
  }
}

const initialState = {
  screen: 'role_reveal' as GameScreen,
  sessionId: null,
  phase: null,
  nightNumber: 0,
  dayNumber: 0,
  myPlayerId: null,
  myRole: null,
  myStatus: 'alive' as const,
  myIsBlockedTonight: false,
  players: [],
  acknowledged: false,
  acknowledgedCount: 0,
  totalPlayers: 0,
  currentAnnouncement: null,
  pendingScreen: null,
  narratorTexts: [],
  narratorIndex: 0,
  awaitingAction: false,
  actionType: null,
  actionLabel: '',
  availableTargets: [],
  selectedTarget: null,
  actionSubmitted: false,
  checkResults: [],
  nightKills: [],
  nightResultDied: null,
  nightResultText: '',
  votes: null,
  voteSubmitted: false,
  voteTarget: null,
  voteCounts: {},
  dayBlockedPlayer: null,
  result: null,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,

  loadState: async (sessionId) => {
    const response = await gameApi.getState(sessionId);
    const data: GameStateResponse = response.data;

    const phase = data.phase;
    const screen = deriveScreen(
      phase?.type,
      phase?.sub_phase,
      data.awaiting_action,
      data.session_status,
    );

    const myPlayer = data.my_player;
    const actionType = (data.action_type as NightActionType | null) ?? null;

    set({
      sessionId,
      phase,
      screen,
      myPlayerId: myPlayer?.id ?? null,
      myRole: myPlayer?.role ?? null,
      myStatus: myPlayer?.status ?? 'alive',
      myIsBlockedTonight: myPlayer?.is_blocked_tonight ?? false,
      players: data.players ?? [],
      totalPlayers: (data.players ?? []).length,
      acknowledged: data.role_reveal?.my_acknowledged ?? false,
      acknowledgedCount: data.role_reveal?.players_acknowledged ?? 0,
      awaitingAction: data.awaiting_action,
      actionType,
      actionLabel: actionLabelFor(actionType),
      availableTargets: data.available_targets ?? [],
      actionSubmitted: data.my_action_submitted || get().actionSubmitted,
      votes: data.votes ?? null,
      dayBlockedPlayer: data.day_blocked_player ?? null,
      // Не затираем финальный result при re-sync: /state не возвращает
      // result, но в памяти он уже мог быть установлен через WS game_finished.
      result: data.result ?? get().result ?? null,
      nightNumber: phase?.type === 'night' ? phase.number : get().nightNumber,
      dayNumber: phase?.type === 'day' ? phase.number : get().dayNumber,
    });
  },

  submitNightAction: async (targetId) => {
    const state = get();
    if (!state.sessionId) return;
    const response = await gameApi.nightAction(state.sessionId, targetId);
    const data = response.data;
    // Mark submitted locally; real result may arrive via WS too.
    set({ actionSubmitted: true, selectedTarget: targetId });
    // If backend returns check_result inline (for sheriff/don), store it.
    if (data?.check_result && state.actionType) {
      const entry: CheckResultEntry = {
        targetId,
        actionType: state.actionType,
        team: data.check_result.team,
        isSheriff: data.check_result.is_sheriff ?? data.check_result.match,
      };
      set((s) => ({ checkResults: [...s.checkResults, entry] }));
    }
  },

  submitVote: async (targetId) => {
    const state = get();
    if (!state.sessionId) return;
    await gameApi.vote(state.sessionId, targetId);
    set({ voteSubmitted: true, voteTarget: targetId });
  },

  acknowledgeRole: async () => {
    const state = get();
    if (!state.sessionId) return;
    try {
      await gameApi.acknowledgeRole(state.sessionId);
    } catch {
      // Swallow — the local ack flag still flips so the user is not stuck.
    }
    set({ acknowledged: true });
  },

  setScreen: (screen) => set({ screen }),
  setSessionId: (sessionId) => set({ sessionId }),
  setMyPlayerId: (myPlayerId) => set({ myPlayerId }),
  setPlayers: (players) => set({ players, totalPlayers: players.length }),
  updatePlayerStatus: (playerId, status) => set((s) => ({
    players: s.players.map((p) => p.id === playerId ? { ...p, status } : p),
    myStatus: s.myPlayerId === playerId ? status : s.myStatus,
  })),
  setSelectedTarget: (selectedTarget) => set({ selectedTarget }),
  advanceNarrator: () => {
    const s = get();
    if (s.narratorIndex < s.narratorTexts.length - 1) {
      set({ narratorIndex: s.narratorIndex + 1 });
    } else if (s.pendingScreen) {
      set({ screen: s.pendingScreen, pendingScreen: null });
    }
  },

  // --- WebSocket hooks -------------------------------------------------------

  onGameStarted: (_payload) => {
    set({
      screen: 'role_reveal',
      acknowledged: false,
      acknowledgedCount: 0,
    });
  },

  setMyRole: (payload) => {
    // payload may be either { role } or the raw role object
    const role: Role | null = payload?.role ?? payload ?? null;
    set({ myRole: role });
  },

  applyPhase: (payload) => {
    const phase: Phase = payload?.phase ?? payload;
    const sessionStatus = payload?.session_status;
    const hasActionData = payload && 'awaiting_action' in payload;
    const incomingAwaiting: boolean = payload?.awaiting_action ?? false;
    const incomingActionType: NightActionType | null = payload?.action_type ?? null;
    const incomingTargets: Target[] = payload?.available_targets ?? [];

    set((state) => {
      // Finale — терминальный экран. Никакие поздние phase_changed от бэка
      // (например, при гонке с game_finished) не должны выкинуть игрока обратно
      // в day/night UI.
      if (state.screen === 'finale' || state.result) return state;

      const samePhase =
        state.phase?.type === phase?.type &&
        state.phase?.number === phase?.number &&
        state.phase?.sub_phase === phase?.sub_phase;
      const preserveAction = !hasActionData && samePhase && state.awaitingAction;

      const awaitingAction = hasActionData
        ? incomingAwaiting
        : preserveAction
          ? state.awaitingAction
          : false;
      const actionType = hasActionData
        ? incomingActionType
        : preserveAction
          ? state.actionType
          : null;
      const availableTargets = hasActionData
        ? incomingTargets
        : preserveAction
          ? state.availableTargets
          : [];
      const actionSubmitted = preserveAction ? state.actionSubmitted : false;
      const selectedTarget = preserveAction ? state.selectedTarget : null;

      const screen = deriveScreen(
        phase?.type,
        phase?.sub_phase,
        awaitingAction,
        sessionStatus,
      );

      return {
        phase,
        screen,
        awaitingAction,
        actionType,
        actionLabel: actionLabelFor(actionType),
        availableTargets,
        selectedTarget,
        actionSubmitted,
        voteSubmitted:
          phase?.type === 'day' && phase?.sub_phase === 'voting' ? false : state.voteSubmitted,
        voteTarget:
          phase?.type === 'day' && phase?.sub_phase === 'voting' ? null : state.voteTarget,
        voteCounts:
          phase?.type === 'day' && phase?.sub_phase === 'voting' ? {} : state.voteCounts,
        nightNumber: phase?.type === 'night' ? phase.number : state.nightNumber,
        dayNumber: phase?.type === 'day' ? phase.number : state.dayNumber,
      };
    });
  },

  applyActionRequired: (payload) => {
    const actionType: NightActionType | null = payload?.action_type ?? null;
    const availableTargets: Target[] = payload?.available_targets ?? [];
    set((state) => {
      if (state.screen === 'finale' || state.result) return state;
      return {
        awaitingAction: true,
        actionType,
        actionLabel: actionLabelFor(actionType),
        availableTargets,
        selectedTarget: null,
        actionSubmitted: false,
        screen: state.phase?.type === 'night' ? 'night_action' : state.screen,
      };
    });
  },

  applyActionBlocked: (_payload) => {
    set((state) => {
      if (state.screen === 'finale' || state.result) return state;
      return {
        awaitingAction: false,
        actionType: null,
        actionLabel: '',
        availableTargets: [],
        selectedTarget: null,
        actionSubmitted: false,
        screen: state.phase?.type === 'night' ? 'night_waiting' : state.screen,
      };
    });
  },

  applyActionTimeout: (payload) => {
    const TURN_TO_ACTION: Record<string, NightActionType> = {
      lover: 'lover_visit',
      mafia: 'kill',
      don: 'don_check',
      sheriff: 'check',
      doctor: 'heal',
      maniac: 'maniac_kill',
    };
    const turnSlug = payload?.action_type as string | undefined;
    const mappedActionType = turnSlug ? TURN_TO_ACTION[turnSlug] : null;
    set((state) => {
      if (!state.awaitingAction) return state;
      if (mappedActionType && state.actionType === mappedActionType) {
        return {
          ...state,
          awaitingAction: false,
          selectedTarget: null,
          screen: 'night_waiting',
        };
      }
      return state;
    });
  },

  applyRoleAcknowledged: (payload) => {
    const acked = Number(payload?.players_acknowledged ?? 0);
    set({ acknowledgedCount: acked });
  },

  applyAllAcknowledged: () => {
    set((state) => ({
      acknowledgedCount: state.totalPlayers,
    }));
  },

  applyNightResult: (payload) => {
    const died: { player_id: string; name: string }[] = payload?.died ?? [];
    const killedNames = died.map((d) => d.name).join(', ');
    set((state) => ({
      nightKills: died.map((d) => ({ player_id: d.player_id, name: d.name })),
      nightResultDied: died,
      nightResultText: killedNames,
      dayBlockedPlayer: payload?.day_blocked_player ?? null,
      // Apply dead status update to players list.
      players: state.players.map((p) =>
        died.some((d) => d.player_id === p.id) ? { ...p, status: 'dead' as const } : p
      ),
      myStatus: died.some((d) => d.player_id === state.myPlayerId) ? 'dead' : state.myStatus,
    }));
  },

  setVoteCounts: (payload) => {
    const cast: number = payload?.cast ?? 0;
    const total: number = payload?.total_expected ?? 0;
    const counts: Record<string, number> = payload?.counts ?? {};
    set((state) => ({
      votes: { total_expected: total || state.totalPlayers, cast },
      voteCounts: counts,
    }));
  },

  applyVoteResult: (payload) => {
    const eliminatedId: string | null = payload?.eliminated_player_id ?? null;
    if (!eliminatedId) return;
    set((state) => ({
      players: state.players.map((p) =>
        p.id === eliminatedId ? { ...p, status: 'dead' as const } : p
      ),
      myStatus: state.myPlayerId === eliminatedId ? 'dead' : state.myStatus,
    }));
  },

  markEliminated: (playerId) => {
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, status: 'dead' as const } : p
      ),
      myStatus: state.myPlayerId === playerId ? 'dead' : state.myStatus,
    }));
  },

  setActionSubmitted: (value) => set({ actionSubmitted: value }),

  addCheckResult: (payload) => {
    const targetId: string = payload?.target_player_id ?? payload?.targetId;
    if (!targetId) return;
    const result: NightActionCheckResult = payload?.check_result ?? payload;
    const state = get();
    const entry: CheckResultEntry = {
      targetId,
      actionType: (payload?.action_type ?? state.actionType) as NightActionType,
      team: result?.team,
      isSheriff: result?.is_sheriff ?? result?.match,
    };
    set((s) => ({ checkResults: [...s.checkResults, entry] }));
  },

  queueAnnouncement: (payload) => {
    const announcement: Announcement = payload?.announcement ?? payload;
    set({ currentAnnouncement: announcement });
  },

  setResult: (payload) => {
    // Payload is expected in shape { winner, announcement, players (final_roster) }.
    const winner = payload?.winner ?? null;
    const announcement: Announcement = payload?.announcement ?? {
      audio_url: '',
      text: '',
      duration_ms: 0,
    };
    const roster = payload?.final_roster ?? payload?.players ?? [];
    const result: GameResult = {
      winner,
      announcement,
      players: roster,
    };
    set({ result, screen: 'finale' });
  },

  reset: () => set({ ...initialState }),
}));
