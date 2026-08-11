"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  Info,
  KeyRound,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  canViewTenantAdministration,
  useAuth,
  type AuthUser,
} from "@repo/auth";
import { Button } from "@repo/ds";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { useEmployeeRoster } from "@/app/(pages)/employees/use-employees";
import { useTenantAccessSummary } from "@/features/tenant-access/api/use-tenant-access";
import { useOrganizationReadiness } from "@/features/organization/api/use-organization";
import { canViewCoreOrganization } from "@repo/auth";
import {
  composeSetupCapabilities,
  deriveLaunchpadVariant,
  recommendedNextStep,
  type CapabilityState,
  type ComposedCapability,
  type LaunchpadVariant,
} from "./compose";

const WORKFORCE_PRESENCE_QUERY = {
  page: 1,
  pageSize: 1,
  sortBy: "Name" as const,
  sortDir: "Asc" as const,
};

const CAPABILITY_ICON: Record<string, LucideIcon> = {
  "administrator-access": ShieldCheck,
  "tenant-configuration": Settings2,
  organization: Building2,
  workforce: Users,
  "workforce-access": KeyRound,
  performance: ChartNoAxesCombined,
};

/**
 * Canonical tenant-level setup launchpad.
 *
 * This surface composes authoritative reads from Identity and Core. It owns no
 * setup workflow or progress data, and opening it never mutates tenant state.
 */
export default function SetupLaunchpad() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LaunchpadSkeleton />;
  }

  if (!user || !canViewTenantAdministration(user)) {
    return (
      <PageContainer className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Tenant Setup</h1>
        </header>
        <PagePermissionNotice
          title="You do not have access to this page"
          description="Ask an administrator if you need to review tenant setup."
        />
      </PageContainer>
    );
  }

  // Capability reads live below the authorization boundary so a denied reader
  // does not fetch tenant name, workforce, or setup presentation data.
  return <AuthorizedSetupLaunchpad user={user} />;
}

export function AuthorizedSetupLaunchpad({ user }: { user: AuthUser }) {
  const organizationReadiness = useOrganizationReadiness(
    canViewCoreOrganization(user)
  );
  const accessSummary = useTenantAccessSummary(
    canViewTenantAdministration(user)
  );
  const workforce = useEmployeeRoster(WORKFORCE_PRESENCE_QUERY);

  const workforceTotalCount = workforce.error
    ? null
    : workforce.isLoading
      ? undefined
      : workforce.data?.totalCount ?? null;
  const effectiveSetupState = organizationReadiness.error
    ? null
    : organizationReadiness.isLoading
      ? undefined
      : organizationReadiness.data ?? null;

  const composed = useMemo(
    () =>
      composeSetupCapabilities({
        user,
        entitlements: user.moduleEntitlements ?? [],
        setupState: effectiveSetupState,
        workforceTotalCount,
      }),
    [effectiveSetupState, user, workforceTotalCount]
  );

  const isInitialLoading =
    organizationReadiness.isLoading ||
    accessSummary.isLoading ||
    workforce.isLoading;

  if (isInitialLoading) {
    return <LaunchpadSkeleton />;
  }

  const visible = composed.filter((entry) => entry.state !== "not-included");
  const recommendation = recommendedNextStep(visible);
  const recommendationKey = recommendation?.capability.key ?? null;
  const entries = visible
    .filter((entry) => entry.capability.key !== recommendationKey)
    .sort((left, right) => {
      if (left.capability.key === "organization") return -1;
      if (right.capability.key === "organization") return 1;
      return left.capability.order - right.capability.order;
    });
  const variant = deriveLaunchpadVariant(visible, workforceTotalCount);
  const tenantName =
    accessSummary.data?.tenantName?.trim() || "your tenant";

  return (
    <LaunchpadView
      tenantName={tenantName}
      variant={variant}
      recommendation={recommendation}
      entries={entries}
      onRetry={(key) => {
        if (key === "organization" || organizationReadiness.error) {
          void organizationReadiness.refetch();
          return;
        }

        if (key === "workforce") {
          void workforce.refetch();
        }
      }}
    />
  );
}

export function LaunchpadView({
  tenantName,
  variant,
  recommendation,
  entries,
  onRetry,
}: {
  tenantName: string;
  variant: LaunchpadVariant;
  recommendation: ComposedCapability | null;
  entries: ComposedCapability[];
  onRetry: (key: string) => void;
}) {
  const heading =
    variant === "fresh" ? `Welcome to ${tenantName}` : "Tenant Setup";
  const description =
    variant === "fresh"
      ? "Your tenant is ready. Start building the foundation your organization will use."
      : variant === "mature"
        ? "Review and manage the foundation your tenant uses."
        : variant === "indeterminate"
          ? "Review and manage your tenant foundation."
          : "Continue building and managing your tenant foundation.";

  return (
    <PageContainer className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="max-w-3xl space-y-2">
        <h1 className="text-balance text-3xl font-semibold tracking-tight">
          {heading}
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </header>

      {recommendation ? (
        <RecommendationPanel entry={recommendation} />
      ) : null}

      <section aria-labelledby="tenant-foundation-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b pb-3">
          <h2
            id="tenant-foundation-heading"
            className="text-base font-semibold tracking-tight"
          >
            Tenant foundation
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {entries.map((entry) => (
            <CapabilityCard
              key={entry.capability.key}
              entry={entry}
              onRetry={() => onRetry(entry.capability.key)}
            />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}

function RecommendationPanel({ entry }: { entry: ComposedCapability }) {
  const isOrganization = entry.capability.key === "organization";
  const Icon = isOrganization ? Building2 : Users;
  const title = isOrganization
    ? entry.state === "in-progress"
      ? "Continue organization setup"
      : "Set up your organization"
    : "Add your workforce";
  const description = isOrganization
    ? "Define the structure your workforce and future HR processes will build on."
    : "Add and manage the people who work in this tenant.";
  const action = isOrganization
    ? entry.state === "in-progress"
      ? "Continue organization setup"
      : "Open Organization"
    : "Add workforce";

  return (
    <section
      aria-labelledby="recommended-destination-heading"
      className="overflow-hidden rounded-2xl border border-primary/55 bg-card shadow-sm"
    >
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/16 text-primary-foreground dark:text-primary">
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">
              Recommended next step
            </p>
            <h2
              id="recommended-destination-heading"
              className="text-balance text-lg font-semibold"
            >
              {title}
            </h2>
            <p className="max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <Button asChild className="w-full sm:w-auto">
          <Link href={entry.capability.route ?? "#"}>
            {action}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function CapabilityCard({
  entry,
  onRetry,
}: {
  entry: ComposedCapability;
  onRetry: () => void;
}) {
  const { capability, state, blockedBy, detail, isActionable } = entry;
  const Icon = CAPABILITY_ICON[capability.key] ?? Info;
  const unavailableText = unavailableLabel(state, blockedBy);
  const action = actionLabel(entry);

  return (
    <article className="group flex min-h-44 flex-col rounded-2xl border bg-card p-5 transition-colors duration-200 hover:border-foreground/20 motion-reduce:transition-none">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/75">
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-base font-semibold">{capability.title}</h3>
          <p className="text-pretty text-sm leading-6 text-muted-foreground">
            {capability.purpose}
          </p>
        </div>
      </div>

      <div className="mt-auto flex min-h-9 flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t pt-4 text-sm">
        <div className="min-w-0">
          {detail ? (
            <span className="text-muted-foreground">{detail}</span>
          ) : unavailableText ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Info className="size-3.5 shrink-0" aria-hidden />
              {unavailableText}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1">
          {state === "unknown" ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-9 items-center rounded-lg px-2 font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retry status
            </button>
          ) : null}
          {isActionable && capability.route ? (
            <Link
              href={capability.route}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {action}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function unavailableLabel(
  state: CapabilityState,
  blockedBy: string | null
): string | null {
  if (state === "planned") return "Not available in this build";
  if (state === "blocked" && blockedBy) {
    return `Available after ${blockedBy.toLowerCase()} setup`;
  }
  if (state === "unknown") return "Status unavailable";
  return null;
}

function actionLabel(entry: ComposedCapability): string {
  const { key } = entry.capability;
  if (key === "administrator-access") return "Manage access";
  if (key === "organization") {
    if (entry.state === "ready") return "Review organization";
    if (entry.state === "in-progress") return "Continue organization setup";
    return "Open Organization";
  }
  if (key === "workforce") {
    return entry.state === "ready" ? "Manage workforce" : "Add workforce";
  }
  return entry.capability.actionLabel ?? "Open";
}

export function LaunchpadSkeleton() {
  return (
    <PageContainer className="mx-auto max-w-6xl pb-12">
      <div
        className="space-y-8"
        role="status"
        aria-busy="true"
        aria-label="Loading tenant setup"
      >
        <div className="max-w-3xl space-y-3">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-[34rem] max-w-full" />
        </div>
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-36" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
