"use client";

import * as React from "react";
import { LogFilters } from "@/components/logs/log-filters";
import { LogList } from "@/components/logs/log-list";
import { useLogStream } from "@/hooks/use-log-stream";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { loadAutoScroll, saveAutoScroll } from "@/lib/state/filter-store";
import type { LogSource } from "@/lib/logs/types";

export function LogViewer({ source }: { source: LogSource }) {
  const reduceMotion = usePrefersReducedMotion();
  const stream = useLogStream(source);
  const [autoScroll, setAutoScrollRaw] = React.useState<boolean>(() => loadAutoScroll());
  const setAutoScroll = React.useCallback((next: boolean) => {
    setAutoScrollRaw(next);
    saveAutoScroll(next);
  }, []);

  const onApplyFilter = React.useCallback(
    (kind: "session" | "user" | "correlation", value: string) => {
      stream.setFilter((prev) => {
        if (kind === "session") return { ...prev, sessionId: value };
        if (kind === "user") return { ...prev, userId: value };
        return { ...prev, correlation: value };
      });
    },
    [stream],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LogFilters
        source={source}
        filter={stream.filter}
        setFilter={stream.setFilter}
        paused={stream.paused}
        onTogglePause={stream.togglePause}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        onClear={stream.clear}
        total={stream.entries.length}
        shown={stream.filtered.length}
        rate={stream.rate}
        reduceMotion={reduceMotion}
      />

      <div className="min-h-0 flex-1">
        <LogList
          entries={stream.filtered}
          autoScroll={autoScroll}
          onApplyFilter={onApplyFilter}
          reduceMotion={reduceMotion}
        />
      </div>
    </div>
  );
}
