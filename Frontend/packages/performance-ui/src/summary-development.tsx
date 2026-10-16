import type { DevelopmentGoalStatus, PersonSummaryDevelopmentDto } from "@repo/api";
import { cn } from "@repo/ds";
import { formatDate, type RenderSummaryLink } from "./summary-lib";

export const DEVELOPMENT_STATUS_LABEL: Record<DevelopmentGoalStatus, string> = {
  NotStarted: "Not started",
  InProgress: "In progress",
  Done: "Done",
};

/**
 * The person's growth goals for the cycle, each with its status and, while open, when it's aimed for.
 * The mark carries the status by shape and colour: an empty ring, a half-filled ring, a filled check.
 */
export function SummaryDevelopment({ development, renderLink }: { development: PersonSummaryDevelopmentDto; renderLink: RenderSummaryLink }) {
  return (
    <section aria-labelledby="summary-development-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="summary-development-heading" className="type-section-title text-foreground">
          Development
        </h2>
        {renderLink({ href: development.href, className: "type-label text-primary-ink hover:underline", children: "Open development" })}
      </div>
      {development.goals.length === 0 ? (
        <p className="type-body-secondary text-muted-foreground">No development goals yet</p>
      ) : (
        <ul className="space-y-4 rounded-surface bg-card p-5">
          {development.goals.map((goal, index) => (
            <li key={`${goal.title}-${index}`} className="flex items-start gap-3">
              <GoalMark status={goal.status} />
              <div className="min-w-0">
                <p className="type-body font-medium text-foreground">{goal.title}</p>
                <p className="type-meta text-muted-foreground">
                  {[
                    DEVELOPMENT_STATUS_LABEL[goal.status],
                    goal.competencyName,
                    goal.targetDate && goal.status !== "Done" ? `by ${formatDate(goal.targetDate)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GoalMark({ status }: { status: DevelopmentGoalStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
        status === "Done" && "border-success bg-success text-background",
        status === "InProgress" && "border-primary bg-[linear-gradient(90deg,var(--primary)_50%,transparent_50%)]",
        status === "NotStarted" && "border-muted-foreground/40",
      )}
    >
      {status === "Done" ? (
        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.5 6.5l2.2 2.2 4.8-5" />
        </svg>
      ) : null}
    </span>
  );
}
