"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, LogLevel, LogSource } from "@/lib/logs/types";
import { timestampToMs } from "@/lib/utils/format-time";
import { loadFilter, saveFilter } from "@/lib/state/filter-store";

export type ConnectionState = "idle" | "connecting" | "open" | "error";

export interface UpstreamStatus {
  connected: boolean;
  lastError: string | null;
  lastConnectedAt: number | null;
  refCount: number;
}

export interface LogFilter {
  levels: Set<LogLevel>;
  domains: Set<string>;
  events: Set<string>;
  search: string;
  correlation: string;
  userId: string;
  sessionId: string;
  timeWindowMs: number | null;
}

export const DEFAULT_FILTER: LogFilter = {
  levels: new Set<LogLevel>(["debug", "info", "warn", "error"]),
  domains: new Set<string>(),
  events: new Set<string>(),
  search: "",
  correlation: "",
  userId: "",
  sessionId: "",
  timeWindowMs: null,
};

const BUFFER_LIMIT = 5000;
const RATE_WINDOW_MS = 5000;
const FLUSH_INTERVAL_MS = 250;

function eventDomain(event: string | null): string | null {
  if (!event) return null;
  const dot = event.indexOf(".");
  return dot > 0 ? event.slice(0, dot) : event;
}

function matchesFilter(entry: LogEntry, filter: LogFilter, nowMs: number): boolean {
  if (filter.levels.size > 0 && !filter.levels.has(entry.level)) return false;

  if (filter.domains.size > 0) {
    const d = eventDomain(entry.event);
    if (!d || !filter.domains.has(d)) return false;
  }
  if (filter.events.size > 0) {
    if (!entry.event || !filter.events.has(entry.event)) return false;
  }

  if (filter.search) {
    const needle = filter.search.toLowerCase();
    const haystack =
      entry.message.toLowerCase() +
      " " +
      (entry.event ?? "").toLowerCase() +
      " " +
      (entry.details ? JSON.stringify(entry.details).toLowerCase() : "");
    if (!haystack.includes(needle)) return false;
  }

  if (filter.correlation) {
    const needle = filter.correlation;
    if (entry.requestId !== needle && entry.clientRequestId !== needle) return false;
  }

  if (filter.userId && entry.userId !== filter.userId) return false;
  if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;

  if (filter.timeWindowMs !== null) {
    const ts = timestampToMs(entry.timestamp);
    if (ts && nowMs - ts > filter.timeWindowMs) return false;
  }

  return true;
}

interface RateState {
  timestamps: number[];
}

export interface UseLogStreamResult {
  entries: LogEntry[];
  filtered: LogEntry[];
  status: ConnectionState;
  upstreamStatus: UpstreamStatus | null;
  rate: number;
  paused: boolean;
  togglePause: () => void;
  clear: () => void;
  filter: LogFilter;
  setFilter: (next: LogFilter | ((prev: LogFilter) => LogFilter)) => void;
}

export function useLogStream(source: LogSource): UseLogStreamResult {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [upstreamStatus, setUpstreamStatus] = useState<UpstreamStatus | null>(null);
  const [paused, setPaused] = useState(false);
  // Стартовое значение для filter — из sessionStorage (per source), чтобы выбор
  // уровней / event-фильтров пережил переключение между Backend и Frontend.
  const [filter, setFilterRaw] = useState<LogFilter>(() => loadFilter(source) ?? DEFAULT_FILTER);
  const [now, setNow] = useState(() => Date.now());
  const [rate, setRate] = useState(0);
  const [frozen, setFrozen] = useState<LogEntry[] | null>(null);

  const rateRef = useRef<RateState>({ timestamps: [] });

  const setFilter = useCallback<UseLogStreamResult["setFilter"]>(
    (next) => {
      setFilterRaw((prev) => {
        const value = typeof next === "function" ? (next as (p: LogFilter) => LogFilter)(prev) : next;
        saveFilter(source, value);
        return value;
      });
    },
    [source],
  );

  useEffect(() => {
    let cancelled = false;
    const pendingQueue: LogEntry[] = [];
    const url = `/api/logs/stream?source=${source}`;
    const es = new EventSource(url);

    const trackRate = (count: number) => {
      const now = Date.now();
      for (let i = 0; i < count; i += 1) {
        rateRef.current.timestamps.push(now);
      }
      const cutoff = now - RATE_WINDOW_MS;
      rateRef.current.timestamps = rateRef.current.timestamps.filter((t) => t >= cutoff);
    };

    const commit = (batch: LogEntry[]) => {
      if (batch.length === 0) return;
      setEntries((prev) => {
        const next = prev.concat(batch);
        const overflow = next.length - BUFFER_LIMIT;
        return overflow > 0 ? next.slice(overflow) : next;
      });
    };

    es.addEventListener("backlog", (event: MessageEvent) => {
      if (cancelled) return;
      try {
        const items = JSON.parse(event.data) as LogEntry[];
        if (items.length === 0) return;
        trackRate(items.length);
        commit(items);
      } catch {
        // ignore malformed
      }
    });

    es.addEventListener("entry", (event: MessageEvent) => {
      if (cancelled) return;
      try {
        const entry = JSON.parse(event.data) as LogEntry;
        trackRate(1);
        pendingQueue.push(entry);
      } catch {
        // ignore malformed
      }
    });

    es.addEventListener("status", (event: MessageEvent) => {
      try {
        const s = JSON.parse(event.data) as UpstreamStatus;
        setUpstreamStatus(s);
      } catch {
        // ignore
      }
    });

    es.onopen = () => {
      if (!cancelled) setStatus("open");
    };
    es.onerror = () => {
      if (!cancelled) setStatus("error");
    };

    const flushTimer = setInterval(() => {
      if (cancelled || pendingQueue.length === 0) return;
      const batch = pendingQueue.splice(0, pendingQueue.length);
      commit(batch);
    }, FLUSH_INTERVAL_MS);

    const rateTimer = setInterval(() => {
      const tick = Date.now();
      const cutoff = tick - RATE_WINDOW_MS;
      rateRef.current.timestamps = rateRef.current.timestamps.filter((t) => t >= cutoff);
      setNow(tick);
      setRate(Math.round((rateRef.current.timestamps.length / RATE_WINDOW_MS) * 1000));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(flushTimer);
      clearInterval(rateTimer);
      es.close();
    };
  }, [source]);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      // Снимок берём через функциональный setState, чтобы захватить **последний**
      // entries (между кликом и обработкой может прилететь свежий батч).
      if (next) {
        setEntries((latest) => {
          setFrozen(latest);
          return latest;
        });
      } else {
        setFrozen(null);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    setFrozen((cur) => (cur !== null ? [] : null));
  }, []);

  const visible = paused && frozen ? frozen : entries;

  const filtered = useMemo(() => {
    return visible.filter((entry) => matchesFilter(entry, filter, now));
  }, [visible, filter, now]);

  return {
    entries: visible,
    filtered,
    status,
    upstreamStatus,
    rate,
    paused,
    togglePause,
    clear,
    filter,
    setFilter,
  };
}
