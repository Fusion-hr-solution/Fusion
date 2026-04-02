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
      <div className="flex flex-col items-center gap-2 py-1">
        <div className="flex flex-col items-center gap-0.5" title="Completed">
          <span className="text-xs font-bold tabular-nums text-foreground">12</span>
          <span className="text-[9px] text-muted-foreground">Done</span>
        </div>
        <div className="flex flex-col items-center gap-0.5" title="In Progress">
          <span className="text-xs font-bold tabular-nums text-foreground">3</span>
          <span className="text-[9px] text-muted-foreground">Active</span>
        </div>
        <div className="flex flex-col items-center gap-0.5" title="Certificates">
          <span className="text-xs font-bold tabular-nums text-foreground">8</span>
          <span className="text-[9px] text-muted-foreground">Certs</span>
        </div>
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
