"use client";

import { cn } from "@/lib/utils";
import type { LogLevel } from "@/lib/logs/types";

const STYLES: Record<LogLevel, string> = {
  debug: "bg-muted text-muted-foreground",
  info: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  error: "bg-destructive/15 text-destructive dark:text-red-300",
};

const LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

export function LevelBadge({ level, className }: { level: LogLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-12 items-center justify-center rounded px-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide",
        STYLES[level],
        className,
      )}
    >
      {LABELS[level]}
    </span>
  );
}
