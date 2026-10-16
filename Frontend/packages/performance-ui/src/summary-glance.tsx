import type { PersonSummaryCycleDto, PersonSummaryReviewsDto } from "@repo/api";
import { cn } from "@repo/ds";
import { PLAN_STATUS_LABEL, formatDate, percent, reviewSteps, stepLabel } from "./summary-lib";

const RING = 88;
const STROKE = 9;
const GAP = 3;

/**
 * Plan progress as each objective's share of it, one arc per objective coloured by its type (amber
 * aligned, blue standalone), the same reading as My Plan's ring. Before an approved plan has any
 * progress it holds an empty track and a dash: missing is not 0%.
 */
export function PlanDial({ cycle }: { cycle: PersonSummaryCycleDto }) {
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = cycle.objectives
    .map((objective) => ({
      id: objective.objectiveId,
      aligned: objective.alignedTo !== null,
      share: ((objective.progress ?? 0) * (objective.weight ?? 0)) / 100,
    }))
    .filter((segment) => segment.share > 0)
    .map((segment) => {
      const length = (segment.share / 100) * c;
      const placed = { ...segment, start: offset, length };
      offset += length;
      return placed;
    });
  const value = cycle.overallProgress;

  return (
    <div className="relative shrink-0" style={{ width: RING, height: RING }}>
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="-rotate-90" aria-hidden>
        <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" strokeWidth={STROKE} className="stroke-muted" />
        {segments.map((segment) => {
          const visible = Math.max(segment.length - (segments.length > 1 ? GAP : 0), 1);
          return (
            <circle
              key={segment.id}
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              fill="none"
              strokeWidth={STROKE}
              strokeDasharray={`${visible} ${c - visible}`}
              strokeDashoffset={-segment.start}
              className={segment.aligned ? "stroke-primary" : "stroke-info"}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("type-metric", value === null ? "text-muted-foreground" : "text-foreground")}>
          {value === null ? "–" : `${percent(value)}%`}
        </span>
      </div>
    </div>
  );
}

function PlanFact({ cycle }: { cycle: PersonSummaryCycleDto | null }) {
  if (!cycle) return <p className="type-body-secondary text-muted-foreground">No cycle yet</p>;
  if (!cycle.isParticipant) return <p className="type-body-secondary text-muted-foreground">Not part of {cycle.cycleName}</p>;
  return (
    <div className="flex items-center gap-4">
      <PlanDial cycle={cycle} />
      <div className="min-w-0 space-y-0.5">
        <p className="type-body font-medium text-foreground">{PLAN_STATUS_LABEL[cycle.planStatus ?? "NotStarted"]}</p>
        <p className="type-meta text-muted-foreground">
          {cycle.objectives.length === 1 ? "1 objective" : `${cycle.objectives.length} objectives`}
        </p>
      </div>
    </div>
  );
}

/** The current review's steps, done, current and ahead, with the current step's due date. */
export function ReviewStepTrack({ reviews }: { reviews: PersonSummaryReviewsDto }) {
  const current = reviews.current;
  if (!current) return <p className="type-body-secondary text-muted-foreground">No review in progress</p>;
  const steps = reviewSteps(current);
  const at = steps.indexOf(current.state as (typeof steps)[number]);
  return (
    <div className="space-y-2.5">
      <ol className="flex items-center gap-1" aria-label={`${current.reviewRoundName} review steps`}>
        {steps.map((step, index) => (
          <li
            key={step}
            aria-current={index === at ? "step" : undefined}
            aria-label={stepLabel(step)}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              index < at ? "bg-success" : index === at ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </ol>
      <div className="min-w-0">
        <p className="type-body font-medium text-foreground">{at >= 0 ? stepLabel(steps[at]!) : current.state}</p>
        <p className="type-meta text-muted-foreground">
          {current.reviewRoundName}
          {current.dueDate ? `, due ${formatDate(current.dueDate)}` : ""}
        </p>
      </div>
    </div>
  );
}

/** Released results over time, oldest to newest, so the latest sits at the end of the line. */
export function ResultsOverTime({ reviews }: { reviews: PersonSummaryReviewsDto }) {
  if (reviews.history.length === 0) return <p className="type-body-secondary text-muted-foreground">No released results yet</p>;
  const ordered = [...reviews.history].reverse().slice(-4);
  return (
    <ol className="flex flex-wrap items-end gap-x-5 gap-y-2">
      {ordered.map((result, index) => (
        <li key={result.reviewId} className="min-w-0">
          <p className={cn("type-body font-medium", index === ordered.length - 1 ? "text-foreground" : "text-muted-foreground")}>
            {result.finalRatingLabel ?? "No rating"}
          </p>
          <p className="type-meta text-muted-foreground">{result.cycleName}</p>
        </li>
      ))}
    </ol>
  );
}

/** The three facts that answer "how is this person doing": plan, review, results. */
export function SummaryGlance({
  cycle,
  reviews,
}: {
  cycle: PersonSummaryCycleDto | null;
  reviews: PersonSummaryReviewsDto | null;
}) {
  return (
    <section
      aria-label="At a glance"
      className="grid gap-6 rounded-surface bg-card p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] md:divide-x md:divide-border md:gap-0"
    >
      <div className="md:pr-6">
        <h3 className="mb-3 type-eyebrow text-muted-foreground">{cycle ? `Plan, ${cycle.cycleName}` : "Plan"}</h3>
        <PlanFact cycle={cycle} />
      </div>
      {reviews ? (
        <>
          <div className="md:px-6">
            <h3 className="mb-3 type-eyebrow text-muted-foreground">Review</h3>
            <ReviewStepTrack reviews={reviews} />
          </div>
          <div className="md:pl-6">
            <h3 className="mb-3 type-eyebrow text-muted-foreground">Results</h3>
            <ResultsOverTime reviews={reviews} />
          </div>
        </>
      ) : null}
    </section>
  );
}
