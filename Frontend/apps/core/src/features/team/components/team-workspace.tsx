"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { useAuth } from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PageEmpty,
  PageError,
  StatusBadge,
} from "@repo/ds/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamPageSkeleton } from "@/shell/route-skeletons";
import { canAccessTeamWorkspace } from "@/lib/employee-roster-access";
import {
  useEmployeeDetailsById,
  useEmployeeReportingLines,
} from "@/app/(pages)/employees/use-employees";

export default function TeamWorkspace() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const canAccess = canAccessTeamWorkspace(user);

  // Reporting lines are keyed by the stable employee key, not the raw employee id
  // (the auth token carries the GUID). Resolve the details record first to obtain
  // the stable key, exactly as the self-profile page does.
  const { data: details, error: detailsError, isLoading: isDetailsLoading } =
    useEmployeeDetailsById(canAccess ? employeeId : null);
  const stableEmployeeKey = details?.stableEmployeeKey ?? null;
  const {
    data,
    error: reportingError,
    isLoading: isReportingLoading,
    isFetching,
    refetch,
  } = useEmployeeReportingLines(stableEmployeeKey);

  const error = detailsError ?? reportingError;
  const directReports = data?.directReports ?? [];

  // A linked employee can always fall back to their own profile; an unlinked
  // admin falls back to the Core overview.
  const exitHref = employeeId ? "/profile" : "/";
  const exitLabel = employeeId ? "Go to your profile" : "Go to overview";

  if (isAuthLoading) {
    return <TeamPageSkeleton />;
  }

  if (!canAccess || !employeeId) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="My Team" description="Direct reports." />
        <PageEmpty
          icon={Users}
          title="No team to manage"
          description="The team workspace shows people who report to you. You don't have any direct reports right now."
          action={
            <Link
              href={exitHref}
              className="text-sm font-medium text-primary hover:underline"
            >
              {exitLabel}
            </Link>
          }
        />
      </PageContainer>
    );
  }

  if ((isDetailsLoading || isReportingLoading) && !data && !error) {
    return <TeamPageSkeleton />;
  }

  if (error && !data) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="My Team" description="Direct reports." />
        <PageError
          title="Team couldn't load"
          description="Your team didn't load just now. Try again in a moment."
          onRetry={() => refetch()}
        />
        <div className="text-center">
          <Link
            href={exitHref}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {exitLabel}
          </Link>
        </div>
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
                  href={`/people/${employee.stableEmployeeKey}`}
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
