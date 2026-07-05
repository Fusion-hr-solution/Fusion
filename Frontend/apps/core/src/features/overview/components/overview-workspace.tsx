"use client";

import Link from "next/link";
import { useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  Gauge,
  Mail,
  Network,
  PartyPopper,
  Pause,
  Plus,
  Settings2,
  ShieldCheck,
  TrendingUp,
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
  BarChartMini,
  ColumnChart,
  ProgressMeter,
  CHART_TONES,
  CHART_PALETTE,
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
import {
  useEmployeeRoster,
  useWorkforceReadinessSummary,
} from "@/app/(pages)/employees/use-employees";
import {
  useWorkforceMe,
  useWorkforceTeam,
  type WorkforceMeContext,
} from "@/features/overview/api/use-workforce-me";
import { StatusBadge } from "@/app/(pages)/organizations/status-badge";
import { useOrganizationList } from "@/features/organizations/api/use-organizations";
import type { EmployeeRosterItem } from "@/app/(pages)/employees/employee-roster.types";

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
      <PageHeader
        title="Dashboard"
        description={<Skeleton className="h-4 w-80 max-w-full" />}
      />
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

const TENURE_BUCKETS = [
  { name: "< 1 yr", min: 0, max: 1 },
  { name: "1–3 yrs", min: 1, max: 3 },
  { name: "3–5 yrs", min: 3, max: 5 },
  { name: "5+ yrs", min: 5, max: Infinity },
];

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildWorkforceAnalytics(items: EmployeeRosterItem[]) {
  const now = new Date();
  const today = startOfToday();
  const dept = new Map<string, number>();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, name: d.toLocaleDateString("en-GB", { month: "short" }), value: 0 };
  });
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  const tenure = TENURE_BUCKETS.map((b) => ({ name: b.name, value: 0 }));
  let managers = 0;
  let newHires90 = 0;

  for (const e of items) {
    dept.set(e.orgUnitName?.trim() || "Unassigned", (dept.get(e.orgUnitName?.trim() || "Unassigned") ?? 0) + 1);
    if (e.directReportCount > 0) managers++;
    const hire = new Date(e.hireDate);
    if (Number.isNaN(hire.getTime())) continue;
    const mi = monthIndex.get(`${hire.getFullYear()}-${hire.getMonth()}`);
    const month = mi !== undefined ? months[mi] : undefined;
    if (month) month.value++;
    const days = (Date.now() - hire.getTime()) / 86_400_000;
    if (days >= 0 && days <= 90) newHires90++;
    const years = days / 365.25;
    if (years >= 0) {
      const bi = TENURE_BUCKETS.findIndex((b) => years >= b.min && years < b.max);
      const bucket = bi >= 0 ? tenure[bi] : undefined;
      if (bucket) bucket.value++;
    }
  }

  const byDept = [...dept.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const attention = items
    .filter((e) => e.readiness.hasEmployeeStateIssues)
    .map((e) => {
      const issues = e.readiness.employeeStateIssues.map((i) => ({
        label: i.label,
        blocker: i.severity === "Blocker",
      }));
      return { employee: e, blocking: issues.some((i) => i.blocker), issues };
    })
    .sort((a, b) => Number(b.blocking) - Number(a.blocking))
    .slice(0, 6);

  const anniversaries = items
    .map((e) => {
      const hire = new Date(e.hireDate);
      if (Number.isNaN(hire.getTime())) return null;
      let next = new Date(now.getFullYear(), hire.getMonth(), hire.getDate());
      if (next < today) next = new Date(now.getFullYear() + 1, hire.getMonth(), hire.getDate());
      const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      const years = next.getFullYear() - hire.getFullYear();
      if (days < 0 || days > 45 || years < 1) return null;
      return { employee: e, years, days, dateLabel: next.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  return { byDept, hiringTrend: months, tenure, managers, newHires90, attention, anniversaries };
}

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
  const { data: roster, isLoading: isRosterLoading } = useEmployeeRoster({
    sortBy: "HireDate",
    sortDir: "Desc",
    page: 1,
    pageSize: 200,
  });

  const items: EmployeeRosterItem[] = useMemo(() => roster?.items ?? [], [roster]);
  const analytics = useMemo(() => buildWorkforceAnalytics(items), [items]);
  const totalWorkforce = roster?.totalCount ?? items.length;
  const active = rs?.activeEmployeeCount ?? 0;
  const inactive = Math.max(totalWorkforce - active, 0);
  const readyCount = rs?.readyEmployeeCount ?? 0;
  const readinessPct = active > 0 ? Math.round((readyCount / active) * 100) : 0;
  const needsAttention = rs?.employeesNeedingAttention ?? 0;
  const recentHires = items.slice(0, 5);
  const compositionData: DonutDatum[] = [
    { name: "Active", value: active, color: CHART_TONES.success },
    { name: "Inactive", value: inactive, color: CHART_TONES.muted },
  ];

  if ((isRsLoading && !rs) || (isRosterLoading && !roster)) {
    return <LoadingSkeleton />;
  }

  return (
    <PageContainer width="wide" className="space-y-5">
      <PageHeader title={title} description={description} actions={actions} />

      <KpiGrid>
        <KpiStat
          label="Active headcount"
          value={active}
          icon={Users}
          hint={`${totalWorkforce} total · ${inactive} inactive`}
          href={toHref("/employees?status=Active")}
        />
        <KpiStat
          label="Workforce readiness"
          value={`${readinessPct}%`}
          tone={readinessPct >= 90 ? "success" : readinessPct >= 70 ? "warning" : "danger"}
          icon={Gauge}
          hint={`${readyCount} of ${active} records ready`}
          href={toHref("/employees?readiness=Ready")}
        />
        <KpiStat
          label="Needs attention"
          value={needsAttention}
          tone={needsAttention > 0 ? "warning" : "success"}
          icon={TriangleAlert}
          hint={needsAttention > 0 ? "People with data issues" : "All records healthy"}
          href={toHref("/employees?readiness=NeedsAttention")}
        />
        <KpiStat
          label="New hires (90d)"
          value={analytics.newHires90}
          icon={TrendingUp}
          hint={`${analytics.managers} managers`}
          href={toHref("/employees")}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="Headcount by department"
            description="Where your people sit across the organization."
            action={
              <Link
                href={toHref("/org-chart")}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                Org chart <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {analytics.byDept.length > 0 ? (
              <BarChartMini
                data={analytics.byDept}
                height={Math.max(170, analytics.byDept.length * 30)}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No org units assigned yet.</p>
            )}
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection title="Composition" description="Active vs inactive headcount.">
            <DonutChart centerLabel="people" total={totalWorkforce} data={compositionData} />
            <div className="mt-4">
              <ProgressMeter
                label="Records ready"
                value={readinessPct}
                valueLabel={`${readinessPct}%`}
                tone={readinessPct >= 90 ? CHART_TONES.success : CHART_TONES.warning}
              />
            </div>
          </DashboardSection>
        </DashboardPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection title="Hiring trend" description="New hires over the last 12 months.">
            <ColumnChart data={analytics.hiringTrend} />
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection title="Tenure" description="How long people have been here.">
            <BarChartMini data={analytics.tenure} height={170} color={CHART_PALETTE[2]} />
          </DashboardSection>
        </DashboardPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="People needing attention"
            description="Records with blocking or data-quality issues — resolve to keep the workforce trustworthy."
            action={
              <Link
                href={toHref("/employees?readiness=NeedsAttention")}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                Review all <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {analytics.attention.length > 0 ? (
              <ul className="divide-y divide-border">
                {analytics.attention.map(({ employee, blocking, issues }) => (
                  <li key={employee.id}>
                    <Link
                      href={toHref(`/employees/${employee.stableEmployeeKey}`)}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        {blocking ? (
                          <TriangleAlert className="size-4 shrink-0 text-destructive" />
                        ) : (
                          <CircleAlert className="size-4 shrink-0 text-primary" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {employee.firstName} {employee.lastName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {employee.jobTitle || employee.orgUnitName || employee.email}
                          </span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 flex-wrap items-center justify-end gap-1 sm:flex">
                        {issues.slice(0, 2).map((iss, idx) => (
                          <span
                            key={idx}
                            className={
                              iss.blocker
                                ? "rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive"
                                : "rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                            }
                          >
                            {iss.label}
                          </span>
                        ))}
                        {issues.length > 2 ? (
                          <span className="text-[11px] text-muted-foreground">+{issues.length - 2}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
                <UserCheck className="size-5 text-emerald-600" />
                Every workforce record is complete and healthy.
              </div>
            )}
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection
            title="Upcoming anniversaries"
            description="Work anniversaries in the next 45 days."
          >
            {analytics.anniversaries.length > 0 ? (
              <ul className="divide-y divide-border">
                {analytics.anniversaries.map(({ employee, years, dateLabel }) => (
                  <li
                    key={employee.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <PartyPopper className="size-4 shrink-0 text-primary" />
                      <span className="truncate font-medium text-foreground">
                        {employee.firstName} {employee.lastName}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {years} yr{years === 1 ? "" : "s"} · {dateLabel}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No anniversaries in the next 45 days.
              </p>
            )}
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
            {recentHires.length > 0 ? (
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
                          {employee.jobTitle || employee.orgUnitName || employee.email}
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

function buildMonthlyCounts(dates: string[]) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      name: d.toLocaleDateString("en-GB", { month: "short" }),
      value: 0,
    };
  });
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const ds of dates) {
    const d = new Date(ds);
    if (Number.isNaN(d.getTime())) continue;
    const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
    const m = i !== undefined ? months[i] : undefined;
    if (m) m.value++;
  }
  return months;
}

function PlatformAdminDashboard() {
  const { data: recentData, isLoading: isDashboardLoading } = useOrganizationList({
    skip: 0,
    take: 40,
  });
  const { data: attentionData, isLoading: isAttentionLoading } = useOrganizationList({
    skip: 0,
    take: 5,
    filterByStatus: ["invited", "suspended"],
  });

  const stats = recentData?.stats;
  const allOrgs = recentData?.items ?? [];
  const recentOrgs = allOrgs.slice(0, 6);
  const orgGrowth = buildMonthlyCounts(allOrgs.map((o) => o.createdAt));
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

      <DashboardPanel>
        <DashboardSection
          title="Organization growth"
          description="New organizations created over the last 12 months."
        >
          <ColumnChart data={orgGrowth} />
        </DashboardSection>
      </DashboardPanel>

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

function ManagerDashboard({ me }: { me: WorkforceMeContext }) {
  const emp = me.employee!;
  const { data: team, isLoading: isTeamLoading } = useWorkforceTeam(emp.employeeId);
  const teamList = team ?? [];
  const directReportCount = emp.directReportCount;
  const teamActive = teamList.filter((t) => t.isActive).length;
  const teamAttention = teamList.filter((t) => t.dataQuality.hasEmployeeStateIssues).length;

  return (
    <PageContainer width="wide" className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`Your team at a glance, ${emp.firstName}.`}
      />

      <KpiGrid>
        <KpiStat label="Direct reports" value={directReportCount} icon={Users} href="/team" />
        <KpiStat
          label="Team active"
          value={teamActive}
          tone="success"
          icon={UserCheck}
          hint={`of ${directReportCount} direct`}
        />
        <KpiStat
          label="Needs attention"
          value={teamAttention}
          tone={teamAttention > 0 ? "warning" : "success"}
          icon={TriangleAlert}
          hint={teamAttention > 0 ? "Reports with data issues" : "Team records healthy"}
        />
        <KpiStat
          label="My status"
          value={emp.employmentStatus}
          tone={emp.isActive ? "success" : "default"}
          icon={UserCheck}
          hint={emp.jobTitle ?? undefined}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="My team"
            description={`${directReportCount} direct report${directReportCount === 1 ? "" : "s"} · ${teamActive} active`}
            action={
              <Link
                href="/team"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                Open team <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {isTeamLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : teamList.length > 0 ? (
              <ul className="divide-y divide-border">
                {teamList.map((member) => {
                  const attn = member.dataQuality.hasEmployeeStateIssues;
                  return (
                    <li key={member.employeeId}>
                      <Link
                        href={`/employees/${member.stableEmployeeKey}`}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${member.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {member.displayName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {member.jobTitle || member.workEmail}
                            </span>
                          </span>
                        </span>
                        {attn ? (
                          <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                            Needs attention
                          </span>
                        ) : (
                          <ArrowRight className="size-4 shrink-0 text-muted-foreground/40" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No direct reports currently assigned.
              </div>
            )}
          </DashboardSection>
        </DashboardPanel>

        <DashboardPanel>
          <DashboardSection title="My reporting context">
            <dl className="space-y-2">
              {[
                ["My status", emp.employmentStatus],
                ["Reports to", emp.manager?.displayName ?? "—"],
                ["Org unit", emp.orgUnit?.name ?? "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate pl-2 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-col gap-2">
              <QuickLink href="/team" icon={Users}>
                Open my team
              </QuickLink>
              <QuickLink href="/org-chart" icon={Network}>
                Org chart
              </QuickLink>
              <QuickLink href="/profile" icon={User}>
                My profile
              </QuickLink>
            </div>
          </DashboardSection>
        </DashboardPanel>
      </div>
    </PageContainer>
  );
}

function EmployeeDashboard({ me }: { me: WorkforceMeContext }) {
  const emp = me.employee!;

  return (
    <PageContainer width="wide" className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`Welcome${emp.firstName ? `, ${emp.firstName}` : ""}. Your profile and work details.`}
      />

      <KpiGrid>
        <KpiStat
          label="Status"
          value={emp.employmentStatus}
          tone={emp.isActive ? "success" : "default"}
          icon={UserCheck}
        />
        <KpiStat
          label="Job title"
          value={emp.jobTitle ? "Set" : "—"}
          hint={emp.jobTitle ?? "Not set"}
          icon={ClipboardList}
        />
        <KpiStat
          label="Org unit"
          value={emp.orgUnit ? "Assigned" : "—"}
          hint={emp.orgUnit?.name ?? "No org unit"}
          icon={Building2}
        />
        <KpiStat
          label="Manager"
          value={emp.manager ? "Assigned" : "—"}
          hint={emp.manager?.displayName ?? "No manager"}
          icon={Network}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardPanel className="lg:col-span-2">
          <DashboardSection
            title="My profile"
            description={`${emp.fullName}${emp.jobTitle ? ` · ${emp.jobTitle}` : ""}`}
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
                ["Status", emp.employmentStatus],
                ["Manager", emp.manager?.displayName ?? "—"],
                ["Org unit", emp.orgUnit?.name ?? "—"],
                ["Preferred name", emp.preferredName ?? "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="truncate pl-2 font-medium">{value}</dd>
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

  // Personal (self / team) dashboard is driven by the workforce hierarchy, not a static
  // profile: any workforce-linked user gets a dashboard, and having direct reports promotes
  // them from the self view to the team view (cascading up the org). `workforce/me` is
  // permissioned for own-profile/team scope, so it resolves without roster access.
  const wantsPersonalDashboard =
    !!user && !isPlatformAdmin && !isHrAdmin && !isInTenantContext;
  const { data: me, isLoading: isMeLoading } = useWorkforceMe(wantsPersonalDashboard);

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

  if (wantsPersonalDashboard) {
    if (isMeLoading && !me) {
      return <LoadingSkeleton />;
    }
    if (me?.isWorkforceLinked && me.employee) {
      return me.employee.directReportCount > 0 ? (
        <ManagerDashboard me={me} />
      ) : (
        <EmployeeDashboard me={me} />
      );
    }
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
