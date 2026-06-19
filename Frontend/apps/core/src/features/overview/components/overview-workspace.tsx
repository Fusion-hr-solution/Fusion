"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  ExternalLink,
  Mail,
  Network,
  Pause,
  Plus,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  User,
  UserCheck,
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
  type AuthUser,
  useAuth,
} from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
  KpiStat,
  KpiGrid,
  DashboardPanel,
  DashboardSection,
  DonutChart,
  CHART_TONES,
  type DonutDatum,
} from "@repo/ds/shell";
import { Button } from "@/components/ui/button";
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
import { useOrganizationList } from "@/features/organizations/api/use-organizations";

// ── Shared helpers ──────────────────────────────────────────────────────────

type HrefFn = (href: string) => string;

function formatCompactDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getNewHireLabel(hireDate: string) {
  const parsed = new Date(hireDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffInDays = Math.ceil(
    (parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diffInDays > 0) {
    return diffInDays === 1 ? "Starts tomorrow" : `Starts in ${diffInDays} days`;
  }
  if (diffInDays >= -30) {
    const days = Math.abs(diffInDays);
    return days <= 1 ? "Started recently" : `Started ${days} days ago`;
  }
  return null;
}

function LoadingSkeleton() {
  return (
    <PageContainer width="wide" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
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

function QuickLink({ href, icon: Icon, children }: { href: string; icon: typeof Plus; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/10"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="flex-1">{children}</span>
      <ArrowRight className="size-3.5 text-muted-foreground/50" />
    </Link>
  );
}

// ── Workforce dashboard (HR admin + platform-admin tenant context) ──────────

function WorkforceDashboard({
  title,
  description,
  actions,
  toHref,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  toHref: HrefFn;
}) {
  const { data: rs, isLoading: isRsLoading } = useWorkforceReadinessSummary();
  const {
    data: recentEmployees,
    isLoading: isRecentLoading,
  } = useEmployeeRoster({ sortBy: "HireDate", sortDir: "Desc", page: 1, pageSize: 6 });

  const recentHires = recentEmployees?.items ?? [];
  const totalWorkforce = recentEmployees?.totalCount ?? recentHires.length;
  const active = rs?.activeEmployeeCount ?? 0;
  const inactive = Math.max(totalWorkforce - active, 0);
  const brokenManagers = rs
    ? rs.issueCounts.managerInactive + rs.issueCounts.managerMissing
    : 0;
  const issueRows = rs
    ? [
        {
          name: "Missing required fields",
          value: rs.issueCounts.missingRequiredFields,
          href: toHref("/employees?readiness=MissingRequiredField"),
          color: CHART_TONES.warning,
        },
        {
          name: "Missing org units",
          value: rs.issueCounts.missingOrgUnit,
          href: toHref("/employees?readiness=MissingOrgUnit"),
          color: CHART_TONES.info,
        },
        {
          name: "Broken reporting lines",
          value: brokenManagers,
          href: toHref("/employees?readiness=DeactivationBlocked"),
          color: CHART_TONES.danger,
        },
        {
          name: "Unresolved import follow-up",
          value: rs.issueCounts.unresolvedImportIssues,
          href: toHref(buildImportHistoryHref()),
          color: CHART_TONES.muted,
        },
      ]
    : [];
  const totalIssues = issueRows.reduce((sum, r) => sum + r.value, 0);
  const compositionData: DonutDatum[] = [
    { name: "Active", value: active, color: CHART_TONES.success },
    { name: "Inactive", value: inactive, color: CHART_TONES.muted },
  ];

  if (isRsLoading && !rs) {
    return <LoadingSkeleton />;
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader title={title} description={description} actions={actions} />

      <KpiGrid>
        <KpiStat
          label="Active employees"
          value={active}
          icon={UserCheck}
          hint="Currently employed"
          href={toHref("/employees?status=Active")}
        />
        <KpiStat
          label="Total workforce"
          value={totalWorkforce}
          icon={Users}
          hint={`${inactive} inactive`}
          href={toHref("/employees")}
        />
        <KpiStat
          label="Open data issues"
          value={totalIssues}
          tone={totalIssues > 0 ? "warning" : "success"}
          icon={TriangleAlert}
          hint={totalIssues > 0 ? "Across the workforce" : "Records are healthy"}
          href={toHref("/employees?readiness=MissingRequiredField")}
        />
        <KpiStat
          label="Broken reporting"
          value={brokenManagers}
          tone={brokenManagers > 0 ? "danger" : "success"}
          icon={Network}
          hint={brokenManagers > 0 ? "Need a valid manager" : "All lines valid"}
          href={toHref("/employees?readiness=DeactivationBlocked")}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="Workforce data quality"
            description="Issues blocking a trustworthy system of record."
            action={
              <Link
                href={toHref("/employees")}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                Review people <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {totalIssues > 0 ? (
                <DonutChart
                  className="sm:w-1/2"
                  centerLabel="issues"
                  data={issueRows.map((r) => ({
                    name: r.name,
                    value: r.value,
                    color: r.color,
                  }))}
                />
              ) : (
                <div className="flex flex-1 items-center gap-3 rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground sm:w-1/2">
                  <UserCheck className="size-5 text-emerald-600" />
                  All workforce records are healthy.
                </div>
              )}
              <ul className="flex flex-1 flex-col gap-1.5">
                {issueRows.map((row) => (
                  <li key={row.name}>
                    <Link
                      href={row.href}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-[3px]"
                          style={{ background: row.color }}
                        />
                        {row.name}
                      </span>
                      <span className="font-semibold tabular-nums">{row.value}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection
            title="Workforce composition"
            description="Active vs inactive headcount."
          >
            <DonutChart
              centerLabel="people"
              total={totalWorkforce}
              data={compositionData}
            />
          </DashboardSection>
        </DashboardPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="Recent hires"
            description="Newest people joining the workforce."
            action={
              <Link
                href={toHref("/employees")}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                All employees <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {isRecentLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : recentHires.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentHires.map((employee) => (
                  <li key={employee.id}>
                    <Link
                      href={toHref(`/employees/${employee.stableEmployeeKey}`)}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {employee.firstName} {employee.lastName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {employee.jobTitle || employee.email}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-muted-foreground">
                        <span className="block">{formatCompactDate(employee.hireDate)}</span>
                        {getNewHireLabel(employee.hireDate) ? (
                          <span className="block">{getNewHireLabel(employee.hireDate)}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No recent hires yet.
              </div>
            )}
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection title="Quick actions">
            <div className="flex flex-col gap-2">
              <QuickLink href={toHref("/employees?create=1")} icon={Plus}>
                Add employee
              </QuickLink>
              <QuickLink href={toHref("/access")} icon={ShieldCheck}>
                Manage access
              </QuickLink>
              <QuickLink href={toHref("/org-chart")} icon={Network}>
                Open org chart
              </QuickLink>
              <QuickLink href={toHref("/setup")} icon={ClipboardList}>
                Setup &amp; structure
              </QuickLink>
            </div>
          </DashboardSection>
        </DashboardPanel>
      </div>
    </PageContainer>
  );
}

function HRAdminDashboard() {
  return (
    <WorkforceDashboard
      title="Dashboard"
      description="Workforce health and the work that needs your attention."
      toHref={(h) => h}
    />
  );
}

function PlatformAdminTenantDashboard() {
  const { tenantId, tenantSlug, tenantName, isLoading, isReady } = useTenantContext();
  const toHref: HrefFn = (h) => buildTenantContextHref(h, tenantId, tenantSlug);

  if (isLoading && !isReady) {
    return <LoadingSkeleton />;
  }

  return (
    <WorkforceDashboard
      title={tenantName ?? "Tenant dashboard"}
      description="Tenant workforce overview and data quality."
      actions={
        <Button asChild variant="outline">
          <Link href={toHref("/setup")}>View setup</Link>
        </Button>
      }
      toHref={toHref}
    />
  );
}

// ── Platform admin (platform operations) ────────────────────────────────────

function PlatformAdminDashboard() {
  const { data: recentData, isLoading: isDashboardLoading } = useOrganizationList({
    skip: 0,
    take: 6,
  });
  const { data: attentionData, isLoading: isAttentionLoading } = useOrganizationList({
    skip: 0,
    take: 5,
    filterByStatus: ["invited", "suspended"],
  });

  const stats = recentData?.stats;
  const recentOrgs = recentData?.items ?? [];
  const attentionOrgs = attentionData?.items ?? [];
  const totalAttention =
    (stats?.invitedPending ?? 0) + (stats?.suspendedOrganizations ?? 0);

  const statusData: DonutDatum[] = stats
    ? [
        { name: "Active", value: stats.activeOrganizations, color: CHART_TONES.success },
        { name: "Draft", value: stats.draftOrganizations, color: CHART_TONES.muted },
        { name: "Invited", value: stats.invitedPending, color: CHART_TONES.info },
        { name: "Suspended", value: stats.suspendedOrganizations, color: CHART_TONES.danger },
        { name: "Archived", value: stats.archivedOrganizations, color: CHART_TONES.warning },
      ]
    : [];

  if (isDashboardLoading && !recentData) {
    return <LoadingSkeleton />;
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Platform dashboard"
        description="Tenant organizations and platform operations."
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

      <KpiGrid>
        <KpiStat
          label="Total organizations"
          value={stats?.totalOrganizations ?? 0}
          icon={Building2}
          href="/organizations"
        />
        <KpiStat
          label="Active"
          value={stats?.activeOrganizations ?? 0}
          tone="success"
          href="/organizations?status=active"
        />
        <KpiStat
          label="Draft"
          value={stats?.draftOrganizations ?? 0}
          hint="Not yet live"
          href="/organizations?status=draft"
        />
        <KpiStat
          label="Need attention"
          value={totalAttention}
          tone={totalAttention > 0 ? "warning" : "success"}
          icon={TriangleAlert}
          hint="Invited or suspended"
          href="/organizations?status=suspended"
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="Needs attention"
            description="Organizations that are invited or suspended."
            action={
              <Link
                href="/organizations"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                All organizations <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {isAttentionLoading && !attentionData ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : attentionOrgs.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {attentionOrgs.map((org) => (
                  <li key={org.id}>
                    <Link
                      href={`/organizations?detail=${org.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/10"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{org.name}</span>
                        <StatusBadge status={org.operationalStatus} />
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        {org.pendingInviteCount > 0 ? (
                          <span>{org.pendingInviteCount} invites</span>
                        ) : null}
                        <ExternalLink className="size-3.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                <UserCheck className="size-5 text-emerald-600" />
                All organizations are in good standing.
              </div>
            )}
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection
            title="Organization status"
            description="Lifecycle distribution across tenants."
          >
            <DonutChart centerLabel="orgs" data={statusData} />
          </DashboardSection>
        </DashboardPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="Recently created organizations"
            action={
              <Link
                href="/organizations"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {recentOrgs.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentOrgs.map((org) => (
                  <li key={org.id}>
                    <Link
                      href={`/organizations?detail=${org.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{org.name}</span>
                        <StatusBadge status={org.operationalStatus} />
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No organizations created yet.
              </div>
            )}
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection title="Quick actions">
            <div className="flex flex-col gap-2">
              <QuickLink href="/organizations?create=1" icon={Plus}>
                Create organization
              </QuickLink>
              <QuickLink href="/organizations?status=invited" icon={Mail}>
                Review invited orgs
              </QuickLink>
              <QuickLink href="/organizations?status=suspended" icon={Pause}>
                Manage suspended
              </QuickLink>
              <QuickLink href="/organizations" icon={Building2}>
                Organizations table
              </QuickLink>
            </div>
          </DashboardSection>
        </DashboardPanel>
      </div>
    </PageContainer>
  );
}

// ── Manager + Employee ───────────────────────────────────────────────────────

function ManagerDashboard() {
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const { data: profile, isLoading: isProfileLoading } = useEmployeeProfile(employeeId);
  const { data: reportingLines, isLoading: isReportingLoading } =
    useEmployeeReportingLines(employeeId);
  const directReports = reportingLines?.directReports ?? [];
  const directReportCount = reportingLines?.directReportCount ?? directReports.length;

  if (isProfileLoading && !profile) {
    return <LoadingSkeleton />;
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your team and reporting context at a glance."
      />

      <KpiGrid>
        <KpiStat
          label="Direct reports"
          value={directReportCount}
          icon={Users}
          href="/team"
        />
        <KpiStat
          label="My status"
          value={profile?.status ?? "—"}
          tone={profile?.status === "Active" ? "success" : "default"}
          icon={UserCheck}
        />
        <KpiStat
          label="Org unit"
          value={profile?.orgUnitName ? "Assigned" : "—"}
          hint={profile?.orgUnitName ?? "No org unit"}
          icon={Building2}
        />
        <KpiStat
          label="Manager"
          value={profile?.managerFullName ? "Assigned" : "—"}
          hint={profile?.managerFullName ?? "No manager"}
          icon={Network}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="My team"
            description={`${directReportCount} direct report${directReportCount === 1 ? "" : "s"}`}
            action={
              <Link
                href="/team"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                Open team <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {isReportingLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : directReports.length > 0 ? (
              <ul className="divide-y divide-border">
                {directReports.slice(0, 6).map(({ employee }) => (
                  <li key={employee.id}>
                    <Link
                      href={`/employees/${employee.stableEmployeeKey}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {employee.firstName} {employee.lastName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {employee.jobTitle || employee.email}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground/50" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No direct reports currently assigned.
              </div>
            )}
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection title="Quick actions">
            <div className="flex flex-col gap-2">
              <QuickLink href="/profile" icon={User}>
                My profile
              </QuickLink>
              <QuickLink href="/team" icon={Users}>
                My team
              </QuickLink>
              <QuickLink href="/org-chart" icon={Network}>
                Org chart
              </QuickLink>
            </div>
          </DashboardSection>
        </DashboardPanel>
      </div>
    </PageContainer>
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
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your profile and work details."
      />

      <KpiGrid>
        <KpiStat
          label="Status"
          value={profile?.status ?? "—"}
          tone={profile?.status === "Active" ? "success" : "default"}
          icon={UserCheck}
        />
        <KpiStat
          label="Job title"
          value={profile?.jobTitle ? "Set" : "—"}
          hint={profile?.jobTitle ?? "Not set"}
          icon={ClipboardList}
        />
        <KpiStat
          label="Org unit"
          value={profile?.orgUnitName ? "Assigned" : "—"}
          hint={profile?.orgUnitName ?? "No org unit"}
          icon={Building2}
        />
        <KpiStat
          label="Manager"
          value={profile?.managerFullName ? "Assigned" : "—"}
          hint={profile?.managerFullName ?? "No manager"}
          icon={Network}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="My profile"
            description={
              profile
                ? `${profile.fullName}${profile.jobTitle ? ` · ${profile.jobTitle}` : ""}`
                : "Your linked employee record."
            }
            action={
              <Link
                href="/profile"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                Open profile <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <dl className="grid gap-2 sm:grid-cols-2">
              {[
                ["Status", profile?.status ?? "—"],
                ["Manager", profile?.managerFullName ?? "—"],
                ["Org unit", profile?.orgUnitName ?? "—"],
                ["Preferred name", profile?.preferredName ?? "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection title="Quick actions">
            <div className="flex flex-col gap-2">
              <QuickLink href="/profile" icon={User}>
                View profile
              </QuickLink>
              <QuickLink href="/profile" icon={Settings2}>
                Edit preferences
              </QuickLink>
            </div>
          </DashboardSection>
        </DashboardPanel>
      </div>
    </PageContainer>
  );
}

// ── Generic fallback (role with overview but no specific dashboard) ──────────

function CoreOperationsDashboard() {
  const { user } = useAuth();
  const { tenantId, tenantSlug } = useTenantContext();
  const moduleHref: HrefFn = (h) =>
    tenantId ? buildTenantContextHref(h, tenantId, tenantSlug) : h;

  const workspaces = [
    canAccessCoreAccess(user)
      ? { href: moduleHref("/access"), title: "Access", icon: ShieldCheck }
      : canManageCoreAccessProfiles(user)
        ? { href: moduleHref("/settings?tab=access-permissions"), title: "Settings", icon: ShieldCheck }
        : null,
    canSeeCoreSetupNavigation(user)
      ? { href: moduleHref("/setup"), title: "Setup", icon: ClipboardList }
      : null,
    canAccessCoreSettings(user)
      ? { href: moduleHref("/settings"), title: "Settings", icon: Settings2 }
      : null,
    canAccessEmployeeRoster(user)
      ? { href: moduleHref("/employees"), title: "Employees", icon: Users }
      : null,
    canAccessTeamWorkspace(user)
      ? { href: moduleHref("/team"), title: "My Team", icon: Users }
      : null,
    canAccessSelfEmployeeProfile(user)
      ? { href: moduleHref("/profile"), title: "My Profile", icon: User }
      : null,
  ].filter((w): w is { href: string; title: string; icon: typeof Plus } => w !== null);

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader title="Dashboard" description="Open the Core workspace you use today." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((w) => (
          <QuickLink key={w.title} href={w.href} icon={w.icon}>
            {w.title}
          </QuickLink>
        ))}
      </div>
    </PageContainer>
  );
}

function CoreWorkspaceRedirect({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader title="Dashboard" description={`Redirecting to ${label}.`} />
      <PageLoading rows={4} label={`Redirecting to ${href}`} />
    </PageContainer>
  );
}

function getFallbackWorkspace(user: AuthUser | null): { href: string; label: string } | null {
  if (canAccessCoreAccess(user)) return { href: "/access", label: "Access" };
  if (canManageCoreAccessProfiles(user))
    return { href: "/settings?tab=access-permissions", label: "Settings" };
  if (canAccessCoreSetup(user)) return { href: "/setup", label: "Setup" };
  if (canAccessCoreSettings(user)) return { href: "/settings", label: "Settings" };
  if (canAccessEmployeeRoster(user)) return { href: "/employees", label: "Employees" };
  if (canAccessTeamWorkspace(user)) return { href: "/team", label: "My Team" };
  if (canAccessSelfEmployeeProfile(user)) return { href: "/profile", label: "My Profile" };
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
      <CoreWorkspaceRedirect href={fallbackWorkspace.href} label={fallbackWorkspace.label} />
    );
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PagePermissionNotice
        title="No workspaces available"
        description="No Core workspaces are available for your current role. Contact your platform administrator to configure access."
      />
    </PageContainer>
  );
}
