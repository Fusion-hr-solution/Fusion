"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { GraduationCap, BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppSidebar, type NavSection } from "@repo/ui";
import {
  SidebarUserPanel,
  useAuth,
  hasAnyRole,
  HR_ADMIN_ROLE,
} from "@repo/auth";
import { useApiQuery } from "@repo/api/react";
import { EMPLOYEE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import { getMyTrainings } from "@/services/learning-service";
import { StatRow } from "./stat-row";

function SidebarNavSkeleton() {
  const widths = ["75%", "60%", "85%", "50%", "70%"];
  return (
    <div className="px-3 py-4 space-y-3 animate-pulse">
      <div className="h-3 w-20 rounded bg-muted" />
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="h-4 w-4 rounded bg-muted" />
          <div className="h-3 rounded bg-muted" style={{ width: w }} />
        </div>
      ))}
    </div>
  );
}

function QuickStatsFooter({
  collapsed,
  completed,
  inProgress,
}: {
  collapsed: boolean;
  completed: number;
  inProgress: number;
}) {
  const t = useTranslations("nav.quickStats");

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-1">
        <div className="flex flex-col items-center gap-0.5" title={t("completed")}>
          <span className="text-xs font-bold tabular-nums text-foreground">{completed}</span>
          <span className="text-[9px] text-muted-foreground">{t("completedShort")}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5" title={t("inProgress")}>
          <span className="text-xs font-bold tabular-nums text-foreground">{inProgress}</span>
          <span className="text-[9px] text-muted-foreground">{t("inProgressShort")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--ey-yellow))]/20 bg-[hsl(var(--ey-yellow))]/10 p-3">
      <div className="flex items-center gap-1.5">
        <BarChart3
          className="h-3 w-3 text-muted-foreground dark:text-[hsl(var(--ey-yellow))]"
          aria-hidden="true"
        />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-[hsl(var(--ey-yellow))]">
          {t("title")}
        </p>
      </div>
      <div className="mt-2.5 space-y-2">
        <StatRow label={t("completed")} value={String(completed)} />
        <StatRow label={t("inProgress")} value={String(inProgress)} />
      </div>
    </div>
  );
}

export function LearningSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/learning/, "") || "/";
  const t = useTranslations("nav");

  const { user, isLoading } = useAuth();
  const isAdmin = hasAnyRole(user, [HR_ADMIN_ROLE]);

  const fetchMyTrainings = useCallback(() => getMyTrainings(), []);
  const { data: myTrainings } = useApiQuery(fetchMyTrainings, {
    enabled: !isAdmin && !isLoading,
  });
  const myTrainingsCount = myTrainings?.length ?? 0;
  const completedCount = myTrainings?.filter((t) => t.status === "completed").length ?? 0;
  const inProgressCount = myTrainings?.filter((t) => t.status === "in-progress").length ?? 0;

  const translateSection = useCallback(
    (section: NavSection): NavSection => ({
      ...section,
      title: t(`sections.${section.title}`),
      items: section.items.map((item) => ({
        ...item,
        label: t(`items.${item.label}`),
        disabledReason: item.disabledReason
          ? t(item.disabledReason)
          : undefined,
      })),
    }),
    [t]
  );

  const employeeNavWithCount = useMemo(() => {
    const section = translateSection(EMPLOYEE_NAV);
    return {
      ...section,
      items: section.items.map((item) =>
        item.href === "/my-trainings"
          ? {
              ...item,
              badge:
                myTrainingsCount > 0 ? String(myTrainingsCount) : undefined,
            }
          : item
      ),
    };
  }, [translateSection, myTrainingsCount]);

  const sections = useMemo(() => {
    if (isLoading) return [];
    return isAdmin ? [translateSection(ADMIN_NAV)] : [employeeNavWithCount];
  }, [isLoading, isAdmin, translateSection, employeeNavWithCount]);

  if (isLoading) {
    return (
      <aside className="group/sidebar relative flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar w-[260px]">
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground shadow-sm dark:bg-secondary">
            <GraduationCap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-foreground">
              EY Academy
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("brandSubtitle")}
            </p>
          </div>
        </div>
        <SidebarNavSkeleton />
      </aside>
    );
  }

  return (
    <AppSidebar
      activeModule="Learning"
      activePath={activePath}
      sections={sections}
      brandIcon={GraduationCap}
      brandTitle="EY Academy"
      brandSubtitle={t("brandSubtitle")}
      basePath="/learning"
      footer={(collapsed) =>
        isAdmin ? null : (
          <QuickStatsFooter collapsed={collapsed} completed={completedCount} inProgress={inProgressCount} />
        )
      }
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
