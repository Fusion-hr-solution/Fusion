"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Building,
  Building2,
  ClipboardList,
  ExternalLink,
  Mail,
  Network,
  Pause,
  Plus,
  Settings2,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import {
  canAccessCoreOverview,
  canAccessCoreAccess,
  canAccessCoreSettings,
  canAccessCoreSetup,
  canAccessOrganizations,
  canManageCoreAccessProfiles,
  canSeeCoreSetupNavigation,
  canSeeCoreSettingsNavigation,
  type AuthUser,
  useAuth,
} from "@repo/auth";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canAccessEmployeeRoster,
  canAccessSelfEmployeeProfile,
  canAccessTeamWorkspace,
} from "@/lib/employee-roster-access";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { buildImportHistoryHref } from "@/app/(pages)/employees/employee-readiness";
import {
  useEmployeeProfile,
  useEmployeeReportingLines,
  useEmployeeRoster,
  useWorkforceReadinessSummary,
} from "@/app/(pages)/employees/use-employees";
import { StatusBadge } from "@/app/(pages)/organizations/status-badge";
import { StatsCards } from "@/app/(pages)/organizations/stats-cards";
import { useOrganizationList } from "@/features/organizations/api/use-organizations";

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

function formatCompactDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getNewHireLabel(hireDate: string) {
  const parsed = new Date(hireDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const now = new Date();
  const diffInDays = Math.ceil(
    (parsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays > 0) {
    return diffInDays === 1
      ? "Starts tomorrow"
      : `Starts in ${diffInDays} days`;
  }

  if (diffInDays >= -30) {
    const daysSinceStart = Math.abs(diffInDays);
    return daysSinceStart <= 1
      ? "Started recently"
      : `Started ${daysSinceStart} days ago`;
  }

  return null;
}

function HRAdminDashboard() {
  const { user } = useAuth();
  const {
    data: rs,
    error: rsError,
    isLoading: isRsLoading,
  } = useWorkforceReadinessSummary();
  const {
    data: recentEmployees,
    error: recentEmployeesError,
    isLoading: isRecentEmployeesLoading,
  } = useEmployeeRoster({
    sortBy: "HireDate",
    sortDir: "Desc",
    page: 1,
    pageSize: 5,
  });
  const reportingIssueCount = rs
    ? rs.issueCounts.noManagerAssigned +
      rs.issueCounts.managerInactive +
      rs.issueCounts.managerMissing
    : 0;
  const canSeeSetup = canSeeCoreSetupNavigation(user);
  const canSeeSettings = canSeeCoreSettingsNavigation(user);
  const recentHireItems = recentEmployees?.items ?? [];

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Overview"
        description="People, access, and setup work needing attention."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2 flex flex-col">
          <CardHeader
            density="compact"
            className="flex-row items-center justify-between gap-3 space-y-0"
          >
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Users className="size-4" />
                </div>
                <CardTitle className="text-base">Data quality</CardTitle>
              </div>
              {rs ? <Badge variant="outline">{rs.activeEmployeeCount} active</Badge> : null}
            </CardHeader>
            <CardContent density="compact" className="flex-1">
              {rs ? (
                <div className="space-y-3">
                  <div className="grid gap-1.5">
                  <Link
                    href="/employees?readiness=MissingRequiredField"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Missing required fields</span>
                    <span className="font-medium tabular-nums">
                      {rs.issueCounts.missingRequiredFields}
                    </span>
                  </Link>
                  <Link
                    href="/employees?readiness=MissingOrgUnit"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Missing org units</span>
                    <span className="font-medium tabular-nums">
                      {rs.issueCounts.missingOrgUnit}
                    </span>
                  </Link>
                  <Link
                    href="/employees?readiness=DeactivationBlocked"
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Broken manager relationships</span>
                    <span className="font-medium tabular-nums">
                      {rs.issueCounts.managerInactive + rs.issueCounts.managerMissing}
                    </span>
                  </Link>
                  <Link
                    href={buildImportHistoryHref()}
                    className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <span>Unresolved import follow-up</span>
                    <span className="font-medium tabular-nums">
                      {rs.issueCounts.unresolvedImportIssues}
                    </span>
                  </Link>
                </div>
              </div>
            ) : isRsLoading ? (
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ) : rsError ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                <AlertTriangle className="size-4" />
                People and import issues are temporarily unavailable.
              </div>
            ) : (
              <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                No employee data available.
              </div>
            )}
          </CardContent>
          <CardContent density="compact" className="pt-0">
            <Link
              href="/employees"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Review people
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              density="compact"
              className="flex-row items-center justify-between gap-3 space-y-0"
            >
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <ShieldCheck className="size-4" />
                </div>
                <CardTitle className="text-base">Access</CardTitle>
              </div>
              <Badge variant="outline">2 actions</Badge>
            </CardHeader>
            <CardContent density="compact" className="space-y-2">
              <Link
                href="/employees?create=1"
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
              >
                <span>Add employee</span>
                <Plus className="size-4 text-muted-foreground" />
              </Link>
              <Link
                href="/access?access=NotInvited"
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
              >
                <span>Review pending access</span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              density="compact"
              className="flex-row items-center justify-between gap-3 space-y-0"
            >
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <ClipboardList className="size-4" />
                </div>
                <CardTitle className="text-base">Setup</CardTitle>
              </div>
              <Badge variant={canSeeSetup ? "secondary" : "outline"}>
                {canSeeSetup ? "Available" : "Restricted"}
              </Badge>
            </CardHeader>
            {canSeeSetup && (
              <CardContent density="compact">
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

        <Card className="flex flex-col">
          <CardHeader
            density="compact"
            className="flex-row items-center justify-between gap-3 space-y-0"
          >
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-4" />
              </div>
              <CardTitle className="text-base">Recent hires</CardTitle>
            </div>
            <Badge variant="outline">{recentHireItems.length}</Badge>
          </CardHeader>
          <CardContent density="compact" className="flex-1">
            {isRecentEmployeesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : recentEmployeesError ? (
              <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                Recent hires are temporarily unavailable.
              </div>
            ) : recentHireItems.length > 0 ? (
              <div className="space-y-2">
                  {recentHireItems.map((employee) => (
                  <Link
                    key={employee.id}
                    href={`/employees/${employee.stableEmployeeKey}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {employee.jobTitle || employee.email}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{formatCompactDate(employee.hireDate)}</p>
                      {getNewHireLabel(employee.hireDate) ? (
                        <p>{getNewHireLabel(employee.hireDate)}</p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                No recent hires are available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <Link href="/org-chart" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <Network className="size-4" />
          Open org chart
        </Link>
        {canSeeSettings ? (
          <Link href="/settings" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Settings2 className="size-4" />
            Open settings
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ManagerDashboard() {
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const { data: profile, isLoading: isProfileLoading } =
    useEmployeeProfile(employeeId);
  const { data: reportingLines, isLoading: isReportingLoading } =
    useEmployeeReportingLines(employeeId);
  const directReportCount = reportingLines?.directReportCount ?? 0;
  const hasReportingData =
    profile?.managerFullName ?? profile?.orgUnitName ?? null;

  if (isProfileLoading && !profile) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with your profile and team.
        </p>
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
              {profile
                ? `${profile.fullName}${profile.jobTitle ? ` · ${profile.jobTitle}` : ""}`
                : "Your linked employee record."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {profile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      profile.status === "Active" ? "secondary" : "outline"
                    }
                  >
                    {profile.status}
                  </Badge>
                </div>
                {profile.managerFullName ? (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Manager</span>
                    <span className="font-medium">
                      {profile.managerFullName}
                    </span>
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
              {isReportingLoading
                ? "Loading team summary..."
                : `${directReportCount} direct report${directReportCount === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {isReportingLoading ? (
              <Skeleton className="h-9 w-full rounded-lg" />
            ) : directReportCount > 0 ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Employees who report directly to you.
              </div>
            ) : (
              <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                No direct reports currently assigned.
              </div>
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
                    <span className="font-medium">
                      {profile.managerFullName}
                    </span>
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
  const { data: profile, isLoading: isProfileLoading } =
    useEmployeeProfile(employeeId);

  if (isProfileLoading && !profile) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your profile and work details.
        </p>
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
              {profile
                ? `${profile.fullName}${profile.jobTitle ? ` · ${profile.jobTitle}` : ""}`
                : "Your work profile."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {profile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      profile.status === "Active" ? "secondary" : "outline"
                    }
                  >
                    {profile.status}
                  </Badge>
                </div>
                {profile.managerFullName ? (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Manager</span>
                    <span className="font-medium">
                      {profile.managerFullName}
                    </span>
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
              {profile?.preferredName
                ? `Preferred name: ${profile.preferredName}`
                : "Set your preferred display name."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/profile"
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
  const {
    data: recentData,
    error: dashboardError,
    isLoading: isDashboardLoading,
    refetch: refetchDashboard,
  } = useOrganizationList({ skip: 0, take: 5 });
  const {
    data: attentionData,
    error: attentionError,
    isLoading: isAttentionLoading,
    refetch: refetchAttention,
  } = useOrganizationList({
    skip: 0,
    take: 5,
    filterByStatus: ["invited", "suspended"],
  });
  const stats = recentData?.stats;
  const recentOrgs = recentData?.items ?? [];
  const attentionOrgs = attentionData?.items ?? [];
  const totalAttentionCount =
    (stats?.invitedPending ?? 0) + (stats?.suspendedOrganizations ?? 0);
  const remainingAttentionCount = Math.max(
    totalAttentionCount - attentionOrgs.length,
    0
  );

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Platform workspace"
        description="Organizations and platform operations."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/organizations?create=1">
                <Plus className="size-4" />
                New organization
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/organizations">Open organizations</Link>
            </Button>
          </div>
        }
      />

      {dashboardError && !recentData ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load platform dashboard</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              {dashboardError.message || "An unexpected error occurred."}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchDashboard()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <StatsCards
            stats={stats}
            isLoading={isDashboardLoading && !recentData}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2 flex flex-col">
              <CardHeader
                density="compact"
                className="flex-row items-center justify-between gap-3 space-y-0"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <AlertTriangle className="size-4" />
                  </div>
                  <CardTitle className="text-base">Needs attention</CardTitle>
                </div>
                <Badge variant="outline">{totalAttentionCount}</Badge>
              </CardHeader>
              <CardContent density="compact" className="flex-1">
                {attentionError && !attentionData ? (
                  <Alert variant="destructive">
                    <AlertTitle>
                      Failed to load organizations needing attention
                    </AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-4">
                      <span>
                        {attentionError.message ||
                          "An unexpected error occurred."}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchAttention()}
                      >
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : isAttentionLoading && !attentionData ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : totalAttentionCount > 0 ? (
                  <div className="space-y-3">
                    {attentionOrgs.length > 0 ? (
                      <div className="space-y-1.5">
                        {attentionOrgs.map((org) => (
                          <Link
                            key={org.id}
                            href={`/organizations?detail=${org.id}`}
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate font-medium">
                                {org.name}
                              </span>
                              <StatusBadge status={org.operationalStatus} />
                            </div>
                            <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                              {org.pendingInviteCount > 0 && (
                                <span>
                                  {org.pendingInviteCount} invite
                                  {org.pendingInviteCount !== 1 ? "s" : ""}
                                </span>
                              )}
                              {org.activeUserCount > 0 && (
                                <span>
                                  {org.activeUserCount} user
                                  {org.activeUserCount !== 1 ? "s" : ""}
                                </span>
                              )}
                              <ExternalLink className="size-3.5" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        Organizations still need attention. Open the
                        organizations table to review them.
                      </div>
                    )}
                    {remainingAttentionCount > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {remainingAttentionCount} more organization
                        {remainingAttentionCount === 1 ? "" : "s"} need
                        attention.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                    All organizations are in good standing.
                  </div>
                )}
              </CardContent>
              <CardContent density="compact" className="pt-0">
                <Link
                  href="/organizations"
                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  All organizations
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader density="compact">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Building className="size-4" />
                  </div>
                  <CardTitle className="text-base">Quick actions</CardTitle>
                </div>
              </CardHeader>
              <CardContent density="compact" className="flex flex-1 flex-col gap-2">
                <Link
                  href="/organizations?create=1"
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/10"
                >
                  <Plus className="size-4 text-muted-foreground" />
                  Create organization
                </Link>
                <Link
                  href="/organizations?status=invited"
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/10"
                >
                  <Mail className="size-4 text-muted-foreground" />
                  Review invited orgs
                </Link>
                <Link
                  href="/organizations?status=suspended"
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/10"
                >
                  <Pause className="size-4 text-muted-foreground" />
                  Manage suspended orgs
                </Link>
                <Link
                  href="/organizations"
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/10"
                >
                  <Building2 className="size-4 text-muted-foreground" />
                  Full organizations table
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              density="compact"
              className="flex-row items-center justify-between gap-3 space-y-0"
            >
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Building className="size-4" />
                </div>
                <CardTitle className="text-base">
                  Recently created organizations
                </CardTitle>
              </div>
              <Badge variant="outline">{recentOrgs.length}</Badge>
            </CardHeader>
            <CardContent density="compact">
              {isDashboardLoading && !recentData ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : recentOrgs.length > 0 ? (
                <div className="divide-y">
                  {recentOrgs.map((org) => (
                    <Link
                      key={org.id}
                      href={`/organizations?detail=${org.id}`}
                      className="flex items-center justify-between px-1 py-2.5 text-sm transition-colors hover:text-primary"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{org.name}</span>
                        <StatusBadge status={org.operationalStatus} />
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Created {new Date(org.createdAt).toLocaleDateString()}
                        </span>
                        <ExternalLink className="size-3.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  No organizations created yet.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PlatformAdminTenantDashboard() {
  const { tenantId, tenantSlug, tenantName, isLoading, isReady } = useTenantContext();
  const tenantHref = (href: string) => buildTenantContextHref(href, tenantId, tenantSlug);
  const { data: rs, isLoading: isRsLoading } = useWorkforceReadinessSummary();
  const reportingIssueCount = rs
    ? rs.issueCounts.noManagerAssigned +
      rs.issueCounts.managerInactive +
      rs.issueCounts.managerMissing
    : 0;

  if (isLoading && !isReady) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title={tenantName ?? "Tenant context"}
        description={
          isReady
            ? "Tenant overview and workforce data quality."
            : "Tenant summary is still loading."
        }
        actions={
          <Button asChild variant="outline">
            <Link href={tenantHref("/setup")}>View setup</Link>
          </Button>
        }
      />

      {rs ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active employees
            </span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {rs.activeEmployeeCount}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Missing fields
            </span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {rs.issueCounts.missingRequiredFields}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Missing org units
            </span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {rs.issueCounts.missingOrgUnit}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Broken managers
            </span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {rs.issueCounts.managerInactive + rs.issueCounts.managerMissing}
            </span>
          </div>
        </div>
      ) : isRsLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 flex flex-col">
          <CardHeader
            density="compact"
            className="flex-row items-center justify-between gap-3 space-y-0"
          >
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Users className="size-4" />
                </div>
                <CardTitle className="text-base">Data quality</CardTitle>
              </div>
              {rs ? <Badge variant="outline">{rs.activeEmployeeCount} active</Badge> : null}
            </CardHeader>
            <CardContent density="compact" className="flex-1">
              {rs ? (
                <div className="space-y-3">
                  <div className="grid gap-1.5">
                    <Link
                      href={tenantHref(
                        "/employees?readiness=MissingRequiredField"
                      )}
                      className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                    >
                      <span>Missing required fields</span>
                      <span className="font-medium tabular-nums">
                        {rs.issueCounts.missingRequiredFields}
                      </span>
                    </Link>
                    <Link
                      href={tenantHref("/employees?readiness=MissingOrgUnit")}
                      className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                    >
                      <span>Missing org units</span>
                      <span className="font-medium tabular-nums">
                        {rs.issueCounts.missingOrgUnit}
                      </span>
                    </Link>
                    <Link
                      href={tenantHref("/employees?readiness=DeactivationBlocked")}
                      className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                    >
                      <span>Broken manager relationships</span>
                      <span className="font-medium tabular-nums">
                        {rs.issueCounts.managerInactive + rs.issueCounts.managerMissing}
                      </span>
                    </Link>
                    <Link
                      href={tenantHref(buildImportHistoryHref())}
                      className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                    >
                      <span>Unresolved import follow-up</span>
                      <span className="font-medium tabular-nums">
                        {rs.issueCounts.unresolvedImportIssues}
                      </span>
                    </Link>
                  </div>
                </div>
              ) : isRsLoading ? (
                <div className="space-y-3">
                  <div className="grid gap-1.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full rounded-lg" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  People and import issues are temporarily unavailable.
                </div>
              )}
            </CardContent>
            <CardContent density="compact" className="pt-0">
              <Link
                href={tenantHref("/employees")}
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                Review people
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader density="compact">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Settings2 className="size-4" />
              </div>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent density="compact" className="flex flex-1 flex-col gap-2">
            <Link
              href={tenantHref("/setup")}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/10"
            >
              <ClipboardList className="size-4 text-muted-foreground" />
              Setup
            </Link>
            <Link
              href={tenantHref("/settings")}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/10"
            >
              <Settings2 className="size-4 text-muted-foreground" />
              Settings
            </Link>
            <Link
              href={tenantHref("/org-chart")}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/10"
            >
              <Network className="size-4 text-muted-foreground" />
              Org chart
            </Link>
            <Link
              href={tenantHref("/employees")}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/10"
            >
              <Users className="size-4 text-muted-foreground" />
              Employees
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CoreOperationsDashboard() {
  const { user } = useAuth();
  const { tenantId, tenantSlug } = useTenantContext();

  // Show the create-tenant button only when there's no active tenant context
  // AND the user is a super-admin.
  const moduleHref = (href: string) =>
    tenantId ? buildTenantContextHref(href, tenantId, tenantSlug) : href;

  const workspaces = [
    canAccessCoreAccess(user)
      ? {
          href: moduleHref("/access"),
          title: "Access",
          badge: "Invites",
          icon: ShieldCheck,
        }
      : canManageCoreAccessProfiles(user)
        ? {
            href: moduleHref("/settings?tab=access-profiles"),
            title: "Settings",
            badge: "Access profiles",
            icon: ShieldCheck,
          }
      : null,
    canSeeCoreSetupNavigation(user)
      ? {
          href: moduleHref("/setup"),
          title: "Setup",
          badge: "Readiness",
          icon: ClipboardList,
        }
      : null,
    canSeeCoreSettingsNavigation(user)
      ? {
          href: moduleHref("/settings"),
          title: "Settings",
          badge: "Config",
          icon: Settings2,
        }
      : null,
    canAccessEmployeeRoster(user)
      ? {
          href: moduleHref("/employees"),
          title: "Employees",
          badge: "Roster",
          icon: Users,
        }
      : null,
    canAccessTeamWorkspace(user)
      ? {
          href: moduleHref("/team"),
          title: "My Team",
          badge: "Reports",
          icon: Users,
        }
      : null,
    canAccessSelfEmployeeProfile(user)
      ? {
          href: moduleHref("/profile"),
          title: "My Profile",
          badge: "Self",
          icon: User,
        }
      : null,
  ].filter((workspace) => workspace !== null);

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Overview"
        description="Open the Core workspace you use today."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((workspace) => {
          const Icon = workspace.icon;

          return (
            <Card key={workspace.title}>
              <CardHeader
                density="compact"
                className="flex-row items-center justify-between gap-3 space-y-0"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <CardTitle className="text-base">{workspace.title}</CardTitle>
                </div>
                <Badge variant="outline">{workspace.badge}</Badge>
              </CardHeader>
              <CardContent density="compact">
                <Link
                  href={workspace.href}
                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Open {workspace.title.toLowerCase()}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CoreWorkspaceRedirect({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return (
    <CorePageLoadingState
      title="Overview"
      description={`Redirecting to ${label}.`}
      message={`Redirecting to ${href}`}
      variant="redirect"
    />
  );
}

function getFallbackWorkspace(user: AuthUser | null): {
  href: string;
  label: string;
} | null {
  if (canAccessCoreAccess(user)) {
    return { href: "/access", label: "Access" };
  }

  if (canManageCoreAccessProfiles(user)) {
    return { href: "/settings?tab=access-profiles", label: "Settings" };
  }

  if (canAccessCoreSetup(user)) {
    return { href: "/setup", label: "Setup" };
  }

  if (canAccessCoreSettings(user)) {
    return { href: "/settings", label: "Settings" };
  }

  if (canAccessEmployeeRoster(user)) {
    return { href: "/employees", label: "Employees" };
  }

  if (canAccessTeamWorkspace(user)) {
    return { href: "/team", label: "My Team" };
  }

  if (canAccessSelfEmployeeProfile(user)) {
    return { href: "/profile", label: "My Profile" };
  }

  return null;
}

export default function OverviewWorkspace() {
  const { user, isLoading } = useAuth();
  const { tenantId } = useTenantContext();
  const isInTenantContext = !!tenantId;
  const canSeeOverview = canAccessCoreOverview(user);
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

  if (canSeeOverview && isHrAdmin) {
    return <HRAdminDashboard />;
  }

  if (canSeeOverview && isManager) {
    return <ManagerDashboard />;
  }

  if (canSeeOverview && isEmployee) {
    return <EmployeeDashboard />;
  }

  if (canSeeOverview) {
    return <CoreOperationsDashboard />;
  }

  const fallbackWorkspace = getFallbackWorkspace(user);
  if (fallbackWorkspace) {
    return (
      <CoreWorkspaceRedirect
        href={fallbackWorkspace.href}
        label={fallbackWorkspace.label}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Overview"
        description="No Core workspaces are available for your current role."
      />
      <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        Contact your platform administrator to configure access.
      </div>
    </div>
  );
}
