import { create } from 'zustand';
import { Role, Player, Target, Announcement, VoteInfo, GameResult, Phase } from '../types/game';
import type { GameStateResponse, NightActionCheckResult } from '../types/api';
import { gameApi } from '../api/gameApi';
import { useSessionStore } from './sessionStore';

export type GameScreen =
  | 'syncing'
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

  // Night action
  awaitingAction: boolean;
  actionType: NightActionType | null;
  actionLabel: string;
  availableTargets: Target[];
  selectedTarget: string | null;
  actionSubmitted: boolean;
  checkResults: CheckResultEntry[];
  healRestriction: { player_id: string; name: string; reason: string } | null;

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
  if (sessionStatus === 'active' && !phaseType) return 'syncing';
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

function announcementIdentity(announcement: Announcement | null | undefined): string {
  if (!announcement?.text) return '';
  return `${announcement.key ?? ''}|${announcement.step_index ?? ''}|${announcement.text}`;
}

function sameAnnouncement(
  left: Announcement | null | undefined,
  right: Announcement | null | undefined,
): boolean {
  const leftId = announcementIdentity(left);
  return leftId !== '' && leftId === announcementIdentity(right);
}

function actionWindowIdentity(
  phase: Partial<Phase> | null | undefined,
  actionType: NightActionType | null | undefined,
): string {
  if (!phase?.type) return '';
  return [
    (phase as any)?.id ?? '',
    phase.type,
    phase.number ?? '',
    (phase as any)?.timer_started_at ?? '',
    actionType ?? '',
  ].join('|');
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
  awaitingAction: false,
  actionType: null,
  actionLabel: '',
  availableTargets: [],
  selectedTarget: null,
  actionSubmitted: false,
  checkResults: [],
  healRestriction: null,
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

    // Sync pause state and settings from backend into sessionStore.
    if ((data as any).game_paused != null) {
      useSessionStore.setState({ timerPaused: !!(data as any).game_paused });
    }
    // Hydrate session settings so timer fallback values are correct after refresh.
    if ((data as any).settings && typeof (data as any).settings === 'object') {
      const incoming = (data as any).settings;
      useSessionStore.setState((prev) => ({
        settings: { ...prev.settings, ...incoming, role_config: { ...prev.settings.role_config, ...(incoming.role_config || {}) } },
      }));
    }
    const announcement = (data as any).announcement ?? null;

    set((state) => {
      const nextAnnouncement = sameAnnouncement(state.currentAnnouncement, announcement)
        ? state.currentAnnouncement
        : announcement;
      const showNarrator = !!nextAnnouncement?.text && nextAnnouncement?.blocking !== false;
      const sameActionWindow =
        actionWindowIdentity(state.phase, state.actionType) === actionWindowIdentity(phase, actionType);

      return {
        sessionId,
        phase,
        screen: showNarrator ? 'narrator' : screen,
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
        selectedTarget: sameActionWindow ? state.selectedTarget : null,
        actionSubmitted: data.my_action_submitted || (sameActionWindow ? state.actionSubmitted : false),
        voteSubmitted: (data as any).my_vote_submitted || state.voteSubmitted,
        votes: data.votes ?? null,
        dayBlockedPlayer: data.day_blocked_player ?? null,
        // Не затираем финальный result при re-sync: /state не возвращает
        // result, но в памяти он уже мог быть установлен через WS game_finished.
        result: data.result ?? state.result ?? null,
        nightNumber: phase?.type === 'night' ? phase.number : state.nightNumber,
        dayNumber: phase?.type === 'day' ? phase.number : state.dayNumber,
        currentAnnouncement: nextAnnouncement,
      };
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
      const res = await gameApi.acknowledgeRole(state.sessionId);
      const body = res?.data ?? res;
      const acked = (body as any)?.players_acknowledged;
      const total = (body as any)?.players_total;
      set({
        acknowledged: true,
        ...(acked != null ? { acknowledgedCount: Number(acked) } : {}),
        ...(total != null ? { totalPlayers: Number(total) } : {}),
      });
    } catch {
      // Swallow — the local ack flag still flips so the user is not stuck.
      set({ acknowledged: true });
    }
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
  advanceNarrator: () => undefined,

  // --- WebSocket hooks -------------------------------------------------------

  onGameStarted: (payload) => {
    // Build phase from the game_started payload so timer_seconds is correct.
    const rawPhase = payload?.phase;
    const phase: Phase | null = rawPhase
      ? {
          ...rawPhase,
          sub_phase: rawPhase.sub_phase ?? null,
          timer_seconds: payload?.timer_seconds ?? rawPhase.timer_seconds ?? null,
          timer_started_at: payload?.started_at ?? rawPhase.timer_started_at ?? null,
        }
      : null;
    // Go straight to role_reveal — players read their cards first.
    // Rules narrator plays AFTER all acknowledge (via transition_to_night).
    set((state) => {
      if (
        state.phase &&
        state.phase.type !== 'role_reveal' &&
        state.screen !== 'finale'
      ) {
        return state;
      }

      return {
        phase,
        screen: 'role_reveal' as GameScreen,
        acknowledged: false,
        acknowledgedCount: 0,
        currentAnnouncement: null,
      };
    });
  },

  setMyRole: (payload) => {
    // payload may be either { role } or the raw role object
    const role: Role | null = payload?.role ?? payload ?? null;
    set({ myRole: role });
  },

  applyPhase: (payload) => {
    const rawPhase = payload?.phase ?? payload;
    const phase: Phase = {
      ...rawPhase,
      sub_phase: payload?.sub_phase ?? rawPhase?.sub_phase ?? null,
      timer_seconds: payload?.timer_seconds ?? rawPhase?.timer_seconds ?? null,
      timer_started_at: payload?.timer_started_at ?? rawPhase?.timer_started_at ?? null,
    };
    const sessionStatus = payload?.session_status;
    const awaitingAction: boolean = payload?.awaiting_action ?? false;
    const incomingActionType: NightActionType | null = payload?.action_type ?? null;
    const incomingTargets: Target[] = payload?.available_targets ?? [];
    const announcement: Announcement | null = payload?.announcement ?? null;

    set((state) => {
      if (state.screen === 'finale' || state.result) return state;
      const nextAnnouncement = sameAnnouncement(state.currentAnnouncement, announcement)
        ? state.currentAnnouncement
        : announcement;
      const sameActionWindow =
        actionWindowIdentity(state.phase, state.actionType) === actionWindowIdentity(phase, incomingActionType);
      const screen = nextAnnouncement?.text && nextAnnouncement?.blocking !== false
        ? 'narrator'
        : deriveScreen(phase?.type, phase?.sub_phase, awaitingAction, sessionStatus);

      return {
        phase,
        screen,
        currentAnnouncement: nextAnnouncement,
        awaitingAction,
        actionType: incomingActionType,
        actionLabel: actionLabelFor(incomingActionType),
        availableTargets: incomingTargets,
        selectedTarget: sameActionWindow ? state.selectedTarget : null,
        actionSubmitted: sameActionWindow ? state.actionSubmitted : false,
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
    const healRestriction = payload?.heal_restriction ?? null;
    set((state) => {
      if (state.screen === 'finale' || state.result) return state;
      const sameActionWindow =
        actionWindowIdentity(state.phase, state.actionType) ===
        actionWindowIdentity(
          {
            ...(state.phase ?? {}),
            timer_started_at: payload?.timer_started_at ?? state.phase?.timer_started_at ?? null,
          },
          actionType,
        );

      return {
        awaitingAction: true,
        actionType,
        actionLabel: actionLabelFor(actionType),
        availableTargets,
        selectedTarget: sameActionWindow ? state.selectedTarget : null,
        actionSubmitted: sameActionWindow ? state.actionSubmitted : false,
        healRestriction: sameActionWindow ? state.healRestriction ?? healRestriction : healRestriction,
        currentAnnouncement: null,
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
        currentAnnouncement: null,
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
    const total = payload?.players_total;
    set({
      acknowledgedCount: acked,
      ...(total != null ? { totalPlayers: Number(total) } : {}),
    });
  },

  applyAllAcknowledged: () => {
    set((state) => ({
      acknowledgedCount: state.totalPlayers,
    }));
  },

  applyNightResult: (payload) => {
    const died: { player_id: string; name: string }[] = payload?.died ?? [];
    const killedNames = died.map((d) => d.name).join(', ');
    const bpId = payload?.day_blocked_player ?? null;
    const announcement: Announcement | null = payload?.announcement ?? null;

    set((s) => {
      const nextAnnouncement = sameAnnouncement(s.currentAnnouncement, announcement)
        ? s.currentAnnouncement
        : announcement;
      const base = {
        nightKills: died.map((d) => ({ player_id: d.player_id, name: d.name })),
        nightResultDied: died,
        nightResultText: killedNames,
        dayBlockedPlayer: bpId,
        players: s.players.map((p) =>
          died.some((d) => d.player_id === p.id) ? { ...p, status: 'dead' as const } : p
        ),
        myStatus: died.some((d) => d.player_id === s.myPlayerId) ? ('dead' as const) : s.myStatus,
        currentAnnouncement: nextAnnouncement,
      };
      if (nextAnnouncement?.text && nextAnnouncement?.blocking !== false) {
        return {
          ...base,
          screen: 'narrator' as GameScreen,
        };
      }
      return base;
    });
  },

  setVoteCounts: (payload) => {
    // Backend vote_update sends votes_cast / votes_total;
    // /state response sends votes.cast / votes.total_expected.
    const cast: number = payload?.votes_cast ?? payload?.cast ?? 0;
    const total: number = payload?.votes_total ?? payload?.total_expected ?? 0;
    const counts: Record<string, number> = payload?.counts ?? {};
    set((state) => ({
      votes: { total_expected: total || state.totalPlayers, cast },
      voteCounts: counts,
    }));
  },

  applyVoteResult: (payload) => {
    const eliminated = payload?.eliminated ?? null;
    const eliminatedId: string | null = eliminated?.player_id ?? payload?.eliminated_player_id ?? null;
    const announcement: Announcement | null = payload?.announcement ?? null;

    set((state) => {
      const nextAnnouncement = sameAnnouncement(state.currentAnnouncement, announcement)
        ? state.currentAnnouncement
        : announcement;
      const base: any = {};
      if (eliminatedId) {
        base.players = state.players.map((p: any) =>
          p.id === eliminatedId ? { ...p, status: 'dead' as const } : p
        );
        base.myStatus = state.myPlayerId === eliminatedId ? 'dead' : state.myStatus;
      }
      base.currentAnnouncement = nextAnnouncement;
      if (nextAnnouncement?.text && nextAnnouncement?.blocking !== false) {
        return {
          ...base,
          screen: 'narrator' as GameScreen,
        };
      }
      return base;
    });
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
    set((state) => {
      const nextAnnouncement = sameAnnouncement(state.currentAnnouncement, announcement)
        ? state.currentAnnouncement
        : announcement;
      return {
        currentAnnouncement: nextAnnouncement,
        screen: nextAnnouncement?.blocking === false ? state.screen : 'narrator',
      };
    });
  },

  setResult: (payload) => {
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
    set({ result, screen: 'finale', currentAnnouncement: null });
  },

  reset: () => set({ ...initialState }),
}));
