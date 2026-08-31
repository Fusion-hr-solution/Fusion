"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ds/components/ui/button";
import { PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import type { CycleDetailDto } from "@repo/api";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import {
  useActivateCycle,
  useCreateCycle,
  useCurrentCycle,
  useMyPlan,
  usePerformanceAccess,
  usePlanReviews,
  useStrategy,
} from "@/features/performance/api/use-performance";
import { formatDate, measurementSummary } from "@/features/performance/lib";
import { CycleContextBar } from "@/features/performance/components/cycle-context-bar";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { LaunchReadiness } from "@/features/performance/components/launch-readiness";
import { MilestoneRail } from "@/features/performance/components/milestone-rail";
import { ActivationReview } from "@/features/performance/components/activation-review";
import { CycleDetailsDialog } from "@/features/performance/components/cycle-details-dialog";

const LIFECYCLE = ["Direction", "Population", "Planning", "Progress"] as const;

export default function OverviewPage() {
  const access = usePerformanceAccess();
  const canEnter = access.data?.canEnter ?? false;
  const detail = useCurrentCycle(canEnter);

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading Performance" />;
  if (!canEnter) {
    return (
      <PagePermissionNotice
        title="No Performance access"
        description="You do not have access to the Performance workspace."
      />
    );
  }

  const canAdminister = access.data?.canAdminister ?? false;
  const canParticipate = access.data?.canParticipate ?? false;
  const canReview =
    canAdminister ||
    ["DirectReports", "OrgUnit", "Tenant"].includes(access.data?.aggregateViewScope ?? "");

  if (detail.isLoading) return <PageSkeleton rows={4} label="Loading Cycle" />;
  if (detail.error) {
    return <ContentUnavailable error={detail.error} onRetry={detail.refetch} subject="The Cycle" />;
  }

  if (!detail.data) {
    return <NoCycleEntry canAdminister={canAdminister} />;
  }

  return (
    <CycleOverview
      detail={detail.data}
      canAdminister={canAdminister}
      canParticipate={canParticipate}
      canReview={canReview}
    />
  );
}

/** First entry, before any Cycle exists — compact, no decorative illustration. */
function NoCycleEntry({ canAdminister }: { canAdminister: boolean }) {
  const router = useRouter();
  const createCycle = useCreateCycle();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PageContainer>
      <PerformancePageHeading
        title="Performance"
        description="Set direction, align people, agree plans, and track progress through one Performance Cycle."
      />
      <div className="max-w-xl">
        <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
          {LIFECYCLE.map((step, index) => (
            <li key={step} className="flex items-center gap-2.5">
              <span className="text-foreground">{step}</span>
              {index < LIFECYCLE.length - 1 ? (
                <ArrowRight className="size-3.5 text-muted-foreground/40" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>

        {canAdminister ? (
          <div className="mt-7">
            <Button size="lg" onClick={() => setCreateOpen(true)}>
              <CalendarPlus className="size-4" data-icon="inline-start" />
              Create cycle
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            No Cycle is running yet. Your administrator opens the next one.
          </p>
        )}
      </div>

      <CycleDetailsDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (value) => {
          const created = await createCycle.mutateAsync({
            name: value.name,
            startDate: value.startDate,
            endDate: value.endDate,
            planningDeadline: value.planningDeadline,
          });
          toast.success(`${created.name} created.`);
          router.push("/setup");
        }}
      />
    </PageContainer>
  );
}

function CycleOverview({
  detail,
  canAdminister,
  canParticipate,
  canReview,
}: {
  detail: CycleDetailDto;
  canAdminister: boolean;
  canParticipate: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const cycleId = detail.cycle.id;
  const isDraft = detail.cycle.state === "Draft";

  return (
    <PageContainer>
      <CycleContextBar cycle={detail.cycle} />
      <PerformancePageHeading
        title="Overview"
        actions={
          canAdminister && isDraft ? (
            <Button onClick={() => router.push("/setup")}>Continue setup</Button>
          ) : undefined
        }
      />

      <div className="space-y-8">
        {/* Responsibility first: what needs this person now. */}
        {canReview ? <ReviewsCallout cycleId={cycleId} /> : null}
        {canParticipate ? (
          <MyPlanCallout cycleId={cycleId} planningDeadline={detail.cycle.planningDeadline} />
        ) : null}

        {/* Cycle command, for administrators. */}
        {canAdminister ? (
          <div className="space-y-6">
            <MilestoneRail milestones={detail.milestones} />
            {isDraft ? (
              <AdminDraftCommand detail={detail} />
            ) : (
              <AdminActiveCommand detail={detail} />
            )}
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

function ReviewsCallout({ cycleId }: { cycleId: string }) {
  const reviews = usePlanReviews(cycleId, true);
  const count = reviews.data?.awaitingDecisionCount ?? 0;
  if (count === 0) return null;
  const top = reviews.data?.plans[0];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="type-metric text-foreground">{count}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            plan{count === 1 ? "" : "s"} awaiting your decision
          </p>
          {top ? (
            <p className="truncate text-sm text-muted-foreground">
              {top.employee.name ?? "A team member"}
              {top.orgUnitName ? ` · ${top.orgUnitName}` : ""}
              {count > 1 ? ` and ${count - 1} more` : ""}
            </p>
          ) : null}
        </div>
        <Button asChild className="ml-auto">
          <Link href="/reviews">
            Review
            <ArrowRight className="size-4" data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function MyPlanCallout({
  cycleId,
  planningDeadline,
}: {
  cycleId: string;
  planningDeadline: string;
}) {
  const my = useMyPlan(cycleId, true);
  if (!my.data?.participatesInCycle) return null;

  const plan = my.data.plan;
  const latest = plan?.history.at(-1);
  const returned = plan?.state === "Draft" && latest?.kind === "Returned";
  const reviewer = plan?.responsibleManager?.name ?? "your manager";

  let headline: string;
  let sub: string | undefined;
  let cta: string;
  if (!plan) {
    headline = "Start your plan";
    sub = `Planning is open until ${formatDate(planningDeadline)}. Reviewer: ${reviewer}.`;
    cta = "Start planning";
  } else if (returned) {
    headline = "Returned for changes";
    sub = latest?.feedback
      ? `${latest.actorName ?? reviewer}: “${latest.feedback}”`
      : `${latest?.actorName ?? reviewer} asked for changes.`;
    cta = "Revise plan";
  } else if (plan.state === "Draft") {
    headline = "Continue your plan";
    sub = `${plan.readiness.weightTotal}% of 100% allocated · ${plan.objectives.length} objective${plan.objectives.length === 1 ? "" : "s"}`;
    cta = plan.objectives.length === 0 ? "Start planning" : "Continue";
  } else if (plan.state === "Submitted") {
    headline = `Awaiting ${reviewer}'s review`;
    sub = `Submitted ${formatDate((plan.submittedAt ?? "").slice(0, 10))}`;
    cta = "View plan";
  } else {
    headline = "Plan approved";
    sub = `${plan.planProgress}% progress · keep it up to date`;
    cta = "Update progress";
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="type-eyebrow text-muted-foreground">My plan</p>
          <p className="mt-1 text-base font-semibold text-foreground">{headline}</p>
          {sub ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{sub}</p> : null}
        </div>
        <Button asChild variant={returned ? "default" : "outline"}>
          <Link href="/plan">
            {cta}
            <ArrowRight className="size-4" data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function AdminDraftCommand({ detail }: { detail: CycleDetailDto }) {
  const router = useRouter();
  const activate = useActivateCycle(detail.cycle.id);
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <>
      <LaunchReadiness
        readiness={detail.launchReadiness}
        onOpenArea={(area) => router.push(`/setup?area=${area}`)}
        onActivate={() => setReviewOpen(true)}
        activating={activate.isLoading}
      />
      <ActivationReview
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        detail={detail}
        onActivate={async () => {
          await activate.mutateAsync();
        }}
      />
    </>
  );
}

function AdminActiveCommand({ detail }: { detail: CycleDetailDto }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <DirectionSummary cycleId={detail.cycle.id} />

      <aside className="space-y-6 lg:border-l lg:border-border/60 lg:pl-8">
        <div className="flex gap-10">
          <div>
            <p className="type-metric text-foreground">{detail.confirmedParticipantCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Participants</p>
          </div>
          <div>
            <p className="type-metric text-foreground">{detail.publishedStrategyCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Published
              {detail.draftStrategyCount > 0 ? (
                <span className="text-muted-foreground/70"> · {detail.draftStrategyCount} draft</span>
              ) : null}
            </p>
          </div>
        </div>

        {detail.launchReadiness.blockers.length > 0 ? (
          <div className="rounded-xl border border-warning/30 bg-warning-subtle p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
              <AlertTriangle className="size-3.5" aria-hidden />
              Needs attention
            </p>
            <ul className="mt-1.5 space-y-1 pl-5 text-sm text-muted-foreground">
              {detail.launchReadiness.blockers.map((blocker) => (
                <li key={blocker} className="list-disc marker:text-warning/60">
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col items-start gap-1">
          <Button variant="ghost" asChild className="px-2">
            <Link href="/setup">Manage cycle</Link>
          </Button>
          <Button variant="ghost" asChild className="px-2">
            <Link href="/settings">Settings</Link>
          </Button>
        </div>
      </aside>
    </div>
  );
}

function DirectionSummary({ cycleId }: { cycleId: string }) {
  const strategy = useStrategy(cycleId);
  const published = (strategy.data ?? []).filter((item) => item.state === "Published");

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="type-section-title text-foreground">Direction</h2>
        <Link
          href="/goals"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Goals
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {strategy.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading direction…</p>
      ) : published.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No strategic direction is published for this Cycle yet.
        </p>
      ) : (
        <ul className="divide-y divide-border/70 border-t border-border/70">
          {published.map((objective) => (
            <li
              key={objective.id}
              className="flex items-baseline justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {objective.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {objective.accountablePersonName ?? "Unassigned"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {measurementSummary(objective.measurement)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
