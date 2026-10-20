"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { PerformanceReviewDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { ArrowRight, Check, Eye, Lock } from "@/lib/icons";
import { useSummaryRevision } from "../../api/use-review-work";
import { dayLabel } from "./review-parts";

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * Board 15: what calibration settled for this person, shown to their reviewer once the session is finalized (D-23, call 7).
 * When the rating changed, the summary, and only the summary, stays editable until release.
 */
export function CalibratedOutcome({ record }: { record: PerformanceReviewDto }) {
  const calibration = record.calibration;
  if (!calibration?.sessionFinalized) return null;
  const subject = first(record.subjectDisplayName);
  const final = calibration.calibratedRating ?? calibration.originalRating;
  const changed = calibration.calibratedRating !== null && calibration.calibratedRating !== calibration.originalRating;
  const potentialChanged = calibration.calibratedPotential !== null && calibration.calibratedPotential !== calibration.originalPotential;
  const label = (value: number) => record.ratingScale.find((level) => level.value === value)?.label ?? String(value);
  return (
    <section aria-labelledby="calibration-outcome" className="mt-6 rounded-surface bg-card p-6">
      <p id="calibration-outcome" className="type-eyebrow text-muted-foreground">After calibration</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-12 items-center justify-center rounded-control type-metric tabular-nums",
            changed ? "border border-primary bg-primary-tint text-primary-ink" : "bg-inlay text-foreground")}>{final}</span>
          <div>
            <p className="type-label text-foreground">{label(final)}</p>
            <p className="type-meta text-muted-foreground">{changed ? `You gave ${calibration.originalRating} · ${label(calibration.originalRating)}` : "As you rated"}</p>
          </div>
        </div>
        {potentialChanged ? (
          <p className="inline-flex items-center gap-1.5 type-body text-foreground">
            Potential <span className="text-muted-foreground line-through">{calibration.originalPotential}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />{calibration.calibratedPotential}
          </p>
        ) : null}
      </div>
      {calibration.rationale ? (
        <figure className="mt-5 rounded-control bg-inlay px-4 py-3">
          <blockquote className="type-narrative text-foreground">{calibration.rationale}</blockquote>
          <figcaption className="mt-1.5 type-meta text-muted-foreground">
            {[calibration.changedBy, calibration.changedAt ? dayLabel(calibration.changedAt.slice(0, 10)) : null].filter(Boolean).join(" · ")}
          </figcaption>
        </figure>
      ) : null}
      {record.state === "ReadyToFinalize" ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-control bg-inlay px-4 py-3">
            <p className="flex items-center gap-1.5 type-label text-foreground"><Eye className="size-4 text-muted-foreground" aria-hidden />{subject} will see</p>
            <p className="mt-1 type-body-secondary text-muted-foreground">The final rating and your summary</p>
          </div>
          <div className="rounded-control bg-inlay px-4 py-3">
            <p className="flex items-center gap-1.5 type-label text-foreground"><Lock className="size-4 text-muted-foreground" aria-hidden />{subject} won&apos;t see</p>
            <p className="mt-1 type-body-secondary text-muted-foreground">Your rating, the reason{record.potentialEnabled ? " or potential" : ""}</p>
          </div>
        </div>
      ) : null}
      {calibration.canReviseSummary ? <SummaryRevision record={record} subject={subject} /> : null}
    </section>
  );
}

function SummaryRevision({ record, subject }: { record: PerformanceReviewDto; subject: string }) {
  const calibration = record.calibration!;
  const commands = useSummaryRevision(record.id);
  const saved = record.managerAssessment?.summary ?? "";
  const [summary, setSummary] = useState(saved);
  const settled = calibration.summaryRevisedAt ?? calibration.summaryCheckedAt;
  const dirty = summary.trim() !== saved.trim();
  return (
    <div className="mt-6 border-t border-border pt-5">
      <label htmlFor="revised-summary" className="type-label text-foreground">Your summary</label>
      <p className="type-meta text-muted-foreground">
        {calibration.summaryRevisedAt ? `Revised ${dayLabel(calibration.summaryRevisedAt.slice(0, 10))} · editable until results are released`
          : calibration.summaryCheckedAt ? `Kept ${dayLabel(calibration.summaryCheckedAt.slice(0, 10))} · editable until results are released`
          : `${subject} reads this beside the final rating`}
      </p>
      <Textarea id="revised-summary" className="mt-2 min-h-28 type-narrative" maxLength={4000} value={summary} onChange={(event) => setSummary(event.target.value)} />
      {commands.revise.error || commands.keep.error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">{(commands.revise.error ?? commands.keep.error)?.message}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {!settled ? (
          <AsyncButton variant="outline" pending={commands.keep.isLoading} disabled={dirty}
            onClick={async () => { try { await commands.keep.mutateAsync(undefined); toast.success("Summary kept."); } catch { /* shown above */ } }}>
            Keep as is
          </AsyncButton>
        ) : null}
        <AsyncButton pending={commands.revise.isLoading} disabled={!dirty || !summary.trim()}
          onClick={async () => {
            try { await commands.revise.mutateAsync({ summary: summary.trim(), expectedVersion: record.version }); toast.success("Summary saved."); }
            catch { /* shown above */ }
          }}>
          <Check className="size-4" aria-hidden />Save summary
        </AsyncButton>
        {dirty ? <Button variant="ghost" onClick={() => setSummary(saved)}>Undo changes</Button> : null}
      </div>
    </div>
  );
}
