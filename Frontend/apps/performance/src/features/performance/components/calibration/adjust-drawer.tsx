"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError, type CalibrationConflictDto, type CalibrationSubjectDetailDto, type ReviewPotential } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Checkbox } from "@repo/ds/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@repo/ds/components/ui/sheet";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { ObjectiveStatusBadge, PersonInitials } from "@repo/performance-ui";
import { ArrowRight, Check, RotateCcw } from "@/lib/icons";
import { reviewHref } from "@/lib/performance-routes";
import { useCalibrationSubject, type useCalibrationMutations } from "../../api/use-calibration";
import { dayLabel, LevelCards } from "../reviews/review-parts";
import { FlagChip, PersonFlags } from "./calibration-views";
import { leniencyText, POTENTIALS } from "./calibration-format";

type Mutations = ReturnType<typeof useCalibrationMutations>;

interface Draft { rating: number; potential: ReviewPotential | null; reason: string; discussed: boolean }

function draftOf(detail: CalibrationSubjectDetailDto): Draft {
  const person = detail.person;
  return { rating: person.currentRating, potential: person.currentPotential, reason: detail.rationale ?? "", discussed: person.discussed };
}

/** Board 06: one person's evidence and the change, with its reason, in a drawer over the view. */
export function AdjustDrawer({ roundId, reviewId, readOnly, potentialEnabled, mutations, onClose }: {
  roundId: string;
  reviewId: string | null;
  readOnly: boolean;
  potentialEnabled: boolean;
  mutations: Mutations;
  onClose: () => void;
}) {
  const detail = useCalibrationSubject(roundId, reviewId);
  return (
    <Sheet open={Boolean(reviewId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[44rem]">
        {!detail.data ? (
          <div className="space-y-3 p-7" role="status" aria-label="Loading">
            <SheetTitle className="sr-only">Loading</SheetTitle>
            <SheetDescription className="sr-only">Evidence and calibration</SheetDescription>
            {detail.error ? <p className="text-sm text-destructive" role="alert">{detail.error.message}</p> : (
              <><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 rounded-surface" /><Skeleton className="h-24 rounded-surface" /></>
            )}
          </div>
        ) : (
          <DrawerBody key={`${detail.data.person.reviewId}-${detail.data.person.version}`} detail={detail.data} readOnly={readOnly}
            potentialEnabled={potentialEnabled} mutations={mutations} onClose={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ detail, readOnly, potentialEnabled, mutations, onClose }: {
  detail: CalibrationSubjectDetailDto;
  readOnly: boolean;
  potentialEnabled: boolean;
  mutations: Mutations;
  onClose: () => void;
}) {
  const person = detail.person;
  const [draft, setDraft] = useState<Draft>(() => draftOf(detail));
  const [conflict, setConflict] = useState<CalibrationConflictDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setDraft(draftOf(detail)); }, [detail]);

  const first = person.name.split(" ")[0];
  const reviewerFirst = person.reviewerName.split(" ")[0];
  const ratingLabel = (value: number) => detail.scale.find((level) => level.value === value)?.label ?? String(value);
  const differs = draft.rating !== person.originalRating || (potentialEnabled && draft.potential !== person.originalPotential);
  const dirty = draft.rating !== person.currentRating || draft.potential !== person.currentPotential
    || draft.discussed !== person.discussed || (differs && draft.reason.trim() !== (detail.rationale ?? ""));
  const missingReason = differs && !draft.reason.trim();
  const restore = person.currentRating !== person.originalRating || person.currentPotential !== person.originalPotential;

  const save = async () => {
    setError(null);
    try {
      await mutations.adjust.mutateAsync({
        reviewId: person.reviewId,
        rating: draft.rating,
        rationale: differs ? draft.reason.trim() : null,
        discussionState: draft.discussed ? "Discussed" : "NotDiscussed",
        expectedVersion: person.version,
        ...(potentialEnabled && draft.potential ? { potential: draft.potential } : {}),
      });
      toast.success(`${first} saved.`);
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "Calibration.Conflict") {
        const extra = (failure.details as { extra?: CalibrationConflictDto } | null)?.extra ?? null;
        setConflict(extra);
        return;
      }
      setError(failure instanceof Error ? failure.message : "This change couldn't be saved.");
    }
  };

  const reviewer = detail.reviewer;
  const weighted = person.attainment === null ? null : Math.round(person.attainment);
  return (
    <>
      <div className="px-7 pt-6 pb-4 pr-14">
        <div className="flex items-center gap-4">
          <PersonInitials name={person.name} size="lg" />
          <SheetTitle className="min-w-0 flex-1 type-page-title text-foreground">{person.name}</SheetTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href={reviewHref(person.reviewId)}>Open review<ArrowRight className="size-3.5" aria-hidden /></Link>
          </Button>
        </div>
        <SheetDescription className="mt-2 type-meta text-muted-foreground">
          {[person.jobTitle, person.unit, `reviewed by ${person.reviewerName}`].filter(Boolean).join(" · ")}
        </SheetDescription>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-7 pb-6">
        {person.flags.length > 0 || reviewer?.lenient ? (
          <div className="flex flex-wrap gap-1.5">
            <PersonFlags flags={person.flags} />
            {reviewer?.lenient ? <FlagChip>{`${reviewerFirst} rates ${leniencyText(reviewer.delta)}`}</FlagChip> : null}
          </div>
        ) : null}

        {conflict ? (
          <div role="alert" className="rounded-surface bg-warning-subtle p-4">
            <p className="type-label text-foreground">
              {conflict.changedBy ?? "Someone"} changed {first} {conflict.changedAt ? dayLabel(conflict.changedAt.slice(0, 10)) : ""}
            </p>
            <p className="mt-1 type-body-secondary text-foreground">
              Now {conflict.current.currentRating} · {ratingLabel(conflict.current.currentRating)}
              {conflict.current.currentPotential ? ` · ${conflict.current.currentPotential}` : ""}
              {conflict.current.rationale ? ` — ${conflict.current.rationale}` : ""}
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => { setConflict(null); onClose(); }}>Close and reload</Button>
          </div>
        ) : null}

        <section aria-label="Objectives" className="overflow-hidden rounded-surface bg-card">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
            <p className="type-eyebrow text-muted-foreground">Objectives{weighted !== null ? ` · weighted ${weighted}%` : ""}</p>
            <p className="type-meta text-muted-foreground">
              {person.lastResult ? `${person.lastResult.cycleName} · ${person.lastResult.rating} ${ratingLabel(person.lastResult.rating)}` : "No earlier result"}
            </p>
          </div>
          {detail.objectives.length === 0 ? (
            <p className="px-4 py-4 type-body-secondary text-muted-foreground">No approved objectives this cycle</p>
          ) : (
            <ul className="divide-y divide-border">
              {detail.objectives.map((objective) => (
                <li key={objective.id} className="grid grid-cols-[minmax(0,1fr)_3rem_auto] items-center gap-3 px-4 py-3">
                  <p className="min-w-0 type-body text-foreground">
                    {objective.title}{objective.weight !== null ? <span className="text-muted-foreground"> · {Math.round(objective.weight)}%</span> : null}
                  </p>
                  <span className="text-right type-label tabular-nums text-foreground">{objective.progress === null ? "—" : `${Math.round(objective.progress)}%`}</span>
                  <ObjectiveStatusBadge status={objective.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {detail.managerSummary ? (
          <section aria-label={`${reviewerFirst}'s summary`}>
            <p className="type-label text-foreground">{reviewerFirst}&apos;s summary</p>
            <p className="mt-2 type-narrative text-foreground">{detail.managerSummary}</p>
          </section>
        ) : null}

        <section aria-label="Rating" className="border-t border-border pt-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="type-label text-foreground">Rating</p>
            <p className="type-meta text-muted-foreground">
              {reviewerFirst} rated <b className="text-foreground">{person.originalRating} · {ratingLabel(person.originalRating)}</b>
            </p>
          </div>
          <LevelCards levels={detail.scale} value={draft.rating} theirs={person.originalRating} label="Calibrated rating" disabled={readOnly}
            onChange={readOnly ? undefined : (rating) => setDraft({ ...draft, rating })} />
        </section>

        {potentialEnabled && person.originalPotential ? (
          <section aria-label="Potential" className="flex flex-wrap items-center justify-between gap-3">
            <p className="type-label text-foreground">Potential</p>
            <div role="radiogroup" aria-label="Potential" className="inline-flex gap-1 rounded-control bg-inlay p-1">
              {POTENTIALS.map((potential) => (
                <button key={potential} type="button" role="radio" aria-checked={draft.potential === potential} disabled={readOnly}
                  onClick={() => setDraft({ ...draft, potential })}
                  className={cn("rounded-nested px-3 py-1 type-meta font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    draft.potential === potential ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    person.originalPotential === potential && draft.potential !== potential && "ring-1 ring-inset ring-info")}>
                  {potential}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {differs || detail.rationale ? (
          <label className="block">
            <span className="type-label text-foreground">Why this changes{differs ? <span className="text-destructive"> *</span> : null}</span>
            <Textarea className="mt-2" rows={4} maxLength={2000} value={draft.reason} disabled={readOnly}
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
            <span className="mt-1.5 flex justify-between type-meta text-muted-foreground">
              <span>{reviewerFirst} and HR see this reason, never {first}</span>
              <span className="tabular-nums">{draft.reason.length} / 2,000</span>
            </span>
          </label>
        ) : null}

        {detail.history.length > 0 ? (
          <section aria-label="History">
            <p className="type-label text-foreground">History</p>
            <ul className="mt-2 space-y-2">
              {detail.history.map((item) => (
                <li key={item.id} className="type-meta text-muted-foreground">
                  <span className="text-foreground">{item.actorDisplayName}</span> · {dayLabel(item.at.slice(0, 10))} ·{" "}
                  {item.previousRating !== item.newRating ? `${item.previousRating} → ${item.newRating}` : null}
                  {item.previousPotential !== item.newPotential ? ` ${item.previousPotential ?? "—"} → ${item.newPotential ?? "—"}` : null}
                  {item.rationale ? <span className="block text-foreground">{item.rationale}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </div>

      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-7 py-4">
          <label className="flex items-center gap-2.5 type-body text-foreground">
            <Checkbox checked={draft.discussed} onCheckedChange={(value) => setDraft({ ...draft, discussed: value === true })} />Discussed
          </label>
          <span className="flex-1" />
          {restore ? (
            <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, rating: person.originalRating, potential: person.originalPotential, reason: "" })}>
              <RotateCcw className="size-3.5" aria-hidden />Back to {reviewerFirst}&apos;s
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} disabled={mutations.adjust.isLoading}>Cancel</Button>
          <AsyncButton pending={mutations.adjust.isLoading} disabled={!dirty || missingReason || Boolean(conflict)} onClick={save}>
            <Check className="size-4" aria-hidden />
            {draft.rating !== person.currentRating ? `Save ${person.currentRating} → ${draft.rating}` : "Save"}
          </AsyncButton>
        </div>
      )}
    </>
  );
}

