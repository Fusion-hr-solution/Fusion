"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Search, Users } from "lucide-react";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canAccessTeamWorkspace } from "@/lib/employee-roster-access";
import { useMyTeam } from "../employees/use-employees";

export default function TeamPage() {
  const { user } = useAuth();
  const canAccess = canAccessTeamWorkspace(user);
  const [search, setSearch] = useState("");
  const query = useMemo(
    () => ({
      search: search || undefined,
      status: "Active" as const,
      sortBy: "Name" as const,
      sortDir: "Asc" as const,
      page: 1,
      pageSize: 24,
    }),
    [search]
  );
  const { data, error, isLoading, isFetching } = useMyTeam(query);

  if (canAccess && isLoading && !data && !error) {
    return (
      <CorePageLoadingState
        title="My Team"
        description="Loading your direct reports..."
        message="Loading team..."
        variant="list"
      />
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="My Team"
          description="Direct-report access is available only to linked managers."
        />
        <EmptyState
          icon={Users}
          title="Team workspace is not available"
          description="Ask a tenant HR administrator to link your account to a manager employee record."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="My Team"
        description="Direct reports connected to your current employee record."
      />

      <div className="max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Search direct reports"
          />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load your team</AlertTitle>
          <AlertDescription>
            {error.message || "An unexpected error occurred."}
          </AlertDescription>
        </Alert>
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((employee) => (
            <Link key={employee.id} href={`/employees/${employee.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/10">
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {employee.firstName} {employee.lastName}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {employee.jobTitle ?? "Role not set"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        employee.status === "Active" ? "default" : "secondary"
                      }
                    >
                      {employee.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-4" />
                    <span>{employee.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Direct reports
                    </span>
                    <span className="font-medium">
                      {employee.directReportCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium text-foreground">
                    <span>Open profile</span>
                    <ArrowRight className="size-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : !error && !isFetching ? (
        <EmptyState
          icon={Users}
          title="No direct reports found"
          description={
            search
              ? "No direct reports match your current search."
              : "Your linked employee record does not currently manage any direct reports."
          }
        />
      ) : null}
    </div>
  );
}
