import { WS_BASE_URL } from '../utils/constants';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useGameStore } from '../stores/gameStore';

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

type WsMessage = { type: string; payload: any };

/** Локальный обработчик персонального кика: логаут не нужен, просто редирект и reset. */
function handleKicked(_payload: any) {
  // Отвязываем текущую сессию из сторов.
  try {
    // reset sessionStore (метод добавит другой агент)
    (useSessionStore.getState() as any).reset?.();
  } catch {
    // ignore
  }
  // Перенаправляем пользователя на главную.
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

class WsClient {
  private socket: WebSocket | null = null;
  private heartbeatId: number | null = null;
  private reconnectAttempts = 0;
  private currentSessionId: string | null = null;

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
        const parsed: WsMessage = JSON.parse(e.data);
        this.dispatch(parsed);
      } catch (err) {
        console.warn('[wsClient] failed to parse message', err, e.data);
      }
    };

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      // Ре-синк состояния: после (re)connect дергаем /state, чтобы догнать
      // сообщения, которые backend мог отправить, пока сокет ещё не был в OPEN.
      const sid = this.currentSessionId;
      if (sid) {
        useGameStore
          .getState()
          .loadState(sid)
          .catch((err) => {
            console.warn('[wsClient] state resync failed', err);
          });
      }
    };

    this.socket.onclose = (e: CloseEvent) => this.handleClose(e);

    this.socket.onerror = (err: Event) => {
      console.warn('[wsClient] socket error', err);
    };
  }

  disconnect(): void {
    this.stopHeartbeat();
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
    const sessionStore = useSessionStore.getState() as any;
    const gameStore = useGameStore.getState() as any;

    switch (msg.type) {
      case 'player_joined':
        return sessionStore.upsertPlayer?.(msg.payload);

      case 'player_left':
      case 'player_kicked':
        return sessionStore.removePlayer?.(msg.payload?.player_id);

      case 'settings_updated': {
        // Hook: either applySessionSettings (preferred, local-only setter)
        // or setSettings (may be an async API call in the current store).
        const settings = msg.payload?.settings ?? msg.payload;
        if (typeof sessionStore.applySessionSettings === 'function') {
          return sessionStore.applySessionSettings(settings);
        }
        return sessionStore.setSettings?.(settings);
      }

      case 'session_closed':
        sessionStore.reset?.();
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
        return;

      case 'kicked':
        return handleKicked(msg.payload);

      case 'game_started':
        return gameStore.onGameStarted?.(msg.payload);

      case 'role_assigned':
        return gameStore.setMyRole?.(msg.payload);

      case 'phase_changed':
        return gameStore.applyPhase?.(msg.payload);

      case 'action_required':
        return gameStore.applyActionRequired?.(msg.payload);

      case 'action_blocked':
        return gameStore.applyActionBlocked?.(msg.payload);

      case 'action_timeout':
        return gameStore.applyActionTimeout?.(msg.payload);

      case 'role_acknowledged':
        return gameStore.applyRoleAcknowledged?.(msg.payload);

      case 'all_acknowledged':
        return gameStore.applyAllAcknowledged?.();

      case 'night_result':
        return gameStore.applyNightResult?.(msg.payload);

      case 'vote_update':
        return gameStore.setVoteCounts?.(msg.payload);

      case 'vote_result':
        return gameStore.applyVoteResult?.(msg.payload);

      case 'player_eliminated':
        return gameStore.markEliminated?.(msg.payload?.player_id);

      case 'action_confirmed':
        return gameStore.setActionSubmitted?.(true);

      case 'check_result':
        return gameStore.addCheckResult?.(msg.payload);

      case 'announcement':
        return gameStore.queueAnnouncement?.(msg.payload);

      case 'game_finished':
        return gameStore.setResult?.(msg.payload);

      case 'game_paused':
        sessionStore.timerPaused !== true && useSessionStore.setState({ timerPaused: true });
        return;

      case 'game_resumed':
        useSessionStore.setState({ timerPaused: false });
        // Update phase timer info so screens can sync the countdown.
        gameStore.applyPhase?.(msg.payload);
        return;

      case 'session_reset': {
        // Host reset game → all players go back to lobby.
        const code = msg.payload?.session_code;
        gameStore.reset?.();
        if (code && typeof window !== 'undefined') {
          window.location.href = `/lobby/${code}`;
        }
        return;
      }

      case 'pong':
        // heartbeat reply — ничего не делаем
        return;

      default:
        console.warn('[wsClient] unknown message type', msg.type, msg);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatId = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        } catch (err) {
          console.warn('[wsClient] heartbeat send failed', err);
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
    if ([4000, 4001, 4003].includes(e.code)) {
      this.socket = null;
      this.currentSessionId = null;
      return;
    }

    const sessionId = this.currentSessionId;
    if (!sessionId) return;

    // Экспоненциальный backoff: 500ms * 2^n, максимум 30s.
    const delay = Math.min(30_000, 500 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;

    // Сбрасываем ссылку на мёртвый сокет, чтобы connect() мог создать новый.
    this.socket = null;

    window.setTimeout(() => {
      // Проверяем, не был ли disconnect() вызван за это время.
      if (this.currentSessionId === sessionId) {
        this.connect(sessionId);
      }
    }, delay);
  }
}

export const wsClient = new WsClient();
