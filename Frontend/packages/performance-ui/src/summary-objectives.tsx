import type { PersonSummaryCycleDto } from "@repo/api";
import { cn } from "@repo/ds";
import { percent, type RenderSummaryLink } from "./summary-lib";

/**
 * The plan's objectives in Performance's own language: a numbered tile in the objective's type colour
 * (amber aligned, blue standalone), its alignment, weight and progress. Each opens its record.
 */
export function SummaryObjectives({ cycle, renderLink }: { cycle: PersonSummaryCycleDto; renderLink: RenderSummaryLink }) {
  return (
    <section aria-labelledby="summary-objectives-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="summary-objectives-heading" className="type-section-title text-foreground">
          Objectives
        </h2>
        {cycle.planHref
          ? renderLink({
              href: cycle.planHref,
              className: "type-label text-primary-ink hover:underline",
              children: "Open plan",
            })
          : null}
      </div>
      {!cycle.isParticipant ? (
        <p className="type-body-secondary text-muted-foreground">Not part of {cycle.cycleName}</p>
      ) : cycle.objectives.length === 0 ? (
        <p className="type-body-secondary text-muted-foreground">No objectives shared yet</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-surface bg-card">
          {cycle.objectives.map((objective) => {
            const aligned = objective.alignedTo !== null;
            return (
              <li key={objective.objectiveId}>
                {renderLink({
                  href: objective.href,
                  className: "group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted",
                  children: (
                    <>
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-control border type-label tabular-nums",
                          aligned ? "border-primary-ring bg-primary-tint text-primary-ink" : "border-info-subtle bg-info-subtle text-info",
                        )}
                      >
                        {String(objective.number).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate type-body font-medium text-foreground group-hover:underline">
                          {objective.title}
                        </span>
                        <span className={cn("block truncate type-meta", aligned ? "text-primary-ink" : "text-info")}>
                          {aligned ? `Aligned to ${objective.alignedTo}` : "Standalone"}
                        </span>
                      </span>
                      {objective.weight !== null ? (
                        <span className="w-12 shrink-0 text-right type-meta tabular-nums text-muted-foreground">
                          {percent(objective.weight)}%
                        </span>
                      ) : null}
                      <span className="flex w-28 shrink-0 items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span
                            className={cn("block h-full rounded-full", aligned ? "bg-primary" : "bg-info")}
                            style={{ width: `${Math.min(objective.progress ?? 0, 100)}%` }}
                          />
                        </span>
                        <span className="w-9 text-right type-meta tabular-nums text-foreground">
                          {objective.progress === null ? "–" : `${percent(objective.progress)}%`}
                        </span>
                      </span>
                    </>
                  ),
                })}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
