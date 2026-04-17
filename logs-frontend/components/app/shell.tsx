"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { LogViewer } from "@/components/logs/log-viewer";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DatabaseView } from "@/components/database/database-view";
import type { LogSource } from "@/lib/logs/types";

type View = "dashboard" | "database" | "logs";

export function Shell() {
  const params = useSearchParams();
  const viewParam = params.get("view");
  const view: View =
    viewParam === "dashboard" ? "dashboard" : viewParam === "database" ? "database" : "logs";
  const source: LogSource = params.get("source") === "frontend" ? "frontend" : "backend";

  const breadcrumb =
    view === "dashboard" ? "/dashboard" : view === "database" ? "/database" : `/logs/${source}`;

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <AppSidebar view={view} source={source} />
        <SidebarInset className="flex h-svh min-h-0 flex-col">
          <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-2">
            <SidebarTrigger className="h-7 w-7" />
            <span className="font-mono text-[11px] text-muted-foreground">{breadcrumb}</span>
          </header>
          <div className="min-h-0 flex-1">
            {view === "dashboard" ? (
              <DashboardView />
            ) : view === "database" ? (
              <DatabaseView />
            ) : (
              <LogViewer key={source} source={source} />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
