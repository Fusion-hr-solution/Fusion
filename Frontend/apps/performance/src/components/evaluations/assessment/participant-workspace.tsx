"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type AssessmentIncompleteItemDto,
  type ParticipantWorkspaceDto,
  type SaveAssessmentDraftRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { canAccessTeamEvaluations, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageError,
  PageHeader,
  PageListSkeleton,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { Button, Textarea } from "@repo/ds";
import { toast } from "sonner";
import { formatDate } from "@/lib/labels";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-labels";
import { RatingControl, type RatingLevel } from "./rating-control";
import { LevelTrack, LevelTrackLegend } from "./level-track";
import {
  QuestionField,
  EMPTY_ANSWER,
  type QuestionAnswerValue,
} from "./question-field";
import {
  WorkspaceScaffold,
  WorkspaceSection,
  WorkspaceRail,
  type RailSection,
} from "./workspace-scaffold";
import { useAssessmentAutosave } from "./use-assessment-autosave";
import {
  assessmentItemAnchor,
  incompleteItemsFromError,
} from "./incomplete-blockers";
import { ReopenDialog } from "./reopen-dialog";
import {
  evaluationTerms,
  evaluationStateLabel,
  evaluationStateTone,
} from "./evaluation-terms";

interface ManagerDraft {
  objectives: Record<string, { ratingOrdinal: number | null; comment: string }>;
  skills: Record<string, { proficiencyOrdinal: number | null; comment: string }>;
  questions: Record<string, QuestionAnswerValue>;
}

function initialDraft(ws: ParticipantWorkspaceDto): ManagerDraft {
  return {
    objectives: Object.fromEntries(
      ws.objectives.map((o) => [
        o.objectiveSnapshotId,
        {
          ratingOrdinal: o.managerRatingOrdinal,
          comment: o.managerComment ?? "",
        },
      ])
    ),
    skills: Object.fromEntries(
      ws.skills.map((s) => [
        s.skillSnapshotItemId,
        {
          proficiencyOrdinal: s.managerProficiencyOrdinal,
          comment: s.managerComment ?? "",
        },
      ])
    ),
    questions: Object.fromEntries(
      ws.questions
        .filter((q) => q.targetRater === "Manager" || q.targetRater === "Both")
        .map((q) => [
          q.questionSnapshotId,
          {
            textAnswer: q.managerTextAnswer ?? "",
            ratingOrdinal: q.managerRatingOrdinal,
            isNotApplicable: q.managerNotApplicable,
            notApplicableReason: "",
          },
        ])
    ),
  };
}

function draftToPayload(draft: ManagerDraft): SaveAssessmentDraftRequest {
  return {
    objectiveRatings: Object.entries(draft.objectives).map(([id, v]) => ({
      objectiveSnapshotId: id,
      ratingOrdinal: v.ratingOrdinal,
      comment: v.comment.trim() || null,
    })),
    skillRatings: Object.entries(draft.skills).map(([id, v]) => ({
      skillSnapshotItemId: id,
      proficiencyOrdinal: v.proficiencyOrdinal,
      comment: v.comment.trim() || null,
    })),
    questionAnswers: Object.entries(draft.questions).map(([id, v]) => ({
      questionSnapshotId: id,
      textAnswer: v.isNotApplicable ? null : v.textAnswer.trim() || null,
      ratingOrdinal: v.isNotApplicable ? null : v.ratingOrdinal,
      isNotApplicable: v.isNotApplicable,
      notApplicableReason: v.isNotApplicable
        ? v.notApplicableReason.trim() || null
        : null,
    })),
  };
}

export function ParticipantWorkspacePage({
  roundId,
  participantId,
}: {
  roundId: string;
  participantId: string;
}) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const allowed = canAccessTeamEvaluations(user);
  const query = useApiQuery<ParticipantWorkspaceDto>(
    performanceQueryKeys.participantAssessmentWorkspace(roundId, participantId),
    (signal) =>
      api.get(
        performancePaths.participantAssessmentWorkspace(roundId, participantId),
        { signal }
      ),
    { enabled: allowed }
  );

  useBreadcrumbLabel(participantId, query.data?.participantName);
  useBreadcrumbLabel(roundId, query.data?.roundName);

  if (authLoading || (allowed && query.isLoading))
    return (
      <PageContainer width="wide">
        <PageListSkeleton />
      </PageContainer>
    );
  if (!allowed)
    return (
      <PageContainer>
        <PagePermissionNotice
          title={evaluationTerms.selfWorkspaceUnavailable}
          description={evaluationTerms.accessRequired}
        />
      </PageContainer>
    );
  if (query.error || !query.data)
    return (
      <PageContainer>
        <PageError title={evaluationTerms.loadFailed} onRetry={query.refetch} />
      </PageContainer>
    );

  const ws = query.data;

  if (ws.managerStatus === "Finalized" && ws.result)
    return <ManagerResultView workspace={ws} />;

  if (!ws.actionable)
    return <AwaitingSelfView workspace={ws} />;

  return (
    <ManagerAuthoring
      key={`${ws.managerAssignmentId}-${ws.managerStatus}`}
      workspace={ws}
      onReload={query.refetch}
    />
  );
}

function ManagerResultView({
  workspace,
}: {
  workspace: ParticipantWorkspaceDto;
}) {
  const result = workspace.result!;
  const hasSkills = result.skillsWeightPercent > 0;
  return (
    <PageContainer width="wide">
      <ParticipantHeader workspace={workspace} />
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {evaluationTerms.finalResult}
              </p>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-5xl font-semibold tabular-nums">
                  {result.finalScore?.toFixed(1) ?? "—"}
                </span>
                <span className="text-xl text-muted-foreground">
                  {result.finalRatingLabel ?? "—"}
                </span>
              </div>
            </div>
            {result.acknowledgedAt ? (
              <StatusBadge tone="success">
                {evaluationStateLabel("Acknowledged")}
              </StatusBadge>
            ) : (
              <StatusBadge tone="info">
                {evaluationTerms.awaitingAcknowledgement}
              </StatusBadge>
            )}
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="bg-primary"
              style={{ width: `${result.objectivesWeightPercent}%` }}
            />
            <div
              className="bg-emerald-600 dark:bg-emerald-400"
              style={{ width: `${result.skillsWeightPercent}%` }}
            />
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">
                {evaluationTerms.objectivesArea} {result.objectivesWeightPercent}%
              </span>{" "}
              · {result.overallObjectivesRatingLabel ?? "—"}
            </p>
            {hasSkills ? (
              <p>
                <span className="text-muted-foreground">
                  {evaluationTerms.skillsArea} {result.skillsWeightPercent}%
                </span>{" "}
                · {result.overallSkillsRatingLabel ?? "—"}
              </p>
            ) : null}
          </div>
        </div>
        {result.discussionSummary ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">
              {evaluationTerms.discussionSummary}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {result.discussionSummary}
            </p>
          </section>
        ) : null}
      </div>
    </PageContainer>
  );
}

function AwaitingSelfView({ workspace }: { workspace: ParticipantWorkspaceDto }) {
  return (
    <PageContainer width="wide">
      <ParticipantHeader workspace={workspace} />
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <Clock aria-hidden className="size-8 text-muted-foreground" />
        <p className="text-lg font-medium">
          {workspace.selfMissing
            ? evaluationTerms.noSelfSubmission
            : evaluationTerms.awaitingSelf}
        </p>
        {workspace.managerDeadline ? (
          <p className="text-sm text-muted-foreground">
            Your review is due {formatDate(workspace.managerDeadline)}
          </p>
        ) : null}
      </div>
    </PageContainer>
  );
}

function ParticipantHeader({
  workspace,
}: {
  workspace: ParticipantWorkspaceDto;
}) {
  return (
    <PageHeader
      title={workspace.participantName}
      description={workspace.roundName}
      eyebrow={
        <StatusBadge tone={evaluationStateTone(workspace.managerStatus)}>
          {evaluationStateLabel(workspace.managerStatus)}
        </StatusBadge>
      }
    />
  );
}

function ManagerAuthoring({
  workspace,
  onReload,
}: {
  workspace: ParticipantWorkspaceDto;
  onReload: () => Promise<unknown>;
}) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const finalized = workspace.managerStatus === "Finalized";
  const submitted = workspace.managerStatus === "Submitted";
  const editable = !finalized;

  const [draft, setDraft] = useState<ManagerDraft>(() =>
    initialDraft(workspace)
  );
  const [summary, setSummary] = useState(
    workspace.result?.discussionSummary ?? ""
  );
  const [objectivesRating, setObjectivesRating] = useState<number | null>(
    workspace.result?.overallObjectivesRatingOrdinal ?? null
  );
  const [skillsRating, setSkillsRating] = useState<number | null>(
    workspace.result?.overallSkillsRatingOrdinal ?? null
  );
  const [blockers, setBlockers] = useState<AssessmentIncompleteItemDto[]>([]);
  const [reopenOpen, setReopenOpen] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const ratingLevels: RatingLevel[] = workspace.performanceScale.map((l) => ({
    ordinal: l.ordinal,
    label: l.label,
    description: l.description,
  }));
  const proficiencyLevels = workspace.proficiencyScale.map((l) => ({
    ordinal: l.ordinal,
    label: l.label,
    description: l.description,
  }));

  const autosave = useAssessmentAutosave<ParticipantWorkspaceDto>({
    initialVersion: workspace.managerVersion,
    enabled: editable,
    save: (version) =>
      api.post(
        performancePaths.saveManagerAssessmentDraft(
          workspace.managerAssignmentId
        ),
        draftToPayload(draftRef.current),
        { headers: { "If-Match": `"${version}"` } }
      ),
    versionOf: (result) => result.managerVersion,
  });

  const invalidate = [
    {
      queryKey: performanceQueryKeys.participantAssessmentWorkspace(
        workspace.roundId,
        workspace.participantEmployeeId
      ),
    },
    { queryKey: performanceQueryKeys.teamAssessmentQueue(workspace.roundId) },
  ];

  const submit = useApiMutation<ParticipantWorkspaceDto, void>(
    async () => {
      const version = await autosave.flush();
      return api.post(
        performancePaths.submitManagerAssessment(workspace.managerAssignmentId),
        {},
        { headers: { "If-Match": `"${version}"` } }
      );
    },
    {
      invalidateQueries: invalidate,
      onSuccess: () => {
        toast.success(evaluationTerms.assessmentRecorded);
        setBlockers([]);
      },
      onError: (error) => handleSubmitError(error),
    }
  );

  const finalize = useApiMutation<ParticipantWorkspaceDto, void>(
    async () => {
      const version = await autosave.flush();
      return api.post(
        performancePaths.finalizeEvaluation(workspace.managerAssignmentId),
        {
          overallObjectivesRatingOrdinal: objectivesRating,
          overallSkillsRatingOrdinal:
            workspace.skillsWeightPercent > 0 ? skillsRating : null,
          discussionSummary: summary.trim(),
        },
        { headers: { "If-Match": `"${version}"` } }
      );
    },
    {
      invalidateQueries: invalidate,
      onSuccess: () => {
        toast.success(evaluationTerms.finalized);
      },
      onError: (error) => handleSubmitError(error),
    }
  );

  const reopen = useApiMutation<ParticipantWorkspaceDto, string>(
    (reason) => {
      if (!workspace.selfAssignmentId)
        return Promise.reject(new Error("No self-assessment to reopen."));
      return api.post(
        performancePaths.reopenSelfAssessment(workspace.selfAssignmentId),
        { reason },
        { headers: { "If-Match": `"${workspace.selfVersion ?? 0}"` } }
      );
    },
    {
      invalidateQueries: invalidate,
      onSuccess: () => {
        toast.success(evaluationTerms.reopenSelf);
        setReopenOpen(false);
      },
      onError: () => {
        toast.error("Could not reopen the self-assessment.");
      },
    }
  );

  function handleSubmitError(error: unknown) {
    const items = incompleteItemsFromError(error);
    const first = items[0];
    if (first) {
      setBlockers(items);
      document
        .getElementById(assessmentItemAnchor(first.id))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(
        `${items.length} item${items.length === 1 ? "" : "s"} still need a rating.`
      );
    } else {
      toast.error("Could not save the assessment.");
    }
  }

  const updateObjective = useCallback(
    (id: string, patch: Partial<ManagerDraft["objectives"][string]>) => {
      setDraft((prev) => {
        const current = prev.objectives[id] ?? {
          ratingOrdinal: null,
          comment: "",
        };
        return {
          ...prev,
          objectives: { ...prev.objectives, [id]: { ...current, ...patch } },
        };
      });
      autosave.markDirty();
    },
    [autosave]
  );
  const updateSkill = useCallback(
    (id: string, patch: Partial<ManagerDraft["skills"][string]>) => {
      setDraft((prev) => {
        const current = prev.skills[id] ?? {
          proficiencyOrdinal: null,
          comment: "",
        };
        return {
          ...prev,
          skills: { ...prev.skills, [id]: { ...current, ...patch } },
        };
      });
      autosave.markDirty();
    },
    [autosave]
  );
  const updateQuestion = useCallback(
    (id: string, value: QuestionAnswerValue) => {
      setDraft((prev) => ({
        ...prev,
        questions: { ...prev.questions, [id]: value },
      }));
      autosave.markDirty();
    },
    [autosave]
  );

  // Completion tallies (manager ratings)
  const objectivesDone = workspace.objectives.filter(
    (o) => draft.objectives[o.objectiveSnapshotId]?.ratingOrdinal != null
  ).length;
  const skillsDone = workspace.skills.filter(
    (s) => draft.skills[s.skillSnapshotItemId]?.proficiencyOrdinal != null
  ).length;
  const managerQuestions = workspace.questions.filter(
    (q) => q.targetRater === "Manager" || q.targetRater === "Both"
  );
  const questionsDone = managerQuestions.filter((q) => {
    const a = draft.questions[q.questionSnapshotId];
    return a?.isNotApplicable || a?.ratingOrdinal != null || a?.textAnswer.trim();
  }).length;

  const railSections: RailSection[] = [
    workspace.includesObjectives && {
      id: "objectives",
      label: evaluationTerms.sections.objectives,
      done: objectivesDone,
      total: workspace.objectives.length,
    },
    workspace.includesSkills && {
      id: "skills",
      label: evaluationTerms.sections.skills,
      done: skillsDone,
      total: workspace.skills.length,
    },
    managerQuestions.length > 0 && {
      id: "questions",
      label: evaluationTerms.sections.questions,
      done: questionsDone,
      total: managerQuestions.length,
    },
    submitted && {
      id: "decision",
      label: evaluationTerms.sections.decision,
      done:
        (objectivesRating != null ? 1 : 0) +
        (workspace.skillsWeightPercent === 0 || skillsRating != null ? 1 : 0) +
        (summary.trim() ? 1 : 0),
      total: workspace.skillsWeightPercent > 0 ? 3 : 2,
    },
  ].filter(Boolean) as RailSection[];

  // Live weighted preview
  const weightedPreview =
    objectivesRating != null &&
    (workspace.skillsWeightPercent === 0 || skillsRating != null)
      ? (objectivesRating * workspace.objectivesWeightPercent +
          (skillsRating ?? 0) * workspace.skillsWeightPercent) /
        100
      : null;

  const canFinalize =
    submitted &&
    objectivesRating != null &&
    (workspace.skillsWeightPercent === 0 || skillsRating != null) &&
    summary.trim().length > 0;

  return (
    <PageContainer width="wide">
      <ParticipantHeader workspace={workspace} />
      <WorkspaceScaffold
        rail={
          <WorkspaceRail
            sections={railSections}
            saveStatus={autosave.status}
            deadline={
              submitted
                ? workspace.finalizationDeadline
                : workspace.managerDeadline
            }
            blockers={blockers}
            onReload={onReload}
            notice={
              workspace.selfMissing ? (
                <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  {evaluationTerms.noSelfSubmission}
                </p>
              ) : undefined
            }
            action={
              finalized ? undefined : submitted ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      !canFinalize ||
                      finalize.isLoading ||
                      autosave.status === "conflict"
                    }
                    onClick={() => finalize.mutate()}
                  >
                    {evaluationTerms.finalize}
                  </Button>
                  {workspace.selfAssignmentId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setReopenOpen(true)}
                    >
                      {evaluationTerms.reopenSelf}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <Button
                  type="button"
                  className="w-full"
                  disabled={submit.isLoading || autosave.status === "conflict"}
                  onClick={() => submit.mutate()}
                >
                  {evaluationTerms.recordAssessment}
                </Button>
              )
            }
          />
        }
      >
        {workspace.includesObjectives ? (
          <WorkspaceSection
            id="objectives"
            title={evaluationTerms.sections.objectives}
            meta={
              <span className="text-sm tabular-nums text-muted-foreground">
                {objectivesDone}/{workspace.objectives.length}
              </span>
            }
          >
            {workspace.objectives.map((item) => (
              <div
                key={item.objectiveSnapshotId}
                id={assessmentItemAnchor(item.objectiveSnapshotId)}
                className="flex scroll-mt-24 flex-col gap-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium">{item.title}</p>
                  {item.materialDifference ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {evaluationTerms.materialDifference}
                    </span>
                  ) : null}
                </div>
                {item.selfComment ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Employee:</span>{" "}
                    {item.selfComment}
                  </p>
                ) : null}
                <RatingControl
                  levels={ratingLevels}
                  value={
                    draft.objectives[item.objectiveSnapshotId]?.ratingOrdinal ??
                    null
                  }
                  markers={
                    item.selfRatingOrdinal != null
                      ? [
                          {
                            ordinal: item.selfRatingOrdinal,
                            label: "Employee",
                            tone: "self",
                          },
                        ]
                      : []
                  }
                  onChange={
                    editable
                      ? (ordinal) =>
                          updateObjective(item.objectiveSnapshotId, {
                            ratingOrdinal: ordinal,
                          })
                      : undefined
                  }
                  disabled={!editable}
                  ariaLabel={`Manager rating for ${item.title}`}
                />
                <Textarea
                  aria-label={`Comment for ${item.title}`}
                  placeholder="Add a comment"
                  rows={2}
                  disabled={!editable}
                  value={draft.objectives[item.objectiveSnapshotId]?.comment ?? ""}
                  onChange={(event) =>
                    updateObjective(item.objectiveSnapshotId, {
                      comment: event.target.value,
                    })
                  }
                />
              </div>
            ))}
          </WorkspaceSection>
        ) : null}

        {workspace.includesSkills ? (
          <WorkspaceSection
            id="skills"
            title={evaluationTerms.sections.skills}
            meta={
              <span className="text-sm tabular-nums text-muted-foreground">
                {skillsDone}/{workspace.skills.length}
              </span>
            }
          >
            <LevelTrackLegend
              expected
              selfLabel="Employee"
              managerLabel="Your rating"
            />
            {workspace.skills.map((item) => (
              <div
                key={item.skillSnapshotItemId}
                id={assessmentItemAnchor(item.skillSnapshotItemId)}
                className="flex scroll-mt-24 flex-col gap-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium">{item.skillName}</p>
                  <span className="text-xs text-muted-foreground">
                    {item.categoryName} · {evaluationTerms.expectedLevel}{" "}
                    {item.expectedLevelLabel ?? item.expectedLevelOrdinal}
                  </span>
                </div>
                <LevelTrack
                  levels={proficiencyLevels}
                  expected={item.expectedLevelOrdinal}
                  self={item.selfProficiencyOrdinal}
                  value={
                    draft.skills[item.skillSnapshotItemId]?.proficiencyOrdinal ??
                    null
                  }
                  onChange={
                    editable
                      ? (ordinal) =>
                          updateSkill(item.skillSnapshotItemId, {
                            proficiencyOrdinal: ordinal,
                          })
                      : undefined
                  }
                  disabled={!editable}
                  ariaLabel={`Your proficiency rating for ${item.skillName}`}
                />
              </div>
            ))}
          </WorkspaceSection>
        ) : null}

        {managerQuestions.length > 0 ? (
          <WorkspaceSection
            id="questions"
            title={evaluationTerms.sections.questions}
            meta={
              <span className="text-sm tabular-nums text-muted-foreground">
                {questionsDone}/{managerQuestions.length}
              </span>
            }
          >
            {managerQuestions.map((q) => (
              <div
                key={q.questionSnapshotId}
                id={assessmentItemAnchor(q.questionSnapshotId)}
                className="flex scroll-mt-24 flex-col gap-2"
              >
                {q.selfTextAnswer || q.selfRatingOrdinal != null ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Employee:</span>{" "}
                    {q.selfNotApplicable
                      ? evaluationTerms.notApplicable
                      : (q.selfTextAnswer ?? q.selfRatingOrdinal)}
                  </p>
                ) : null}
                <QuestionField
                  questionId={q.questionSnapshotId}
                  prompt={q.prompt}
                  type={q.type}
                  isRequired={q.isRequired}
                  allowNotApplicable={q.allowNotApplicable}
                  ratingLevels={ratingLevels}
                  value={draft.questions[q.questionSnapshotId] ?? EMPTY_ANSWER}
                  onChange={(value) => updateQuestion(q.questionSnapshotId, value)}
                  disabled={!editable}
                />
              </div>
            ))}
          </WorkspaceSection>
        ) : null}

        {submitted ? (
          <WorkspaceSection
            id="decision"
            title={evaluationTerms.sections.decision}
          >
            <DecisionBand
              workspace={workspace}
              ratingLevels={ratingLevels}
              objectivesRating={objectivesRating}
              setObjectivesRating={setObjectivesRating}
              skillsRating={skillsRating}
              setSkillsRating={setSkillsRating}
              summary={summary}
              setSummary={setSummary}
              weightedPreview={weightedPreview}
            />
          </WorkspaceSection>
        ) : null}
      </WorkspaceScaffold>

      {workspace.selfAssignmentId ? (
        <ReopenDialog
          open={reopenOpen}
          onOpenChange={setReopenOpen}
          submitting={reopen.isLoading}
          onConfirm={(reason) => reopen.mutate(reason)}
        />
      ) : null}
    </PageContainer>
  );
}

function DecisionBand({
  workspace,
  ratingLevels,
  objectivesRating,
  setObjectivesRating,
  skillsRating,
  setSkillsRating,
  summary,
  setSummary,
  weightedPreview,
}: {
  workspace: ParticipantWorkspaceDto;
  ratingLevels: RatingLevel[];
  objectivesRating: number | null;
  setObjectivesRating: (value: number) => void;
  skillsRating: number | null;
  setSkillsRating: (value: number) => void;
  summary: string;
  setSummary: (value: string) => void;
  weightedPreview: number | null;
}) {
  const hasSkills = workspace.skillsWeightPercent > 0;
  const finalLabel =
    weightedPreview != null
      ? ratingLevels.find(
          (l) => l.ordinal === Math.round(weightedPreview)
        )?.label
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Live weighted preview */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="text-sm text-muted-foreground">
            {evaluationTerms.weightedPreview}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums">
              {weightedPreview != null ? weightedPreview.toFixed(1) : "—"}
            </span>
            <span className="text-lg text-muted-foreground">
              {finalLabel ?? ""}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {evaluationTerms.objectivesArea} {workspace.objectivesWeightPercent}%
          {hasSkills
            ? ` · ${evaluationTerms.skillsArea} ${workspace.skillsWeightPercent}%`
            : ""}
        </div>
      </div>

      {/* Objectives area rating with guidance */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-medium">{evaluationTerms.objectivesArea} rating</p>
          {workspace.meanManagerObjectiveRating != null ? (
            <span className="text-xs text-muted-foreground">
              Your item average {workspace.meanManagerObjectiveRating.toFixed(1)}
            </span>
          ) : null}
        </div>
        <RatingControl
          levels={ratingLevels}
          value={objectivesRating}
          onChange={setObjectivesRating}
          ariaLabel="Overall objectives rating"
        />
      </div>

      {/* Skills area rating with guidance */}
      {hasSkills ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="font-medium">{evaluationTerms.skillsArea} rating</p>
            <span className="text-xs text-muted-foreground">
              {workspace.skillsBelowExpectation} below ·{" "}
              {workspace.skillsMeetsExpectation} at ·{" "}
              {workspace.skillsExceedsExpectation} above expected
            </span>
          </div>
          <RatingControl
            levels={ratingLevels}
            value={skillsRating}
            onChange={setSkillsRating}
            ariaLabel="Overall skills rating"
          />
        </div>
      ) : null}

      {/* Discussion summary */}
      <div className="flex flex-col gap-2">
        <p className="font-medium">{evaluationTerms.discussionSummary}</p>
        <Textarea
          aria-label={evaluationTerms.discussionSummary}
          placeholder="Summarize the discussion held with the employee"
          rows={4}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </div>
    </div>
  );
}
