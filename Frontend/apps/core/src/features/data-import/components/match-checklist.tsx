"use client";

import { ChartNoAxesColumn, Check, TriangleAlert } from "lucide-react";
import { cn } from "@repo/ds";
import type { OrganizationImportMatch, OrganizationSourceTable } from "@repo/api";
import { countMappedColumns } from "../model/match-progress";
import { summarizeMatch } from "./match-summary-banner";

/** Where interpretation stands, one line per thing Match resolves. */
export function MatchStatusSummary({
  table,
  match,
}: {
  table: OrganizationSourceTable;
  match: OrganizationImportMatch;
}) {
  const summary = summarizeMatch(match);
  const columns = countMappedColumns(table, match);
  const lines: Array<{ label: string; value: string; done: boolean }> = [
    { label: "Hierarchy shape interpreted", value: summary.shapeLabel, done: summary.shapeResolved },
    {
      label: "Source columns mapped",
      value: `${columns.mapped} of ${columns.total} mapped`,
      done: !match.readiness.requiredDecisions.some((d) => d.kind === "FieldMapping"),
    },
    {
      label: "Organization types resolved",
      value: `${summary.typesResolved} of ${summary.typesTotal} resolved`,
      done: summary.typesResolved === summary.typesTotal,
    },
    {
      label: "Items needing review",
      value: summary.needsReview ? `${summary.needsReview} remaining` : "None",
      done: summary.needsReview === 0,
    },
  ];

  return (
    <section aria-labelledby="match-status-title" className="rounded-surface border border-border bg-card p-4">
      <header className="flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <ChartNoAxesColumn className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 id="match-status-title" className="type-panel-title font-semibold text-foreground">
            Matching summary
          </h2>
          <p className="type-meta text-muted-foreground">Current interpretation status.</p>
        </div>
      </header>
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-object border border-border">
        {lines.map((line) => (
          <li key={line.label} className="flex items-center gap-3 px-3 py-2">
            <StatusMark done={line.done} />
            <span className="type-meta min-w-0 flex-1 text-foreground">{line.label}</span>
            <span
              className={cn(
                "type-meta shrink-0 text-right tabular-nums",
                line.done ? "text-muted-foreground" : "font-medium text-primary-foreground dark:text-primary"
              )}
            >
              {line.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusMark({ done }: { done: boolean }) {
  return done ? (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success text-white">
      <Check aria-hidden className="size-3" strokeWidth={3} />
      <span className="sr-only">Done</span>
    </span>
  ) : (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
      <TriangleAlert aria-hidden className="size-3" strokeWidth={2.5} />
      <span className="sr-only">Needs attention</span>
    </span>
  );
}
