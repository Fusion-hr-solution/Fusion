"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type {
  PerformanceReviewDto,
  RatingScaleLevelDto,
  ReviewAnswerInput,
  ReviewItemAssessmentDto,
  ReviewItemResponseInput,
  ReviewMissingDto,
  ReviewPotential,
} from "@repo/api";
import { ApiError, REVIEW_POTENTIALS } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ds/components/ui/popover";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton, PageContainer, PagePermissionNotice, PageSkeleton, StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { AvatarStack, ObjectiveStatusBadge, PersonInitials, ValueChip } from "@repo/performance-ui";
import { Ban, CalendarDays, Check, ChevronDown, Download, FeedbackIcon, FileText, Lock, OneOnOnes, Send, Star, Target, UserRoundCheck } from "@/lib/icons";
import { useReview, useReviewAssessmentMutations } from "../../api/use-reviews";
import { useAcknowledge, useDownloadReviewPdf, usePeerCommands, useScheduleCommands } from "../../api/use-review-work";
import { RecordCycleScope, useWorkspaceContext } from "../../api/use-workspace";
import { ContentUnavailable } from "../content-unavailable";
import { PerformancePageHeading } from "../performance-page-heading";
import { measurementSummary } from "../../lib";
import { CalibratedOutcome } from "./calibrated-outcome";
import { ReviewDraftBlock } from "./review-draft";
import { ColleaguePicker } from "../conversations/colleague-picker";
import { objectiveHref, roundHref, withCycle } from "@/lib/performance-routes";
import { DueChip, LevelCards, POTENTIAL_COPY, ProgressRing, SectionHeading, SegmentRating, StageTrack, dayLabel, dueIn, type Step } from "./review-parts";
import { useRecentRecord } from "@repo/api/react";

/**
 * One review as a page (D12): the person writing (board 08), what they sent (09), their released result (13); the reviewer
 * beside the person's words and the evidence (12); HR's operational view (14). What each lens may see comes from the server.
 */
export function ReviewRecordPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const context = useWorkspaceContext();
  const review = useReview(reviewId, Boolean(context.data));
  useRecentRecord(
    "performance",
    review.data
      ? {
          label: `${review.data.subjectDisplayName}'s review`,
          kind: review.data.reviewRoundName,
          href: `/performance/reviews/${review.data.id}`,
        }
      : null,
  );
  if (context.isLoading || (context.data && review.isLoading)) return <PageSkeleton rows={7} width="wide" label="Loading review" />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (review.error) return <ContentUnavailable error={review.error} onRetry={review.refetch} subject="Review" />;
  if (!review.data) return <PagePermissionNotice title="Review unavailable" description="This review could not be found." />;
  const record = review.data;
  return (
    <RecordCycleScope cycleId={record.cycleId}>
      <PageContainer width="wide">
        {record.lens === "Subject" ? <SubjectView record={record} />
          : record.lens === "Reviewer" ? <ReviewerView record={record} />
          : record.lens === "Administrator" ? <AdministratorView record={record} />
          : <ReviewerView record={record} />}
      </PageContainer>
    </RecordCycleScope>
  );
}

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const levelLabel = (levels: RatingScaleLevelDto[], value: number | null | undefined) => levels.find((l) => l.value === value)?.label ?? null;
const ratingRequired = (record: PerformanceReviewDto, item: ReviewItemAssessmentDto) => item.kind === "Competency" || record.objectiveRatingsEnabled;

function reviewSteps(record: PerformanceReviewDto, perspective: "subject" | "reviewer"): Step[] {
  const order = ["SelfAssessment", "ManagerAssessment", "Calibration", "ReadyToFinalize", "Finalized"];
  const at = order.indexOf(record.state);
  const late = (record.schedule?.daysLate ?? 0) > 0;
  const state = (index: number): Step["state"] => (record.state === "Closed" ? "todo" : index < at ? "done" : index === at ? (late ? "late" : "current") : "todo");
  const reviewer = first(record.reviewerDisplayName);
  const subject = first(record.subjectDisplayName);
  const steps: Step[] = [];
  if (record.selfAssessmentEnabled)
    steps.push({
      label: perspective === "subject" ? "Your self-assessment" : `${subject}'s self-assessment`,
      detail: record.selfAssessment?.submittedAt ? dayLabel(record.selfAssessment.submittedAt.slice(0, 10)) : `Due ${dayLabel(record.schedule?.selfAssessmentDue)}`,
      state: state(0),
    });
  steps.push({
    label: perspective === "subject" ? `${reviewer}'s assessment` : "Your review",
    detail: record.managerAssessment?.submittedAt && perspective === "reviewer" ? dayLabel(record.managerAssessment.submittedAt.slice(0, 10)) : `Due ${dayLabel(record.schedule?.managerAssessmentDue)}`,
    state: state(1),
  });
  if (record.calibrationEnabled) steps.push({ label: "Calibration", detail: "HR", state: record.state === "Calibration" ? "current" : state(2) });
  steps.push({ label: perspective === "subject" ? "Your result" : "Released", detail: record.finalizedAt ? dayLabel(record.finalizedAt.slice(0, 10)) : "Released by HR", state: record.state === "Finalized" ? "done" : "todo" });
  return steps;
}

function YearChips({ record }: { record: PerformanceReviewDto }) {
  const year = record.year;
  if (!year) return null;
  const chips: { icon: ReactNode; text: string }[] = [
    { icon: <FeedbackIcon className="size-3.5" aria-hidden />, text: `${year.feedback} feedback` },
    { icon: <Star className="size-3.5" aria-hidden />, text: `${year.praise} praise` },
    { icon: <OneOnOnes className="size-3.5" aria-hidden />, text: `${year.oneOnOnesHeld} 1:1s${year.actionsDone ? ` · ${year.actionsDone} actions done` : ""}` },
    ...(year.developmentGoals ? [{ icon: <UserRoundCheck className="size-3.5" aria-hidden />, text: `${year.developmentGoals} development goals` }] : []),
    ...(year.lastResult ? [{ icon: <FileText className="size-3.5" aria-hidden />, text: `${year.lastResult.roundName} · ${year.lastResult.label ?? "released"}` }] : []),
  ];
  return (
    <ul className="flex flex-wrap justify-end gap-2" aria-label={`${first(record.subjectDisplayName)}'s year`}>
      {chips.map((chip) => (
        <li key={chip.text}>
          <Link href={`/people/${record.subjectEmployeeId}`} className="inline-flex items-center gap-1.5 rounded-control bg-inlay px-2.5 py-1 type-meta font-medium text-foreground hover:bg-card">
            {chip.icon}{chip.text}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── The person (boards 08, 09, 13) ─────────────────────────────────────────────────

function SubjectView({ record }: { record: PerformanceReviewDto }) {
  if (record.state === "Finalized") return <ReleasedView record={record} />;
  if (record.state === "Closed") return (
    <div className="mx-auto max-w-3xl">
      <SubjectHeading record={record} />
      <p className="type-body-secondary text-muted-foreground">This review was closed without a result.</p>
    </div>
  );
  if (record.canEditSelfAssessment) return <SelfAssessmentWriter record={record} />;
  return <SubmittedView record={record} />;
}

function SubjectHeading({ record, actions, detail }: { record: PerformanceReviewDto; actions?: ReactNode; detail?: string }) {
  return (
    <PerformancePageHeading
      back={{ href: "/reviews", label: "Reviews" }}
      leading={<PersonInitials name={record.subjectDisplayName} size="xl" />}
      title={`Your ${record.reviewRoundName.toLowerCase()}`}
      description={detail ?? `${record.periodStart.slice(0, 4)}–${record.periodEnd.slice(0, 4)} · ${record.reviewerDisplayName} reviews you`}
      actions={actions}
    />
  );
}

type ItemDraft = { reflection: string; selfRating: number | null; selfComment: string; assessment: string; managerRating: number | null };
const keyOf = (item: ReviewItemAssessmentDto) => `${item.kind}:${item.itemId}`;

/** Drafts for one side, autosaved a moment after the last change. The latest version follows each save. */
function useDraft(record: PerformanceReviewDto, side: "self" | "manager") {
  const mutations = useReviewAssessmentMutations(record.id, record.cycleId);
  const own = side === "self" ? record.selfAssessment : record.managerAssessment;
  const [summary, setSummary] = useState(own?.summary ?? "");
  const [overall, setOverall] = useState<number | null>(own?.overallRating ?? null);
  const [potential, setPotential] = useState<ReviewPotential | null>(record.potential);
  const [items, setItems] = useState<Record<string, ItemDraft>>(() => Object.fromEntries(record.items.map((item) => [keyOf(item), {
    reflection: item.selfReflection ?? "", selfRating: item.selfRating, selfComment: item.selfComment ?? "",
    assessment: item.managerAssessment ?? "", managerRating: item.managerRating,
  }])));
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(record.questions
    .filter((q) => q.audience === (side === "self" ? "Person" : "Manager"))
    .map((q) => [q.questionId, (side === "self" ? q.selfAnswer : q.managerAnswer) ?? ""])));
  const [savedAt, setSavedAt] = useState<Date | null>(own?.savedAt ? new Date(own.savedAt) : null);
  const [missing, setMissing] = useState<ReviewMissingDto | null>(null);
  const version = useRef(record.version);
  const dirty = useRef(false);
  if (record.version > version.current) version.current = record.version;

  const payload = () => {
    const itemInputs: ReviewItemResponseInput[] = record.items.map((item) => {
      const draft = items[keyOf(item)]!;
      return side === "self"
        ? { kind: item.kind, itemId: item.itemId, reflection: draft.reflection.trim() || null, rating: draft.selfRating, comment: draft.selfComment.trim() || null }
        : { kind: item.kind, itemId: item.itemId, assessment: draft.assessment.trim() || null, rating: draft.managerRating };
    });
    const answerInputs: ReviewAnswerInput[] = Object.entries(answers).map(([questionId, text]) => ({ questionId, text: text.trim() || null }));
    return { summary: summary.trim(), overallRating: overall, items: itemInputs, answers: answerInputs };
  };

  const save = async () => {
    // The server needs a summary on every save; an empty draft waits until one is written.
    if (!summary.trim()) return;
    const body = { ...payload(), expectedVersion: version.current };
    const result = side === "self"
      ? await mutations.saveSelf.mutateAsync(body)
      : await mutations.saveManager.mutateAsync({ ...body, potential: record.potentialEnabled ? potential : null });
    version.current = result.version;
    setSavedAt(new Date());
  };

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => { dirty.current = false; void save().catch(() => undefined); }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autosave follows the drafts only
  }, [summary, overall, potential, items, answers]);

  const touch = <T,>(setter: (value: T) => void) => (value: T) => { dirty.current = true; setMissing(null); setter(value); };

  const submit = async () => {
    try {
      const body = { ...payload(), expectedVersion: version.current };
      const result = side === "self"
        ? await mutations.submitSelf.mutateAsync(body)
        : await mutations.submitManager.mutateAsync({ ...body, potential: record.potentialEnabled ? potential : null });
      version.current = result.version;
      toast.success(side === "self" ? `Sent to ${first(record.reviewerDisplayName)}.` : "Your review is submitted.");
    } catch (error) {
      if (error instanceof ApiError && error.details && typeof error.details === "object" && "extra" in error.details) {
        setMissing((error.details as { extra: ReviewMissingDto }).extra);
      }
      toast.error(error instanceof Error ? error.message : "This couldn't be submitted.");
    }
  };

  const updateItem = (item: ReviewItemAssessmentDto, patch: Partial<ItemDraft>) => touch(setItems)({ ...items, [keyOf(item)]: { ...items[keyOf(item)]!, ...patch } });
  return {
    summary, setSummary: touch(setSummary), overall, setOverall: touch(setOverall), potential, setPotential: touch(setPotential),
    items, updateItem, answers, setAnswer: (id: string, text: string) => touch(setAnswers)({ ...answers, [id]: text }),
    savedAt, missing, submit, pending: side === "self" ? mutations.submitSelf.isLoading : mutations.submitManager.isLoading,
    saving: side === "self" ? mutations.saveSelf.isLoading : mutations.saveManager.isLoading,
  };
}

function savedLabel(savedAt: Date | null, saving: boolean) {
  if (saving) return "saving…";
  if (!savedAt) return null;
  const minutes = Math.round((Date.now() - savedAt.getTime()) / 60_000);
  return minutes < 1 ? "saved just now" : `saved ${minutes} min ago`;
}

function SelfAssessmentWriter({ record }: { record: PerformanceReviewDto }) {
  const draft = useDraft(record, "self");
  const objectives = record.items.filter((i) => i.kind === "Objective");
  const competencies = record.items.filter((i) => i.kind === "Competency");
  const questions = record.questions.filter((q) => q.audience === "Person");
  const missingItems = draft.missing?.items.map((m) => `${m.kind}:${m.itemId}`) ?? [];
  const left = [
    ...objectives.filter((i) => ratingRequired(record, i) && draft.items[keyOf(i)]?.selfRating === null).map(() => "objective"),
    ...competencies.filter((i) => draft.items[keyOf(i)]?.selfRating === null).map(() => "competency"),
  ];
  const unanswered = questions.filter((q) => !draft.answers[q.questionId]?.trim()).length;
  const parts = [
    left.length ? `${left.length} ${left.length === 1 ? "rating" : "ratings"}` : null,
    unanswered ? `${unanswered} ${unanswered === 1 ? "question" : "questions"}` : null,
    draft.overall === null ? "overall" : null,
    !draft.summary.trim() ? "summary" : null,
  ].filter(Boolean) as string[];
  const total = objectives.filter((i) => ratingRequired(record, i)).length + competencies.length + questions.length + 2;
  const done = total - left.length - unanswered - (draft.overall === null ? 1 : 0) - (!draft.summary.trim() ? 1 : 0);
  const late = (record.schedule?.daysLate ?? 0) > 0;

  return (
    <div className="max-w-4xl pb-24">
      <SubjectHeading record={record} detail={`${record.periodStart.slice(0, 4)}–${record.periodEnd.slice(0, 4)} · ${record.reviewerDisplayName} reviews you${savedLabel(draft.savedAt, draft.saving) ? ` · ${savedLabel(draft.savedAt, draft.saving)}` : ""}`} />

      <section aria-label="Where your review stands" className="rounded-surface bg-card p-5">
        <StageTrack label="Your review's stages" steps={reviewSteps(record, "subject").map((s, i) => i === 1 ? { ...s, detail: "Sees yours once you submit" } : s)} />
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <PeersAsked record={record} />
          <div className="ms-auto"><YearChips record={record} /></div>
        </div>
      </section>

      {objectives.length ? (
        <section className="mt-10" aria-labelledby="objectives-heading">
          <SectionHeading id="objectives-heading" title="Objectives" count={objectives.length} aside="Progress and evidence from your plan" />
          <div className="space-y-4">
            {objectives.map((item) => (
              <ObjectiveCard key={item.itemId} record={record} item={item}>
                <div className="mt-4 border-t border-border pt-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="type-label text-foreground">How it went</span>
                    {record.objectiveRatingsEnabled ? (
                      <span className="flex items-center gap-2">
                        <span className="type-meta text-muted-foreground">Your rating</span>
                        <SegmentRating label={`Your rating for ${item.title}`} levels={record.ratingScale} value={draft.items[keyOf(item)]!.selfRating}
                          onChange={(value) => draft.updateItem(item, { selfRating: value })} />
                        <span className="w-36 type-meta text-muted-foreground">{levelLabel(record.ratingScale, draft.items[keyOf(item)]!.selfRating)}</span>
                      </span>
                    ) : null}
                  </div>
                  <Textarea aria-label={`How ${item.title} went`} className="min-h-24 type-narrative" maxLength={4000}
                    aria-invalid={missingItems.includes(keyOf(item)) || undefined}
                    value={draft.items[keyOf(item)]!.reflection} onChange={(e) => draft.updateItem(item, { reflection: e.target.value })} />
                </div>
              </ObjectiveCard>
            ))}
          </div>
        </section>
      ) : null}

      {competencies.length ? (
        <section className="mt-10" aria-labelledby="competencies-heading">
          <SectionHeading id="competencies-heading" title="Competencies"
            count={`${competencies.filter((c) => draft.items[keyOf(c)]?.selfRating !== null).length} of ${competencies.length}`} />
          <ul className="divide-y divide-border rounded-surface bg-card">
            {competencies.map((item) => (
              <li key={item.itemId} className={cn("grid items-center gap-3 px-5 py-3 md:grid-cols-[14rem_auto_minmax(0,1fr)]", missingItems.includes(keyOf(item)) && "bg-destructive/5")}>
                <ValueChip value={{ id: item.itemId, name: item.title }} />
                <SegmentRating label={`Your rating for ${item.title}`} levels={record.ratingScale} value={draft.items[keyOf(item)]!.selfRating}
                  onChange={(value) => draft.updateItem(item, { selfRating: value })} />
                <Input aria-label={`Comment on ${item.title}`} className="border-transparent bg-transparent" placeholder="Add a comment" maxLength={2000}
                  value={draft.items[keyOf(item)]!.selfComment} onChange={(e) => draft.updateItem(item, { selfComment: e.target.value })} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {questions.length ? (
        <section className="mt-10" aria-labelledby="questions-heading">
          <SectionHeading id="questions-heading" title="Questions" count={`${questions.length - unanswered} of ${questions.length}`} />
          <ul className="divide-y divide-border rounded-surface bg-card">
            {questions.map((question) => (
              <li key={question.questionId} className="p-5">
                <label htmlFor={`q-${question.questionId}`} className="type-label text-foreground">{question.text}</label>
                <Textarea id={`q-${question.questionId}`} className="mt-2 min-h-20 type-narrative" placeholder="Write your answer" maxLength={4000}
                  aria-invalid={draft.missing?.questions.includes(question.questionId) || undefined}
                  value={draft.answers[question.questionId] ?? ""} onChange={(e) => draft.setAnswer(question.questionId, e.target.value)} />
                {draft.missing?.questions.includes(question.questionId) ? <p className="mt-1.5 type-meta text-destructive">Answer this before submitting.</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="overall-heading">
        <SectionHeading id="overall-heading" title="Your overall view" />
        <div className="space-y-3 rounded-surface bg-card p-5">
          <ReviewDraftBlock reviewId={record.id} lens="self" subject={first(record.subjectDisplayName)} value={draft.summary} onInsert={draft.setSummary} />
          <LevelCards label="Your overall rating" levels={record.ratingScale} value={draft.overall} onChange={draft.setOverall} />
          <Textarea aria-label="Your summary" className="min-h-24 type-narrative" placeholder="Sum up your year in a few sentences" maxLength={4000}
            aria-invalid={draft.missing?.summary || undefined} value={draft.summary} onChange={(e) => draft.setSummary(e.target.value)} />
        </div>
      </section>

      <div className="sticky bottom-4 mt-10 flex flex-wrap items-center gap-4 rounded-surface bg-popover px-5 py-3.5 shadow-overlay">
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: Math.min(total, 12) }, (_, i) => <span key={i} className={cn("h-1.5 w-6 rounded-full", i < Math.round((done / total) * Math.min(total, 12)) ? "bg-success" : "bg-inlay")} />)}
        </span>
        <span className="flex-1 type-meta text-muted-foreground">
          {parts.length ? <><strong className="font-semibold text-foreground">{parts.length} {parts.length === 1 ? "part" : "parts"} left</strong> · {parts.join(", ")}</> : <strong className="font-semibold text-foreground">Ready to submit</strong>}
          {savedLabel(draft.savedAt, draft.saving) ? ` · ${savedLabel(draft.savedAt, draft.saving)}` : ""}
        </span>
        {record.schedule?.selfAssessmentDue ? <DueChip date={record.schedule.selfAssessmentDue} late={late} label={late ? dueIn(record.schedule.selfAssessmentDue) : `Due ${dayLabel(record.schedule.selfAssessmentDue)}`} /> : null}
        <AsyncButton pending={draft.pending} onClick={() => void draft.submit()}><Send className="size-4" aria-hidden />Submit self-assessment</AsyncButton>
      </div>
    </div>
  );
}

/** Who gives peer input: chosen while self-assessing, then the reviewer approves. The person never sees answers. */
function PeersAsked({ record }: { record: PerformanceReviewDto }) {
  const peers = record.peers;
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState<{ employeeId: string; displayName: string }[]>(() => peers?.people.map((p) => ({ employeeId: p.employeeId, displayName: p.displayName })) ?? []);
  const { nominate } = usePeerCommands(record.id);
  if (!record.peerInputEnabled || !peers) return null;
  const names = peers.people.map((p) => p.displayName);
  const reviewer = first(record.reviewerDisplayName);
  if (choosing) {
    return (
      <div className="w-full space-y-2">
        <p className="type-label text-foreground">Who should give peer input? <span className="type-meta text-muted-foreground">1 to 5 colleagues, {reviewer} approves</span></p>
        <ul className="flex flex-wrap gap-2">
          {picked.map((person) => (
            <li key={person.employeeId} className="inline-flex items-center gap-1.5 rounded-control bg-inlay py-1 pe-1 ps-2 type-meta text-foreground">
              {person.displayName}
              <Button size="icon" variant="ghost" className="size-6" aria-label={`Remove ${person.displayName}`}
                onClick={() => setPicked(picked.filter((p) => p.employeeId !== person.employeeId))}>×</Button>
            </li>
          ))}
        </ul>
        {picked.length < 5 ? <ColleaguePicker value={null} exclude={[...picked.map((p) => p.employeeId), record.subjectEmployeeId, record.reviewerEmployeeId]}
          onChange={(person) => setPicked([...picked, { employeeId: person.employeeId, displayName: person.displayName }])} /> : null}
        <div className="flex gap-2">
          <AsyncButton size="sm" pending={nominate.isLoading} disabled={picked.length === 0}
            onClick={() => void nominate.mutateAsync({ ids: picked.map((p) => p.employeeId), version: record.version })
              .then(() => { setChoosing(false); toast.success(`${reviewer} will review your list.`); })
              .catch((error) => toast.error(error instanceof Error ? error.message : "The list couldn't be saved."))}>
            Send to {reviewer}
          </AsyncButton>
          <Button size="sm" variant="ghost" onClick={() => setChoosing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 type-meta text-muted-foreground">
      {names.length ? <AvatarStack names={names} size="xs" /> : null}
      {names.length
        ? `${names.length === 1 ? names[0] : `${names.slice(0, -1).map(first).join(", ")} and ${first(names[names.length - 1]!)}`} ${peers.approved ? "were asked" : "await approval"} · their answers go to ${reviewer}`
        : "No colleagues chosen for peer input yet"}
      {record.canNominatePeers ? <Button size="sm" variant="outline" onClick={() => setChoosing(true)}>{names.length ? "Change" : "Choose colleagues"}</Button> : null}
    </span>
  );
}

function ObjectiveCard({ record, item, children }: { record: PerformanceReviewDto; item: ReviewItemAssessmentDto; children?: ReactNode }) {
  const quote = item.feedback?.[0];
  return (
    <article className="rounded-surface bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <Link href={objectiveHref({ cycleId: record.cycleId, objectiveId: item.itemId })} className="type-subsection-title text-foreground hover:underline">{item.title}</Link>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 type-meta text-muted-foreground">
            {item.status ? <ObjectiveStatusBadge status={item.status} /> : null}
            {item.measurement ? <span>{measurementSummary(item.measurement)}</span> : item.legacyMeasurementSummary ? <span>{item.legacyMeasurementSummary}</span> : null}
            {item.evidenceSummary.slice(0, 2).map((evidence, i) => <span key={i} className="inline-flex items-center gap-1 rounded-control bg-inlay px-2 py-0.5 text-foreground"><FileText className="size-3.5" aria-hidden />{evidence.label}</span>)}
          </div>
        </div>
        <ProgressRing value={item.progress} tone={item.status === "AtRisk" || item.status === "OffTrack" ? "warning" : "success"} />
      </div>
      {quote ? (
        <blockquote className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-control bg-inlay px-4 py-3">
          <p className="max-w-[60ch] type-narrative text-foreground">“{quote.message}”</p>
          <footer className="type-meta text-muted-foreground">{first(quote.authorName)} · feedback, {dayLabel(quote.sentAt.slice(0, 10))}</footer>
        </blockquote>
      ) : null}
      {children}
    </article>
  );
}

function SubmittedView({ record }: { record: PerformanceReviewDto }) {
  const [open, setOpen] = useState<string | null>(null);
  const objectives = record.items.filter((i) => i.kind === "Objective");
  const competencies = record.items.filter((i) => i.kind === "Competency");
  const questions = record.questions.filter((q) => q.audience === "Person" && q.selfAnswer);
  const reviewer = first(record.reviewerDisplayName);
  return (
    <div className="max-w-4xl">
      <SubjectHeading record={record} />
      <section className="rounded-surface bg-card p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 items-center justify-center rounded-control bg-success/15 text-success"><Check className="size-5" aria-hidden /></span>
          <div>
            <h2 className="type-page-title text-foreground">{record.selfAssessment?.submittedAt ? `Submitted ${dayLabel(record.selfAssessment.submittedAt.slice(0, 10))}` : `${reviewer} is writing your review`}</h2>
            <p className="mt-0.5 type-meta text-muted-foreground">{reviewer} writes their part by {dayLabel(record.schedule?.managerAssessmentDue)}</p>
          </div>
        </div>
        <StageTrack className="mt-6" label="Your review's stages" steps={reviewSteps(record, "subject").map((s, i) => i === reviewSteps(record, "subject").length - 1 ? { ...s, detail: "You'll be notified" } : s)} />
      </section>
      {record.selfAssessment ? (
        <section className="mt-10" aria-labelledby="sent-heading">
          <SectionHeading id="sent-heading" title="What you sent" aside={<span className="inline-flex items-center gap-1"><Lock className="size-3.5" aria-hidden />Locked</span>} />
          <ul className="divide-y divide-border rounded-surface bg-card">
            {objectives.map((item) => (
              <li key={item.itemId} className="flex items-center gap-4 px-5 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block type-label text-foreground">{item.title}</span>
                  {item.selfReflection ? <span className="block truncate type-meta text-muted-foreground">“{item.selfReflection}”</span> : null}
                </span>
                {item.selfRating ? <span className="rounded-control-sm bg-primary px-2 type-label tabular-nums text-primary-foreground">{item.selfRating}</span> : null}
              </li>
            ))}
            {competencies.length ? (
              <Disclosure id="c" open={open} setOpen={setOpen} title="Competencies"
                summary={`${competencies.length} rated · ${competencies.map((c) => `${c.title} ${c.selfRating ?? "–"}`).join(" · ")}`}>
                {competencies.map((c) => <p key={c.itemId} className="type-body text-foreground">{c.title} · {c.selfRating ?? "–"}{c.selfComment ? ` · ${c.selfComment}` : ""}</p>)}
              </Disclosure>
            ) : null}
            {questions.length ? (
              <Disclosure id="q" open={open} setOpen={setOpen} title="Questions" summary={`${questions.length} answered`}>
                {questions.map((q) => <div key={q.questionId}><p className="type-label text-foreground">{q.text}</p><p className="type-narrative text-foreground">{q.selfAnswer}</p></div>)}
              </Disclosure>
            ) : null}
            <Disclosure id="o" open={open} setOpen={setOpen}
              title={`Overall${record.selfAssessment.overallRating ? ` · ${levelLabel(record.ratingScale, record.selfAssessment.overallRating)}` : ""}`}
              summary={`“${record.selfAssessment.summary}”`}>
              <p className="type-narrative text-foreground">{record.selfAssessment.summary}</p>
            </Disclosure>
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Disclosure({ id, title, summary, open, setOpen, children }: {
  id: string; title: string; summary: string; open: string | null; setOpen: (id: string | null) => void; children: ReactNode;
}) {
  const expanded = open === id;
  return (
    <li>
      <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : id)}
        className="flex w-full items-center gap-4 px-5 py-3.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1">
          <span className="block type-label text-foreground">{title}</span>
          <span className="block truncate type-meta text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>
      {expanded ? <div className="space-y-3 px-5 pb-4">{children}</div> : null}
    </li>
  );
}

function ReleasedView({ record }: { record: PerformanceReviewDto }) {
  const acknowledge = useAcknowledge(record.id);
  const download = useDownloadReviewPdf();
  const [comment, setComment] = useState("");
  const final = levelLabel(record.ratingScale, record.finalRating) ?? "Released";
  const objectives = record.items.filter((i) => i.kind === "Objective");
  const competencies = record.items.filter((i) => i.kind === "Competency");
  const managerAnswers = record.questions.filter((q) => q.audience === "Manager" && q.managerAnswer);
  const reviewer = first(record.reviewerDisplayName);
  return (
    <div className="max-w-4xl">
      <SubjectHeading record={record}
        detail={`Released ${dayLabel(record.finalizedAt?.slice(0, 10))} · reviewed by ${record.reviewerDisplayName}`}
        actions={<div className="flex items-center gap-2">
          {record.acknowledgement ? <StatusBadge tone="success" dot>Acknowledged</StatusBadge> : <StatusBadge tone="warning" dot>Not acknowledged</StatusBadge>}
          {record.canDownloadPdf ? <Button variant="outline" onClick={() => void download(record.id, `${record.reviewRoundName}.pdf`)}><Download className="size-4" aria-hidden />PDF</Button> : null}
        </div>} />
      {/* A result to read, not a decision: a plain card, with amber only on the level reached. */}
      <section aria-label="Your result" className="rounded-surface bg-card p-6">
        <p className="type-meta text-muted-foreground">Your result</p>
        <h2 className="mt-2 type-display text-foreground">{final}</h2>
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${record.ratingScale.length}, minmax(0, 1fr))` }} aria-hidden>
          {record.ratingScale.map((level) => (
            <span key={level.value} className={cn("rounded-control px-3 py-2 type-label tabular-nums", level.value === record.finalRating ? "border border-primary bg-primary/20 text-primary" : "bg-card text-muted-foreground")}>{level.value}</span>
          ))}
        </div>
        {record.managerAssessment?.summary ? (
          <div className="mt-6 flex gap-4 border-t border-primary/30 pt-5">
            <PersonInitials name={record.reviewerDisplayName} size="lg" />
            <div>
              <p className="type-meta text-muted-foreground">{record.reviewerDisplayName}</p>
              <p className="mt-1 max-w-[65ch] type-narrative text-foreground">{record.managerAssessment.summary}</p>
            </div>
          </div>
        ) : null}
      </section>

      {objectives.length ? (
        <section className="mt-10" aria-labelledby="r-objectives">
          <SectionHeading id="r-objectives" title="Objectives" />
          <ul className="divide-y divide-border rounded-surface bg-card">
            {objectives.map((item) => (
              <li key={item.itemId} className="flex items-center gap-4 px-5 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block type-label text-foreground">{item.title}</span>
                  <span className="block truncate type-meta text-muted-foreground">
                    {[item.progress !== null ? `${Math.round(item.progress)}%` : null, item.managerAssessment ? `“${item.managerAssessment}”` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {item.managerRating ? <span className="type-label tabular-nums text-foreground">{item.managerRating} · {levelLabel(record.ratingScale, item.managerRating)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {competencies.length ? (
        <section className="mt-10" aria-labelledby="r-competencies">
          <SectionHeading id="r-competencies" title="Competencies" />
          <div className="grid gap-3 md:grid-cols-2">
            {competencies.map((item) => (
              <div key={item.itemId} className="rounded-surface bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <ValueChip value={{ id: item.itemId, name: item.title }} />
                  {item.managerRating ? <span className="type-label tabular-nums text-foreground">{item.managerRating} · {levelLabel(record.ratingScale, item.managerRating)}</span> : null}
                </div>
                {item.managerAssessment ? <p className="mt-2 type-body-secondary text-muted-foreground">{item.managerAssessment}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {managerAnswers.length ? (
        <section className="mt-10" aria-labelledby="r-answers">
          <SectionHeading id="r-answers" title={`${reviewer}'s answers`} />
          <ul className="divide-y divide-border rounded-surface bg-card">
            {managerAnswers.map((q) => (
              <li key={q.questionId} className="p-5"><p className="type-label text-foreground">{q.text}</p><p className="mt-1 type-narrative text-foreground">{q.managerAnswer}</p></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 rounded-surface bg-card p-5" aria-labelledby="ack-heading">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-control bg-primary-tint text-primary"><Check className="size-4" aria-hidden /></span>
          <div>
            <h2 id="ack-heading" className="type-panel-title text-foreground">{record.acknowledgement ? `You acknowledged this ${dayLabel(record.acknowledgement.at.slice(0, 10))}` : "I've read my review"}</h2>
            <p className="type-meta text-muted-foreground">Acknowledging isn&apos;t agreeing · {reviewer} and HR see it · optional comment</p>
          </div>
        </div>
        {record.acknowledgement ? (
          record.acknowledgement.comment ? <p className="mt-3 type-narrative text-foreground">“{record.acknowledgement.comment}”</p> : null
        ) : record.canAcknowledge ? (
          <>
            <Textarea className="mt-4" aria-label="Comment for your reviewer and HR" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="mt-3 flex items-center justify-between">
              <span className="type-meta tabular-nums text-muted-foreground">{comment.length} / 1,000</span>
              <AsyncButton pending={acknowledge.isLoading} onClick={() => void acknowledge.mutateAsync(comment.trim() || null)
                .then(() => toast.success("Acknowledged."))
                .catch((error) => toast.error(error instanceof Error ? error.message : "This couldn't be acknowledged."))}>
                <Check className="size-4" aria-hidden />Acknowledge
              </AsyncButton>
            </div>
          </>
        ) : null}
      </section>
      <Link href={withCycle("/plan#development", record.cycleId)} className="mt-3 flex items-center gap-3 rounded-surface bg-card px-5 py-4 hover:bg-inlay/60">
        <span className="flex size-9 items-center justify-center rounded-control bg-primary-tint text-primary"><Target className="size-4" aria-hidden /></span>
        <span className="flex-1">
          <span className="block type-label text-foreground">Plan your development</span>
          <span className="block type-meta text-muted-foreground">{record.year?.developmentGoals ? `${record.year.developmentGoals} goals in your plan` : "Turn this into a goal or two"}</span>
        </span>
      </Link>
    </div>
  );
}

// ── The reviewer (board 12) ────────────────────────────────────────────────────────

function ReviewerView({ record }: { record: PerformanceReviewDto }) {
  const editable = record.canEditManagerAssessment;
  const draft = useDraft(record, "manager");
  const download = useDownloadReviewPdf();
  const subject = first(record.subjectDisplayName);
  const objectives = record.items.filter((i) => i.kind === "Objective");
  const competencies = record.items.filter((i) => i.kind === "Competency");
  const managerQuestions = record.questions.filter((q) => q.audience === "Manager");
  const personQuestions = record.questions.filter((q) => q.audience === "Person" && q.selfAnswer);
  const missingItems = draft.missing?.items.map((m) => `${m.kind}:${m.itemId}`) ?? [];
  const selfIn = Boolean(record.selfAssessment?.submittedAt);
  return (
    <div className="pb-16">
      <PerformancePageHeading
        back={{ href: "/reviews", label: "Reviews" }}
        leading={<span className="flex"><PersonInitials name={record.subjectDisplayName} size="xl" /><PersonInitials name={record.reviewerDisplayName} size="xl" className="-ms-4 ring-2 ring-background" /></span>}
        title={record.subjectDisplayName}
        description={[record.reviewRoundName, record.subjectJobTitle,
          selfIn ? `self-assessment came in ${dayLabel(record.selfAssessment!.submittedAt!.slice(0, 10))}` : null,
          editable ? savedLabel(draft.savedAt, draft.saving) : null].filter(Boolean).join(" · ")}
        actions={editable ? <AsyncButton pending={draft.pending} onClick={() => void draft.submit()}><Send className="size-4" aria-hidden />Submit review</AsyncButton>
          : record.canDownloadPdf ? <Button variant="outline" onClick={() => void download(record.id, `${record.reviewRoundName} ${record.subjectDisplayName}.pdf`)}><Download className="size-4" aria-hidden />PDF</Button>
          : null}
      />

      <section aria-label="Where the review stands" className="flex flex-wrap items-start gap-6 rounded-surface bg-card p-5">
        <StageTrack className="min-w-[28rem] flex-1" label="Review stages" steps={reviewSteps(record, "reviewer")} />
        <YearChips record={record} />
      </section>
      {record.lens === "Reviewer" ? <CalibratedOutcome record={record} /> : null}
      {record.acknowledgement ? (
        <p className="mt-4 rounded-surface bg-card px-5 py-3 type-body text-foreground">
          {subject} acknowledged this {dayLabel(record.acknowledgement.at.slice(0, 10))}{record.acknowledgement.comment ? `: “${record.acknowledgement.comment}”` : "."}
        </p>
      ) : null}
      {!selfIn && record.selfAssessmentEnabled && record.state === "SelfAssessment" ? (
        <p className="mt-4 type-body-secondary text-muted-foreground">{subject}&apos;s self-assessment isn&apos;t in yet. You&apos;ll write yours beside it once it is.</p>
      ) : null}

      {record.state !== "SelfAssessment" ? (
        <>
          <p className="mt-6 flex gap-4 type-meta text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-info" />{subject}&apos;s view</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-primary" />Yours</span>
          </p>
          {objectives.length ? (
            <section className="mt-6" aria-labelledby="m-objectives">
              <SectionHeading id="m-objectives" title="Objectives" count={record.objectiveRatingsEnabled ? `${objectives.filter((o) => draft.items[keyOf(o)]?.managerRating !== null).length} of ${objectives.length} rated` : objectives.length} />
              <div className="space-y-4">
                {objectives.map((item) => (
                  <ObjectiveCard key={item.itemId} record={record} item={item}>
                    <div className="mt-4 grid border-t border-border md:grid-cols-2">
                      <div className="py-4 md:pe-5">
                        <p className="mb-2 flex items-center justify-between gap-2 type-label text-foreground">
                          <span className="inline-flex items-center gap-2"><PersonInitials name={record.subjectDisplayName} size="xs" />{subject}</span>
                          {item.selfRating ? <span className="rounded-control-sm px-1.5 type-label tabular-nums text-info ring-1 ring-info">{item.selfRating}</span> : null}
                        </p>
                        <p className="type-narrative text-foreground">{item.selfReflection ?? <span className="text-muted-foreground">No reflection</span>}</p>
                      </div>
                      <div className="border-border py-4 md:border-s md:ps-5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 type-label text-foreground"><PersonInitials name={record.reviewerDisplayName} size="xs" />You</span>
                          {record.objectiveRatingsEnabled ? (
                            <SegmentRating label={`Your rating for ${item.title}`} levels={record.ratingScale} value={draft.items[keyOf(item)]!.managerRating}
                              disabled={!editable} onChange={editable ? (value) => draft.updateItem(item, { managerRating: value }) : undefined} />
                          ) : null}
                        </div>
                        {editable ? (
                          <Textarea aria-label={`Your view of ${item.title}`} className="min-h-24 type-narrative" placeholder="Your view of this objective" maxLength={4000}
                            aria-invalid={missingItems.includes(keyOf(item)) || undefined}
                            value={draft.items[keyOf(item)]!.assessment} onChange={(e) => draft.updateItem(item, { assessment: e.target.value })} />
                        ) : <p className="type-narrative text-foreground">{item.managerAssessment ?? <span className="text-muted-foreground">No assessment</span>}</p>}
                      </div>
                    </div>
                  </ObjectiveCard>
                ))}
              </div>
            </section>
          ) : null}

          {competencies.length ? (
            <section className="mt-10" aria-labelledby="m-competencies">
              <SectionHeading id="m-competencies" title="Competencies" count={`${competencies.filter((c) => draft.items[keyOf(c)]?.managerRating !== null).length} of ${competencies.length}`} />
              <div className="overflow-x-auto rounded-surface bg-card">
                <table className="w-full min-w-[48rem] text-start">
                  <thead className="bg-inlay"><tr className="type-meta text-muted-foreground">
                    <th scope="col" className="px-5 py-3 font-semibold">Competency</th>
                    <th scope="col" className="px-3 py-3 font-semibold">{subject}</th>
                    <th scope="col" className="px-3 py-3 font-semibold">You</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Comment</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {competencies.map((item) => (
                      <tr key={item.itemId} className={cn(missingItems.includes(keyOf(item)) && "bg-destructive/5")}>
                        <td className="px-5 py-3"><ValueChip value={{ id: item.itemId, name: item.title }} /></td>
                        <td className="px-3 py-3"><SegmentRating label={`${subject}'s rating for ${item.title}`} levels={record.ratingScale} value={null} theirs={item.selfRating} /></td>
                        <td className="px-3 py-3"><SegmentRating label={`Your rating for ${item.title}`} levels={record.ratingScale} value={draft.items[keyOf(item)]!.managerRating}
                          disabled={!editable} onChange={editable ? (value) => draft.updateItem(item, { managerRating: value }) : undefined} /></td>
                        <td className="px-5 py-3">{editable ? (
                          <Input aria-label={`Comment on ${item.title}`} className="border-transparent bg-transparent" placeholder="Add a comment" maxLength={4000}
                            value={draft.items[keyOf(item)]!.assessment} onChange={(e) => draft.updateItem(item, { assessment: e.target.value })} />
                        ) : <span className="type-body text-foreground">{item.managerAssessment}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <PeerAnswers record={record} />

          {personQuestions.length ? (
            <section className="mt-10" aria-labelledby="m-person-answers">
              <SectionHeading id="m-person-answers" title={`${subject}'s answers`} />
              <ul className="divide-y divide-border rounded-surface bg-card">
                {personQuestions.map((q) => <li key={q.questionId} className="p-5"><p className="type-label text-foreground">{q.text}</p><p className="mt-1 type-narrative text-foreground">{q.selfAnswer}</p></li>)}
              </ul>
            </section>
          ) : null}

          {managerQuestions.length ? (
            <section className="mt-10" aria-labelledby="m-questions">
              <SectionHeading id="m-questions" title="Your answers" />
              <ul className="divide-y divide-border rounded-surface bg-card">
                {managerQuestions.map((q) => (
                  <li key={q.questionId} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <label htmlFor={`m-${q.questionId}`} className="type-label text-foreground">{q.text}</label>
                      {editable ? <ReviewDraftBlock reviewId={record.id} kind="Question" questionId={q.questionId} lens="manager" subject={subject}
                        value={draft.answers[q.questionId] ?? ""} onInsert={(text) => draft.setAnswer(q.questionId, text)} className="shrink-0" /> : null}
                    </div>
                    {editable ? (
                      <Textarea id={`m-${q.questionId}`} className="mt-2 min-h-20 type-narrative" maxLength={4000}
                        aria-invalid={draft.missing?.questions.includes(q.questionId) || undefined}
                        value={draft.answers[q.questionId] ?? ""} onChange={(e) => draft.setAnswer(q.questionId, e.target.value)} />
                    ) : <p className="mt-1 type-narrative text-foreground">{q.managerAnswer}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10" aria-labelledby="m-overall">
            <SectionHeading id="m-overall" title="Overall" aside={record.selfAssessment?.overallRating ? `${subject}'s view: ${levelLabel(record.ratingScale, record.selfAssessment.overallRating)}` : undefined} />
            <div className="space-y-3 rounded-surface bg-card p-5">
              {editable ? <ReviewDraftBlock reviewId={record.id} lens="manager" subject={subject} value={draft.summary} onInsert={draft.setSummary} /> : null}
              <LevelCards label="Your overall rating" levels={record.ratingScale} value={draft.overall} theirs={record.selfAssessment?.overallRating}
                disabled={!editable} onChange={editable ? draft.setOverall : undefined} />
              {editable ? (
                <Textarea aria-label="Your summary" className="min-h-24 type-narrative" placeholder={`What ${subject} should read first`} maxLength={4000}
                  aria-invalid={draft.missing?.summary || undefined} value={draft.summary} onChange={(e) => draft.setSummary(e.target.value)} />
              ) : <p className="type-narrative text-foreground">{record.managerAssessment?.summary}</p>}
            </div>
          </section>

          {record.potentialEnabled ? (
            <section className="mt-10" aria-labelledby="m-potential">
              <SectionHeading id="m-potential" title="Potential" aside={<span className="inline-flex items-center gap-1"><Lock className="size-3.5" aria-hidden />Never shown to {subject}</span>} />
              <div role="radiogroup" aria-label="Potential" className={cn("grid gap-3 md:grid-cols-3", draft.missing?.potential && "rounded-surface ring-1 ring-destructive")}>
                {REVIEW_POTENTIALS.map((level) => {
                  const selected = draft.potential === level;
                  return (
                    <button key={level} type="button" role="radio" aria-checked={selected} disabled={!editable} onClick={() => draft.setPotential(level)}
                      className={cn("rounded-surface border px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-success bg-success/10" : "border-transparent bg-card hover:border-border")}>
                      <span className="block type-label text-foreground">{level}</span>
                      <span className="block type-meta text-muted-foreground">{POTENTIAL_COPY[level]}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PeerAnswers({ record }: { record: PerformanceReviewDto }) {
  const [all, setAll] = useState(false);
  const peers = record.peers;
  if (!peers || !peers.approved) return null;
  const answered = peers.people.filter((p) => p.state === "Answered");
  const declined = peers.people.filter((p) => p.state === "Declined");
  const questions = Array.from(new Set(answered.flatMap((p) => p.answers ?? []).map((a) => a.question)));
  const shown = all ? questions : questions.slice(0, 1);
  return (
    <section className="mt-10" aria-labelledby="m-peers">
      <SectionHeading id="m-peers" title={`From ${first(record.subjectDisplayName)}'s peers`} count={`${answered.length} of ${peers.people.length}`}
        aside={<span className="inline-flex items-center gap-1"><Lock className="size-3.5" aria-hidden />You and HR only</span>} />
      <div className="rounded-surface bg-card">
        {answered.length === 0 ? <p className="p-5 type-body-secondary text-muted-foreground">No answers yet.</p> : (
          <div className="divide-y divide-border">
            {shown.map((question) => (
              <div key={question} className="p-5">
                <p className="type-label text-foreground">{question}</p>
                <ul className="mt-2 space-y-2">
                  {answered.map((peer) => {
                    const answer = peer.answers?.find((a) => a.question === question);
                    return answer ? <li key={peer.employeeId} className="flex items-start gap-2.5"><PersonInitials name={peer.displayName} size="xs" className="mt-1" /><span className="type-narrative text-foreground">{answer.text}</span></li> : null;
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        {questions.length > 1 ? (
          <button type="button" onClick={() => setAll(!all)} className="flex w-full items-center justify-between border-t border-border px-5 py-3 type-meta text-muted-foreground hover:text-foreground">
            <span>{all ? "Showing every question" : `${questions.length - 1} more ${questions.length === 2 ? "question" : "questions"}`}</span>
            <span className="inline-flex items-center gap-1 type-label text-foreground">{all ? "Show less" : "Show all"}<ChevronDown className={cn("size-4", all && "rotate-180")} aria-hidden /></span>
          </button>
        ) : null}
        {declined.map((peer) => (
          <p key={peer.employeeId} className="border-t border-border px-5 py-3 type-meta text-muted-foreground">
            <Ban className="me-1.5 inline size-3.5" aria-hidden />{peer.displayName} declined{peer.declineNote ? `: “${peer.declineNote}”` : ""}
          </p>
        ))}
      </div>
    </section>
  );
}

// ── HR (board 14) ──────────────────────────────────────────────────────────────────

function AdministratorView({ record }: { record: PerformanceReviewDto }) {
  const late = record.schedule?.daysLate ?? 0;
  const stage = record.state === "SelfAssessment" ? "Self-assessment" : record.state === "ManagerAssessment" ? "Manager assessment" : null;
  const peers = record.peers;
  return (
    <div className="pb-16">
      <PerformancePageHeading
        back={{ href: withCycle(roundHref(record.reviewRoundId), record.cycleId), label: record.reviewRoundName }}
        leading={<PersonInitials name={record.subjectDisplayName} size="xl" />}
        title={record.subjectDisplayName}
        description={[record.reviewRoundName, record.subjectJobTitle, record.subjectOrgUnitName, `reviewed by ${record.reviewerDisplayName}`].filter(Boolean).join(" · ")}
        actions={<div className="flex items-center gap-2">
          {record.canMoveDueDate ? <MoveReviewDueDate record={record} /> : null}
          {record.canClose ? <CloseWithoutResult record={record} /> : null}
        </div>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-surface bg-card p-5" aria-label="Where the review stands">
          {late > 0 && stage ? <StatusBadge tone="danger" dot>{stage} {late === 1 ? "a day" : `${late} days`} late</StatusBadge> : null}
          {record.state === "Closed" ? <StatusBadge tone="muted">Closed without a result{record.closeReason ? ` · ${record.closeReason}` : ""}</StatusBadge> : null}
          <StageTrack className="mt-4" label="Review stages" steps={reviewSteps(record, "subject").map((s) => ({ ...s, label: s.label.replace("Your self-assessment", "Self-assessment").replace("Your result", "Released") }))} />
          <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <div className="rounded-control bg-inlay p-3">
              <p className="type-meta text-muted-foreground">Peers</p>
              {peers?.people.length ? (
                <p className="mt-1.5 flex items-center gap-2"><AvatarStack names={peers.people.map((p) => p.displayName)} size="xs" />
                  <span className="type-label tabular-nums">{peers.people.filter((p) => p.state === "Answered").length} of {peers.people.length}</span></p>
              ) : <p className="mt-1.5 type-meta text-muted-foreground">{record.peerInputEnabled ? "None yet" : "Not asked"}</p>}
            </div>
            <div className="rounded-control bg-inlay p-3">
              <p className="type-meta text-muted-foreground">Reminders sent</p>
              <p className="mt-1.5 type-body text-foreground"><strong className="tabular-nums">{record.schedule?.remindersSent.length ?? 0}</strong>
                {record.schedule?.remindersSent.length ? <span className="type-meta text-muted-foreground"> · last {dayLabel(record.schedule.remindersSent.at(-1)!.slice(0, 10))}</span> : null}</p>
            </div>
            <div className="rounded-control bg-inlay p-3">
              <p className="type-meta text-muted-foreground">Next reminder</p>
              <p className="mt-1.5 type-body text-foreground">{record.schedule?.nextReminder ? <strong>{dayLabel(record.schedule.nextReminder)}</strong> : "None"}</p>
            </div>
          </div>
        </section>
        <section aria-labelledby="hr-activity" className="rounded-surface bg-card p-5">
          <h2 id="hr-activity" className="mb-3 type-meta text-muted-foreground">Activity</h2>
          <ol className="divide-y divide-border">
            {record.activity.map((entry, index) => (
              <li key={`${entry.kind}-${index}`} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-2.5">
                <span className="type-meta text-muted-foreground">{dayLabel(entry.at.slice(0, 10))}</span>
                <span>
                  <span className="block type-body text-foreground">{entry.text}</span>
                  {entry.detail ? <span className="block type-meta text-muted-foreground">{entry.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {record.state !== "SelfAssessment" && record.state !== "Closed" ? (
        <div className="mt-10"><ReviewerView record={{ ...record, canEditManagerAssessment: false }} /></div>
      ) : null}
    </div>
  );
}

function MoveReviewDueDate({ record }: { record: PerformanceReviewDto }) {
  const { moveReview } = useScheduleCommands();
  const [open, setOpen] = useState(false);
  const current = record.state === "SelfAssessment" ? record.schedule?.selfAssessmentDue : record.schedule?.managerAssessmentDue;
  const [date, setDate] = useState(current ?? "");
  const [reason, setReason] = useState("");
  const subject = first(record.subjectDisplayName);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="outline"><CalendarDays className="size-4" aria-hidden />Move due date</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-5">
        <p className="type-panel-title text-foreground">Move {subject}&apos;s due date</p>
        <p className="mt-0.5 type-meta text-muted-foreground">Only this review · {subject} and {first(record.reviewerDisplayName)} are notified</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex-1 type-label text-foreground">{record.state === "SelfAssessment" ? "Self-assessment" : "Manager assessment"}</span>
          {date && date !== current ? <span className="type-meta text-muted-foreground line-through">{dayLabel(current)}</span> : null}
          <Input type="date" aria-label="New due date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Textarea className="mt-4" aria-label="Reason" placeholder="Why it moves" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <AsyncButton pending={moveReview.isLoading} disabled={!date || date === current || !reason.trim()}
            onClick={() => void moveReview.mutateAsync({ reviewId: record.id, request: { expectedVersion: record.version, dueDate: date, reason: reason.trim() } })
              .then(() => { toast.success(`${subject}'s due date moved.`); setOpen(false); setReason(""); })
              .catch((error) => toast.error(error instanceof Error ? error.message : "The due date couldn't move."))}>
            Move date
          </AsyncButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CloseWithoutResult({ record }: { record: PerformanceReviewDto }) {
  const mutations = useReviewAssessmentMutations(record.id, record.cycleId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="ghost"><Ban className="size-4" aria-hidden />Close without a result</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-5">
        <p className="type-panel-title text-foreground">Close {first(record.subjectDisplayName)}&apos;s review without a result</p>
        <p className="mt-0.5 type-meta text-muted-foreground">No rating is released and open peer requests close. This can&apos;t be undone.</p>
        <Textarea className="mt-4" aria-label="Reason" placeholder="Left the company on 10 Sep" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <AsyncButton variant="destructive" pending={mutations.close.isLoading} disabled={!reason.trim()}
            onClick={() => void mutations.close.mutateAsync({ expectedVersion: record.version, reason: reason.trim() })
              .then(() => { toast.success("Review closed."); setOpen(false); })
              .catch((error) => toast.error(error instanceof Error ? error.message : "The review couldn't close."))}>
            Close review
          </AsyncButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}
