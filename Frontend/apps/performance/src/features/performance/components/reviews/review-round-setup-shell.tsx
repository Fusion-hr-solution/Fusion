"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { useReviewRound } from "@/features/performance/api/use-reviews";
import { RecordCycleScope, useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { roundHref, roundSetupHref, withCycle } from "@/lib/performance-routes";

const steps = [
  { key: "details", label: "Details", caption: "Set the review period" },
  { key: "population", label: "People", caption: "Confirm subjects and reviewers" },
  { key: "review", label: "Launch", caption: "Resolve readiness" },
] as const;

export function ReviewRoundSetupShell({ step, children }: { step: (typeof steps)[number]["key"]; children: ReactNode }) {
  const params = useParams<{ roundId: string }>();
  const roundId = params.roundId;
  const context = useWorkspaceContext();
  const isAdmin = context.data?.capabilities.administers ?? false;
  const round = useReviewRound(roundId, isAdmin);

  if (context.isLoading || (isAdmin && round.isLoading)) return <PageSkeleton rows={5} width="wide" label="Loading review round" />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (!isAdmin) return <PagePermissionNotice title="Administration only" description="Review round setup is available to Performance administrators." />;
  if (round.error) return <ContentUnavailable error={round.error} onRetry={round.refetch} subject="Review round" />;
  if (!round.data) return <PageSkeleton rows={5} width="wide" label="Loading review round" />;
  const currentRound = round.data;
  if (currentRound.state !== "Draft") return <RecordCycleScope cycleId={currentRound.cycleId}><PagePermissionNotice title="This round has launched" description="Launched rounds are read-only. Open the round to monitor its progress." action={
    <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={withCycle(roundHref(roundId), currentRound.cycleId)}>Open round</Link>
  } /></RecordCycleScope>;

  return (
    <RecordCycleScope cycleId={currentRound.cycleId}>
    <PageContainer width="wide">
      <PerformancePageHeading title={currentRound.name} eyebrow="Review round · Draft" back={{ href: withCycle("/reviews", currentRound.cycleId), label: "Reviews" }} />
      <nav aria-label="Review round setup" className="mb-7 border-b border-border">
        <ol className="flex gap-6 overflow-x-auto">
          {steps.map((item, index) => {
            const current = item.key === step;
            const href = withCycle(roundSetupHref(roundId, item.key), currentRound.cycleId);
            return (
              <li key={item.key} className="shrink-0">
                <Link aria-current={current ? "step" : undefined} href={href} className={`block border-b-2 py-3 text-sm ${current ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  <span className="mr-2 tabular-nums text-muted-foreground">{index + 1}</span>{item.label}
                  <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{item.caption}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      {children}
    </PageContainer>
    </RecordCycleScope>
  );
}
