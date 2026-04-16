"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { EventCatalogItem } from "@/lib/logs/types";

export interface EventComboboxProps {
  catalog: EventCatalogItem[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  className?: string;
}

export function EventCombobox({ catalog, selected, onChange, className }: EventComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const grouped = React.useMemo(() => {
    const map = new Map<string, EventCatalogItem[]>();
    for (const item of catalog) {
      const arr = map.get(item.domain) ?? [];
      arr.push(item);
      map.set(item.domain, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const toggle = (event: string) => {
    const next = new Set(selected);
    if (next.has(event)) next.delete(event);
    else next.add(event);
    onChange(next);
  };

  const remove = (event: string) => {
    const next = new Set(selected);
    next.delete(event);
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  return (
    <div className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="h-8 w-44 justify-between text-xs"
          >
            <span className="truncate">
              {selected.size === 0 ? "Все события" : `${selected.size} выбрано`}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Поиск события…" className="h-9" />
            <CommandList>
              <CommandEmpty>Не найдено.</CommandEmpty>
              {grouped.map(([domain, items]) => (
                <CommandGroup key={domain} heading={domain}>
                  {items.map((item) => {
                    const checked = selected.has(item.event);
                    return (
                      <CommandItem
                        key={item.event}
                        value={`${item.event} ${item.description}`}
                        onSelect={() => toggle(item.event)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            checked ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-mono text-xs">{item.event}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {item.description}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.size > 0 && (
        <>
          {Array.from(selected).map((event) => (
            <Badge
              key={event}
              variant="secondary"
              className="h-6 cursor-pointer gap-1 pl-2 pr-1 font-mono text-[10px]"
              onClick={() => remove(event)}
            >
              {event}
              <X className="h-3 w-3 opacity-60" />
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={clearAll}>
            Очистить
          </Button>
        </>
      )}
    </div>
  );
}
