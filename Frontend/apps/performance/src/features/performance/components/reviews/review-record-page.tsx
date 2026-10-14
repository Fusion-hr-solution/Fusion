"use client";

import { useEffect, useRef, useState } from "react";
import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { PerformanceReviewDto, PerformanceReviewState, ReviewItemAssessmentDto, ReviewItemResponseInput } from "@repo/api";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageContainer, PagePermissionNotice, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { useReview, useReviewAssessmentMutations } from "../../api/use-reviews";
import { RecordCycleScope, useWorkspaceContext } from "../../api/use-workspace";
import { ContentUnavailable } from "../content-unavailable";
import { PerformancePageHeading } from "../performance-page-heading";
import { formatDate, formatDateRange, formatDateTime, measurementSummary as formatMeasurementSummary } from "../../lib";
import { objectiveHref, withCycle } from "@/lib/performance-routes";

type ItemDraft = { reflection: string; selfRating: number | null; selfComment: string; assessment: string; managerRating: number | null };
const itemKey = (kind: string, id: string) => `${kind}:${id}`;

export function ReviewRecordPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const context = useWorkspaceContext();
  const review = useReview(reviewId, Boolean(context.data));
  const mutations = useReviewAssessmentMutations(reviewId, review.data?.cycleId ?? "");
  const [selfSummary, setSelfSummary] = useState("");
  const [managerSummary, setManagerSummary] = useState("");
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const synced = useRef("");

  useEffect(() => {
    const value = review.data;
    if (!value) return;
    const key = [value.id, value.selfAssessment?.savedAt, value.selfAssessment?.summary,
      value.managerAssessment?.savedAt, value.managerAssessment?.summary,
      value.managerAssessment?.overallRating].join("|");
    if (synced.current === key) return;
    synced.current = key;
    setSelfSummary(value.selfAssessment?.summary ?? "");
    setManagerSummary(value.managerAssessment?.summary ?? "");
    setOverallRating(value.managerAssessment?.overallRating ?? null);
    setItemDrafts(Object.fromEntries(value.items.map((item) => [itemKey(item.kind, item.itemId), {
      reflection: item.selfReflection ?? "", selfRating: item.selfRating, selfComment: item.selfComment ?? "",
      assessment: item.managerAssessment ?? "", managerRating: item.managerRating,
    }])));
  }, [review.data]);

  if (context.isLoading || (context.data && review.isLoading)) return <PageSkeleton rows={7} width="wide" label="Loading review" />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (review.error) return <ContentUnavailable error={review.error} onRetry={review.refetch} subject="Review" />;
  if (!review.data) return <PagePermissionNotice title="Review unavailable" description="This review could not be found." />;

  const record = review.data;
  const draftFor = (item: ReviewItemAssessmentDto): ItemDraft => itemDrafts[itemKey(item.kind, item.itemId)] ?? {
    reflection: item.selfReflection ?? "", selfRating: item.selfRating, selfComment: item.selfComment ?? "",
    assessment: item.managerAssessment ?? "", managerRating: item.managerRating,
  };
  const updateItem = (item: ReviewItemAssessmentDto, update: Partial<ItemDraft>) => setItemDrafts((current) => ({
    ...current, [itemKey(item.kind, item.itemId)]: { ...draftFor(item), ...update },
  }));
  const selfItems = (): ReviewItemResponseInput[] => record.items.map((item) => {
    const draft = draftFor(item);
    return { kind: item.kind, itemId: item.itemId, reflection: draft.reflection.trim(), ...(item.kind === "Competency" || record.objectiveRatingsEnabled ? { rating: draft.selfRating, comment: draft.selfComment.trim() } : {}) };
  });
  const managerItems = (): ReviewItemResponseInput[] => record.items.map((item) => {
    const draft = draftFor(item);
    return { kind: item.kind, itemId: item.itemId, assessment: draft.assessment.trim(), ...(item.kind === "Competency" || record.objectiveRatingsEnabled ? { rating: draft.managerRating } : {}) };
  });
  const selfItemsComplete = record.items.every((item) => (item.kind !== "Competency" && !record.objectiveRatingsEnabled) || draftFor(item).selfRating !== null);
  const managerItemsComplete = record.items.every((item) => (item.kind !== "Competency" && !record.objectiveRatingsEnabled) || draftFor(item).managerRating !== null);
  const saveSelf = async () => {
    await mutations.saveSelf.mutateAsync({ summary: selfSummary.trim(), items: selfItems(), expectedVersion: record.version });
    toast.success("Draft saved.");
  };
  const submitSelf = async () => {
    await mutations.submitSelf.mutateAsync({ summary: selfSummary.trim(), items: selfItems(), expectedVersion: record.version });
  };
  const saveManager = async () => {
    await mutations.saveManager.mutateAsync({ summary: managerSummary.trim(), overallRating, items: managerItems(), expectedVersion: record.version });
    toast.success("Draft saved.");
  };
  const submitManager = async () => {
    await mutations.submitManager.mutateAsync({ summary: managerSummary.trim(), overallRating, items: managerItems(), expectedVersion: record.version });
  };

  return (
    <RecordCycleScope cycleId={record.cycleId}>
    <PageContainer width="wide">
      <PerformancePageHeading
        title={record.reviewRoundName}
        eyebrow="Performance review"
        description={`${record.subjectDisplayName} · ${formatDateRange(record.periodStart, record.periodEnd)}`}
        back={{ href: withCycle("/reviews", record.cycleId), label: "Reviews" }}
      />

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
        <article className="min-w-0" aria-label="Review document">
          {record.managerAssessment !== null ? (
            <AssessmentComparison
              record={record}
              selfSummary={selfSummary}
              managerSummary={managerSummary}
              overallRating={overallRating}
              setSelfSummary={setSelfSummary}
              setManagerSummary={setManagerSummary}
              setOverallRating={setOverallRating}
              onSaveSelf={saveSelf}
              onSubmitSelf={submitSelf}
              onSaveManager={saveManager}
              onSubmitManager={submitManager}
              selfPending={mutations.saveSelf.isLoading || mutations.submitSelf.isLoading}
              managerPending={mutations.saveManager.isLoading || mutations.submitManager.isLoading}
              error={mutations.saveSelf.error ?? mutations.submitSelf.error ?? mutations.saveManager.error ?? mutations.submitManager.error}
              selfItemsComplete={selfItemsComplete}
              managerItemsComplete={managerItemsComplete}
            />
          ) : (
            <SelfAssessmentDocument
              record={record}
              value={selfSummary}
              onChange={setSelfSummary}
              onSave={saveSelf}
              onSubmit={submitSelf}
              pending={mutations.saveSelf.isLoading || mutations.submitSelf.isLoading}
              error={mutations.saveSelf.error ?? mutations.submitSelf.error}
              itemsComplete={selfItemsComplete}
            />
          )}
          <ReviewItems record={record} draftFor={draftFor} updateItem={updateItem} />
        </article>

        <ReviewSidebar record={record} />
      </div>
    </PageContainer>
    </RecordCycleScope>
  );
}

function SelfAssessmentDocument({
  record, value, onChange, onSave, onSubmit, pending, error, itemsComplete,
}: {
  record: PerformanceReviewDto;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
  onSubmit: () => Promise<void>;
  pending: boolean;
  error: Error | null;
  itemsComplete: boolean;
}) {
  return (
    <section aria-labelledby="self-assessment-heading" className="max-w-3xl">
      <div className="border-b border-border pb-5">
        <p className="type-eyebrow text-muted-foreground">Your reflection</p>
        <h2 id="self-assessment-heading" className="mt-1 type-section-title text-foreground">Self-assessment</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Reflect on the work and outcomes from this review period.</p>
      </div>
      {record.canEditSelfAssessment ? (
        <AssessmentEditor
          id="self-summary"
          value={value}
          onChange={onChange}
          pending={pending}
          error={error}
          onSave={onSave}
          onSubmit={onSubmit}
          canSubmit={Boolean(value.trim()) && itemsComplete}
          submittedAt={record.selfAssessment?.submittedAt ?? null}
        />
      ) : record.selfAssessment?.submittedAt ? (
        <SummaryText value={record.selfAssessment.summary} submittedAt={record.selfAssessment.submittedAt} />
      ) : (
        <p className="py-6 text-sm text-muted-foreground">Your reviewer will see your reflection after you submit it.</p>
      )}
      {!record.canEditSelfAssessment && record.state === "ManagerAssessment" && record.managerAssessment === null ? (
        <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">Your reflection has been received. Your reviewer is preparing their assessment.</p>
      ) : null}
      {record.state === "Finalized" && record.managerAssessment ? (
        <section aria-labelledby="released-manager-heading" className="mt-8 border-t border-border pt-6">
          <p className="type-eyebrow text-muted-foreground">Released result</p>
          <h2 id="released-manager-heading" className="mt-1 type-section-title text-foreground">Reviewer assessment</h2>
          <SummaryText value={record.managerAssessment.summary} submittedAt={record.managerAssessment.submittedAt} />
          <p className="mt-5 text-sm text-muted-foreground">Final rating</p>
          <p className="mt-1 font-medium text-foreground">{ratingLabel(record, record.finalRating)}</p>
        </section>
      ) : null}
    </section>
  );
}

function AssessmentComparison({
  record, selfSummary, managerSummary, overallRating, setSelfSummary, setManagerSummary, setOverallRating,
  onSaveSelf, onSubmitSelf, onSaveManager, onSubmitManager, selfPending, managerPending, error, selfItemsComplete, managerItemsComplete,
}: {
  record: PerformanceReviewDto;
  selfSummary: string;
  managerSummary: string;
  overallRating: number | null;
  setSelfSummary: (value: string) => void;
  setManagerSummary: (value: string) => void;
  setOverallRating: (value: number | null) => void;
  onSaveSelf: () => Promise<void>;
  onSubmitSelf: () => Promise<void>;
  onSaveManager: () => Promise<void>;
  onSubmitManager: () => Promise<void>;
  selfPending: boolean;
  managerPending: boolean;
  error: Error | null;
  selfItemsComplete: boolean;
  managerItemsComplete: boolean;
}) {
  const editingSelf = record.canEditSelfAssessment;
  const editingManager = record.canEditManagerAssessment;
  return (
    <section aria-labelledby="assessment-heading" className="min-w-0">
      <div className="border-b border-border pb-5">
        <p className="type-eyebrow text-muted-foreground">Formal assessment</p>
        <h2 id="assessment-heading" className="mt-1 type-section-title text-foreground">Reflection and assessment</h2>
      </div>
      <div className="grid min-w-0 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="min-w-0 py-5 md:pr-6">
          <h3 className="type-label text-foreground">{editingSelf ? "Your reflection" : "Subject reflection"}</h3>
          {record.selfAssessment ? editingSelf ? (
            <AssessmentEditor
              id="self-summary"
              value={selfSummary}
              onChange={setSelfSummary}
              pending={selfPending}
              error={error}
              onSave={onSaveSelf}
              onSubmit={onSubmitSelf}
              canSubmit={Boolean(selfSummary.trim()) && selfItemsComplete}
              submittedAt={record.selfAssessment.submittedAt}
            />
          ) : <SummaryText value={record.selfAssessment.summary} submittedAt={record.selfAssessment.submittedAt} /> : (
            <p className="mt-3 text-sm text-muted-foreground">The subject’s reflection appears here after submission.</p>
          )}
        </div>
        <div className="min-w-0 py-5 md:pl-6">
          <h3 className="type-label text-foreground">{editingManager ? "Your assessment" : "Reviewer assessment"}</h3>
          {editingManager ? (
            <>
              <label htmlFor="manager-summary" className="mt-4 block text-sm font-medium text-foreground">Summary</label>
              <Textarea id="manager-summary" className="min-h-44" value={managerSummary} onChange={(event) => setManagerSummary(event.target.value)} rows={7} maxLength={4000} aria-describedby="manager-summary-count" />
              <div className="mt-1 flex justify-end"><span id="manager-summary-count" className="type-meta text-muted-foreground">{managerSummary.length}/4,000</span></div>
              <RatingScale record={record} value={overallRating} onChange={setOverallRating} />
              <AssessmentActions pending={managerPending} canSubmit={Boolean(managerSummary.trim()) && overallRating !== null && managerItemsComplete} onSave={onSaveManager} onSubmit={onSubmitManager} />
              <MutationError error={error} />
            </>
          ) : record.managerAssessment?.submittedAt ? (
            <>
              <SummaryText value={record.managerAssessment.summary} submittedAt={record.managerAssessment.submittedAt} />
              <p className="mt-5 text-sm text-muted-foreground">{record.finalRating !== null ? "Final rating" : "Overall rating"}</p>
              <p className="mt-1 font-medium text-foreground">{ratingLabel(record, record.finalRating ?? record.managerAssessment.overallRating)}</p>
              {record.finalRating !== null && record.finalRatingSource ? <p className="mt-1 text-sm text-muted-foreground">{record.finalRatingSource === "Calibration" ? "Set through calibration" : "Set by reviewer"}</p> : null}
            </>
          ) : record.managerAssessment ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">This assessment is still a draft.</p>
              <SummaryText value={record.managerAssessment.summary} submittedAt={null} />
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">The reviewer’s assessment is shared once the review is finalized.</p>
          )}
        </div>
      </div>
      {!record.selfAssessmentEnabled ? <p className="mt-4 text-sm text-muted-foreground">Self-assessment was not part of this review round.</p> : null}
    </section>
  );
}

function AssessmentEditor({
  id, value, onChange, pending, error, onSave, onSubmit, canSubmit, submittedAt,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  error: Error | null;
  onSave: () => Promise<void>;
  onSubmit: () => Promise<void>;
  canSubmit: boolean;
  submittedAt: string | null;
}) {
  return (
    <>
      {submittedAt ? <SummaryText value={value} submittedAt={submittedAt} /> : (
        <>
          <label htmlFor={id} className="mt-4 block text-sm font-medium text-foreground">Summary</label>
          <Textarea id={id} className="min-h-52" value={value} onChange={(event) => onChange(event.target.value)} rows={9} maxLength={4000} aria-describedby={`${id}-count`} />
          <div className="mt-1 flex justify-end"><span id={`${id}-count`} className="type-meta text-muted-foreground">{value.length}/4,000</span></div>
          <AssessmentActions pending={pending} canSubmit={canSubmit} onSave={onSave} onSubmit={onSubmit} />
          <MutationError error={error} />
        </>
      )}
    </>
  );
}

function AssessmentActions({ pending, canSubmit, onSave, onSubmit }: {
  pending: boolean; canSubmit: boolean; onSave: () => Promise<void>; onSubmit: () => Promise<void>;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <AsyncButton variant="outline" pending={pending} onClick={() => { void onSave().catch(() => undefined); }}>Save draft</AsyncButton>
      <AsyncButton pending={pending} disabled={!canSubmit} onClick={() => { void onSubmit().catch(() => undefined); }}>Submit</AsyncButton>
    </div>
  );
}

function RatingScale({ record, value, onChange }: {
  record: PerformanceReviewDto; value: number | null; onChange: (value: number | null) => void;
}) {
  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-medium text-foreground">Overall rating <span className="text-destructive" aria-hidden="true">*</span></legend>
      <p className="mt-1 text-sm text-muted-foreground">Choose one level from the review’s rating scale.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {record.ratingScale.map((level) => (
          <label key={level.value} className="group relative flex min-h-12 cursor-pointer items-start gap-3 rounded-control border border-border px-3 py-2.5 transition-colors hover:bg-muted/60 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            <input
              className="peer sr-only"
              type="radio"
              name="overall-rating"
              value={level.value}
              checked={value === level.value}
              onChange={() => onChange(level.value)}
            />
            <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-input bg-background after:size-2 after:rounded-full after:bg-primary after:content-[''] after:scale-0 peer-checked:after:scale-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{level.label}</span>
              {level.description ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{level.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ReviewSidebar({ record }: { record: PerformanceReviewDto }) {
  const steps = (["SelfAssessment", "ManagerAssessment", "Calibration", "ReadyToFinalize", "Finalized"] as const).filter((step) =>
    (step !== "SelfAssessment" || record.selfAssessmentEnabled) && (step !== "Calibration" || record.calibrationEnabled));
  const terminal = record.state === "Closed";
  const currentIndex = steps.indexOf(record.state as (typeof steps)[number]);
  return (
    <aside aria-label="Review details" className="min-w-0 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <section aria-labelledby="review-progress-heading">
        <h2 id="review-progress-heading" className="type-label text-foreground">Review progress</h2>
        <ol className="mt-3 space-y-3">
          {steps.map((step, index) => {
            const reached = !terminal && currentIndex >= 0 && index < currentIndex;
            const current = !terminal && step === record.state;
            return (
              <li key={step} className="flex items-start gap-3">
                <span aria-hidden className={current ? "mt-0.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" : reached ? "mt-1 size-2 shrink-0 rounded-full bg-success" : "mt-1 size-2 shrink-0 rounded-full bg-muted-foreground/35"} />
                <div className="min-w-0">
                  <p className={current ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}>{stageLabel(step)}</p>
                  {current && record.dueDate ? <p className="mt-0.5 text-xs text-muted-foreground">Due {formatDate(record.dueDate)}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
        {terminal ? <StatusBadge className="mt-4" tone="muted">Closed</StatusBadge> : null}
      </section>

      {record.calibration ? <CalibrationOutcome record={record} calibration={record.calibration} /> : null}

      <section aria-labelledby="review-people-heading" className="mt-7 border-t border-border pt-5">
        <h2 id="review-people-heading" className="type-label text-foreground">People</h2>
        <dl className="mt-3 space-y-4">
          <PersonDetail label="Subject" name={record.subjectDisplayName} />
          <PersonDetail label="Reviewer" name={record.reviewerDisplayName} />
        </dl>
      </section>

      <section aria-labelledby="review-period-heading" className="mt-7 border-t border-border pt-5">
        <h2 id="review-period-heading" className="type-label text-foreground">Review period</h2>
        <p className="mt-2 text-sm text-foreground">{formatDateRange(record.periodStart, record.periodEnd)}</p>
      </section>
    </aside>
  );
}

/** Why the rating changed in calibration: shown to the reviewer and administrators, never to the subject (server-enforced). */
function CalibrationOutcome({ record, calibration }: { record: PerformanceReviewDto; calibration: NonNullable<PerformanceReviewDto["calibration"]> }) {
  const changed = calibration.calibratedRating !== null;
  return (
    <section aria-labelledby="review-calibration-heading" className="mt-7 border-t border-border pt-5">
      <h2 id="review-calibration-heading" className="type-label text-foreground">Calibration</h2>
      {changed ? (
        <p className="mt-2 text-sm text-foreground">
          <span className="text-muted-foreground line-through decoration-muted-foreground/60">{ratingLabel(record, calibration.originalRating)}</span>
          <span className="ml-2 font-medium">{ratingLabel(record, calibration.calibratedRating)}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-foreground">{ratingLabel(record, calibration.originalRating)} <span className="text-muted-foreground">{calibration.sessionFinalized ? "kept" : "so far"}</span></p>
      )}
      {changed && calibration.rationale ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{calibration.rationale}</p> : null}
    </section>
  );
}

function PersonDetail({ label, name }: { label: string; name: string }) {
  return <div><dt className="type-meta text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-medium text-foreground">{name}</dd></div>;
}

function SummaryText({ value, submittedAt }: { value: string; submittedAt: string | null }) {
  return (
    <div className="mt-4 min-w-0">
      {value ? <p className="max-w-[72ch] whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{value}</p> : <p className="text-sm text-muted-foreground">No summary provided.</p>}
      {submittedAt ? <p className="mt-3 type-meta text-muted-foreground">Submitted {formatDateTime(submittedAt)}</p> : null}
    </div>
  );
}

function MutationError({ error }: { error: Error | null }) {
  return error ? <p className="mt-3 text-sm text-destructive" role="alert">{error.message || "Your assessment could not be saved. Try again."}</p> : null;
}

function stageLabel(state: Exclude<PerformanceReviewState, "Closed">) {
  switch (state) {
    case "SelfAssessment": return "Self-assessment";
    case "ManagerAssessment": return "Reviewer assessment";
    case "ReadyToFinalize": return "Ready to finalize";
    default: return state;
  }
}

function ratingLabel(record: PerformanceReviewDto, rating: number | null) {
  if (rating === null) return "No rating";
  return record.ratingScale.find((level) => level.value === rating)?.label ?? `Level ${rating}`;
}

function ReviewItems({ record, draftFor, updateItem }: {
  record: PerformanceReviewDto;
  draftFor: (item: ReviewItemAssessmentDto) => ItemDraft;
  updateItem: (item: ReviewItemAssessmentDto, update: Partial<ItemDraft>) => void;
}) {
  if (record.items.length === 0) return null;
  const editingSelf = record.canEditSelfAssessment;
  const editingManager = record.canEditManagerAssessment;
  const selfIncomplete = record.items.some((item) => (item.kind === "Competency" || record.objectiveRatingsEnabled) && draftFor(item).selfRating === null);
  const managerIncomplete = record.items.some((item) => (item.kind === "Competency" || record.objectiveRatingsEnabled) && draftFor(item).managerRating === null);
  return (
    <section className="mt-8 border-t border-border pt-6" aria-labelledby="review-items-heading">
      <p className="type-eyebrow text-muted-foreground">Review record</p>
      <h2 id="review-items-heading" className="mt-1 type-section-title text-foreground">Objectives and competencies</h2>
      <p className="mt-2 text-sm text-muted-foreground">Item ratings and reflections are saved with this review.</p>
      {record.items.map((item) => {
        const draft = draftFor(item);
        const ratingRequired = item.kind === "Competency" || record.objectiveRatingsEnabled;
        return (
          <article key={itemKey(item.kind, item.itemId)} className="mt-6 rounded-card border border-border p-4 sm:p-5">
            <div className="border-b border-border pb-4">
              <p className="type-meta text-muted-foreground">{item.kind}</p>
              <h3 className="mt-1 type-label text-foreground">{item.kind === "Objective" ? <Link className="underline decoration-border underline-offset-4 hover:decoration-foreground" href={objectiveHref({ cycleId: record.cycleId, objectiveId: item.itemId })}>{item.title}</Link> : item.title}</h3>
              {item.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
              {item.behaviors.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{item.behaviors.map((behavior) => <li key={behavior}>{behavior}</li>)}</ul> : null}
              {item.measurement ? <p className="mt-3 text-sm text-foreground"><span className="font-medium">Measure:</span> {formatMeasurementSummary(item.measurement)}</p> : item.legacyMeasurementSummary ? <p className="mt-3 text-sm text-foreground"><span className="font-medium">Measure:</span> {item.legacyMeasurementSummary}</p> : null}
              {item.hasProgress ? <p className="mt-3 text-sm text-foreground">Progress: {item.progress ?? 0}%</p> : null}
              {item.evidenceCount > 0 ? <div className="mt-3"><p className="text-sm font-medium text-foreground">Evidence · {item.evidenceCount}</p><ul className="mt-1 space-y-1 text-sm text-muted-foreground">{item.evidenceSummary.map((evidence, index) => <li key={evidence.evidenceId ?? `${index}-${evidence.label}`}>{evidence.label}{evidence.kind ? ` · ${evidence.kind}` : ""}{evidence.recordedAt ? ` · ${formatDate(evidence.recordedAt)}` : ""}</li>)}{item.evidenceCount > item.evidenceSummary.length ? <li>Showing {item.evidenceSummary.length} of {item.evidenceCount} evidence items</li> : null}</ul></div> : null}
            </div>
            <div className="grid min-w-0 gap-5 pt-4 md:grid-cols-2">
              <div className="min-w-0">
                <h4 className="type-label text-foreground">{editingSelf ? "Your reflection" : "Self-assessment"}</h4>
                {editingSelf ? <>
                  {item.kind === "Objective" ? <label className="mt-3 block text-sm font-medium text-foreground" htmlFor={`self-reflection-${item.itemId}`}>Reflection</label> : null}
                  <Textarea id={`self-reflection-${item.itemId}`} className="mt-2 min-h-24" aria-label={`${item.title} self reflection`} value={draft.reflection} maxLength={2000} onChange={(event) => updateItem(item, { reflection: event.target.value })} rows={3} />
                  {ratingRequired ? <ItemRating record={record} item={item} side="self" value={draft.selfRating} onChange={(value) => updateItem(item, { selfRating: value })} /> : null}
                  {item.kind === "Competency" ? <Textarea className="mt-3 min-h-20" aria-label={`${item.title} self comment`} placeholder="Optional comment" value={draft.selfComment} maxLength={2000} onChange={(event) => updateItem(item, { selfComment: event.target.value })} rows={2} /> : null}
                </> : <>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.selfReflection || "No reflection provided."}</p>
                  {ratingRequired ? <p className="mt-2 text-sm text-muted-foreground">Self rating: {ratingLabel(record, item.selfRating)}</p> : null}
                  {item.selfComment ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.selfComment}</p> : null}
                </>}
              </div>
              <div className="min-w-0 border-t border-border pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                <h4 className="type-label text-foreground">{editingManager ? "Your assessment" : "Reviewer assessment"}</h4>
                {editingManager ? <>
                  <Textarea className="mt-3 min-h-24" aria-label={`${item.title} reviewer assessment`} placeholder="Assessment" value={draft.assessment} maxLength={2000} onChange={(event) => updateItem(item, { assessment: event.target.value })} rows={3} />
                  {ratingRequired ? <ItemRating record={record} item={item} side="manager" value={draft.managerRating} onChange={(value) => updateItem(item, { managerRating: value })} /> : null}
                </> : item.managerAssessment ? <>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.managerAssessment}</p>
                  {ratingRequired ? <p className="mt-2 text-sm text-muted-foreground">Reviewer rating: {ratingLabel(record, item.managerRating)}</p> : null}
                </> : <p className="mt-2 text-sm text-muted-foreground">Reviewer assessment is shared when the review is finalized.</p>}
              </div>
            </div>
          </article>
        );
      })}
      {editingSelf && selfIncomplete ? <p className="mt-4 text-sm text-muted-foreground" role="status">Choose a rating for each competency{record.objectiveRatingsEnabled ? " and objective" : ""} before submitting.</p> : null}
      {editingManager && managerIncomplete ? <p className="mt-4 text-sm text-muted-foreground" role="status">Choose a reviewer rating for each competency{record.objectiveRatingsEnabled ? " and objective" : ""} before submitting.</p> : null}
    </section>
  );
}

function ItemRating({ record, item, side, value, onChange }: {
  record: PerformanceReviewDto; item: ReviewItemAssessmentDto; side: "self" | "manager"; value: number | null; onChange: (value: number) => void;
}) {
  return <fieldset className="mt-4"><legend className="text-sm font-medium text-foreground">{side === "self" ? "Your rating" : "Reviewer rating"}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{record.ratingScale.map((level) => {
    const name = `${side}-${item.kind}-${item.itemId}-rating`;
    return <label key={level.value} className="group relative flex min-h-10 cursor-pointer items-start gap-2 rounded-control border border-border px-2.5 py-2 transition-colors hover:bg-muted/60 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"><input className="peer sr-only" type="radio" name={name} value={level.value} checked={value === level.value} onChange={() => onChange(level.value)} /><span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-input bg-background after:size-2 after:rounded-full after:bg-primary after:content-[''] after:scale-0 peer-checked:after:scale-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring"/><span className="text-sm text-foreground">{level.label}</span></label>;
  })}</div></fieldset>;
}
