import httpClient from './httpClient';
import type {
  CreateSessionRequest,
  SessionResponse,
  SessionDetailResponse,
  JoinSessionRequest,
  JoinSessionResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  PlayerInList,
} from '../types/api';

export const sessionApi = {
  create: (data: CreateSessionRequest) =>
    httpClient.post<SessionResponse>('/sessions', data),

  getByCode: (code: string) =>
    httpClient.get<SessionDetailResponse>(`/sessions/${code}`),

  join: (code: string, data: JoinSessionRequest) =>
    httpClient.post<JoinSessionResponse>(`/sessions/${code}/join`, data),

  getPlayers: (sessionId: string) =>
    httpClient.get<{ players: PlayerInList[] }>(`/sessions/${sessionId}/players`),

  leave: (sessionId: string) =>
    httpClient.delete(`/sessions/${sessionId}/players/me`),

  kick: (sessionId: string, playerId: string, confirm?: boolean) =>
    httpClient.delete(`/sessions/${sessionId}/players/${playerId}`, {
      params: confirm !== undefined ? { confirm } : undefined,
    }),

  close: (sessionId: string) =>
    httpClient.delete(`/sessions/${sessionId}`),

  updateSettings: (sessionId: string, data: UpdateSettingsRequest) =>
    httpClient.patch<UpdateSettingsResponse>(`/sessions/${sessionId}/settings`, data),

  pause: (sessionId: string) =>
    httpClient.post(`/sessions/${sessionId}/pause`),

  resume: (sessionId: string) =>
    httpClient.post(`/sessions/${sessionId}/resume`),
};
