"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CalendarRange } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@repo/ui";
import { canAccessPerformance, useAuth } from "@repo/auth";
import { StatCard, CycleStatusBadge, DeadlineBadge } from "@/components";
import { usePerformanceCycles } from "@/hooks/use-cycles";
import { formatPeriod } from "@/lib/format";

export default function PerformanceDashboardPage() {
  const { user } = useAuth();
  const canAccess = canAccessPerformance(user);

  const { data, isLoading } = usePerformanceCycles(
    { search: null, status: null, type: null, page: 1, pageSize: 50 },
    canAccess
  );

  const cycles = useMemo(() => data?.items ?? [], [data]);
  const activeCount = cycles.filter((c) => c.status === "Active").length;
  const dueSoonCount = cycles.filter(
    (c) => c.deadlineState === "DueSoon" || c.deadlineState === "Overdue"
  ).length;
  const recent = cycles.slice(0, 5);

  if (!canAccess) {
    return (
      <div className="container mx-auto px-4 py-12">
        <EmptyState
          icon={CalendarRange}
          title="Welcome to Performance"
          description="You do not yet have access to performance surfaces. Ask an administrator to grant performance permissions."
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage performance cycles, populations, and objectives.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard label="Active cycles" value={String(activeCount)} />
        <StatCard label="Total cycles" value={String(data?.totalCount ?? cycles.length)} />
        <StatCard label="Deadlines due soon" value={String(dueSoonCount)} />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent cycles</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/cycles">
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No cycles yet"
          description="Performance cycles you create will appear here."
        />
      ) : (
        <div className="space-y-2">
          {recent.map((cycle) => (
            <Link
              key={cycle.id}
              href={`/cycles/${cycle.id}`}
              className="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-accent"
            >
              <div>
                <div className="font-medium">{cycle.name}</div>
                <div className="text-sm text-muted-foreground">
                  {formatPeriod(cycle.periodStart, cycle.periodEnd)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DeadlineBadge state={cycle.deadlineState} />
                <CycleStatusBadge status={cycle.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
