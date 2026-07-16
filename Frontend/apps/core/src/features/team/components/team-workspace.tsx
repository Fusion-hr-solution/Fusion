"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { useAuth } from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PageEmpty,
  PageError,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamPageSkeleton } from "@/shell/route-skeletons";
import { canAccessTeamWorkspace } from "@/lib/employee-roster-access";
import { useEmployeeReportingLines } from "@/app/(pages)/employees/use-employees";

export default function TeamWorkspace() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const canAccess = canAccessTeamWorkspace(user);
  const { data, error, isLoading, isFetching, refetch } =
    useEmployeeReportingLines(canAccess ? employeeId : null);
  const directReports = data?.directReports ?? [];

  if (isAuthLoading || (canAccess && isLoading && !data && !error)) {
    return <TeamPageSkeleton />;
  }

  if (!canAccess || !employeeId) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="My Team" description="Manager workspace only." />
        <PagePermissionNotice
          title="No team workspace available"
          description="Contact a tenant HR administrator to link your manager record."
        />
      </PageContainer>
    );
  }

  if (error && !data) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="My Team" description="Direct reports." />
        <PageError
          title="Failed to load team"
          description="Could not load team data. Try again in a moment."
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="My Team" description="Direct reports." />

      <Card>
        <CardHeader density="compact">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>Direct reports</CardTitle>
            <StatusBadge tone="neutral">
              {directReports.length} direct report
              {directReports.length === 1 ? "" : "s"}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          {directReports.length === 0 && !isFetching ? (
            <PageEmpty
              icon={Users}
              title="No direct reports"
              description="No employees report to you right now."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {directReports.map(({ employee }) => (
                <Link
                  key={employee.id}
                  href={`/employees/${employee.stableEmployeeKey}`}
                  className="group rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {employee.email}
                      </p>
                      {employee.jobTitle ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {employee.jobTitle}
                        </p>
                      ) : null}
                    </div>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
