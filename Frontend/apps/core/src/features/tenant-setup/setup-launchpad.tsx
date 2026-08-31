"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  Check,
  Info,
  KeyRound,
  Lock,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  canViewTenantAdministration,
  canViewWorkforceAccess,
  useAuth,
  type AuthUser,
} from "@repo/auth";
import { Button, cn } from "@repo/ds";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { PageContainer, PagePermissionNotice } from "@repo/ds/shell";
import { useEmployeeRoster } from "@/app/(pages)/employees/use-employees";
import { useTenantAccessSummary } from "@/features/tenant-access/api/use-tenant-access";
import { useAccessRosterSummary } from "@/features/workforce-access/api/use-workforce-access";
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
 * A capability's visual family on the launchpad. This is presentation only —
 * the authoritative `CapabilityState` stays in `compose.ts`. The ladder marker,
 * the spine connector, and the readiness meter all read from this so a single
 * mapping governs how state looks across the surface.
 */
type NodeTone = "ready" | "next" | "neutral" | "blocked" | "planned";

const MARKER_TONE: Record<NodeTone, string> = {
  ready: "bg-success-subtle text-success ring-1 ring-inset ring-success/30",
  next: "bg-warning-subtle text-warning ring-1 ring-inset ring-warning/45",
  neutral: "bg-muted text-foreground/75 ring-1 ring-inset ring-border",
  blocked: "bg-muted/50 text-muted-foreground/80 ring-1 ring-inset ring-border",
  planned: "border border-dashed border-border text-muted-foreground/60",
};

const SEGMENT_TONE: Record<NodeTone, string> = {
  ready: "bg-success",
  next: "bg-warning",
  neutral: "bg-muted-foreground/30",
  blocked: "bg-muted-foreground/20",
  planned: "bg-muted-foreground/15",
};

function toneForState(state: CapabilityState): NodeTone {
  if (state === "ready") return "ready";
  if (state === "in-progress") return "next";
  if (state === "blocked") return "blocked";
  if (state === "planned") return "planned";
  return "neutral";
}

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
          <span className="type-eyebrow text-muted-foreground">
            Tenant setup
          </span>
          <h1 className="type-page-title">Getting started</h1>
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
  const workforceAccess = useAccessRosterSummary(canViewWorkforceAccess(user));
  const workforceAccessSummary = workforceAccess.error
    ? null
    : workforceAccess.isLoading
      ? undefined
      : (workforceAccess.data ?? null);

  const workforceTotalCount = workforce.error
    ? null
    : workforce.isLoading
      ? undefined
      : (workforce.data?.totalCount ?? null);
  const effectiveSetupState = organizationReadiness.error
    ? null
    : organizationReadiness.isLoading
      ? undefined
      : (organizationReadiness.data ?? null);

  const composed = useMemo(
    () =>
      composeSetupCapabilities({
        user,
        entitlements: user.moduleEntitlements ?? [],
        setupState: effectiveSetupState,
        workforceTotalCount,
        workforceAccessSummary,
      }),
    [effectiveSetupState, user, workforceTotalCount, workforceAccessSummary]
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
  const tenantName = accessSummary.data?.tenantName?.trim() || "your tenant";

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
    variant === "fresh" ? `Welcome to ${tenantName}` : "Getting started";
  const description =
    variant === "fresh"
      ? "Your tenant is ready. Start building the foundation your organization will use."
      : variant === "mature"
        ? "Review and manage the foundation your tenant uses."
        : variant === "indeterminate"
          ? "Review and manage your tenant foundation."
          : "Continue building and managing your tenant foundation.";

  // Readiness is measured over the real, ownable foundation — the pieces a
  // tenant actually stands up — so planned/entitlement rows never dilute the
  // count. The recommended step is included: it is foundation that is not yet
  // ready, which is exactly what the meter should show as remaining.
  const foundation = [recommendation, ...entries].filter(
    (entry): entry is ComposedCapability =>
      entry != null &&
      entry.capability.group === "foundation" &&
      entry.capability.availability === "implemented"
  );
  const readyCount = foundation.filter((entry) => entry.state === "ready").length;

  return (
    <PageContainer className="mx-auto max-w-4xl space-y-9 pb-14">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2.5">
          <span className="type-eyebrow text-muted-foreground">Tenant setup</span>
          <h1 className="type-display text-balance">{heading}</h1>
          <p className="type-body max-w-xl text-pretty text-muted-foreground">
            {description}
          </p>
        </div>
        {foundation.length > 0 ? (
          <ReadinessMeter
            segments={foundation}
            recommendationKey={recommendation?.capability.key ?? null}
            readyCount={readyCount}
          />
        ) : null}
      </header>

      {recommendation ? <RecommendationPanel entry={recommendation} /> : null}

      {entries.length > 0 ? (
        <section aria-labelledby="tenant-foundation-heading" className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="tenant-foundation-heading"
              className="type-subsection-title text-foreground"
            >
              Tenant foundation
            </h2>
            <span className="type-meta text-muted-foreground">
              {readyCount} of {foundation.length} ready
            </span>
          </div>

          <div className="relative">
            {entries.map((entry, index) => (
              <LadderNode
                key={entry.capability.key}
                entry={entry}
                isLast={index === entries.length - 1}
                onRetry={() => onRetry(entry.capability.key)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}

/**
 * A compact, structural read on how much of the tenant foundation stands up.
 * One segment per foundational area, toned by state — the numeral and the
 * segments carry the progress, not a sentence.
 */
function ReadinessMeter({
  segments,
  recommendationKey,
  readyCount,
}: {
  segments: ComposedCapability[];
  recommendationKey: string | null;
  readyCount: number;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2.5 rounded-2xl border bg-card px-5 py-4 shadow-raised sm:min-w-[13.5rem]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-eyebrow text-muted-foreground">Foundation</span>
        <span className="type-meta text-muted-foreground">
          <span className="type-metric align-baseline text-base text-foreground">
            {readyCount}
          </span>{" "}
          / {segments.length} ready
        </span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {segments.map((segment) => {
          const tone =
            segment.capability.key === recommendationKey
              ? "next"
              : toneForState(segment.state);
          return (
            <span
              key={segment.capability.key}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                SEGMENT_TONE[tone]
              )}
            />
          );
        })}
      </div>
    </div>
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
      className="relative overflow-hidden rounded-2xl border border-primary/40 bg-primary/[0.06] p-6 shadow-raised sm:p-7"
    >
      {/* A quiet brand seam anchoring the one active step, not a decorative glow. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary"
      />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
            <Icon className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 space-y-2">
            <span className="type-eyebrow flex items-center gap-2 text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              Recommended next step
            </span>
            <h2
              id="recommended-destination-heading"
              className="type-page-title text-balance"
            >
              {title}
            </h2>
            <p className="type-body max-w-xl text-pretty text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
          <Link href={entry.capability.route ?? "#"}>
            {action}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function LadderNode({
  entry,
  isLast,
  onRetry,
}: {
  entry: ComposedCapability;
  isLast: boolean;
  onRetry: () => void;
}) {
  const { capability, state, blockedBy, detail, isActionable } = entry;
  const tone = toneForState(state);
  const CapabilityGlyph = CAPABILITY_ICON[capability.key] ?? Info;
  const Glyph =
    state === "ready" ? Check : state === "blocked" ? Lock : CapabilityGlyph;
  const unavailableText = unavailableLabel(state, blockedBy);
  const action = actionLabel(entry);
  const isQuiet = state === "planned" || state === "blocked";

  return (
    <article className="group flex gap-4 sm:gap-5">
      {/* Full-height spine: the marker carries state, the connector carries
          sequence. This replaces the old corner glyph with a functional node. */}
      <div className="flex w-11 shrink-0 flex-col items-center">
        <span
          className={cn(
            "relative z-10 flex size-11 items-center justify-center rounded-xl transition-colors",
            MARKER_TONE[tone]
          )}
        >
          <Glyph
            className={cn("size-5", state === "ready" && "stroke-[2.5]")}
            aria-hidden
          />
        </span>
        {!isLast ? (
          <span
            aria-hidden
            className={cn(
              "mt-1 w-px flex-1 rounded-full",
              state === "ready" ? "bg-success/35" : "bg-border"
            )}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-3 pt-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
          isLast ? "pb-1" : "pb-8"
        )}
      >
        <div className={cn("min-w-0 space-y-1", isQuiet && "opacity-80")}>
          <h3 className="type-subsection-title text-foreground">
            {capability.title}
          </h3>
          <p className="type-meta max-w-md text-pretty text-muted-foreground">
            {capability.purpose}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          {detail ? (
            <span
              className={cn(
                "type-meta inline-flex items-center gap-1.5",
                state === "ready" ? "text-success" : "text-muted-foreground"
              )}
            >
              {state === "ready" ? (
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
              ) : null}
              {detail}
            </span>
          ) : unavailableText ? (
            <span className="type-meta text-muted-foreground">
              {unavailableText}
            </span>
          ) : null}

          <div className="flex items-center gap-3">
            {state === "unknown" ? (
              <button
                type="button"
                onClick={onRetry}
                className="type-label inline-flex min-h-8 items-center rounded-lg text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Retry status
              </button>
            ) : null}
            {isActionable && capability.route ? (
              <Link
                href={capability.route}
                className="type-label group/action inline-flex min-h-8 items-center gap-1.5 rounded-lg text-foreground underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {action}
                <ArrowRight
                  className="size-3.5 transition-transform group-hover/action:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            ) : null}
          </div>
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
    <PageContainer className="mx-auto max-w-4xl pb-14">
      <div
        className="space-y-9"
        role="status"
        aria-busy="true"
        aria-label="Loading tenant setup"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-5 w-[30rem] max-w-full" />
          </div>
          <Skeleton className="h-[4.75rem] w-full rounded-2xl sm:w-[13.5rem]" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="space-y-5">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-8">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex gap-5">
                <Skeleton className="size-11 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-64 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
