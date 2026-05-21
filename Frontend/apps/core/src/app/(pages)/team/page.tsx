"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { canAccessTeamWorkspace } from "@/lib/employee-roster-access";
import { useEmployeeReportingLines } from "../employees/use-employees";

export default function MyTeamPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const canAccess = canAccessTeamWorkspace(user);
  const { data, error, isLoading, isFetching, refetch } =
    useEmployeeReportingLines(canAccess ? employeeId : null);
  const directReports = data?.directReports ?? [];

  if (isAuthLoading || (canAccess && isLoading && !data && !error)) {
    return (
      <CorePageLoadingState
        title="My Team"
        description="Loading reports..."
        message="Loading team..."
        variant="summary-list"
      />
    );
  }

  if (!canAccess || !employeeId) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="My Team"
          description="Available to linked manager accounts."
        />
        <EmptyState
          icon={Users}
          title="No team workspace available"
          description="Contact a tenant HR administrator to link your manager record."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="My Team"
        description="Direct reports from your linked record."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load team</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error.message || "An unexpected error occurred."}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Direct reports</CardTitle>
              <CardDescription>
                Employees who report directly to you.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {directReports.length} direct report
              {directReports.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {directReports.length === 0 && !isFetching ? (
            <EmptyState
              icon={Users}
              title="No direct reports"
              description="No employees report to you right now."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {directReports.map(({ employee }) => (
                <Link
                  key={employee.id}
                  href={`/employees/${employee.id}`}
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
    </div>
  );
}
