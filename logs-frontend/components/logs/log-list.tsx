"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { LogRow } from "@/components/logs/log-row";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/lib/logs/types";

export interface LogListProps {
  entries: LogEntry[];
  autoScroll: boolean;
  onApplyFilter: (kind: "session" | "user" | "correlation", value: string) => void;
  reduceMotion: boolean;
  className?: string;
}

const STICK_THRESHOLD_PX = 80;

export function LogList({ entries, autoScroll, onApplyFilter, reduceMotion, className }: LogListProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [atBottom, setAtBottom] = React.useState(true);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: React.useCallback(
      (index: number) => (expanded.has(entries[index]?.id) ? 220 : 32),
      [expanded, entries],
    ),
    overscan: 12,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const lastIndexRef = React.useRef(-1);

  React.useEffect(() => {
    if (!autoScroll || !atBottom || entries.length === 0 || expanded.size > 0) return;
    const nextIndex = entries.length - 1;
    const previous = lastIndexRef.current;
    lastIndexRef.current = nextIndex;
    // Малый прирост (батч до 5 новых) — плавно спускаемся вниз, чтобы старые
    // строки визуально сдвигались вверх. Большой прыжок (initial backlog,
    // догон после reconnect) — мгновенно, иначе долго едет.
    const behavior: ScrollBehavior = previous >= 0 && nextIndex - previous <= 5 ? "smooth" : "auto";
    virtualizer.scrollToIndex(nextIndex, { align: "end", behavior });
  }, [autoScroll, atBottom, entries.length, virtualizer, expanded.size]);

  const onScroll = React.useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < STICK_THRESHOLD_PX);
  }, []);

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    requestAnimationFrame(() => virtualizer.measure());
  }, [virtualizer]);

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      onScroll={onScroll}
      className={cn("relative h-full w-full overflow-y-auto overscroll-contain", className)}
    >
      {entries.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
          Нет записей по текущим фильтрам.
        </div>
      ) : (
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}>
          {items.map((vi) => {
            const entry = entries[vi.index];
            return (
              <div
                key={entry.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <LogRow
                  entry={entry}
                  expanded={expanded.has(entry.id)}
                  onToggle={() => toggle(entry.id)}
                  onApplyFilter={onApplyFilter}
                  reduceMotion={reduceMotion}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
