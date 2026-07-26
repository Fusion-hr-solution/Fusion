"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type AssessmentIncompleteItemDto,
  type AssessmentWorkspaceDto,
  type SaveAssessmentDraftRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { canAccessMyEvaluations, useAuth } from "@repo/auth";
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
import {
  RatingControl,
  type RatingLevel,
} from "./rating-control";
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
import { ResultSurface } from "./result-surface";
import {
  evaluationTerms,
  evaluationStateLabel,
  evaluationStateTone,
} from "./evaluation-terms";

interface ObjectiveDraft {
  ratingOrdinal: number | null;
  comment: string;
}
interface SkillDraft {
  proficiencyOrdinal: number | null;
  comment: string;
}
interface Draft {
  objectives: Record<string, ObjectiveDraft>;
  skills: Record<string, SkillDraft>;
  questions: Record<string, QuestionAnswerValue>;
}

function initialDraft(ws: AssessmentWorkspaceDto): Draft {
  return {
    objectives: Object.fromEntries(
      ws.objectives.map((o) => [
        o.objectiveSnapshotId,
        { ratingOrdinal: o.myRatingOrdinal, comment: o.myComment ?? "" },
      ])
    ),
    skills: Object.fromEntries(
      ws.skills.map((s) => [
        s.skillSnapshotItemId,
        { proficiencyOrdinal: s.myProficiencyOrdinal, comment: s.myComment ?? "" },
      ])
    ),
    questions: Object.fromEntries(
      ws.questions.map((q) => [
        q.questionSnapshotId,
        {
          textAnswer: q.myTextAnswer ?? "",
          ratingOrdinal: q.myRatingOrdinal,
          isNotApplicable: q.isNotApplicable,
          notApplicableReason: q.notApplicableReason ?? "",
        },
      ])
    ),
  };
}

function draftToPayload(draft: Draft): SaveAssessmentDraftRequest {
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

export function SelfAssessmentWorkspacePage({ roundId }: { roundId: string }) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const allowed = canAccessMyEvaluations(user);
  const query = useApiQuery<AssessmentWorkspaceDto>(
    performanceQueryKeys.myAssessmentWorkspace(roundId),
    (signal) =>
      api.get(performancePaths.myAssessmentWorkspace(roundId), { signal }),
    { enabled: allowed }
  );

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
        <PageError
          title={evaluationTerms.loadFailed}
          onRetry={query.refetch}
        />
      </PageContainer>
    );

  const ws = query.data;

  if (ws.status === "AwaitingManager")
    return <AwaitingManagerView workspace={ws} />;

  if (ws.result)
    return (
      <PageContainer width="wide">
        <PageHeader
          title={ws.roundName}
          eyebrow={
            <StatusBadge tone={evaluationStateTone(ws.status)}>
              {evaluationStateLabel(ws.status)}
            </StatusBadge>
          }
        />
        <ResultSurface workspace={ws} onAcknowledged={query.refetch} />
      </PageContainer>
    );

  return (
    <SelfAuthoring
      key={ws.assignmentId}
      workspace={ws}
      onReload={query.refetch}
    />
  );
}

function AwaitingManagerView({
  workspace,
}: {
  workspace: AssessmentWorkspaceDto;
}) {
  return (
    <PageContainer width="wide">
      <PageHeader
        title={workspace.roundName}
        eyebrow={
          <StatusBadge tone="muted">
            {evaluationStateLabel("AwaitingManager")}
          </StatusBadge>
        }
      />
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <Clock aria-hidden className="size-8 text-muted-foreground" />
        <p className="text-lg font-medium">
          {evaluationTerms.awaitingManagerTitle}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {evaluationTerms.awaitingManagerNotice}
        </p>
        {workspace.deadline ? (
          <p className="text-sm text-muted-foreground">
            Expected by {formatDate(workspace.deadline)}
          </p>
        ) : null}
      </div>
    </PageContainer>
  );
}

function SelfAuthoring({
  workspace,
  onReload,
}: {
  workspace: AssessmentWorkspaceDto;
  onReload: () => Promise<unknown>;
}) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const editable = workspace.editable;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(workspace));
  const [blockers, setBlockers] = useState<AssessmentIncompleteItemDto[]>([]);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useBreadcrumbLabel(workspace.roundId, workspace.roundName);

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

  const autosave = useAssessmentAutosave<AssessmentWorkspaceDto>({
    initialVersion: workspace.version,
    enabled: editable,
    save: (version) =>
      api.post(
        performancePaths.saveSelfAssessmentDraft(workspace.assignmentId),
        draftToPayload(draftRef.current),
        { headers: { "If-Match": `"${version}"` } }
      ),
    versionOf: (result) => result.version,
  });

  const submit = useApiMutation<AssessmentWorkspaceDto, void>(
    async () => {
      const version = await autosave.flush();
      return api.post(
        performancePaths.submitSelfAssessment(workspace.assignmentId),
        {},
        { headers: { "If-Match": `"${version}"` } }
      );
    },
    {
      invalidateQueries: [
        { queryKey: performanceQueryKeys.myAssessments() },
        {
          queryKey: performanceQueryKeys.myAssessmentWorkspace(
            workspace.roundId
          ),
        },
      ],
      onSuccess: () => {
        toast.success(evaluationTerms.submitSelf);
        setBlockers([]);
      },
      onError: (error) => {
        const items = incompleteItemsFromError(error);
        const first = items[0];
        if (first) {
          setBlockers(items);
          document
            .getElementById(assessmentItemAnchor(first.id))
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
          toast.error(
            `${items.length} item${items.length === 1 ? "" : "s"} still need a response.`
          );
        } else {
          toast.error("Could not submit your assessment.");
        }
      },
    }
  );

  const updateObjective = useCallback(
    (id: string, patch: Partial<ObjectiveDraft>) => {
      setDraft((prev) => {
        const current: ObjectiveDraft = prev.objectives[id] ?? {
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
    (id: string, patch: Partial<SkillDraft>) => {
      setDraft((prev) => {
        const current: SkillDraft = prev.skills[id] ?? {
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

  // Completion tallies
  const objectivesDone = workspace.objectives.filter(
    (o) => draft.objectives[o.objectiveSnapshotId]?.ratingOrdinal != null
  ).length;
  const skillsDone = workspace.skills.filter(
    (s) => draft.skills[s.skillSnapshotItemId]?.proficiencyOrdinal != null
  ).length;
  const questionsDone = workspace.questions.filter((q) => {
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
    workspace.questions.length > 0 && {
      id: "questions",
      label: evaluationTerms.sections.questions,
      done: questionsDone,
      total: workspace.questions.length,
    },
  ].filter(Boolean) as RailSection[];

  const handleReload = useCallback(async () => {
    await onReload();
  }, [onReload]);

  return (
    <PageContainer width="wide">
      <PageHeader
        title={workspace.roundName}
        eyebrow={
          <StatusBadge tone={evaluationStateTone(workspace.status)}>
            {evaluationStateLabel(workspace.status)}
          </StatusBadge>
        }
      />
      <WorkspaceScaffold
        rail={
          <WorkspaceRail
            sections={railSections}
            saveStatus={autosave.status}
            deadline={workspace.deadline}
            blockers={blockers}
            onReload={handleReload}
            notice={
              !editable ? (
                <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  {evaluationTerms.submittedNotice}
                </p>
              ) : undefined
            }
            action={
              editable ? (
                <Button
                  type="button"
                  className="w-full"
                  disabled={submit.isLoading || autosave.status === "conflict"}
                  onClick={() => submit.mutate()}
                >
                  {evaluationTerms.submitSelf}
                </Button>
              ) : undefined
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
                <div>
                  <p className="font-medium">{item.title}</p>
                  {item.description ? (
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <RatingControl
                  levels={ratingLevels}
                  value={
                    draft.objectives[item.objectiveSnapshotId]?.ratingOrdinal ??
                    null
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
                  ariaLabel={`Rating for ${item.title}`}
                />
                <CommentField
                  value={draft.objectives[item.objectiveSnapshotId]?.comment ?? ""}
                  disabled={!editable}
                  onChange={(comment) =>
                    updateObjective(item.objectiveSnapshotId, { comment })
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
            <LevelTrackLegend expected selfLabel={null} managerLabel={null} />
            {workspace.skills.map((item) => (
              <div
                key={item.skillSnapshotItemId}
                id={assessmentItemAnchor(item.skillSnapshotItemId)}
                className="flex scroll-mt-24 flex-col gap-3"
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
                  self={
                    draft.skills[item.skillSnapshotItemId]?.proficiencyOrdinal ??
                    null
                  }
                  ariaLabel={`${item.skillName} expectation`}
                />
                <RatingControl
                  levels={proficiencyLevels}
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
                  ariaLabel={`Self proficiency for ${item.skillName}`}
                />
                <CommentField
                  value={draft.skills[item.skillSnapshotItemId]?.comment ?? ""}
                  disabled={!editable}
                  onChange={(comment) =>
                    updateSkill(item.skillSnapshotItemId, { comment })
                  }
                />
              </div>
            ))}
          </WorkspaceSection>
        ) : null}

        {workspace.questions.length > 0 ? (
          <WorkspaceSection
            id="questions"
            title={evaluationTerms.sections.questions}
            meta={
              <span className="text-sm tabular-nums text-muted-foreground">
                {questionsDone}/{workspace.questions.length}
              </span>
            }
          >
            {workspace.questions.map((q) => (
              <div
                key={q.questionSnapshotId}
                id={assessmentItemAnchor(q.questionSnapshotId)}
                className="scroll-mt-24"
              >
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
      </WorkspaceScaffold>
    </PageContainer>
  );
}

function CommentField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Textarea
      aria-label="Comment"
      placeholder="Add a comment"
      value={value}
      disabled={disabled}
      rows={2}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
