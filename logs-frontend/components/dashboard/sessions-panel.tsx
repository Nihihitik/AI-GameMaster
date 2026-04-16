"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ObservedSession, SessionsListResponse } from "@/lib/observability/types";

const POLL_MS = 5000;

const STATUS_STYLE: Record<ObservedSession["status"], string> = {
  waiting: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  finished: "bg-muted text-muted-foreground",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatRelative(iso: string | null, nowMs: number): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Math.max(0, nowMs - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} д назад`;
}

export function SessionsPanel({ reduceMotion }: { reduceMotion: boolean }) {
  const [data, setData] = React.useState<SessionsListResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "waiting" | "active" | "finished">("all");
  const [pendingClose, setPendingClose] = React.useState<ObservedSession | null>(null);
  const [closingId, setClosingId] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  const load = React.useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`/api/dashboard/sessions?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setError(null);
      setData(json as SessionsListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [filter]);

  React.useEffect(() => {
    let cancelled = false;
    const wrapped = async () => {
      if (cancelled) return;
      await load();
    };
    void wrapped();
    const id = setInterval(wrapped, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(tick);
    };
  }, [load]);

  const handleClose = React.useCallback(async () => {
    if (!pendingClose) return;
    setClosingId(pendingClose.id);
    try {
      const res = await fetch(`/api/dashboard/sessions/${pendingClose.id}/close`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      toast.success(json.noop ? `Сессия ${pendingClose.code} уже была закрыта` : `Сессия ${pendingClose.code} закрыта`);
      setPendingClose(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setClosingId(null);
    }
  }, [pendingClose, load]);

  const sessions = data?.sessions ?? [];
  const filterButtons: Array<{ value: typeof filter; label: string }> = [
    { value: "all", label: "Все" },
    { value: "waiting", label: "Ожидание" },
    { value: "active", label: "Идёт" },
    { value: "finished", label: "Завершено" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card/30 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-medium tracking-tight">Активные сессии</h2>
          <span className="font-mono text-[11px] text-muted-foreground">{sessions.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {filterButtons.map((b) => (
            <Button
              key={b.value}
              type="button"
              variant={filter === b.value ? "secondary" : "ghost"}
              size="xs"
              className="h-6 px-2 text-[10px]"
              onClick={() => setFilter(b.value)}
            >
              {b.label}
            </Button>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => void load()}
                aria-label="Обновить"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Обновить (auto каждые 5с)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {error && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          {error}
        </div>
      )}

      {!data ? (
        <div className="space-y-1 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
          Нет сессий по фильтру.
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          <AnimatePresence initial={false}>
            {sessions.map((s) => (
              <motion.li
                key={s.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 4 }}
                transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 px-3 py-2 text-xs"
              >
                <div className="flex w-16 shrink-0 items-center gap-1">
                  <span className="font-mono font-medium tracking-wider">{s.code}</span>
                </div>
                <Badge variant="outline" className={cn("h-5 shrink-0 px-1.5 text-[9px] uppercase", STATUS_STYLE[s.status])}>
                  {s.status}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">
                    {s.host_display_name ?? s.host_email ?? s.host_user_id.slice(0, 8)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {s.joined_count} / {s.player_count} игроков · создано {formatRelative(s.created_at, now)} ·{" "}
                    {formatTime(s.created_at)}
                  </div>
                </div>
                {s.status !== "finished" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-7 gap-1 text-destructive hover:bg-destructive/10"
                    onClick={() => setPendingClose(s)}
                    disabled={closingId === s.id}
                  >
                    {closingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    закрыть
                  </Button>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3" />
                    {formatTime(s.ended_at)}
                  </span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Dialog open={!!pendingClose} onOpenChange={(open) => !open && setPendingClose(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Закрыть сессию {pendingClose?.code}?</DialogTitle>
            <DialogDescription>
              Сессия будет переведена в статус <strong>finished</strong>, всем подключённым игрокам уйдёт сообщение
              {" "}
              <code className="font-mono">session_closed</code>. Действие необратимо.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingClose(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClose}
              disabled={closingId === pendingClose?.id}
            >
              {closingId === pendingClose?.id ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Закрытие…
                </>
              ) : (
                "Закрыть сессию"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
