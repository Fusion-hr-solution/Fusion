import type { ReactNode } from "react";
import {
  PageContainer,
  PageHeader,
  PageLoading,
  PageSkeleton,
} from "@repo/ds/shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Route skeleton registry ─────────────────────────────────────────────────
// One dedicated loading skeleton per route, shared by every loading surface:
// the (pages) route loading boundary, CoreSetupRouteGuard's fail-closed hold,
// and the pages' own loading branches. All three render the SAME component for
// a given route, so the user sees exactly one skeleton from first paint to
// content — never a generic phase swapping into a dedicated one.
//
// Keep this module light: ds/ui primitives only, no feature imports (it loads
// with the route loading boundary).

export function getCorePathname(pathname: string): string {
  const nextPath = pathname.replace(/^\/core/, "");
  return nextPath || "/";
}

interface TitledPageLoadingProps {
  title: string;
  description?: string;
  rows?: number;
  label?: string;
  className?: string;
}

/** Standard "real title + content rows" loading page. */
export function TitledPageLoading({
  title,
  description,
  rows = 6,
  label,
  className = "space-y-6",
}: TitledPageLoadingProps) {
  return (
    <PageContainer width="wide" className={className}>
      <PageHeader title={title} description={description} />
      <PageLoading rows={rows} label={label ?? `Loading ${title.toLowerCase()}...`} />
    </PageContainer>
  );
}

export function OverviewPageSkeleton() {
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

export function EmployeesPageSkeleton({ label }: { label?: string }) {
  return (
    <PageContainer width="wide" className="space-y-5">
      <PageHeader title="People" />
      <PageLoading rows={8} label={label ?? "Loading employees"} />
    </PageContainer>
  );
}

export function EmployeeProfilePageSkeleton() {
  return (
    <TitledPageLoading
      title="Employee Profile"
      description="Loading employee profile."
      label="Loading employee profile..."
    />
  );
}

export function EmployeeImportPageSkeleton() {
  return (
    <TitledPageLoading
      title="Import employees"
      description="Upload and validate from the CSV template."
      label="Loading employee import..."
    />
  );
}

export function MyProfilePageSkeleton() {
  return (
    <TitledPageLoading
      title="My Profile"
      description="Loading profile."
      label="Loading your profile..."
    />
  );
}

export function TeamPageSkeleton() {
  return (
    <PageContainer className="space-y-6">
      <PageHeader title="My Team" description="Loading team." />
      <PageLoading rows={6} label="Loading your team..." />
    </PageContainer>
  );
}

/** Loading skeleton for the Administrators workspace — same shape the page fills. */
export function AccessPageSkeleton() {
  return (
    <PageContainer width="wide" className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36 shrink-0" />
      </div>

      <div className="flex flex-col gap-6 rounded-2xl border bg-muted/30 p-5 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex flex-1 items-start gap-4">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
        </div>
        <div className="flex items-center gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-7 w-8" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Skeleton className="h-9 w-full sm:max-w-xs" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-44" />
            <AccessTableSkeleton rows={2} />
          </div>
        </div>

        <aside className="hidden xl:block">
          <div className="space-y-5 rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t pt-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

function AccessTableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="hidden h-5 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for the activity log — a feed, not a master-detail. */
export function ActivityLogPageSkeleton() {
  return (
    <PageContainer width="wide" className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-4 border-l pl-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4">
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-3 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

export function OrgChartPageSkeleton() {
  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Org Chart"
        description="Workforce structure and reporting lines."
        actions={<Skeleton className="h-9 w-32 shrink-0" />}
      />
      <div className="flex items-center gap-2 rounded-2xl border bg-card p-3">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <Skeleton className="h-[70vh] rounded-2xl" />
    </PageContainer>
  );
}

export function SettingsPageSkeleton() {
  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Settings"
        description={<Skeleton className="h-4 w-80 max-w-full" />}
      />
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-136 rounded-xl" />
      </div>
    </PageContainer>
  );
}

export function SetupPageSkeleton() {
  return (
    <PageContainer width="wide" className="space-y-5">
      <PageHeader title="Setup" description="Activate the draft workspace to get started." />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-4 px-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="h-4 w-full max-w-lg" />
                  <Skeleton className="h-4 w-80" />
                </div>
              </div>
              <div className="flex flex-nowrap gap-2">
                <Skeleton className="h-9 w-44" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-4 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  "border-primary/20 bg-primary/5",
                  "border-dashed",
                  "border-dashed",
                ].map((borderClass, index) => (
                  <div
                    key={index}
                    className={`flex flex-col items-center gap-4 rounded-xl border p-5 text-center ${borderClass}`}
                  >
                    <Skeleton className="size-12 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="mx-auto h-3 w-16" />
                      <Skeleton className="mx-auto h-4 w-28" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:self-stretch">
          <Card className="flex h-full flex-col">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center justify-center py-12">
              <div className="flex size-8 items-center justify-center rounded-full border bg-muted/30 text-muted-foreground/60">
                <Skeleton className="size-3.5 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-4 w-28" />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

/** The dedicated loading skeleton for a core route (module-relative path). */
export function getRoutePageSkeleton(corePath: string): ReactNode {
  if (corePath === "/") return <OverviewPageSkeleton />;
  if (corePath === "/people") return <EmployeesPageSkeleton />;
  if (corePath === "/people/import") return <EmployeeImportPageSkeleton />;
  if (corePath === "/people/hire" || corePath === "/people/add-existing")
    return <TitledPageLoading title="People" rows={5} label="Opening employee details" />;
  if (corePath.startsWith("/people/")) return <EmployeeProfilePageSkeleton />;
  if (corePath === "/profile") return <MyProfilePageSkeleton />;
  if (corePath === "/team") return <TeamPageSkeleton />;
  if (corePath === "/organization" || corePath === "/org-chart") return <OrgChartPageSkeleton />;
  if (corePath === "/settings") return <SettingsPageSkeleton />;
  if (corePath === "/access/profiles")
    return <TitledPageLoading title="Access profiles" rows={4} label="Opening access profile settings" />;
  if (corePath === "/access/activity") return <ActivityLogPageSkeleton />;
  if (corePath.startsWith("/access")) return <AccessPageSkeleton />;
  if (corePath === "/getting-started" || corePath === "/setup")
    return <SetupPageSkeleton />;
  return <PageSkeleton label="Loading page" />;
}
