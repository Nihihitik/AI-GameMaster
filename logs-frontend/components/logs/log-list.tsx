"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
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
  const [unread, setUnread] = React.useState(0);
  const previousLengthRef = React.useRef(entries.length);

  React.useEffect(() => {
    const prev = previousLengthRef.current;
    previousLengthRef.current = entries.length;
    if (atBottom) {
      if (unread !== 0) setUnread(0);
      return;
    }
    if (entries.length > prev) {
      setUnread((u) => u + (entries.length - prev));
    }
  }, [entries.length, atBottom, unread]);

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

  const scrollToBottom = React.useCallback(() => {
    if (entries.length === 0) return;
    virtualizer.scrollToIndex(entries.length - 1, { align: "end", behavior: "smooth" });
    setUnread(0);
  }, [entries.length, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const showJumpButton = !atBottom && entries.length > 0;

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div
        ref={parentRef}
        onScroll={onScroll}
        className="h-full w-full overflow-y-auto overscroll-contain"
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

      <AnimatePresence>
        {showJumpButton && (
          <motion.button
            type="button"
            onClick={scrollToBottom}
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.92 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm hover:bg-muted"
            aria-label="Прокрутить к последнему логу"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span>К последнему</span>
            {unread > 0 && (
              <span className="font-mono tabular-nums text-muted-foreground">+{unread > 999 ? "999+" : unread}</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
