"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@repo/ds/components/ui/button";
import { AsyncButton, PageContainer, PagePermissionNotice, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { RecordCycleScope, useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { useReviewRound, useReviewRoundFinalization, useReviewRoundStatus, useReviewWork } from "@/features/performance/api/use-reviews";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { formatDate } from "@/features/performance/lib";
import { RoundRatingDistribution } from "@/features/performance/components/reviews/round-rating-distribution";
import { calibrationHref, reviewHref, roundSetupHref, withCycle } from "@/lib/performance-routes";
import type { PerformanceReviewState, ReviewWorkItemDto } from "@repo/api";

const stages: { state: PerformanceReviewState; title: string }[] = [
  { state: "SelfAssessment", title: "Self-assessment" },
  { state: "ManagerAssessment", title: "Reviewer assessment" },
  { state: "Calibration", title: "Calibration" },
  { state: "ReadyToFinalize", title: "Ready to finalize" },
];

export default function ReviewRoundOperationsPage() {
  const params = useParams<{ roundId: string }>();
  const router = useRouter();
  const roundId = params.roundId;
  const context = useWorkspaceContext();
  const isAdmin = context.data?.capabilities.administers ?? false;
  const roundQuery = useReviewRound(roundId, isAdmin);
  const round = roundQuery.data;
  const status = useReviewRoundStatus(roundId, isAdmin && round?.state !== "Draft");
  const work = useReviewWork(round?.cycleId ?? null, isAdmin && round?.state !== "Draft");
  const finalize = useReviewRoundFinalization(roundId, round?.cycleId ?? "");
  const canCalibrate = context.data?.capabilities.canCalibrate ?? false;

  if (context.isLoading || (isAdmin && roundQuery.isLoading)) return <PageSkeleton rows={7} width="wide" label="Loading review round" />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (!isAdmin) return <PagePermissionNotice title="Administration only" description="Round operations are available to Performance administrators." />;
  if (roundQuery.error) return <ContentUnavailable error={roundQuery.error} onRetry={roundQuery.refetch} subject="Review round" />;
  if (!round) return <PageSkeleton rows={7} width="wide" label="Loading review round" />;
  if (round.state === "Draft") {
    return <RecordCycleScope cycleId={round.cycleId}><PageContainer width="wide"><PerformancePageHeading title={round.name} eyebrow="Review round · Draft" back={{ href: withCycle("/reviews", round.cycleId), label: "Reviews" }} description="This round has not launched yet." actions={<Button onClick={() => router.push(withCycle(roundSetupHref(round.id, "details"), round.cycleId))}>Continue setup</Button>} /></PageContainer></RecordCycleScope>;
  }
  if (status.error) return <ContentUnavailable error={status.error} onRetry={status.refetch} subject="Round status" />;
  if (work.error) return <ContentUnavailable error={work.error} onRetry={work.refetch} subject="Review work" />;
  if (status.isLoading || work.isLoading) return <PageSkeleton rows={7} width="wide" label="Loading round operations" />;

  const items = (work.data ?? []).filter((item) => item.reviewRoundId === round.id);
  const counts = new Map(status.data?.stageCounts.map((entry) => [entry.state, entry.count]) ?? []);
  const roundStages = round.calibrationEnabled ? stages : stages.filter((stage) => stage.state !== "Calibration");
  const included = round.subjects.filter((subject) => !subject.isExcluded).length;
  const excluded = round.subjects.length - included;
  const today = new Date().toISOString().slice(0, 10);
  const readyCount = status.data?.readyToFinalizeCount ?? 0;

  return (
    <RecordCycleScope cycleId={round.cycleId}>
    <PageContainer width="wide">
      <PerformancePageHeading title={round.name} eyebrow={`Review round · ${round.state}`} back={{ href: withCycle("/reviews", round.cycleId), label: "Reviews" }} description={`${formatDate(round.periodStart)} – ${formatDate(round.periodEnd)} · ${included} ${included === 1 ? "person" : "people"} in the round${excluded ? ` · ${excluded} excluded` : ""}`} actions={<>{round.calibrationEnabled && canCalibrate ? <Button variant={readyCount > 0 ? "outline" : "default"} asChild><Link href={withCycle(calibrationHref(round.id), round.cycleId)}>Open calibration</Link></Button> : null}{readyCount > 0 ? <AsyncButton pending={finalize.isLoading} onClick={() => { void finalize.mutateAsync(round.version).then((result) => toast.success(`${result.finalized.length} ${result.finalized.length === 1 ? "review" : "reviews"} finalized.`)).catch(() => undefined); }}>Finalize {readyCount} ready reviews</AsyncButton> : null}</>} />
      {finalize.error ? <p className="mb-4 max-w-5xl text-sm text-destructive" role="alert">{finalize.error.message || "Ready reviews could not be finalized."}</p> : null}
      <section aria-label="Round status" className="max-w-5xl border-y border-border">
        <div className={`grid grid-cols-2 divide-x divide-border ${roundStages.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {roundStages.map((stage) => <div key={stage.state} className="py-4 pr-4 first:pl-0 md:pl-5"><div className="type-meta text-muted-foreground">{stage.title}</div><div className="mt-1 type-page-title tabular-nums text-foreground">{counts.get(stage.state) ?? 0}</div></div>)}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border py-3 text-sm text-muted-foreground">
          {status.data && round.selfAssessmentEnabled ? <span>Self-assessments <strong className="tabular-nums text-foreground">{status.data.selfAssessments.submitted} of {status.data.selfAssessments.required}</strong> submitted</span> : null}
          {status.data ? <span>Reviewer assessments <strong className="tabular-nums text-foreground">{status.data.managerAssessments.submitted} of {status.data.managerAssessments.required}</strong> submitted</span> : null}
          <span>Overdue self-assessments <strong className="tabular-nums text-foreground">{status.data?.overdueSelfAssessments ?? 0}</strong></span>
          <span>Overdue reviewer assessments <strong className="tabular-nums text-foreground">{status.data?.overdueManagerAssessments ?? 0}</strong></span>
        </div>
      </section>
      {status.data ? <RoundRatingDistribution levels={status.data.ratingDistribution} cycleId={round.cycleId} /> : null}

      <div className="mt-8 max-w-5xl divide-y divide-border">
        {roundStages.map((stage) => {
          const group = items.filter((item) => item.state === stage.state);
          return <section key={stage.state} className="py-5 first:pt-0" aria-labelledby={`stage-${stage.state}`}>
            <div className="mb-2 flex items-baseline gap-3"><h2 id={`stage-${stage.state}`} className="type-section-title text-foreground">{stage.title}</h2><span className="type-meta tabular-nums text-muted-foreground">{counts.get(stage.state) ?? 0}</span></div>
            {group.length ? <ol className="divide-y divide-border">{group.map((item) => <WorkRow key={item.reviewId} item={item} overdue={Boolean(item.dueDate && item.dueDate.slice(0, 10) < today)} />)}</ol> : <p className="py-2 text-sm text-muted-foreground">No reviews at this stage.</p>}
          </section>;
        })}
      </div>
    </PageContainer>
    </RecordCycleScope>
  );
}

function WorkRow({ item, overdue }: { item: ReviewWorkItemDto; overdue: boolean }) {
  return <li><Link href={withCycle(reviewHref(item.reviewId), item.cycleId)} className="group flex min-h-14 flex-wrap items-center gap-x-5 gap-y-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-40 flex-1"><span className="type-label text-foreground">{item.subjectDisplayName}</span><span className="mt-0.5 block text-sm text-muted-foreground">Reviewer · {item.reviewerDisplayName}{item.dueDate ? ` · Due ${formatDate(item.dueDate)}` : ""}</span></span>{overdue ? <StatusBadge tone="warning">Overdue</StatusBadge> : null}<span className="text-sm font-medium text-foreground">Open review <span aria-hidden>→</span></span></Link></li>;
}
