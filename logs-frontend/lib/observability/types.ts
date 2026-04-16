export type SessionStatus = "waiting" | "active" | "finished";

export interface ObservedSession {
  id: string;
  code: string;
  status: SessionStatus;
  player_count: number;
  joined_count: number;
  host_user_id: string;
  host_email: string | null;
  host_display_name: string | null;
  created_at: string | null;
  ended_at: string | null;
}

export interface SessionsListResponse {
  sessions: ObservedSession[];
  total: number;
}
