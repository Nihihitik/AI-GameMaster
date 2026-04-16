"use client";

import * as React from "react";
import { ContainerStats } from "@/components/dashboard/container-stats";
import { SessionsPanel } from "@/components/dashboard/sessions-panel";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function DashboardView() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <section className="space-y-2">
          <header className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xs font-medium tracking-tight">Контейнеры</h2>
              <p className="text-[11px] text-muted-foreground">
                CPU, память, сеть и диск по всем gamemaster-* контейнерам. Опрос каждые 2 секунды через docker.sock.
              </p>
            </div>
          </header>
          <ContainerStats reduceMotion={reduceMotion} />
        </section>

        <section className="space-y-2">
          <header className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xs font-medium tracking-tight">Сессии</h2>
              <p className="text-[11px] text-muted-foreground">
                Активные и недавние партии из таблицы sessions. Закрытие переводит в finished и шлёт session_closed по WebSocket.
              </p>
            </div>
          </header>
          <SessionsPanel reduceMotion={reduceMotion} />
        </section>
      </div>
    </div>
  );
}
