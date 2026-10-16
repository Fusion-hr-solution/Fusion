import type { PersonPerformanceSummaryDto } from "@repo/api";
import { Button, Skeleton } from "@repo/ds";
import { SummaryGlance } from "./summary-glance";
import { SummaryObjectives } from "./summary-objectives";
import { SummaryReviews } from "./summary-reviews";
import type { RenderSummaryLink } from "./summary-lib";

export type PersonPerformanceSummaryState =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; summary: PersonPerformanceSummaryDto };

export interface PersonPerformanceSummaryProps {
  state: PersonPerformanceSummaryState;
  renderLink: RenderSummaryLink;
}

function SummarySkeleton() {
  return (
    <div aria-busy aria-label="Loading performance" className="space-y-8">
      <Skeleton className="h-32 w-full rounded-surface" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full rounded-surface" />
      </div>
    </div>
  );
}

/**
 * One person's performance as the viewer may see it: the glance, the current cycle's objectives and
 * the reviews. Only the sections the server returned are rendered; when it returned none, one line
 * says so. Loading and failure stay in place, so the surrounding record never waits on Performance.
 */
export function PersonPerformanceSummary({ state, renderLink }: PersonPerformanceSummaryProps) {
  if (state.status === "loading") return <SummarySkeleton />;
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-surface bg-card px-5 py-4">
        <p className="type-body text-foreground">Performance couldn&apos;t be loaded.</p>
        <Button variant="outline" size="sm" onClick={state.onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const { summary } = state;
  const cycle = summary.currentCycle;
  const reviews = summary.reviews;
  if (!cycle && !reviews) {
    return <p className="type-body-secondary text-muted-foreground">There&apos;s nothing you can see here yet.</p>;
  }

  return (
    <div className="space-y-8">
      <SummaryGlance cycle={cycle} reviews={reviews} />
      {cycle ? <SummaryObjectives cycle={cycle} renderLink={renderLink} /> : null}
      {reviews ? <SummaryReviews reviews={reviews} renderLink={renderLink} /> : null}
    </div>
  );
}
