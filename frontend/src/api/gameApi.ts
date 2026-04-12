import httpClient from './httpClient';
import type {
  StartSessionResponse,
  AcknowledgeRoleResponse,
  NightActionRequest,
  NightActionResponse,
  VoteRequest,
  VoteResponse,
  GameStateResponse,
} from '../types/api';

export const gameApi = {
  start: (sessionId: string) =>
    httpClient.post<StartSessionResponse>(`/sessions/${sessionId}/start`),

  acknowledgeRole: (sessionId: string) =>
    httpClient.post<AcknowledgeRoleResponse>(`/sessions/${sessionId}/acknowledge-role`),

  nightAction: (sessionId: string, target_player_id: string) => {
    const body: NightActionRequest = { target_player_id };
    return httpClient.post<NightActionResponse>(`/sessions/${sessionId}/night-action`, body);
  },

  vote: (sessionId: string, target_player_id: string | null) => {
    const body: VoteRequest = { target_player_id };
    return httpClient.post<VoteResponse>(`/sessions/${sessionId}/vote`, body);
  },

  getState: (sessionId: string) =>
    httpClient.get<GameStateResponse>(`/sessions/${sessionId}/state`),
};
