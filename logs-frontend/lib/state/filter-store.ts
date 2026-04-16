import type { LogFilter } from "@/hooks/use-log-stream";
import type { LogLevel, LogSource } from "@/lib/logs/types";

const STORAGE_PREFIX = "logs-frontend:filter";

interface PersistedFilter {
  levels: LogLevel[];
  domains: string[];
  events: string[];
  search: string;
  correlation: string;
  userId: string;
  sessionId: string;
  timeWindowMs: number | null;
}

// In-memory mirror — чтобы при смене source быстро отдать ранее выбранные фильтры
// без лишнего обращения к sessionStorage.
const cache = new Map<LogSource, LogFilter>();

function isLogLevel(value: unknown): value is LogLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}

export function loadFilter(source: LogSource): LogFilter | null {
  const cached = cache.get(source);
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}:${source}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedFilter>;
    const filter: LogFilter = {
      levels: new Set(Array.isArray(parsed.levels) ? parsed.levels.filter(isLogLevel) : ["debug", "info", "warn", "error"]),
      domains: new Set(Array.isArray(parsed.domains) ? parsed.domains.map(String) : []),
      events: new Set(Array.isArray(parsed.events) ? parsed.events.map(String) : []),
      search: typeof parsed.search === "string" ? parsed.search : "",
      correlation: typeof parsed.correlation === "string" ? parsed.correlation : "",
      userId: typeof parsed.userId === "string" ? parsed.userId : "",
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : "",
      timeWindowMs:
        typeof parsed.timeWindowMs === "number" || parsed.timeWindowMs === null
          ? parsed.timeWindowMs
          : null,
    };
    cache.set(source, filter);
    return filter;
  } catch {
    return null;
  }
}

export function saveFilter(source: LogSource, filter: LogFilter): void {
  cache.set(source, filter);
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedFilter = {
      levels: Array.from(filter.levels),
      domains: Array.from(filter.domains),
      events: Array.from(filter.events),
      search: filter.search,
      correlation: filter.correlation,
      userId: filter.userId,
      sessionId: filter.sessionId,
      timeWindowMs: filter.timeWindowMs,
    };
    window.sessionStorage.setItem(`${STORAGE_PREFIX}:${source}`, JSON.stringify(payload));
  } catch {
    // storage недоступен / переполнен — игнорим, в худшем случае фильтр не переживёт навигацию
  }
}

const AUTO_SCROLL_KEY = "logs-frontend:autoScroll";

export function loadAutoScroll(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.sessionStorage.getItem(AUTO_SCROLL_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export function saveAutoScroll(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTO_SCROLL_KEY, String(value));
  } catch {
    // ignore
  }
}
