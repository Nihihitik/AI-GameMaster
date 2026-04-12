import { Session, SessionSettings, LobbyPlayer, Phase, MyPlayer, Player, RoleRevealInfo, Target, VoteInfo, GameResult } from './game';

// ---- Auth ----

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  has_pro: boolean;
  created_at: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

// ---- Sessions ----

export interface CreateSessionRequest {
  player_count: number;
  settings: SessionSettings;
}

export interface CreateSessionResponse extends Session {}

export interface GetSessionResponse extends Session {
  players: LobbyPlayer[];
}

export interface JoinSessionRequest {
  name: string;
}

export interface JoinSessionResponse {
  player_id: string;
  session_id: string;
  join_order: number;
}

export interface GetPlayersResponse {
  players: LobbyPlayer[];
}

export interface UpdateSettingsRequest {
  role_reveal_timer_seconds?: number;
  discussion_timer_seconds?: number;
  voting_timer_seconds?: number;
  night_action_timer_seconds?: number;
  role_config?: {
    mafia: number;
    sheriff: number;
    doctor: number;
  };
}

export interface UpdateSettingsResponse {
  settings: SessionSettings;
}

export interface StartSessionResponse {
  status: 'active';
  phase: {
    type: 'role_reveal';
    number: 0;
  };
}

// ---- Game ----

export interface GameStateResponse {
  session_status: 'active' | 'finished';
  phase: Phase;
  my_player: MyPlayer;
  players: Player[];
  role_reveal: RoleRevealInfo | null;
  awaiting_action: boolean;
  action_type: 'kill' | 'check' | 'heal' | 'vote' | null;
  available_targets: Target[] | null;
  my_action_submitted: boolean;
  votes: VoteInfo | null;
  result: GameResult | null;
}

export interface AcknowledgeRoleResponse {
  acknowledged: true;
  players_acknowledged: number;
  players_total: number;
}

export interface NightActionRequest {
  target_player_id: string;
}

export interface NightActionResponse {
  action_type: 'kill' | 'check' | 'heal';
  target_player_id: string;
  confirmed: true;
  check_result?: {
    team: 'mafia' | 'city';
  };
}

export interface VoteRequest {
  target_player_id: string | null;
}

export interface VoteResponse {
  voter_player_id: string;
  target_player_id: string | null;
  confirmed: true;
}

export interface RematchRequest {
  keep_players: boolean;
  settings?: Partial<SessionSettings>;
}

export interface RematchResponse {
  new_session_id: string;
  code: string;
  status: 'waiting' | 'active';
  players_kept: number;
}
