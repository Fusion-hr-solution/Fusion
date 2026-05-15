"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building,
  ClipboardList,
  LayoutDashboard,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  canSeeCoreSetupNavigation,
  canSeeOrganizationsNavigation,
  useAuth,
} from "@repo/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canSeeEmployeeRosterNavigation,
  canSeeSelfEmployeeProfileNavigation,
  canSeeTeamWorkspaceNavigation,
} from "@/lib/employee-roster-access";
import { buildImportHistoryHref } from "./employees/employee-readiness";
import { useWorkforceReadinessSummary } from "./employees/use-employees";

interface WorkspaceArea {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  available: boolean;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const canSeeEmployees = canSeeEmployeeRosterNavigation(user);
  const canSeeMyProfile = canSeeSelfEmployeeProfileNavigation(user);
  const canSeeMyTeam = canSeeTeamWorkspaceNavigation(user);
  const {
    data: readinessSummary,
    error: readinessError,
    isLoading: isReadinessLoading,
  } = useWorkforceReadinessSummary();
  const reportingIssueCount = readinessSummary
    ? readinessSummary.issueCounts.noManagerAssigned +
      readinessSummary.issueCounts.managerInactive +
      readinessSummary.issueCounts.managerMissing
    : 0;

  const workspaceAreas: WorkspaceArea[] = [
    {
      title: "My Profile",
      description:
        "Your linked employee record, status, and reporting context.",
      href: "/profile",
      icon: User,
      available: canSeeMyProfile,
    },
    {
      title: "My Team",
      description: "Direct reports and their current reporting context.",
      href: "/team",
      icon: Users,
      available: canSeeMyTeam,
    },
    {
      title: "Setup",
      description:
        "Tenant structure, draft workspace progress, and publish readiness.",
      href: "/setup",
      icon: ClipboardList,
      available: canSeeCoreSetupNavigation(user),
    },
    {
      title: "Organizations",
      description: "Tenant organization records and lifecycle administration.",
      href: "/organizations",
      icon: Building,
      available: canSeeOrganizationsNavigation(user),
    },
    {
      title: "Employees",
      description:
        "Roster operations, import workflow, and employee history surfaces.",
      href: "/employees",
      icon: Users,
      available: canSeeEmployees,
    },
  ];
  const availableAreas = workspaceAreas.filter((area) => area.available);

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Core workspace"
        description="Summary of active Core workspaces."
      />

      <Card className="py-0">
        <CardContent className="grid gap-6  p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="flex flex-col gap-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <LayoutDashboard className="size-3.5" />
                Operational focus
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Setup, organizations, and employee operations.
                </h2>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {availableAreas.map((area) => {
                const Icon = area.icon;

                return (
                  <div
                    key={area.href}
                    className="flex h-full flex-col rounded-xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </div>
                        <p className="font-medium">{area.title}</p>
                      </div>
                      <Badge variant="secondary">Available</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {area.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {canSeeEmployees ? (
              <Card className="border-dashed bg-muted/10 shadow-none">
                <CardHeader>
                  <CardTitle>Workforce health</CardTitle>
                  <CardDescription>
                    Review the current employee record issues and operational
                    blockers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {readinessSummary ? (
                    <div className="rounded-xl border border-primary/20 bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Workforce readiness
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {readinessSummary.readyEmployeeCount} of{" "}
                            {readinessSummary.activeEmployeeCount} active
                            employee
                            {readinessSummary.activeEmployeeCount === 1
                              ? ""
                              : "s"}{" "}
                            are clean.
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {readinessSummary.readinessScore}% ready
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <Link
                          href="/employees?readiness=NeedsAttention"
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                        >
                          <span>Employees needing attention</span>
                          <span className="font-medium">
                            {readinessSummary.employeesNeedingAttention}
                          </span>
                        </Link>
                        <Link
                          href="/employees?readiness=MissingRequiredField"
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                        >
                          <span>Missing required fields</span>
                          <span className="font-medium">
                            {readinessSummary.issueCounts.missingRequiredFields}
                          </span>
                        </Link>
                        <Link
                          href="/employees?readiness=MissingOrgUnit"
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                        >
                          <span>Missing org units</span>
                          <span className="font-medium">
                            {readinessSummary.issueCounts.missingOrgUnit}
                          </span>
                        </Link>
                        <Link
                          href={buildImportHistoryHref()}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                        >
                          <span>Unresolved import follow-up</span>
                          <span className="font-medium">
                            {
                              readinessSummary.issueCounts
                                .unresolvedImportIssues
                            }
                          </span>
                        </Link>
                        <Link
                          href="/employees?readiness=ReportingIssue"
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                        >
                          <span>Reporting issues</span>
                          <span className="font-medium">{reportingIssueCount}</span>
                        </Link>
                      </div>
                    </div>
                  ) : isReadinessLoading ? (
                    <div className="space-y-3 rounded-xl border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-56" />
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                      <div className="grid gap-2">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Skeleton
                            key={index}
                            className="h-10 w-full rounded-lg"
                          />
                        ))}
                      </div>
                    </div>
                  ) : readinessError ? (
                    <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
                      Workforce health is temporarily unavailable.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-dashed bg-muted/10 shadow-none">
              <CardHeader>
                <CardTitle>Workspace actions</CardTitle>
                <CardDescription>
                  Launch the live Core workspaces available to your current
                  role.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {availableAreas.length > 0 ? (
                  availableAreas.map((area) => {
                    const Icon = area.icon;

                    return (
                      <Link
                        key={area.href}
                        href={area.href}
                        className="group rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                              <Icon className="size-4" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {area.title}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {area.description}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
                    No workspaces are available for your current role.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
