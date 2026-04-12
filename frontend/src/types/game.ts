export interface Role {
  slug?: string;         // backend stable identifier: "mafia", "don", "sheriff", ...
  name: string;          // "Мафия", "Шериф", "Доктор", "Мирный", "Дон"
  team: 'mafia' | 'city' | 'maniac';
  abilities?: {
    night_action: 'kill' | 'check' | 'heal' | 'don_check' | 'lover_visit' | 'maniac_kill' | null;
  };
}

export interface Player {
  id: string;            // UUID (player_id)
  name: string;
  status: 'alive' | 'dead';
  join_order: number;
}

export interface PlayerWithRole extends Player {
  role: { slug?: string; name: string; team: 'mafia' | 'city' | 'maniac' };
}

export interface Phase {
  id: string;
  type: 'role_reveal' | 'night' | 'day';
  number: number;
  sub_phase: 'discussion' | 'voting' | null;
  started_at: string;         // ISO 8601
  timer_seconds: number | null;
  timer_started_at: string | null; // ISO 8601
}

export interface Announcement {
  audio_url: string;
  text: string;
  duration_ms: number;
}

export interface MyPlayer {
  id: string;
  name: string;
  status: 'alive' | 'dead';
  role: Role;
}

export interface Target {
  player_id: string;
  name: string;
}

export interface RoleRevealInfo {
  my_acknowledged: boolean;
  players_acknowledged: number;
  players_total: number;
}

export interface VoteInfo {
  total_expected: number;
  cast: number;
}

export interface GameResult {
  winner: 'mafia' | 'city' | 'maniac' | null;
  announcement: Announcement;
  players: PlayerWithRole[];
}

export interface RoleConfig {
  mafia: number;     // 0–2
  don: number;       // 0–2
  sheriff: number;   // 0–2
  doctor: number;    // 0–2
  lover: number;     // 0–2
  maniac: number;    // 0–2
}

export interface SessionSettings {
  role_reveal_timer_seconds: number;
  discussion_timer_seconds: number;
  voting_timer_seconds: number;
  night_action_timer_seconds: number;
  role_config: RoleConfig;
}

export interface Session {
  id: string;
  code: string;
  host_user_id: string;
  player_count: number;
  status: 'waiting' | 'active' | 'finished';
  settings: SessionSettings;
  created_at: string;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  join_order: number;
  is_host: boolean;
}
