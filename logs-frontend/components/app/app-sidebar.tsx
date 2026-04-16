"use client";

import * as React from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Server, Globe, Activity, LayoutDashboard } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ConnectionIndicator } from "@/components/logs/connection-indicator";
import { cn } from "@/lib/utils";
import type { LogSource } from "@/lib/logs/types";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

type View = "dashboard" | "logs";

interface SidebarProps {
  view: View;
  source: LogSource;
}

const LOG_ITEMS: Array<{ source: LogSource; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { source: "backend", label: "Backend", icon: Server },
  { source: "frontend", label: "Frontend", icon: Globe },
];

export function AppSidebar({ view, source }: SidebarProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const reduceMotion = usePrefersReducedMotion();

  const navigate = React.useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname],
  );

  const onSelectDashboard = React.useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.set("view", "dashboard");
    next.delete("source");
    navigate(next);
  }, [params, navigate]);

  const onSelectLogs = React.useCallback(
    (nextSource: LogSource) => {
      const next = new URLSearchParams(params.toString());
      next.delete("view");
      next.set("source", nextSource);
      navigate(next);
    },
    [params, navigate],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Activity className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium tracking-tight">Logs</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={view === "dashboard"} onClick={onSelectDashboard} className="relative">
                  {view === "dashboard" && !reduceMotion && (
                    <motion.span
                      layoutId="sidebar-active-indicator"
                      className="absolute inset-0 rounded-md bg-sidebar-accent"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <LayoutDashboard className={cn("relative h-4 w-4")} />
                  <span className="relative">Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Streams</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {LOG_ITEMS.map((item) => {
                const active = view === "logs" && source === item.source;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.source}>
                    <SidebarMenuButton
                      isActive={active}
                      onClick={() => onSelectLogs(item.source)}
                      className="relative"
                    >
                      {active && !reduceMotion && (
                        <motion.span
                          layoutId="sidebar-active-indicator"
                          className="absolute inset-0 rounded-md bg-sidebar-accent"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon className={cn("relative h-4 w-4")} />
                      <span className="relative">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1.5">
          <ConnectionIndicator />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
