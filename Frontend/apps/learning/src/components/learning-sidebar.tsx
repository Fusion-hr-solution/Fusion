"use client";

import { usePathname } from "next/navigation";
import { GraduationCap, BarChart3 } from "lucide-react";
import { AppSidebar } from "@repo/ui";
import { SidebarUserPanel } from "@repo/auth";
import { EMPLOYEE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import { StatRow } from "./stat-row";

function QuickStatsFooter({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <BarChart3
          className="h-4 w-4 text-[hsl(var(--ey-grey-400))]"
          aria-hidden="true"
        />
        <span className="text-xs font-bold tabular-nums text-foreground">12</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[hsl(var(--ey-yellow))]/8 p-3">
      <div className="flex items-center gap-1.5">
        <BarChart3
          className="h-3 w-3 text-[hsl(var(--ey-grey-400))]"
          aria-hidden="true"
        />
        <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ey-grey-400))]">
          Quick Stats
        </p>
      </div>
      <div className="mt-2.5 space-y-2">
        <StatRow label="Completed" value="12" />
        <StatRow label="In Progress" value="3" />
        <StatRow label="Certificates" value="8" />
      </div>
    </div>
  );
}

export function LearningSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/learning/, "") || "/";

  return (
    <AppSidebar
      activeModule="Learning"
      activePath={activePath}
      sections={[EMPLOYEE_NAV, ADMIN_NAV]}
      brandIcon={GraduationCap}
      brandTitle="EY Academy"
      brandSubtitle="Learning Platform"
      basePath="/learning"
      footer={(collapsed) => <QuickStatsFooter collapsed={collapsed} />}
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
