"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DockerHealth {
  ok: boolean;
  error?: string;
}

export function ConnectionIndicator({ className }: { className?: string }) {
  const [data, setData] = React.useState<DockerHealth | null>(null);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/health/docker", { cache: "no-store" });
        const json = (await res.json()) as DockerHealth;
        if (!cancelled) {
          setData(json);
          setFetchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const ok = !!data?.ok && !fetchError;
  const message = ok
    ? "Docker socket доступен"
    : data?.error || fetchError || "Загрузка…";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
          <motion.span
            aria-hidden
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              ok ? "bg-emerald-500" : "bg-destructive",
            )}
            animate={ok ? { scale: 1 } : { scale: [1, 1.25, 1] }}
            transition={
              ok ? { duration: 0 } : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            }
          />
          <span>{ok ? "docker.sock" : "no docker"}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{message}</TooltipContent>
    </Tooltip>
  );
}
