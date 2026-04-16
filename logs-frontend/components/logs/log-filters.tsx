"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EventCombobox } from "@/components/logs/event-combobox";
import { LevelBadge } from "@/components/logs/level-badge";
import { eventsForSource, domainsForSource } from "@/lib/logs/event-catalog";
import { cn } from "@/lib/utils";
import type { LogLevel, LogSource } from "@/lib/logs/types";
import type { LogFilter } from "@/hooks/use-log-stream";

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

const TIME_RANGES: Array<{ label: string; value: string; ms: number | null }> = [
  { label: "Live", value: "live", ms: null },
  { label: "5 мин", value: "5m", ms: 5 * 60_000 },
  { label: "15 мин", value: "15m", ms: 15 * 60_000 },
  { label: "1 час", value: "1h", ms: 60 * 60_000 },
];

export interface LogFiltersProps {
  source: LogSource;
  filter: LogFilter;
  setFilter: (next: LogFilter | ((prev: LogFilter) => LogFilter)) => void;
  paused: boolean;
  onTogglePause: () => void;
  autoScroll: boolean;
  onAutoScrollChange: (next: boolean) => void;
  onClear: () => void;
  total: number;
  shown: number;
  rate: number;
  reduceMotion: boolean;
}

export function LogFilters(props: LogFiltersProps) {
  const {
    source,
    filter,
    setFilter,
    paused,
    onTogglePause,
    autoScroll,
    onAutoScrollChange,
    onClear,
    total,
    shown,
    rate,
    reduceMotion,
  } = props;

  const catalog = React.useMemo(() => eventsForSource(source), [source]);
  const domains = React.useMemo(() => domainsForSource(source), [source]);

  const toggleLevel = (level: LogLevel) => {
    setFilter((prev) => {
      const next = new Set(prev.levels);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return { ...prev, levels: next };
    });
  };

  const setDomains = (values: string[]) => {
    setFilter((prev) => ({ ...prev, domains: new Set(values) }));
  };

  const setEvents = (events: Set<string>) => {
    setFilter((prev) => ({ ...prev, events }));
  };

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilter((prev) => ({ ...prev, search: value }));
  };

  const onCorrelationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setFilter((prev) => ({ ...prev, correlation: value }));
  };

  const onUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setFilter((prev) => ({ ...prev, userId: value }));
  };

  const onSessionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setFilter((prev) => ({ ...prev, sessionId: value }));
  };

  const onTimeRangeChange = (value: string) => {
    const range = TIME_RANGES.find((r) => r.value === value);
    setFilter((prev) => ({ ...prev, timeWindowMs: range?.ms ?? null }));
  };

  const currentRange = TIME_RANGES.find((r) => r.ms === filter.timeWindowMs)?.value ?? "live";

  const hasActiveFilters =
    filter.search ||
    filter.correlation ||
    filter.userId ||
    filter.sessionId ||
    filter.events.size > 0 ||
    filter.domains.size > 0;

  const resetTextFilters = () => {
    setFilter((prev) => ({
      ...prev,
      search: "",
      correlation: "",
      userId: "",
      sessionId: "",
      events: new Set(),
      domains: new Set(),
    }));
  };

  return (
    <div className="space-y-2 border-b border-border bg-background/95 p-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {LEVELS.map((level) => {
            const active = filter.levels.has(level);
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={cn(
                  "rounded transition-opacity",
                  active ? "opacity-100" : "opacity-40 hover:opacity-70",
                )}
              >
                <LevelBadge level={level} />
              </button>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-6" />

        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          value={Array.from(filter.domains)}
          onValueChange={setDomains}
          className="gap-1"
        >
          {domains.map((d) => (
            <ToggleGroupItem key={d} value={d} className="h-7 px-2 font-mono text-[10px]">
              {d}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Separator orientation="vertical" className="h-6" />

        <EventCombobox catalog={catalog} selected={filter.events} onChange={setEvents} />

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help font-mono text-[11px] tabular-nums text-muted-foreground">
                <span className="text-foreground">{shown.toLocaleString()}</span>
                <span className="opacity-60"> из </span>
                <span>{total.toLocaleString()}</span>
                <span className="opacity-60"> · </span>
                <span className="text-foreground">{rate}</span>
                <span className="opacity-60">/c</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-mono">{shown.toLocaleString()}</span>
                  <span className="opacity-60"> — записей видно по фильтру</span>
                </div>
                <div>
                  <span className="font-mono">{total.toLocaleString()}</span>
                  <span className="opacity-60"> — всего в буфере (cap 5000, FIFO)</span>
                </div>
                <div>
                  <span className="font-mono">{rate}</span>
                  <span className="opacity-60"> — событий/сек за последние 5с</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1.5">
            <Switch
              id="autoscroll"
              checked={autoScroll}
              onCheckedChange={onAutoScrollChange}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <label htmlFor="autoscroll" className="cursor-help text-[11px] text-muted-foreground">
                  автоскролл
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                <div className="space-y-1.5 text-xs leading-snug">
                  <div>
                    <span className="font-medium">ON</span>
                    <span className="opacity-70">
                      {" "}— при появлении новых логов прокручивать к низу. Срабатывает только если вы уже у дна
                      (≤80px) и ни один лог не раскрыт.
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">OFF</span>
                    <span className="opacity-70">
                      {" "}— скролл никогда не двигается сам. Новые логи всё равно добавляются в список ниже,
                      проскроллите руками чтобы увидеть.
                    </span>
                  </div>
                  <div className="opacity-70">
                    Не путать с <span className="font-mono">Pause</span>: пауза замораживает добавление в видимый
                    список, новые события копятся в фоне.
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <motion.div whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={onTogglePause}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
          </motion.div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-muted-foreground hover:text-destructive"
            onClick={onClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Поиск по message и details…"
          value={filter.search}
          onChange={onSearchChange}
          className="h-8 max-w-xs text-xs"
        />
        <Input
          placeholder="request_id / client_request_id"
          value={filter.correlation}
          onChange={onCorrelationChange}
          className="h-8 max-w-xs text-xs"
        />
        <Input
          placeholder="session_id"
          value={filter.sessionId}
          onChange={onSessionChange}
          className="h-8 max-w-[180px] text-xs"
        />
        <Input
          placeholder="user_id"
          value={filter.userId}
          onChange={onUserChange}
          className="h-8 max-w-[180px] text-xs"
        />
        <Select value={currentRange} onValueChange={onTimeRangeChange}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-xs">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <AnimatePresence initial={false}>
          {hasActiveFilters && (
            <motion.div
              key="reset"
              initial={reduceMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-[11px] text-muted-foreground"
                onClick={resetTextFilters}
              >
                <X className="h-3 w-3" /> Сбросить фильтры
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
