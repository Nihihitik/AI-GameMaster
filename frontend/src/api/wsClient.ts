import { WS_BASE_URL } from '../utils/constants';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useGameStore } from '../stores/gameStore';
import { SessionSettings } from '../types/game';
import { PlayerInList } from '../types/api';
import { logger } from '../services/logger';

/**
 * Синглтон WebSocket-клиента для игровой сессии.
 *
 * Контракт сообщений: §6 backend_documentation.md. Все игровые действия идут через REST,
 * WS — источник push-уведомлений от сервера об изменениях состояния.
 *
 * Вызываемые методы сторов (создаются параллельно другим агентом, см. §F8 плана):
 *   useSessionStore: upsertPlayer, removePlayer, setPlayers, setSettings, reset, loadByCode
 *   useGameStore:    onGameStarted, setMyRole, applyPhase, applyNightResult,
 *                    setVoteCounts, applyVoteResult, markEliminated,
 *                    setActionSubmitted, addCheckResult, queueAnnouncement, setResult
 */

type WsMessage = { type: string; payload?: unknown };
type WsPayloadRecord = Record<string, unknown>;

const PING_MESSAGE = JSON.stringify({ type: 'ping' });
const NO_RECONNECT_CODES = new Set([4000, 4001, 4003]);
const MAX_RECONNECT_ATTEMPTS = 15;

function isPayloadRecord(payload: unknown): payload is WsPayloadRecord {
  return typeof payload === 'object' && payload !== null;
}

function getPayloadString(payload: unknown, key: string): string | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

/** Локальный обработчик персонального кика: логаут не нужен, просто редирект и reset. */
function handleKicked() {
  try {
    useSessionStore.getState().reset();
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

// ---------------------------------------------------------------------------
// Handler map: каждый обработчик вызывает getState() только нужного стора.
// ---------------------------------------------------------------------------

const HANDLERS: Record<string, (payload: unknown) => void> = {
  player_joined: (payload) => {
    if (isPayloadRecord(payload)) {
      useSessionStore.getState().upsertPlayer(payload as unknown as PlayerInList);
    }
  },

  player_left: (payload) => {
    const playerId = getPayloadString(payload, 'player_id');
    if (playerId) {
      useSessionStore.getState().removePlayer(playerId);
    }
  },

  player_kicked: (payload) => {
    const playerId = getPayloadString(payload, 'player_id');
    if (playerId) {
      useSessionStore.getState().removePlayer(playerId);
    }
  },

  settings_updated: (payload) => {
    const settings = isPayloadRecord(payload) && 'settings' in payload
      ? payload.settings
      : payload;
    if (!isPayloadRecord(settings)) {
      return;
    }
    const sessionStore = useSessionStore.getState();
    if (typeof sessionStore.applySessionSettings === 'function') {
      sessionStore.applySessionSettings(settings as unknown as SessionSettings);
      return;
    }
    void sessionStore.setSettings(settings as Partial<SessionSettings>);
  },

  session_closed: () => {
    useSessionStore.getState().reset?.();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  },

  kicked: () => handleKicked(),

  game_started: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().onGameStarted(payload);
    }
  },

  role_assigned: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().setMyRole(payload);
    }
  },

  phase_changed: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().applyPhase(payload);
    }
  },

  action_required: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().applyActionRequired(payload);
    }
  },

  action_blocked: () => {
    useGameStore.getState().applyActionBlocked();
  },

  action_timeout: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().applyActionTimeout(payload);
    }
  },

  role_acknowledged: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().applyRoleAcknowledged(payload);
    }
  },

  all_acknowledged: () => {
    useGameStore.getState().applyAllAcknowledged();
  },

  night_result: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().applyNightResult(payload);
    }
  },

  vote_update: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().setVoteCounts(payload);
    }
  },

  vote_result: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().applyVoteResult(payload);
    }
  },

  player_eliminated: (payload) => {
    const playerId = getPayloadString(payload, 'player_id');
    if (playerId) {
      useGameStore.getState().markEliminated(playerId);
    }
  },

  action_confirmed: () => {
    useGameStore.getState().setActionSubmitted(true);
  },

  check_result: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().addCheckResult(payload);
    }
  },

  announcement: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().queueAnnouncement(payload);
    }
  },

  game_finished: (payload) => {
    if (isPayloadRecord(payload)) {
      useGameStore.getState().setResult(payload);
    }
  },

  game_paused: () => {
    if (!useSessionStore.getState().timerPaused) {
      useSessionStore.setState({ timerPaused: true });
    }
  },

  game_resumed: (payload) => {
    useSessionStore.setState({ timerPaused: false });
    if (isPayloadRecord(payload)) {
      useGameStore.getState().applyPhase(payload);
    }
  },

  session_reset: (payload) => {
    // Новая семантика: первый нажавший «Вернуться в лобби» становится хостом и
    // сбрасывает сессию. Остальные игроки остаются на FinaleScreen и сами решают:
    // нажать «Вернуться в лобби» (фронт вызовет reset_to_lobby → 403 → join) или
    // «На главную». Принудительный redirect отсюда удалён намеренно.
    const newHostUserId = getPayloadString(payload, 'new_host_user_id');
    if (newHostUserId) {
      useSessionStore.getState().applyHostTransfer(newHostUserId);
    }
  },

  host_transferred: (payload) => {
    const newHostUserId = getPayloadString(payload, 'new_host_user_id');
    const newHostPlayerId = getPayloadString(payload, 'new_host_player_id') ?? null;
    if (newHostUserId) {
      useSessionStore.getState().applyHostTransfer(newHostUserId, newHostPlayerId);
    }
  },

  pong: () => {},
};

class WsClient {
  private socket: WebSocket | null = null;
  private heartbeatId: number | null = null;
  private reconnectAttempts = 0;
  private currentSessionId: string | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  connect(sessionId: string): void {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    // Переиспользуем уже открытый сокет, если сессия совпадает.
    if (
      this.socket &&
      this.currentSessionId === sessionId &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Если был подключён к другой сессии — чисто отключимся.
    if (this.socket) {
      this.disconnect();
    }

    const url = `${WS_BASE_URL}/ws/sessions/${sessionId}?token=${encodeURIComponent(token)}`;
    this.currentSessionId = sessionId;
    this.socket = new WebSocket(url);

    this.socket.onmessage = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as unknown;
        if (!isPayloadRecord(parsed) || typeof parsed.type !== 'string') {
          logger.warn('ws.invalid_message', 'WebSocket received invalid message payload', {
            payload: parsed,
          }, { sessionId });
          return;
        }

        this.dispatch({
          type: parsed.type,
          payload: parsed.payload,
        });
      } catch (err) {
        logger.warn('ws.parse_failed', 'Failed to parse WebSocket message', {
          reason: err instanceof Error ? err.message : String(err),
          raw: e.data,
        }, { sessionId });
      }
    };

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      logger.info('ws.connected', 'WebSocket connected', { sessionId }, { sessionId });
      // Ре-синк состояния: после (re)connect дергаем /state, чтобы догнать
      // сообщения, которые backend мог отправить, пока сокет ещё не был в OPEN.
      const sid = this.currentSessionId;
      if (sid) {
        useGameStore
          .getState()
          .loadState(sid)
          .then(() => {
            logger.info('ws.resync_completed', 'Game state resync completed', { sessionId: sid }, { sessionId: sid });
          })
          .catch((err) => {
            logger.warn('ws.state_resync_failed', 'Game state resync failed', {
              reason: err instanceof Error ? err.message : String(err),
            }, { sessionId: sid });
          });
      }
    };

    this.socket.onclose = (e: CloseEvent) => this.handleClose(e);

    this.socket.onerror = (err: Event) => {
      logger.warn('ws.socket_error', 'WebSocket reported an error event', {
        type: err.type,
      }, { sessionId });
    };
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.socket) {
      try {
        this.socket.onclose = null;
        this.socket.onmessage = null;
        this.socket.onerror = null;
        this.socket.onopen = null;
        this.socket.close();
      } catch {
        // ignore
      }
    }
    this.socket = null;
    this.currentSessionId = null;
    this.reconnectAttempts = 0;
  }

  private dispatch(msg: WsMessage): void {
    const handler = HANDLERS[msg.type];
    if (handler) {
      handler(msg.payload);
    } else {
      logger.warn('ws.invalid_message', 'WebSocket received unknown message type', {
        type: msg.type,
        payload: msg.payload,
      }, { sessionId: this.currentSessionId });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatId = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(PING_MESSAGE);
        } catch (err) {
          logger.warn('ws.heartbeat_failed', 'WebSocket heartbeat send failed', {
            reason: err instanceof Error ? err.message : String(err),
          }, { sessionId: this.currentSessionId });
        }
      }
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatId !== null) {
      window.clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
  }

  private handleClose(e: CloseEvent): void {
    this.stopHeartbeat();
    // 4000 (kick), 4001 (bad token), 4003 (not in session) — не переподключаемся.
    if (NO_RECONNECT_CODES.has(e.code)) {
      this.socket = null;
      this.currentSessionId = null;
      return;
    }

    const sessionId = this.currentSessionId;
    if (!sessionId) return;

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.socket = null;
      this.currentSessionId = null;
      return;
    }

    // Экспоненциальный backoff: 500ms * 2^n, максимум 30s.
    const delay = Math.min(30_000, 500 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;
    logger.warn('ws.reconnect_scheduled', 'Scheduling WebSocket reconnect', {
      code: e.code,
      reason: e.reason,
      delay,
      attempt: this.reconnectAttempts,
    }, { sessionId });

    // Сбрасываем ссылку на мёртвый сокет, чтобы connect() мог создать новый.
    this.socket = null;

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      // Проверяем, не был ли disconnect() вызван за это время.
      if (this.currentSessionId === sessionId) {
        this.connect(sessionId);
      }
    }, delay);
  }
}

export const wsClient = new WsClient();
