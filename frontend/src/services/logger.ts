import {
  API_BASE_URL,
  APP_ENV,
  CLIENT_LOG_LEVEL,
  REMOTE_LOGS_ENABLED,
  REMOTE_LOG_MIN_LEVEL,
} from '../utils/constants';

export type FrontendLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface FrontendLogContext {
  route?: string;
  userId?: string | null;
  sessionId?: string | null;
  clientRequestId?: string | null;
  buildEnv?: string;
  page?: string;
  [key: string]: unknown;
}

export interface FrontendLogEvent {
  timestamp: string;
  level: FrontendLogLevel;
  event: string;
  message: string;
  context: FrontendLogContext;
  details?: Record<string, unknown>;
}

const levelOrder: Record<FrontendLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const clientLogLevel = normalizeLevel(CLIENT_LOG_LEVEL);
const remoteMinLevel = normalizeLevel(REMOTE_LOG_MIN_LEVEL);
const bufferLimit = 200;
const pendingQueue: FrontendLogEvent[] = [];
const ringBuffer: FrontendLogEvent[] = [];

let flushTimer: number | null = null;
let globalHandlersInstalled = false;

function normalizeLevel(value: string): FrontendLogLevel {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'warning') return 'warn';
  if (normalized === 'error') return 'error';
  if (normalized === 'info') return 'info';
  return 'debug';
}

function isDev(): boolean {
  return APP_ENV === 'development';
}

function shouldPrint(level: FrontendLogLevel): boolean {
  return isDev() && levelOrder[level] >= levelOrder[clientLogLevel];
}

function shouldShip(level: FrontendLogLevel): boolean {
  return REMOTE_LOGS_ENABLED && level !== 'debug' && levelOrder[level] >= levelOrder[remoteMinLevel];
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getClientSessionId(): string {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return 'server';
  }

  const storageKey = 'frontend-log-session-id';
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const created = nextId('client');
  window.sessionStorage.setItem(storageKey, created);
  return created;
}

function safeStoreContext(): FrontendLogContext {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../stores/authStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSessionStore } = require('../stores/sessionStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useGameStore } = require('../stores/gameStore');

    const authState = useAuthStore.getState();
    const sessionState = useSessionStore.getState();
    const gameState = useGameStore.getState();

    return {
      userId: authState.user?.user_id ?? null,
      sessionId: sessionState.session?.id ?? gameState.sessionId ?? null,
    };
  } catch {
    return {};
  }
}

function getAccessToken(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../stores/authStore');
    return useAuthStore.getState().accessToken ?? null;
  } catch {
    return null;
  }
}

function baseContext(): FrontendLogContext {
  return {
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    buildEnv: APP_ENV,
    clientSessionId: getClientSessionId(),
    ...safeStoreContext(),
  };
}

function appendToBuffer(event: FrontendLogEvent): void {
  ringBuffer.push(event);
  if (ringBuffer.length > bufferLimit) {
    ringBuffer.shift();
  }
}

function printToConsole(event: FrontendLogEvent): void {
  if (!shouldPrint(event.level)) {
    return;
  }

  const printer = event.level === 'error'
    ? console.error
    : event.level === 'warn'
      ? console.warn
      : console.log;
  printer(`[${event.level}] ${event.event}`, {
    message: event.message,
    context: event.context,
    details: event.details,
  });
}

function scheduleFlush(): void {
  if (flushTimer !== null || pendingQueue.length === 0 || typeof window === 'undefined') {
    return;
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushRemoteLogs();
  }, 400);
}

async function flushRemoteLogs(): Promise<void> {
  if (pendingQueue.length === 0) {
    return;
  }

  const batch = pendingQueue.splice(0, 20);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    await fetch(`${API_BASE_URL}/api/logs/frontend`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch (error) {
    if (isDev()) {
      console.warn('[logger] remote flush failed', error);
    }
  } finally {
    if (pendingQueue.length > 0) {
      scheduleFlush();
    }
  }
}

function createLogEvent(
  level: FrontendLogLevel,
  event: string,
  message: string,
  context?: FrontendLogContext,
  details?: Record<string, unknown>,
): FrontendLogEvent {
  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    context: {
      ...baseContext(),
      ...context,
    },
    details,
  };
}

function emit(
  level: FrontendLogLevel,
  event: string,
  message: string,
  context?: FrontendLogContext,
  details?: Record<string, unknown>,
): FrontendLogEvent {
  const payload = createLogEvent(level, event, message, context, details);
  appendToBuffer(payload);
  printToConsole(payload);
  if (shouldShip(level)) {
    pendingQueue.push(payload);
    scheduleFlush();
  }
  return payload;
}

export function nextClientRequestId(): string {
  return nextId('req');
}

export function getLogBuffer(): FrontendLogEvent[] {
  return [...ringBuffer];
}

export const logger = {
  debug: (event: string, message: string, details?: Record<string, unknown>, context?: FrontendLogContext) =>
    emit('debug', event, message, context, details),
  info: (event: string, message: string, details?: Record<string, unknown>, context?: FrontendLogContext) =>
    emit('info', event, message, context, details),
  warn: (event: string, message: string, details?: Record<string, unknown>, context?: FrontendLogContext) =>
    emit('warn', event, message, context, details),
  error: (event: string, message: string, details?: Record<string, unknown>, context?: FrontendLogContext) =>
    emit('error', event, message, context, details),
  business: (
    event: string,
    message: string,
    details?: Record<string, unknown>,
    context?: FrontendLogContext,
    level: FrontendLogLevel = 'info',
  ) => emit(level, event, message, context, details),
};

export function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled || typeof window === 'undefined') {
    return;
  }
  globalHandlersInstalled = true;

  window.addEventListener('error', (errorEvent) => {
    logger.error('ui.unhandled_error', errorEvent.message || 'Unhandled window error', {
      filename: errorEvent.filename,
      lineno: errorEvent.lineno,
      colno: errorEvent.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('ui.unhandled_rejection', 'Unhandled promise rejection', {
      reason: String(event.reason),
    });
  });
}
