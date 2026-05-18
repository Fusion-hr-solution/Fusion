"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Building, ClipboardList, Network, Settings2, User, Users } from "lucide-react";
import { canAccessOrganizations, canSeeCoreSetupNavigation, canSeeCoreSettingsNavigation, useAuth } from "@repo/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccessEmployeeRoster, canAccessSelfEmployeeProfile, canAccessTeamWorkspace } from "@/lib/employee-roster-access";
import { useTenantContext } from "@/components/core-tenant-context-provider";
import { buildImportHistoryHref } from "./employees/employee-readiness";
import { useEmployeeProfile, useEmployeeReportingLines, useWorkforceReadinessSummary } from "./employees/use-employees";

function LoadingSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface DashboardCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  href: string;
  cta?: string;
  children?: React.ReactNode;
}

function DashboardCard({ icon: Icon, title, description, href, cta, children }: DashboardCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {children ? <CardContent className="flex-1">{children}</CardContent> : null}
      <CardContent className="pt-0">
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          {cta ?? `Open ${title.toLowerCase()}`}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

function HRAdminDashboard() {
  const { user } = useAuth();
  const { data: rs, error: rsError, isLoading: isRsLoading } = useWorkforceReadinessSummary();
  const reportingIssueCount = rs
    ? rs.issueCounts.noManagerAssigned + rs.issueCounts.managerInactive + rs.issueCounts.managerMissing
    : 0;
  const canSeeSetup = canSeeCoreSetupNavigation(user);
  const canSeeSettings = canSeeCoreSettingsNavigation(user);

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Core workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage structure, employees, access, and workforce readiness.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Workforce health — spans 2 columns */}
        <Card className="xl:col-span-2 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-4" />
              </div>
              <CardTitle className="text-base">Workforce health</CardTitle>
            </div>
            <CardDescription>Employee record issues and operational blockers.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {rs ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="text-sm font-medium">Readiness score</span>
                  <Badge variant="secondary">{rs.readinessScore}%</Badge>
                </div>
                <div className="grid gap-1.5">
                  <Link
                    href="/employees?readiness=NeedsAttention"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Employees needing attention</span>
                    <span className="font-medium tabular-nums">{rs.employeesNeedingAttention}</span>
                  </Link>
                  <Link
                    href="/employees?readiness=MissingRequiredField"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Missing required fields</span>
                    <span className="font-medium tabular-nums">{rs.issueCounts.missingRequiredFields}</span>
                  </Link>
                  <Link
                    href="/employees?readiness=MissingOrgUnit"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Missing org units</span>
                    <span className="font-medium tabular-nums">{rs.issueCounts.missingOrgUnit}</span>
                  </Link>
                  <Link
                    href="/employees?readiness=ReportingIssue"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Reporting issues</span>
                    <span className="font-medium tabular-nums">{reportingIssueCount}</span>
                  </Link>
                  <Link
                    href={buildImportHistoryHref()}
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Unresolved import follow-up</span>
                    <span className="font-medium tabular-nums">{rs.issueCounts.unresolvedImportIssues}</span>
                  </Link>
                </div>
              </div>
            ) : isRsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full rounded-lg" />
                <div className="grid gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ) : rsError ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                <AlertTriangle className="size-4" />
                Workforce health is temporarily unavailable.
              </div>
            ) : (
              <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                No employee data available.
              </div>
            )}
          </CardContent>
          <CardContent className="pt-0">
            <Link
              href="/employees"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Open employees
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="size-4" />
                </div>
                <CardTitle className="text-base">Access activation</CardTitle>
              </div>
              <CardDescription>Invite employees and manage platform access.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/employees?access=NotInvited"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                Review access invitations
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <ClipboardList className="size-4" />
                </div>
                <CardTitle className="text-base">Setup</CardTitle>
              </div>
              <CardDescription>
                {canSeeSetup ? "Organization structure is published and live." : "Organization structure management."}
              </CardDescription>
            </CardHeader>
            {canSeeSetup && (
              <CardContent>
                <Link
                  href="/setup"
                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Open setup
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardContent>
            )}
          </Card>
        </div>

        <DashboardCard icon={Users} title="Employees" description="Roster operations, import workflow, and employee profiles." href="/employees" />

        <DashboardCard icon={Network} title="Org chart" description="Organizational hierarchy and reporting visibility." href="/org-chart" />

        {canSeeSettings ? (
          <DashboardCard icon={Settings2} title="Settings" description="Configuration surface for tenant preferences." href="/settings" />
        ) : null}
      </div>
    </div>
  );
}

function ManagerDashboard() {
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const { data: profile, isLoading: isProfileLoading } = useEmployeeProfile(employeeId);
  const { data: reportingLines, isLoading: isReportingLoading } = useEmployeeReportingLines(employeeId);
  const directReportCount = reportingLines?.directReportCount ?? 0;
  const hasReportingData = profile?.managerFullName ?? profile?.orgUnitName ?? null;

  if (isProfileLoading && !profile) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review your profile and team context.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="size-4" />
              </div>
              <CardTitle className="text-base">My Profile</CardTitle>
            </div>
            <CardDescription>
              {profile ? `${profile.fullName}${profile.jobTitle ? ` · ${profile.jobTitle}` : ""}` : "Your linked employee record."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {profile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={profile.status === "Active" ? "secondary" : "outline"}>{profile.status}</Badge>
                </div>
                {profile.managerFullName ? (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Manager</span>
                    <span className="font-medium">{profile.managerFullName}</span>
                  </div>
                ) : null}
                {profile.orgUnitName ? (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Org unit</span>
                    <span className="font-medium">{profile.orgUnitName}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
          <CardContent className="pt-0">
            <Link
              href="/profile"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Open profile
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-4" />
              </div>
              <CardTitle className="text-base">My Team</CardTitle>
            </div>
            <CardDescription>
              {isReportingLoading ? "Loading..." : `${directReportCount} direct report${directReportCount === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {isReportingLoading ? (
              <Skeleton className="h-9 w-full rounded-lg" />
            ) : directReportCount > 0 ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Manager scope includes employees who report directly to you.
              </div>
            ) : (
              <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">No direct reports currently assigned.</div>
            )}
          </CardContent>
          <CardContent className="pt-0">
            <Link
              href="/team"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Open team
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>

        {hasReportingData ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Network className="size-4" />
                </div>
                <CardTitle className="text-base">Reporting context</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 text-sm">
                {profile?.managerFullName ? (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-1.5">
                    <span className="text-muted-foreground">Reports to</span>
                    <span className="font-medium">{profile.managerFullName}</span>
                  </div>
                ) : null}
                {profile?.orgUnitName ? (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-1.5">
                    <span className="text-muted-foreground">Org unit</span>
                    <span className="font-medium">{profile.orgUnitName}</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function EmployeeDashboard() {
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const { data: profile, isLoading: isProfileLoading } = useEmployeeProfile(employeeId);

  if (isProfileLoading && !profile) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review your Core profile and work context.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="size-4" />
              </div>
              <CardTitle className="text-base">My Profile</CardTitle>
            </div>
            <CardDescription>
              {profile ? `${profile.fullName}${profile.jobTitle ? ` · ${profile.jobTitle}` : ""}` : "Your linked employee record."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {profile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={profile.status === "Active" ? "secondary" : "outline"}>{profile.status}</Badge>
                </div>
                {profile.managerFullName ? (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Manager</span>
                    <span className="font-medium">{profile.managerFullName}</span>
                  </div>
                ) : null}
                {profile.orgUnitName ? (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Org unit</span>
                    <span className="font-medium">{profile.orgUnitName}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
          <CardContent className="pt-0">
            <Link
              href="/profile"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Open profile
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Settings2 className="size-4" />
              </div>
              <CardTitle className="text-base">Profile preferences</CardTitle>
            </div>
            <CardDescription>
              {profile?.preferredName ? `Preferred name: ${profile.preferredName}` : "Set your preferred display name."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={employeeId ? `/employees/${employeeId}` : "/profile"}
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Edit profile preferences
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlatformAdminDashboard() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage tenant organizations and first admin access.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardCard icon={Building} title="Organizations" description="Tenant organization records and lifecycle administration." href="/organizations" />
      </div>
    </div>
  );
}

function PlatformAdminTenantDashboard() {
  const { tenantId, tenantName, isLoading, isReady } = useTenantContext();
  const { data: rs, isLoading: isRsLoading } = useWorkforceReadinessSummary();
  const reportingIssueCount = rs
    ? rs.issueCounts.noManagerAssigned + rs.issueCounts.managerInactive + rs.issueCounts.managerMissing
    : 0;

  if (isLoading && !isReady) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tenantName ?? tenantId ?? "Tenant context"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isReady
            ? "Tenant overview and support surfaces."
            : "Tenant summary is still loading. Read-only tenant surfaces are available now."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Workforce health */}
        <Card className="xl:col-span-2 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-4" />
              </div>
              <CardTitle className="text-base">Workforce health</CardTitle>
            </div>
            <CardDescription>Employee record issues and operational blockers.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {rs ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="text-sm font-medium">Readiness score</span>
                  <Badge variant="secondary">{rs.readinessScore}%</Badge>
                </div>
                <div className="grid gap-1.5">
                  <Link
                    href="/employees?readiness=NeedsAttention"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Employees needing attention</span>
                    <span className="font-medium tabular-nums">{rs.employeesNeedingAttention}</span>
                  </Link>
                  <Link
                    href="/employees?readiness=MissingRequiredField"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Missing required fields</span>
                    <span className="font-medium tabular-nums">{rs.issueCounts.missingRequiredFields}</span>
                  </Link>
                  <Link
                    href="/employees?readiness=MissingOrgUnit"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Missing org units</span>
                    <span className="font-medium tabular-nums">{rs.issueCounts.missingOrgUnit}</span>
                  </Link>
                  <Link
                    href="/employees?readiness=ReportingIssue"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Reporting issues</span>
                    <span className="font-medium tabular-nums">{reportingIssueCount}</span>
                  </Link>
                  <Link
                    href={buildImportHistoryHref()}
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Unresolved import follow-up</span>
                    <span className="font-medium tabular-nums">{rs.issueCounts.unresolvedImportIssues}</span>
                  </Link>
                </div>
              </div>
            ) : isRsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full rounded-lg" />
                <div className="grid gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                Workforce health data unavailable.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="flex flex-col gap-4">
          <DashboardCard icon={Settings2} title="Setup" description="Setup status and published structure." href="/setup" cta="View setup" />
          <DashboardCard icon={ClipboardList} title="Settings" description="Tenant configuration and field policy." href="/settings" cta="View settings" />
          <DashboardCard icon={Network} title="Org Chart" description="Organizational hierarchy viewer." href="/org-chart" cta="View org chart" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const { tenantId } = useTenantContext();
  const isInTenantContext = !!tenantId;
  const isHrAdmin = canAccessEmployeeRoster(user);
  const isPlatformAdmin = canAccessOrganizations(user);
  const isManager = canAccessTeamWorkspace(user);
  const isEmployee = canAccessSelfEmployeeProfile(user);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isInTenantContext && isPlatformAdmin) {
    return <PlatformAdminTenantDashboard />;
  }

  if (isPlatformAdmin) {
    return <PlatformAdminDashboard />;
  }

  if (isHrAdmin) {
    return <HRAdminDashboard />;
  }

  if (isManager) {
    return <ManagerDashboard />;
  }

  if (isEmployee) {
    return <EmployeeDashboard />;
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Core workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">No workspaces are available for your current role.</p>
      </div>
      <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        Contact your platform administrator to configure access.
      </div>
    </div>
  );
}
