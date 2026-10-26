import type { PersonSummaryCycleDto, PersonSummaryReviewsDto } from "@repo/api";
import { cn } from "@repo/ds";
import { percent, reviewSteps } from "./summary-lib";
import { useTranslations } from "next-intl";
import { usePerformanceWords } from "./use-words";

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
  const t = useTranslations("performanceUi.PlanFact");
  const words = usePerformanceWords();
  if (!cycle) return <p className="type-body-secondary text-muted-foreground">{t("noCycleYet")}</p>;
  if (!cycle.isParticipant) return <p className="type-body-secondary text-muted-foreground">{t("notPartOf", { cycleName: cycle.cycleName })}</p>;
  return (
    <div className="flex items-center gap-4">
      <PlanDial cycle={cycle} />
      <div className="min-w-0 space-y-0.5">
        <p className="type-body font-medium text-foreground">{words.planStatus(cycle.planStatus ?? "NotStarted")}</p>
        <p className="type-meta text-muted-foreground">
          {cycle.objectives.length === 1 ? t("n1Objective") : t("objectives", { length: cycle.objectives.length })}
        </p>
        {atRisk(cycle) > 0 ? <p className="type-meta font-medium text-primary-ink">{t("atRisk", { cycle: atRisk(cycle) })}</p> : null}
      </div>
    </div>
  );
}

/** The current review's steps, done, current and ahead, with the current step's due date. */
export function ReviewStepTrack({ reviews }: { reviews: PersonSummaryReviewsDto }) {
  const t = useTranslations("performanceUi.ReviewStepTrack");
  const words = usePerformanceWords();
  const current = reviews.current;
  if (!current) return <p className="type-body-secondary text-muted-foreground">{t("noReviewInProgress")}</p>;
  const steps = reviewSteps(current);
  const at = steps.indexOf(current.state as (typeof steps)[number]);
  return (
    <div className="space-y-2.5">
      <ol className="flex items-center gap-1" aria-label={t("reviewSteps", { reviewRoundName: current.reviewRoundName })}>
        {steps.map((step, index) => (
          <li
            key={step}
            aria-current={index === at ? "step" : undefined}
            aria-label={words.step(step)}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              index < at ? "bg-success" : index === at ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </ol>
      <div className="min-w-0">
        <p className="type-body font-medium text-foreground">{at >= 0 ? words.step(steps[at]!) : current.state}</p>
        <p className="type-meta text-muted-foreground">
          {current.reviewRoundName}
          {current.dueDate ? t("due", { dueDate: words.date(current.dueDate) }) : ""}
        </p>
      </div>
    </div>
  );
}

/** Released results over time, oldest to newest, so the latest sits at the end of the line. */
export function ResultsOverTime({ reviews }: { reviews: PersonSummaryReviewsDto }) {
  const t = useTranslations("performanceUi.ResultsOverTime");
  if (reviews.history.length === 0) return <p className="type-body-secondary text-muted-foreground">{t("noReleasedResultsYet")}</p>;
  const ordered = [...reviews.history].reverse().slice(-4);
  return (
    <ol className="flex flex-wrap items-end gap-x-5 gap-y-2">
      {ordered.map((result, index) => (
        <li key={result.reviewId} className="min-w-0">
          <p className={cn("type-body font-medium", index === ordered.length - 1 ? "text-foreground" : "text-muted-foreground")}>
            {result.finalRatingLabel ?? t("noRating")}
          </p>
          <p className="type-meta text-muted-foreground">{result.cycleName}</p>
        </li>
      ))}
    </ol>
  );
}

/** At risk and off track together: the objectives someone said need attention. */
function atRisk(cycle: PersonSummaryCycleDto): number {
  return cycle.objectives.filter((objective) => objective.status === "AtRisk" || objective.status === "OffTrack").length;
}

/** The three facts that answer "how is this person doing": plan, review, results. */
export function SummaryGlance({
  cycle,
  reviews,
}: {
  cycle: PersonSummaryCycleDto | null;
  reviews: PersonSummaryReviewsDto | null;
}) {
  const t = useTranslations("performanceUi.SummaryGlance");
  return (
    <section
      aria-label={t("atAGlance")}
      className="grid gap-6 rounded-surface bg-card p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] md:divide-x md:divide-border md:gap-0"
    >
      <div className="md:pe-6">
        <h3 className="mb-3 type-meta text-muted-foreground">{cycle ? t("plan", { cycleName: cycle.cycleName }) : t("plan2")}</h3>
        <PlanFact cycle={cycle} />
      </div>
      {reviews ? (
        <>
          <div className="md:px-6">
            <h3 className="mb-3 type-meta text-muted-foreground">{t("review")}</h3>
            <ReviewStepTrack reviews={reviews} />
          </div>
          <div className="md:ps-6">
            <h3 className="mb-3 type-meta text-muted-foreground">{t("results")}</h3>
            <ResultsOverTime reviews={reviews} />
          </div>
        </>
      ) : null}
    </section>
  );
}
