"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CalibrationSubjectDto, PerformanceReviewDto, RatingScaleLevelDto } from "@repo/api";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { Check } from "@/lib/icons";
import { formatDateTime } from "../../lib";
import { reviewHref } from "@/lib/performance-routes";
import { draftFor, draftProblem, isDirty, levelLabel, type SubjectDraft } from "./calibration-model";

/**
 * One subject, in place beside the table: what the manager concluded and why, then the calibrated rating,
 * its rationale and the discussion mark, then the trail of changes. The review content is read-only context.
 */
export function CalibrationFocusPanel({
  subject,
  scale,
  review,
  reviewLoading,
  readOnly,
  pending,
  error,
  onSave,
}: {
  subject: CalibrationSubjectDto;
  scale: RatingScaleLevelDto[];
  review: PerformanceReviewDto | undefined;
  reviewLoading: boolean;
  readOnly: boolean;
  pending: boolean;
  error: Error | null;
  onSave: (draft: SubjectDraft) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<SubjectDraft>(() => draftFor(subject));
  const [touched, setTouched] = useState(false);
  // A new subject, or a saved version of this one, resets the editor to what the server holds.
  useEffect(() => { setDraft(draftFor(subject)); setTouched(false); }, [subject]);
  const problem = draftProblem(subject, draft);
  const dirty = isDirty(subject, draft);
  const changed = draft.rating !== subject.originalRating;

  return (
    <section aria-labelledby="calibration-focus-title" className="min-w-0">
      <p className="type-meta text-muted-foreground">{[subject.jobTitle, subject.orgUnitName].filter(Boolean).join(" · ") || "Calibration subject"}</p>
      <h2 id="calibration-focus-title" className="mt-0.5 type-panel-title text-foreground">{subject.subjectDisplayName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Reviewer {subject.reviewerDisplayName}</p>

      <div className="mt-5">
        <RatingSegments
          scale={scale}
          value={draft.rating}
          original={subject.originalRating}
          disabled={readOnly}
          onChange={(rating) => setDraft((current) => ({ ...current, rating }))}
        />
      </div>

      {changed && !readOnly ? (
        <div className="mt-4">
          <label htmlFor="calibration-rationale" className="type-label text-foreground">Rationale</label>
          <Textarea
            id="calibration-rationale"
            className="mt-2 min-h-24"
            value={draft.rationale}
            maxLength={2000}
            aria-invalid={touched && Boolean(problem)}
            onBlur={() => setTouched(true)}
            onChange={(event) => setDraft((current) => ({ ...current, rationale: event.target.value }))}
          />
        </div>
      ) : null}
      {readOnly && subject.rationale ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{subject.rationale}</p> : null}

      {!readOnly ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={draft.discussed}
            onClick={() => setDraft((current) => ({ ...current, discussed: !current.discussed }))}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-control border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              draft.discussed ? "border-success/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <span aria-hidden className={cn("grid size-4 place-items-center rounded-detail border", draft.discussed ? "border-success bg-success text-background" : "border-input")}>
              {draft.discussed ? <Check className="size-3" /> : null}
            </span>
            Discussed
          </button>
          <AsyncButton
            pending={pending}
            disabled={!dirty || Boolean(problem)}
            onClick={() => { setTouched(true); if (!problem) void onSave(draft).catch(() => undefined); }}
          >
            Save calibration
          </AsyncButton>
        </div>
      ) : null}
      {touched && problem ? <p className="mt-2 text-sm text-destructive" role="alert">{problem}</p> : null}
      {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error.message || "This change could not be saved."}</p> : null}

      <History subject={subject} scale={scale} />
      <ReviewContext review={review} loading={reviewLoading} scale={scale} />
    </section>
  );
}

/** The scale as one segmented radio group: arrow keys move, the manager's level stays marked. */
export function RatingSegments({ scale, value, original, disabled, onChange }: {
  scale: RatingScaleLevelDto[];
  value: number;
  original: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + scale.length) % scale.length;
    onChange(scale[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Calibrated rating" aria-disabled={disabled} className="grid gap-1 rounded-control border border-border bg-inlay p-1" style={{ gridTemplateColumns: `repeat(${scale.length}, minmax(0, 1fr))` }}>
      {scale.map((level, index) => {
        const checked = level.value === value;
        return (
          <button
            key={level.value}
            ref={(element) => { refs.current[index] = element; }}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(level.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              "min-w-0 rounded-nested px-1.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
              checked ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="block truncate text-sm font-medium">{level.label}</span>
            <span className={cn("block text-xs", checked ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {level.value === original ? "Manager" : " "}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function History({ subject, scale }: { subject: CalibrationSubjectDto; scale: RatingScaleLevelDto[] }) {
  if (subject.history.length === 0) return null;
  return (
    <section aria-labelledby="calibration-history-title" className="mt-6 border-t border-border pt-4">
      <h3 id="calibration-history-title" className="type-label text-foreground">Changes</h3>
      <ol className="mt-2 space-y-3">
        {[...subject.history].reverse().map((entry) => (
          <li key={entry.id} className="text-sm">
            <p className="text-foreground">{levelLabel(scale, entry.previousRating)} to {levelLabel(scale, entry.newRating)}</p>
            {entry.rationale ? <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{entry.rationale}</p> : null}
            <p className="mt-0.5 type-meta text-muted-foreground">{entry.actorDisplayName} · {formatDateTime(entry.at)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ReviewContext({ review, loading, scale }: { review: PerformanceReviewDto | undefined; loading: boolean; scale: RatingScaleLevelDto[] }) {
  if (loading) return <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">Loading the review…</p>;
  if (!review) return null;
  const objectives = review.items.filter((item) => item.kind === "Objective");
  const competencies = review.items.filter((item) => item.kind === "Competency");
  const evidence = review.items.reduce((total, item) => total + item.evidenceCount, 0);
  return (
    <div className="mt-6 space-y-5 border-t border-border pt-4">
      {review.managerAssessment ? (
        <section aria-labelledby="calibration-assessment-title">
          <h3 id="calibration-assessment-title" className="type-label text-foreground">Manager assessment</h3>
          <p className="mt-1.5 max-w-[70ch] whitespace-pre-wrap type-narrative text-foreground">{review.managerAssessment.summary || "No summary provided."}</p>
        </section>
      ) : null}
      {objectives.length ? (
        <section aria-labelledby="calibration-objectives-title">
          <h3 id="calibration-objectives-title" className="type-label text-foreground">Objective outcomes</h3>
          <ul className="mt-1.5 divide-y divide-border">
            {objectives.map((item) => (
              <li key={item.itemId} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-foreground" title={item.title}>{item.title}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{item.hasProgress ? `${Math.round(item.progress ?? 0)}%` : "No progress"}</span>
                {item.managerRating != null ? <span className="shrink-0 text-foreground">{levelLabel(scale, item.managerRating)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {competencies.length ? (
        <section aria-labelledby="calibration-competencies-title">
          <h3 id="calibration-competencies-title" className="type-label text-foreground">Competencies</h3>
          <ul className="mt-1.5 divide-y divide-border">
            {competencies.map((item) => (
              <li key={item.itemId} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
                <span className="shrink-0 text-muted-foreground">{levelLabel(scale, item.managerRating)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {evidence === 0 ? "No evidence attached." : `${evidence} evidence ${evidence === 1 ? "item" : "items"} across objectives.`}{" "}
        <Link href={reviewHref(review.id)} className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">Open the full review</Link>
      </p>
    </div>
  );
}
