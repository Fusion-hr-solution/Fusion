"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarRange,
  Clock,
  Layers,
  ListChecks,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Button, Skeleton } from "@repo/ds";
import type { PerformanceCycleSummaryDto } from "@repo/api";
import {
  PageContainer,
  PageHeader,
  PageEmpty,
  PagePermissionNotice,
  KpiStat,
  KpiGrid,
  DashboardPanel,
  DashboardSection,
  DonutChart,
  CHART_TONES,
  type DonutDatum,
} from "@repo/ds/shell";
import {
  canAccessPerformance,
  canManagePerformanceCycles,
  useAuth,
} from "@repo/auth";
import { CycleStatusBadge, DeadlineBadge } from "@/components";
import { usePerformanceCycles } from "@/hooks/use-cycles";
import { useMyNotifications, useUnreadNotificationCount } from "@/hooks/use-notifications";
import { formatPeriod } from "@/lib/format";

const STATUS_COLOR: Record<string, string> = {
  Active: CHART_TONES.success,
  Draft: CHART_TONES.muted,
  Scheduled: CHART_TONES.info,
  Closed: CHART_TONES.info,
  Archived: CHART_TONES.warning,
};

function CycleRow({ cycle }: { cycle: PerformanceCycleSummaryDto }) {
  return (
    <Link
      href={`/cycles/${cycle.id}`}
      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{cycle.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatPeriod(cycle.periodStart, cycle.periodEnd)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <DeadlineBadge state={cycle.deadlineState} />
        <CycleStatusBadge status={cycle.status} />
      </span>
    </Link>
  );
}

// ── HR / admin: cycle operations ─────────────────────────────────────────────

function PerformanceAdminDashboard() {
  const { data, isLoading } = usePerformanceCycles(
    { search: null, status: null, type: null, page: 1, pageSize: 50 },
    true
  );
  const cycles = useMemo(() => data?.items ?? [], [data]);
  const total = data?.totalCount ?? cycles.length;
  const active = cycles.filter((c) => c.status === "Active").length;
  const dueSoon = cycles.filter((c) => c.deadlineState === "DueSoon").length;
  const overdue = cycles.filter((c) => c.deadlineState === "Overdue").length;
  const recent = cycles.slice(0, 6);

  const statusData: DonutDatum[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cycles) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
    return [...counts.entries()].map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLOR[name] ?? CHART_TONES.muted,
    }));
  }, [cycles]);

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Performance cycles, progress, and what needs action."
        actions={
          <Button asChild>
            <Link href="/cycles">
              <Plus className="size-4" />
              Manage cycles
            </Link>
          </Button>
        }
      />

      <KpiGrid>
        <KpiStat label="Active cycles" value={active} icon={CalendarRange} href="/cycles?status=Active" />
        <KpiStat label="Total cycles" value={total} icon={Layers} href="/cycles" />
        <KpiStat
          label="Due soon"
          value={dueSoon}
          tone={dueSoon > 0 ? "warning" : "success"}
          icon={Clock}
          hint="Approaching deadline"
        />
        <KpiStat
          label="Overdue"
          value={overdue}
          tone={overdue > 0 ? "danger" : "success"}
          icon={TriangleAlert}
          hint={overdue > 0 ? "Past deadline" : "Nothing overdue"}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="Recent cycles"
            description="Latest performance cycles."
            action={
              <Link href="/cycles" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {recent.length > 0 ? (
              <ul className="divide-y divide-border">
                {recent.map((cycle) => (
                  <li key={cycle.id}>
                    <CycleRow cycle={cycle} />
                  </li>
                ))}
              </ul>
            ) : (
              <PageEmpty
                icon={CalendarRange}
                title="No cycles yet"
                description="Performance cycles you create will appear here."
              />
            )}
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection title="Cycles by status" description="Lifecycle distribution.">
            {statusData.length > 0 ? (
              <DonutChart centerLabel="cycles" total={total} data={statusData} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No cycle data yet.</p>
            )}
          </DashboardSection>
        </DashboardPanel>
      </div>
    </PageContainer>
  );
}

// ── Participant (employee / manager) ─────────────────────────────────────────

function ParticipantDashboard() {
  const { data: cyclesData, isLoading: isCyclesLoading } = usePerformanceCycles(
    { search: null, status: "Active", type: null, page: 1, pageSize: 5 },
    true
  );
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: notifData, isLoading: isNotifLoading } = useMyNotifications(
    { unreadOnly: false, page: 1, pageSize: 5 },
    true
  );

  const activeCycles = cyclesData?.items ?? [];
  const notifications = notifData?.items ?? [];

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader title="Dashboard" description="Your performance cycles and updates." />

      <KpiGrid>
        <KpiStat label="Active cycles" value={activeCycles.length} icon={CalendarRange} href="/cycles" />
        <KpiStat
          label="Unread updates"
          value={unreadCount ?? 0}
          tone={(unreadCount ?? 0) > 0 ? "warning" : "default"}
          icon={Bell}
          href="/notifications"
        />
        <KpiStat label="My objectives" value="—" icon={ListChecks} hint="Coming soon" />
        <KpiStat label="Pending actions" value="—" icon={Clock} hint="Coming soon" />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="Active cycles"
            description="Cycles currently running."
            action={
              <Link href="/cycles" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {isCyclesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : activeCycles.length > 0 ? (
              <ul className="divide-y divide-border">
                {activeCycles.map((cycle) => (
                  <li key={cycle.id}>
                    <CycleRow cycle={cycle} />
                  </li>
                ))}
              </ul>
            ) : (
              <PageEmpty
                icon={CalendarRange}
                title="No active cycles"
                description="When a performance cycle is active, it will show here."
              />
            )}
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection
            title="Recent updates"
            action={
              <Link href="/notifications" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
                Inbox <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {isNotifLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : notifications.length > 0 ? (
              <ul className="space-y-1.5">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <p className="truncate font-medium text-foreground">{n.title}</p>
                    {n.message ? (
                      <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </p>
            )}
          </DashboardSection>
        </DashboardPanel>
      </div>
    </PageContainer>
  );
}

function DashboardSkeleton() {
  return (
    <PageContainer width="wide" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </PageContainer>
  );
}

export default function PerformanceDashboardPage() {
  const { user } = useAuth();

  if (!canAccessPerformance(user)) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader title="Dashboard" description="Performance management." />
        <PagePermissionNotice
          title="Performance is not available for your role"
          description="Ask an administrator to grant performance permissions."
        />
      </PageContainer>
    );
  }

  if (canManagePerformanceCycles(user)) {
    return <PerformanceAdminDashboard />;
  }

  return <ParticipantDashboard />;
}
