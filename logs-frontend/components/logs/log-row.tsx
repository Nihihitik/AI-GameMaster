"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/components/logs/level-badge";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils/format-time";
import { safeStringify, tokenizeJson } from "@/lib/utils/safe-json";
import type { LogEntry } from "@/lib/logs/types";

const TOKEN_CLASS: Record<string, string> = {
  key: "text-sky-600 dark:text-sky-300",
  string: "text-emerald-600 dark:text-emerald-300",
  number: "text-amber-600 dark:text-amber-300",
  boolean: "text-fuchsia-600 dark:text-fuchsia-300",
  null: "text-muted-foreground italic",
  punct: "text-muted-foreground",
  ws: "",
};

function HighlightedJson({ value }: { value: unknown }) {
  const text = safeStringify(value);
  const tokens = tokenizeJson(text);
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">
      <code>
        {tokens.map((t, i) => (
          <span key={i} className={TOKEN_CLASS[t.kind] ?? ""}>
            {t.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

export interface LogRowProps {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  onApplyFilter: (kind: "session" | "user" | "correlation", value: string) => void;
  reduceMotion: boolean;
}

const ROW_BG: Record<string, string> = {
  debug: "",
  info: "",
  warn: "bg-amber-500/5",
  error: "bg-destructive/10",
};

export function LogRow({ entry, expanded, onToggle, onApplyFilter, reduceMotion }: LogRowProps) {
  const copy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group border-b border-border/40 px-3 py-1.5 text-xs",
        ROW_BG[entry.level],
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 text-left"
      >
        <ChevronRight
          className={cn(
            "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {formatTime(entry.timestamp)}
        </span>
        <LevelBadge level={entry.level} className="shrink-0" />
        {entry.event && (
          <span className="shrink-0 font-mono text-[11px] text-foreground/80">
            {entry.event}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-foreground">{entry.message}</span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden pl-6 pr-2 pt-2"
          >
            <div className="space-y-2 pb-2">
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <Badge variant="outline" className="font-mono">
                  {entry.logger}
                </Badge>
                {entry.route && (
                  <Badge variant="outline" className="font-mono">
                    route: {entry.route}
                  </Badge>
                )}
                {entry.sessionId && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer font-mono"
                    onClick={() => onApplyFilter("session", entry.sessionId!)}
                  >
                    session: {entry.sessionId}
                  </Badge>
                )}
                {entry.userId && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer font-mono"
                    onClick={() => onApplyFilter("user", entry.userId!)}
                  >
                    user: {entry.userId}
                  </Badge>
                )}
                {entry.requestId && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer font-mono"
                    onClick={() => onApplyFilter("correlation", entry.requestId!)}
                  >
                    request: {entry.requestId}
                  </Badge>
                )}
                {entry.clientRequestId && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer font-mono"
                    onClick={() => onApplyFilter("correlation", entry.clientRequestId!)}
                  >
                    client_req: {entry.clientRequestId}
                  </Badge>
                )}
              </div>

              {entry.details && Object.keys(entry.details).length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      details
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-6 gap-1 px-2 text-[10px]"
                      onClick={() => copy(safeStringify(entry.details))}
                    >
                      <Copy className="h-3 w-3" /> JSON
                    </Button>
                  </div>
                  <HighlightedJson value={entry.details} />
                </div>
              )}

              {entry.traceback && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      traceback
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-6 gap-1 px-2 text-[10px]"
                      onClick={() => copy(entry.traceback!)}
                    >
                      <Copy className="h-3 w-3" /> traceback
                    </Button>
                  </div>
                  <pre className="overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-foreground/90">
                    {entry.traceback}
                  </pre>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={() => copy(entry.raw)}
                >
                  <Copy className="h-3 w-3" /> raw
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
