"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDown, ArrowUp, Cpu, HardDrive, Server, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBytes, formatUptime } from "@/lib/utils/format-size";
import type { ContainerStat } from "@/lib/docker/stats";

const POLL_MS = 2000;
const HISTORY_LIMIT = 60;

interface DashboardStats {
  containers: ContainerStat[];
  timestamp: number;
}

interface CpuPoint {
  time: number;
  value: number;
}

function statePillClass(state: string): string {
  if (state === "running") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
  if (state === "exited") return "bg-destructive/15 text-destructive dark:text-red-300";
  if (state === "paused") return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

function Sparkline({ points, max = 100, className }: { points: CpuPoint[]; max?: number; className?: string }) {
  if (points.length < 2) {
    return <div className={cn("h-8 w-full", className)} />;
  }
  const width = 200;
  const height = 32;
  const stepX = width / (HISTORY_LIMIT - 1);
  const path = points
    .map((p, i) => {
      const x = (i + (HISTORY_LIMIT - points.length)) * stepX;
      const y = height - Math.min(1, p.value / max) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg className={cn("h-8 w-full", className)} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MetricBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct > 80 ? "bg-destructive" : pct > 50 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-foreground">{pct.toFixed(1)}%</span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full", tone)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

interface ContainerCardProps {
  stat: ContainerStat;
  cpuHistory: CpuPoint[];
  reduceMotion: boolean;
}

function ContainerCard({ stat, cpuHistory, reduceMotion }: ContainerCardProps) {
  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-lg border border-border bg-card/30 p-3 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate font-mono text-xs font-medium">{stat.name}</span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{stat.image}</div>
        </div>
        <Badge variant="outline" className={cn("h-5 shrink-0 px-1.5 text-[9px] uppercase", statePillClass(stat.state))}>
          {stat.state}
        </Badge>
      </div>

      {stat.state === "running" ? (
        <div className="mt-3 space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" /> CPU
              </span>
              <span className="font-mono tabular-nums text-foreground">{stat.cpuPct.toFixed(1)}%</span>
            </div>
            <div className="text-muted-foreground/70">
              <Sparkline points={cpuHistory} max={Math.max(100, ...cpuHistory.map((p) => p.value))} />
            </div>
          </div>

          <MetricBar
            value={stat.memPct}
            label={`Память ${formatBytes(stat.memUsage)} / ${formatBytes(stat.memLimit)}`}
          />

          <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ArrowDown className="h-3 w-3" />
              <span className="font-mono tabular-nums text-foreground">{formatBytes(stat.netRx)}</span>
              <span>приём</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUp className="h-3 w-3" />
              <span className="font-mono tabular-nums text-foreground">{formatBytes(stat.netTx)}</span>
              <span>отдача</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3 w-3" />
              <span className="font-mono tabular-nums text-foreground">{formatBytes(stat.blockRead)}</span>
              <span>чтение</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3 w-3" />
              <span className="font-mono tabular-nums text-foreground">{formatBytes(stat.blockWrite)}</span>
              <span>запись</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span>работает {formatUptime(stat.uptimeMs)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-muted-foreground">{stat.status || "не запущен"}</div>
      )}
    </motion.div>
  );
}

export function ContainerStats({ reduceMotion }: { reduceMotion: boolean }) {
  const [data, setData] = React.useState<DashboardStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<Map<string, CpuPoint[]>>(new Map());

  React.useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json.error) {
          setError(json.error ?? `HTTP ${res.status}`);
          return;
        }
        setError(null);
        setData(json as DashboardStats);
        setHistory((prev) => {
          const next = new Map(prev);
          for (const stat of (json as DashboardStats).containers) {
            const list = next.get(stat.name)?.slice(-(HISTORY_LIMIT - 1)) ?? [];
            list.push({ time: json.timestamp ?? Date.now(), value: stat.cpuPct });
            next.set(stat.name, list);
          }
          return next;
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data && !error) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
        Не удалось получить статистику контейнеров: {error}
      </div>
    );
  }

  const containers = data?.containers ?? [];

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
          stale: {error}
        </div>
      )}
      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {containers.map((stat) => (
            <ContainerCard
              key={stat.id}
              stat={stat}
              cpuHistory={history.get(stat.name) ?? []}
              reduceMotion={reduceMotion}
            />
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
