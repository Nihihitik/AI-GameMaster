import { create } from 'zustand';
import { Role, Player, Target, Announcement, VoteInfo, GameResult } from '../types/game';

export type GameScreen =
  | 'role_reveal'
  | 'narrator'
  | 'night_action'
  | 'night_waiting'
  | 'day_discussion'
  | 'day_voting'
  | 'eliminated'
  | 'finale';

export interface CheckResultEntry {
  targetId: string;
  team: 'mafia' | 'city';
}

interface GameState {
  screen: GameScreen;
  sessionId: string | null;
  nightNumber: number;
  dayNumber: number;

  // My player
  myPlayerId: string | null;
  myRole: Role | null;
  myStatus: 'alive' | 'dead';

  // Players
  players: Player[];

  // Role reveal
  acknowledged: boolean;
  acknowledgedCount: number;
  totalPlayers: number;

  // Narrator
  currentAnnouncement: Announcement | null;
  pendingScreen: GameScreen | null;
  narratorTexts: string[];
  narratorIndex: number;

  // Night action
  awaitingAction: boolean;
  actionType: 'kill' | 'check' | 'heal' | 'don_check' | 'lover_visit' | 'maniac_kill' | null;
  actionLabel: string;
  availableTargets: Target[];
  selectedTarget: string | null;
  actionSubmitted: boolean;
  checkResults: CheckResultEntry[];
  mafiaSkippedKill: boolean;
  mafiaCanSkip: boolean;
  doctorLastHealed: string | null;
  doctorSelfHealUsed: boolean;

  // Night results tracking
  nightKills: { player_id: string; name: string; killer: string }[];
  nightHealed: string | null;
  loverTarget: string | null;
  loverBlocked: string | null;

  // Day
  nightResultDied: { player_id: string; name: string }[] | null;
  nightResultText: string;
  votes: VoteInfo | null;
  voteSubmitted: boolean;
  voteTarget: string | null;
  voteCounts: Record<string, number>;
  dayBlockedPlayer: string | null;

  // Finale
  result: GameResult | null;

  // Active roles in session
  activeRoles: string[];

  // All roles assignment (for mock)
  allRolesAssignment: Record<string, Role>;

  // Actions
  setScreen: (screen: GameScreen) => void;
  setSessionId: (id: string) => void;
  setMyPlayerId: (id: string) => void;
  setMyRole: (role: Role) => void;
  setMyStatus: (status: 'alive' | 'dead') => void;
  setPlayers: (players: Player[]) => void;
  updatePlayerStatus: (playerId: string, status: 'alive' | 'dead') => void;
  setAcknowledged: (value: boolean) => void;
  setAcknowledgedCount: (count: number) => void;
  setTotalPlayers: (count: number) => void;
  showNarrator: (texts: string[], pendingScreen: GameScreen) => void;
  advanceNarrator: () => void;
  setAwaitingAction: (value: boolean) => void;
  setActionType: (type: GameState['actionType']) => void;
  setActionLabel: (label: string) => void;
  setAvailableTargets: (targets: Target[]) => void;
  setSelectedTarget: (targetId: string | null) => void;
  setActionSubmitted: (value: boolean) => void;
  addCheckResult: (entry: CheckResultEntry) => void;
  setMafiaSkippedKill: (value: boolean) => void;
  setMafiaCanSkip: (value: boolean) => void;
  setDoctorLastHealed: (id: string | null) => void;
  setDoctorSelfHealUsed: (value: boolean) => void;
  setNightKills: (kills: GameState['nightKills']) => void;
  addNightKill: (kill: { player_id: string; name: string; killer: string }) => void;
  setNightHealed: (id: string | null) => void;
  setLoverTarget: (id: string | null) => void;
  setLoverBlocked: (id: string | null) => void;
  setNightResultDied: (died: { player_id: string; name: string }[] | null) => void;
  setNightResultText: (text: string) => void;
  setVotes: (votes: VoteInfo | null) => void;
  setVoteSubmitted: (value: boolean) => void;
  setVoteTarget: (id: string | null) => void;
  setVoteCounts: (counts: Record<string, number>) => void;
  addVote: (targetId: string) => void;
  setDayBlockedPlayer: (id: string | null) => void;
  setResult: (result: GameResult) => void;
  setNightNumber: (n: number) => void;
  setDayNumber: (n: number) => void;
  setActiveRoles: (roles: string[]) => void;
  setAllRolesAssignment: (assignment: Record<string, Role>) => void;
  resetNightState: () => void;
  resetDayState: () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'role_reveal',
  sessionId: null,
  nightNumber: 0,
  dayNumber: 0,
  myPlayerId: null,
  myRole: null,
  myStatus: 'alive',
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
  mafiaSkippedKill: false,
  mafiaCanSkip: true,
  doctorLastHealed: null,
  doctorSelfHealUsed: false,
  nightKills: [],
  nightHealed: null,
  loverTarget: null,
  loverBlocked: null,
  nightResultDied: null,
  nightResultText: '',
  votes: null,
  voteSubmitted: false,
  voteTarget: null,
  voteCounts: {},
  dayBlockedPlayer: null,
  result: null,
  activeRoles: [],
  allRolesAssignment: {},

  setScreen: (screen) => set({ screen }),
  setSessionId: (sessionId) => set({ sessionId }),
  setMyPlayerId: (myPlayerId) => set({ myPlayerId }),
  setMyRole: (myRole) => set({ myRole }),
  setMyStatus: (myStatus) => set({ myStatus }),
  setPlayers: (players) => set({ players }),
  updatePlayerStatus: (playerId, status) => set((s) => ({
    players: s.players.map((p) => p.id === playerId ? { ...p, status } : p),
    myStatus: s.myPlayerId === playerId ? status : s.myStatus,
  })),
  setAcknowledged: (acknowledged) => set({ acknowledged }),
  setAcknowledgedCount: (acknowledgedCount) => set({ acknowledgedCount }),
  setTotalPlayers: (totalPlayers) => set({ totalPlayers }),
  showNarrator: (narratorTexts, pendingScreen) => set({
    screen: 'narrator',
    narratorTexts,
    narratorIndex: 0,
    pendingScreen,
  }),
  advanceNarrator: () => {
    const s = get();
    if (s.narratorIndex < s.narratorTexts.length - 1) {
      set({ narratorIndex: s.narratorIndex + 1 });
    } else if (s.pendingScreen) {
      set({ screen: s.pendingScreen, pendingScreen: null });
    }
  },
  setAwaitingAction: (awaitingAction) => set({ awaitingAction }),
  setActionType: (actionType) => set({ actionType }),
  setActionLabel: (actionLabel) => set({ actionLabel }),
  setAvailableTargets: (availableTargets) => set({ availableTargets }),
  setSelectedTarget: (selectedTarget) => set({ selectedTarget }),
  setActionSubmitted: (actionSubmitted) => set({ actionSubmitted }),
  addCheckResult: (entry) => set((s) => ({
    checkResults: [...s.checkResults, entry],
  })),
  setMafiaSkippedKill: (mafiaSkippedKill) => set({ mafiaSkippedKill }),
  setMafiaCanSkip: (mafiaCanSkip) => set({ mafiaCanSkip }),
  setDoctorLastHealed: (doctorLastHealed) => set({ doctorLastHealed }),
  setDoctorSelfHealUsed: (doctorSelfHealUsed) => set({ doctorSelfHealUsed }),
  setNightKills: (nightKills) => set({ nightKills }),
  addNightKill: (kill) => set((s) => ({ nightKills: [...s.nightKills, kill] })),
  setNightHealed: (nightHealed) => set({ nightHealed }),
  setLoverTarget: (loverTarget) => set({ loverTarget }),
  setLoverBlocked: (loverBlocked) => set({ loverBlocked }),
  setNightResultDied: (nightResultDied) => set({ nightResultDied }),
  setNightResultText: (nightResultText) => set({ nightResultText }),
  setVotes: (votes) => set({ votes }),
  setVoteSubmitted: (voteSubmitted) => set({ voteSubmitted }),
  setVoteTarget: (voteTarget) => set({ voteTarget }),
  setVoteCounts: (voteCounts) => set({ voteCounts }),
  addVote: (targetId) => set((s) => {
    const counts = { ...s.voteCounts };
    counts[targetId] = (counts[targetId] || 0) + 1;
    const cast = (s.votes?.cast || 0) + 1;
    return {
      voteCounts: counts,
      votes: s.votes ? { ...s.votes, cast } : { total_expected: s.totalPlayers, cast },
    };
  }),
  setDayBlockedPlayer: (dayBlockedPlayer) => set({ dayBlockedPlayer }),
  setResult: (result) => set({ result, screen: 'finale' }),
  setNightNumber: (nightNumber) => set({ nightNumber }),
  setDayNumber: (dayNumber) => set({ dayNumber }),
  setActiveRoles: (activeRoles) => set({ activeRoles }),
  setAllRolesAssignment: (allRolesAssignment) => set({ allRolesAssignment }),
  resetNightState: () => set({
    awaitingAction: false,
    actionType: null,
    actionLabel: '',
    availableTargets: [],
    selectedTarget: null,
    actionSubmitted: false,
    nightKills: [],
    nightHealed: null,
    loverTarget: null,
    loverBlocked: null,
  }),
  resetDayState: () => set({
    voteSubmitted: false,
    voteTarget: null,
    voteCounts: {},
    dayBlockedPlayer: null,
    nightResultDied: null,
    nightResultText: '',
  }),
  reset: () => set({
    screen: 'role_reveal',
    sessionId: null,
    nightNumber: 0,
    dayNumber: 0,
    myPlayerId: null,
    myRole: null,
    myStatus: 'alive',
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
    mafiaSkippedKill: false,
    mafiaCanSkip: true,
    doctorLastHealed: null,
    doctorSelfHealUsed: false,
    nightKills: [],
    nightHealed: null,
    loverTarget: null,
    loverBlocked: null,
    nightResultDied: null,
    nightResultText: '',
    votes: null,
    voteSubmitted: false,
    voteTarget: null,
    voteCounts: {},
    dayBlockedPlayer: null,
    result: null,
    activeRoles: [],
    allRolesAssignment: {},
  }),
}));
