"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardPenLine,
  MessageSquare,
  RotateCcw,
  Target,
  UsersRound,
} from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  AcknowledgeEvaluationRequest,
  AssessmentWorkspaceDto,
  EvaluationWorkEntryDto,
  FinalizeEvaluationRequest,
  MyEvaluationsPageDto,
  ReopenSelfAssessmentRequest,
  SaveAssessmentDraftRequest,
  TeamQueueDto,
  ParticipantWorkspaceDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import {
  canAccessMyEvaluations,
  canAccessTeamEvaluations,
  useAuth,
} from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PageListSkeleton,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  FieldLabel,
  Input,
  Textarea,
} from "@repo/ds";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MyEvaluationsPage() {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading } = useAuth();
  const allowed = canAccessMyEvaluations(user);
  const query = useApiQuery<MyEvaluationsPageDto>(
    performanceQueryKeys.myAssessments(),
    (signal) => api.get(performancePaths.myAssessments(), { signal }),
    { enabled: allowed }
  );
  const router = useRouter();
  if (isLoading)
    return (
      <PageContainer>
        <PageListSkeleton />
      </PageContainer>
    );
  if (!allowed)
    return (
      <PageContainer>
        <PagePermissionNotice
          title="My evaluations unavailable"
          description="Evaluation access is required."
        />
      </PageContainer>
    );
  if (query.isLoading)
    return (
      <PageContainer>
        <PageListSkeleton />
      </PageContainer>
    );
  if (query.error)
    return (
      <PageContainer>
        <PageError
          title="Evaluations could not be loaded"
          onRetry={query.refetch}
        />
      </PageContainer>
    );
  return (
    <PageContainer width="wide">
      <PageHeader title="My evaluations" />
      {!query.data?.items.length ? (
        <PageEmpty icon={ClipboardPenLine} title="No evaluation work" />
      ) : (
        <div className="flex flex-col gap-3">
          {query.data.items.map((item) => (
            <button
              key={item.roundId}
              type="button"
              onClick={() =>
                window.location.assign(`/performance/my-evaluations/${item.roundId}`)
              }
              className="text-left"
            >
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={item.status === "Finalized" ? "success" : "info"}
                      >
                        {item.status}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {item.roundType}
                      </span>
                    </div>
                    <h2 className="mt-2 font-semibold">{item.roundName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.nextAction} · {formatDate(item.deadline)}
                    </p>
                  </div>
                  <ArrowRight className="text-muted-foreground" />
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export function MyAssessmentWorkspacePage({ roundId }: { roundId: string }) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading } = useAuth();
  const allowed = canAccessMyEvaluations(user);
  const query = useApiQuery<AssessmentWorkspaceDto>(
    performanceQueryKeys.myAssessmentWorkspace(roundId),
    (signal) =>
      api.get(performancePaths.myAssessmentWorkspace(roundId), { signal }),
    { enabled: allowed }
  );
  if (isLoading || query.isLoading)
    return (
      <PageContainer width="wide">
        <PageListSkeleton />
      </PageContainer>
    );
  if (!allowed)
    return (
      <PageContainer>
        <PagePermissionNotice
          title="Assessment unavailable"
          description="Evaluation access is required."
        />
      </PageContainer>
    );
  if (query.error || !query.data)
    return (
      <PageContainer>
        <PageError
          title="Assessment could not be loaded"
          onRetry={query.refetch}
        />
      </PageContainer>
    );
  return (
    <AssessmentWorkspace
      workspace={query.data}
      api={api}
      onSaved={query.refetch}
    />
  );
}

export function TeamEvaluationsPage() {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading } = useAuth();
  const allowed = canAccessTeamEvaluations(user);
  const query = useApiQuery<EvaluationWorkEntryDto[]>(
    performanceQueryKeys.teamEvaluationAssignments(),
    (signal) =>
      api.get(performancePaths.teamEvaluationAssignments(), { signal }),
    { enabled: allowed }
  );
  const router = useRouter();
  if (isLoading || query.isLoading)
    return (
      <PageContainer>
        <PageListSkeleton />
      </PageContainer>
    );
  if (!allowed)
    return (
      <PageContainer>
        <PagePermissionNotice
          title="Team evaluations unavailable"
          description="Team evaluation access is required."
        />
      </PageContainer>
    );
  if (query.error)
    return (
      <PageContainer>
        <PageError
          title="Team evaluations could not be loaded"
          onRetry={query.refetch}
        />
      </PageContainer>
    );
  const entries = query.data ?? [];
  const rounds = [
    ...new Map(entries.map((entry) => [entry.round.round.id, entry])).values(),
  ];
  return (
    <PageContainer width="wide">
      <PageHeader title="Team evaluations" />
      {!rounds.length ? (
        <PageEmpty icon={UsersRound} title="No team evaluation work" />
      ) : (
        <div className="flex flex-col gap-3">
          {rounds.map((round) => (
            <button
              key={round.round.round.id}
              type="button"
              onClick={() =>
                router.push(`/team-evaluations/${round.round.round.id}`)
              }
              className="text-left"
            >
              <Card className="hover:border-primary/50">
                <CardContent className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        tone={
                          round.round.round.operationalState === "Overdue"
                            ? "danger"
                            : "info"
                        }
                      >
                        {round.round.round.operationalState}
                      </StatusBadge>
                      <Badge variant="outline">
                        {
                          entries.filter(
                            (entry) =>
                              entry.round.round.id === round.round.round.id
                          ).length
                        }{" "}
                        assignments
                      </Badge>
                    </div>
                    <h2 className="mt-2 font-semibold">
                      {round.round.round.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(round.round.round.managerAssessmentDeadline)}
                    </p>
                  </div>
                  <ArrowRight className="text-muted-foreground" />
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export function TeamEvaluationRoundPage({ roundId }: { roundId: string }) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading } = useAuth();
  const allowed = canAccessTeamEvaluations(user);
  const query = useApiQuery<TeamQueueDto>(
    performanceQueryKeys.teamAssessmentQueue(roundId),
    (signal) =>
      api.get(performancePaths.teamAssessmentQueue(roundId), { signal }),
    { enabled: allowed }
  );
  const router = useRouter();
  if (isLoading || query.isLoading)
    return (
      <PageContainer width="wide">
        <PageListSkeleton />
      </PageContainer>
    );
  if (!allowed)
    return (
      <PageContainer>
        <PagePermissionNotice
          title="Team evaluations unavailable"
          description="Team evaluation access is required."
        />
      </PageContainer>
    );
  if (query.error || !query.data)
    return (
      <PageContainer>
        <PageError
          title="Team queue could not be loaded"
          onRetry={query.refetch}
        />
      </PageContainer>
    );
  const items = [...query.data.items].sort(
    (a, b) =>
      Number(b.actionable) - Number(a.actionable) ||
      b.materialDifferenceCount - a.materialDifferenceCount ||
      Number(a.selfSubmitted) - Number(b.selfSubmitted)
  );
  return (
    <PageContainer width="wide">
      <PageHeader
        title={query.data.roundName}
        description="Team evaluation queue"
      />
      <div className="divide-y rounded-xl border">
        {items.map((item) => (
          <button
            key={item.participantEmployeeId}
            type="button"
            onClick={() =>
              router.push(
                `/team-evaluations/${roundId}/${item.participantEmployeeId}`
              )
            }
            className={cn(
              "flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-muted/40",
              !item.actionable && "opacity-60"
            )}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.participantName}</span>
                {item.materialDifferenceCount > 0 ? (
                  <Badge variant="destructive">
                    {item.materialDifferenceCount} material difference
                    {item.materialDifferenceCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.nextAction} · {formatDate(item.deadline)}
              </p>
            </div>
            <StatusBadge tone={item.actionable ? "info" : "muted"}>
              {item.status}
            </StatusBadge>
          </button>
        ))}
      </div>
    </PageContainer>
  );
}

export function ParticipantAssessmentWorkspacePage({
  roundId,
  participantId,
}: {
  roundId: string;
  participantId: string;
}) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading } = useAuth();
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
  if (isLoading || query.isLoading)
    return (
      <PageContainer width="wide">
        <PageListSkeleton />
      </PageContainer>
    );
  if (!allowed)
    return (
      <PageContainer>
        <PagePermissionNotice
          title="Assessment unavailable"
          description="Team evaluation access is required."
        />
      </PageContainer>
    );
  if (query.error || !query.data)
    return (
      <PageContainer>
        <PageError
          title="Participant assessment could not be loaded"
          onRetry={query.refetch}
        />
      </PageContainer>
    );
  return (
    <ParticipantWorkspace
      workspace={query.data}
      api={api}
      onSaved={query.refetch}
    />
  );
}

function AssessmentWorkspace({
  workspace,
  api,
  onSaved,
}: {
  workspace: AssessmentWorkspaceDto;
  api: ReturnType<typeof createPlatformApiClient>;
  onSaved: () => Promise<unknown>;
}) {
  const [section, setSection] = useState("Objectives");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const save = useApiMutation<
    AssessmentWorkspaceDto,
    SaveAssessmentDraftRequest
  >(
    (body) =>
      api.post(
        performancePaths.saveSelfAssessmentDraft(workspace.assignmentId),
        body
      ),
    {
      onSuccess: async () => {
        toast.success("Draft saved");
        await onSaved();
      },
    }
  );
  const submit = useApiMutation<AssessmentWorkspaceDto, void>(
    () =>
      api.post(
        performancePaths.submitSelfAssessment(workspace.assignmentId),
        {}
      ),
    {
      onSuccess: async () => {
        toast.success("Assessment submitted");
        await onSaved();
      },
    }
  );
  const editable = workspace.editable;
  const saveDraft = () =>
    save.mutate({
      objectiveRatings: Object.entries(ratings)
        .filter(([id]) =>
          workspace.objectives.some((x) => x.objectiveSnapshotId === id)
        )
        .map(([objectiveSnapshotId, ratingOrdinal]) => ({
          objectiveSnapshotId,
          ratingOrdinal,
          comment: comments[objectiveSnapshotId] ?? null,
        })),
      skillRatings: Object.entries(ratings)
        .filter(([id]) =>
          workspace.skills.some((x) => x.skillSnapshotItemId === id)
        )
        .map(([skillSnapshotItemId, proficiencyOrdinal]) => ({
          skillSnapshotItemId,
          proficiencyOrdinal,
          comment: comments[skillSnapshotItemId] ?? null,
        })),
    });
  useEffect(() => {
    if (
      !editable ||
      (!Object.keys(ratings).length && !Object.keys(comments).length)
    )
      return;
    const timer = setTimeout(saveDraft, 800);
    return () => clearTimeout(timer);
  }, [ratings, comments, editable]);
  const missing = incompleteAssessmentItems(workspace, ratings) as [
    { section: string; label: string },
    ...Array<{ section: string; label: string }>,
  ];
  return (
    <PageContainer width="wide">
      <PageHeader
        title={workspace.roundName}
        description={`${workspace.status} · ${formatDate(workspace.deadline)}`}
      />
      {workspace.result ? (
        <ResultSurface workspace={workspace} api={api} onSaved={onSaved} />
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav
          className="flex gap-2 overflow-x-auto lg:flex-col"
          aria-label="Assessment sections"
        >
          {[
            workspace.includesObjectives ? "Objectives" : null,
            workspace.includesSkills ? "Skills" : null,
            workspace.questions.length ? "Questions" : null,
          ]
            .filter(Boolean)
            .map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSection(name!)}
                className={cn(
                  "flex shrink-0 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                  section === name
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border text-muted-foreground"
                )}
              >
                {name}
                <span className="text-xs tabular-nums">
                  <CompletionCount
                    workspace={workspace}
                    section={name!}
                    ratings={ratings}
                  />
                </span>
              </button>
            ))}
        </nav>
        <div className="flex flex-col gap-4">
          {section === "Objectives" ? (
            <ObjectiveAuthoring
              workspace={workspace}
              ratings={ratings}
              setRatings={setRatings}
              comments={comments}
              setComments={setComments}
              disabled={!editable}
            />
          ) : null}
          {section === "Skills" ? (
            <SkillAuthoring
              workspace={workspace}
              ratings={ratings}
              setRatings={setRatings}
              comments={comments}
              setComments={setComments}
              disabled={!editable}
            />
          ) : null}
          {section === "Questions" ? (
            <QuestionAuthoring workspace={workspace} />
          ) : null}
          {editable ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={save.isLoading}
                  onClick={saveDraft}
                >
                  Save draft
                </Button>
                <Button
                  disabled={submit.isLoading}
                  onClick={() => {
                    if (missing.length) {
                      toast.error(
                        `${missing.length} incomplete item${missing.length === 1 ? "" : "s"}`
                      );
                      setSection(missing[0].section);
                      return;
                    }
                    saveDraft();
                    submit.mutate();
                  }}
                >
                  Submit
                </Button>
              </div>
              {missing.length ? (
                <p className="text-right text-sm text-destructive">
                  Missing:{" "}
                  {missing
                    .slice(0, 3)
                    .map((item) => item.label)
                    .join(", ")}
                  {missing.length > 3 ? ` +${missing.length - 3}` : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <StatusBadge tone="success">
              Submitted ·{" "}
              {formatDate(workspace.result?.finalizedAt ?? workspace.deadline)}
            </StatusBadge>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function CompletionCount({
  workspace,
  section,
  ratings,
}: {
  workspace: AssessmentWorkspaceDto;
  section: string;
  ratings: Record<string, number>;
}) {
  if (section === "Objectives") {
    const done = workspace.objectives.filter(
      (item) => ratings[item.objectiveSnapshotId] ?? item.myRatingOrdinal
    ).length;
    return (
      <>
        {done} / {workspace.objectives.length}
      </>
    );
  }
  if (section === "Skills") {
    const done = workspace.skills.filter(
      (item) => ratings[item.skillSnapshotItemId] ?? item.myProficiencyOrdinal
    ).length;
    return (
      <>
        {done} / {workspace.skills.length}
      </>
    );
  }
  const done = workspace.questions.filter(
    (item) => item.isNotApplicable || item.myTextAnswer || item.myRatingOrdinal
  ).length;
  return (
    <>
      {done} / {workspace.questions.length}
    </>
  );
}

function incompleteAssessmentItems(
  workspace: AssessmentWorkspaceDto,
  ratings: Record<string, number>
) {
  return [
    ...workspace.objectives
      .filter(
        (item) => !(ratings[item.objectiveSnapshotId] ?? item.myRatingOrdinal)
      )
      .map((item) => ({ section: "Objectives", label: item.title })),
    ...workspace.skills
      .filter(
        (item) =>
          !(ratings[item.skillSnapshotItemId] ?? item.myProficiencyOrdinal)
      )
      .map((item) => ({ section: "Skills", label: item.skillName })),
    ...workspace.questions
      .filter(
        (item) =>
          item.isRequired &&
          !item.isNotApplicable &&
          !item.myTextAnswer &&
          !item.myRatingOrdinal
      )
      .map((item) => ({ section: "Questions", label: item.prompt })),
  ];
}

function ResultSurface({
  workspace,
  api,
  onSaved,
}: {
  workspace: AssessmentWorkspaceDto;
  api: ReturnType<typeof createPlatformApiClient>;
  onSaved: () => Promise<unknown>;
}) {
  const result = workspace.result!;
  const [comment, setComment] = useState("");
  const acknowledge = useApiMutation<
    AssessmentWorkspaceDto,
    AcknowledgeEvaluationRequest
  >(
    (body) =>
      api.post(
        performancePaths.acknowledgeEvaluation(
          workspace.managerAssignmentId ?? workspace.assignmentId
        ),
        body
      ),
    {
      onSuccess: async () => {
        toast.success("Evaluation acknowledged");
        await onSaved();
      },
    }
  );
  return (
    <Card className="mb-6 overflow-hidden">
      <CardContent className="flex flex-col gap-6 p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Final result</p>
            <p className="text-6xl font-semibold tabular-nums tracking-tight">
              {result.finalScore?.toFixed(1) ?? "—"}
            </p>
            <p className="mt-1 text-lg font-medium">
              {result.finalRatingLabel ?? "No rating"}
            </p>
          </div>
          <StatusBadge tone={result.acknowledgedAt ? "success" : "info"}>
            {result.acknowledgedAt ? "Acknowledged" : "Finalized"}
          </StatusBadge>
        </div>
        <div
          aria-label={`Weight split: ${result.objectivesWeightPercent}% objectives, ${result.skillsWeightPercent}% skills`}
        >
          <div className="mb-2 flex justify-between text-xs font-medium">
            <span>Objectives {result.objectivesWeightPercent}%</span>
            <span>Skills {result.skillsWeightPercent}%</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-primary"
              style={{ width: `${result.objectivesWeightPercent}%` }}
            />
            <div
              className="bg-foreground/40"
              style={{ width: `${result.skillsWeightPercent}%` }}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultMetric
            label="Objectives rating"
            value={`${result.overallObjectivesRatingOrdinal ?? "—"} · ${result.overallObjectivesRatingLabel ?? "—"}`}
          />
          <ResultMetric
            label="Skills rating"
            value={
              result.skillsWeightPercent > 0
                ? `${result.overallSkillsRatingOrdinal ?? "—"} · ${result.overallSkillsRatingLabel ?? "—"}`
                : "Not included"
            }
          />
        </div>
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Ratings and comments</h2>
          <div className="divide-y rounded-xl border">
            {workspace.objectives.map((item) => (
              <div
                key={item.objectiveSnapshotId}
                className="grid gap-3 p-3 sm:grid-cols-2"
              >
                <div>
                  <span className="font-medium">{item.title}</span>
                  <p className="text-sm text-muted-foreground">{item.myComment ?? "No employee comment"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>Mine: {item.myRatingOrdinal ?? "—"}</span>
                  <span>Manager: {item.managerRatingOrdinal ?? "—"}</span>
                  <span className="col-span-2 text-muted-foreground">{item.managerComment ?? "No manager comment"}</span>
                </div>
              </div>
            ))}
            {workspace.skills.map((item) => (
              <div key={item.skillSnapshotItemId} className="grid gap-3 p-3 sm:grid-cols-2">
                <div>
                  <span className="font-medium">{item.skillName}</span>
                  <p className="text-sm text-muted-foreground">{item.myComment ?? "No employee comment"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>Mine: {item.myProficiencyOrdinal ?? "—"}</span>
                  <span>Manager: {item.managerProficiencyOrdinal ?? "—"}</span>
                  <span className="col-span-2 text-muted-foreground">{item.managerComment ?? "No manager comment"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        {result.discussionSummary ? (
          <section>
            <h2 className="font-semibold">Discussion summary</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {result.discussionSummary}
            </p>
          </section>
        ) : null}
        {!result.acknowledgedAt ? (
          <section className="flex flex-col gap-3 border-t pt-4">
            <Field>
              <FieldLabel htmlFor="acknowledgement-comment">
                Acknowledgement comment{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLabel>
              <Textarea
                id="acknowledgement-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </Field>
            <Button
              className="self-start"
              disabled={acknowledge.isLoading}
              onClick={() =>
                acknowledge.mutate({ comment: comment.trim() || null })
              }
            >
              Acknowledge
            </Button>
          </section>
        ) : (
          <p className="text-xs text-muted-foreground">
            Acknowledged {formatDate(result.acknowledgedAt)}
            {result.acknowledgementComment
              ? ` · ${result.acknowledgementComment}`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function ObjectiveAuthoring({
  workspace,
  ratings,
  setRatings,
  comments,
  setComments,
  disabled,
}: any) {
  return (
    <div className="flex flex-col gap-3">
      {workspace.objectives.map((item: any) => (
        <Card key={item.objectiveSnapshotId}>
          <CardContent className="flex flex-col gap-3 p-5">
            <div>
              <h2 className="font-medium">{item.title}</h2>
              <p className="text-sm text-muted-foreground">
                {item.measurementIndicator ??
                  item.description ??
                  "Frozen objective"}
              </p>
            </div>
            <LevelButtons
              levels={workspace.performanceScale}
              value={ratings[item.objectiveSnapshotId] ?? item.myRatingOrdinal}
              onChange={(value) =>
                setRatings({ ...ratings, [item.objectiveSnapshotId]: value })
              }
              disabled={disabled}
            />
            <Textarea
              disabled={disabled}
              value={comments[item.objectiveSnapshotId] ?? item.myComment ?? ""}
              onChange={(e) =>
                setComments({
                  ...comments,
                  [item.objectiveSnapshotId]: e.target.value,
                })
              }
              placeholder="Comment"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function SkillAuthoring({
  workspace,
  ratings,
  setRatings,
  comments,
  setComments,
  disabled,
}: any) {
  return (
    <div className="flex flex-col gap-3">
      {workspace.skills.map((item: any) => (
        <Card key={item.skillSnapshotItemId}>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium">{item.skillName}</h2>
                <p className="text-sm text-muted-foreground">
                  {item.categoryName}
                </p>
              </div>
              <Badge variant="outline">
                Expected {item.expectedLevelLabel ?? item.expectedLevelOrdinal}
              </Badge>
            </div>
            <LevelButtons
              levels={workspace.proficiencyScale}
              value={
                ratings[item.skillSnapshotItemId] ?? item.myProficiencyOrdinal
              }
              onChange={(value) =>
                setRatings({ ...ratings, [item.skillSnapshotItemId]: value })
              }
              disabled={disabled}
            />
            <Textarea
              disabled={disabled}
              value={comments[item.skillSnapshotItemId] ?? item.myComment ?? ""}
              onChange={(e) =>
                setComments({
                  ...comments,
                  [item.skillSnapshotItemId]: e.target.value,
                })
              }
              placeholder="Comment"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function QuestionAuthoring({
  workspace,
}: {
  workspace: AssessmentWorkspaceDto;
}) {
  return (
    <div className="flex flex-col gap-3">
      {workspace.questions.map((q) => (
        <QuestionCard
          key={q.questionSnapshotId}
          question={q}
          editable={workspace.editable}
        />
      ))}
    </div>
  );
}
function QuestionCard({
  question,
  editable,
}: {
  question: AssessmentWorkspaceDto["questions"][number];
  editable: boolean;
}) {
  const [notApplicable, setNotApplicable] = useState(question.isNotApplicable);
  const [reason, setReason] = useState(question.notApplicableReason ?? "");
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <Field>
          <FieldLabel>
            {question.prompt}
            {question.isRequired ? " *" : ""}
          </FieldLabel>
          {notApplicable ? (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              Not applicable
            </div>
          ) : (
            <Textarea
              defaultValue={question.myTextAnswer ?? ""}
              disabled={!editable}
            />
          )}
        </Field>
        {question.allowNotApplicable ? (
          <Button
            type="button"
            variant={notApplicable ? "secondary" : "outline"}
            size="sm"
            disabled={!editable}
            onClick={() => setNotApplicable(!notApplicable)}
          >
            Not applicable
          </Button>
        ) : null}
        {notApplicable && question.isRequired ? (
          <Field>
            <FieldLabel>Reason</FieldLabel>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!editable}
            />
          </Field>
        ) : null}
      </CardContent>
    </Card>
  );
}
function LevelButtons({
  levels,
  value,
  onChange,
  disabled,
}: {
  levels: Array<{ ordinal: number; label: string }>;
  value: number | null | undefined;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-1" role="radiogroup">
      {levels.map((level) => (
        <button
          key={level.ordinal}
          type="button"
          disabled={disabled}
          aria-pressed={value === level.ordinal}
          onClick={() => onChange(level.ordinal)}
          className={cn(
            "flex min-w-0 flex-1 flex-col rounded-lg border px-2 py-2 text-left",
            value === level.ordinal
              ? "border-primary bg-primary/10"
              : "border-border",
            disabled && "cursor-default opacity-70"
          )}
        >
          <span className="font-semibold tabular-nums">{level.ordinal}</span>
          <span className="truncate text-xs">{level.label}</span>
        </button>
      ))}
    </div>
  );
}

function ParticipantWorkspace({
  workspace,
  api,
  onSaved,
}: {
  workspace: ParticipantWorkspaceDto;
  api: ReturnType<typeof createPlatformApiClient>;
  onSaved: () => Promise<unknown>;
}) {
  return (
    <PageContainer width="wide">
      <PageHeader
        title={workspace.participantName}
        description={`${workspace.roundName} · ${workspace.managerStatus}`}
      />
      {!workspace.actionable ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-muted-foreground" />
              <h2 className="font-semibold">
                {workspace.selfMissing
                  ? "No self-assessment submitted"
                  : "Awaiting self-assessment"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {workspace.selfMissing
                ? "The self-assessment deadline passed without a submission."
                : "Manager access opens after employee submission."}
            </p>
            <FrozenContext workspace={workspace} />
          </CardContent>
        </Card>
      ) : (
        <ParticipantEditable
          workspace={workspace}
          api={api}
          onSaved={onSaved}
        />
      )}
    </PageContainer>
  );
}
function FrozenContext({ workspace }: { workspace: ParticipantWorkspaceDto }) {
  return (
    <div className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
      <ResultMetric
        label="Objectives"
        value={`${workspace.objectives.length} items · ${workspace.objectivesWeightPercent}%`}
      />
      <ResultMetric
        label="Skills"
        value={
          workspace.includesSkills
            ? `${workspace.skills.length} items · ${workspace.skillsWeightPercent}%`
            : "Not included"
        }
      />
      <ResultMetric
        label="Manager due"
        value={formatDate(workspace.managerDeadline)}
      />
    </div>
  );
}
function ParticipantEditable({
  workspace,
  api,
  onSaved,
}: {
  workspace: ParticipantWorkspaceDto;
  api: ReturnType<typeof createPlatformApiClient>;
  onSaved: () => Promise<unknown>;
}) {
  const [section, setSection] = useState("Objectives");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [skillRatings, setSkillRatings] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState("");
  const [objectivesRating, setObjectivesRating] = useState<number | null>(
    workspace.result?.overallObjectivesRatingOrdinal ?? null
  );
  const [skillsRating, setSkillsRating] = useState<number | null>(
    workspace.result?.overallSkillsRatingOrdinal ?? null
  );
  const [reopenReason, setReopenReason] = useState("");
  const headers = { headers: { "If-Match": `"${workspace.managerVersion}"` } };
  const save = useApiMutation<
    ParticipantWorkspaceDto,
    SaveAssessmentDraftRequest
  >(
    (body) =>
      api.post(
        performancePaths.saveManagerAssessmentDraft(
          workspace.managerAssignmentId
        ),
        body
      ),
    {
      onSuccess: async () => {
        toast.success("Manager draft saved");
        await onSaved();
      },
    }
  );
  const submit = useApiMutation<ParticipantWorkspaceDto, void>(
    () =>
      api.post(
        performancePaths.submitManagerAssessment(workspace.managerAssignmentId),
        {},
        headers
      ),
    {
      onSuccess: async () => {
        toast.success("Manager assessment submitted");
        await onSaved();
      },
    }
  );
  const finalize = useApiMutation<
    ParticipantWorkspaceDto,
    FinalizeEvaluationRequest
  >(
    (body) =>
      api.post(
        performancePaths.finalizeEvaluation(workspace.managerAssignmentId),
        body,
        headers
      ),
    {
      onSuccess: async () => {
        toast.success("Evaluation finalized");
        await onSaved();
      },
    }
  );
  const saveBody = {
    objectiveRatings: Object.entries(ratings).map(
      ([objectiveSnapshotId, ratingOrdinal]) => ({
        objectiveSnapshotId,
        ratingOrdinal,
      })
    ),
    skillRatings: Object.entries(skillRatings).map(
      ([skillSnapshotItemId, proficiencyOrdinal]) => ({
        skillSnapshotItemId,
        proficiencyOrdinal,
      })
    ),
  };
  const sections = [
    workspace.includesObjectives ? "Objectives" : null,
    workspace.includesSkills ? "Skills" : null,
    workspace.questions.length ? "Questions" : null,
    workspace.managerStatus === "Submitted" ? "Summary" : null,
  ].filter(Boolean) as string[];
  const reopen = useApiMutation<
    ParticipantWorkspaceDto,
    ReopenSelfAssessmentRequest
  >(
    (body) =>
      workspace.selfAssignmentId
        ? api.post(
            performancePaths.reopenSelfAssessment(workspace.selfAssignmentId),
            body,
            headers
          )
        : Promise.reject(new Error("Self-assessment is unavailable")),
    {
      onSuccess: async () => {
        toast.success("Self-assessment reopened");
        await onSaved();
      },
    }
  );
  return (
    <div className="flex flex-col gap-4">
      {workspace.result ? (
        <ManagerResultSurface result={workspace.result} />
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav
          className="flex gap-2 overflow-x-auto lg:flex-col"
          aria-label="Participant assessment sections"
        >
          {sections.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSection(name)}
              className={cn(
                "flex shrink-0 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                section === name
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border text-muted-foreground"
              )}
            >
              {name}
              {name === "Skills" && (
                <span className="text-xs">
                  {workspace.skillsBelowExpectation} below
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="flex flex-col gap-4">
          {section === "Objectives" ? (
            <ComparisonObjectives
              workspace={workspace}
              ratings={ratings}
              setRatings={setRatings}
            />
          ) : null}
          {section === "Skills" ? (
            <ComparisonSkills
              workspace={workspace}
              skillRatings={skillRatings}
              setSkillRatings={setSkillRatings}
            />
          ) : null}
          {section === "Questions" ? (
            <div className="divide-y rounded-xl border">
              {workspace.questions.map((item) => (
                <div
                  key={item.questionSnapshotId}
                  className="grid gap-2 p-4 sm:grid-cols-2"
                >
                  <span className="font-medium">{item.prompt}</span>
                  <span className="text-sm text-muted-foreground">
                    Employee:{" "}
                    {item.selfNotApplicable
                      ? "Not applicable"
                      : (item.selfTextAnswer ?? item.selfRatingOrdinal ?? "—")}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {section === "Summary" ? (
            <FinalizePanel
              workspace={workspace}
              objectivesRating={objectivesRating}
              setObjectivesRating={setObjectivesRating}
              skillsRating={skillsRating}
              setSkillsRating={setSkillsRating}
              summary={summary}
              setSummary={setSummary}
              finalize={finalize}
              reopenReason={reopenReason}
              setReopenReason={setReopenReason}
              reopen={reopen}
            />
          ) : null}
          {workspace.managerStatus !== "Submitted" &&
          workspace.managerStatus !== "Finalized" ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => save.mutate(saveBody)}>
                Save draft
              </Button>
              <Button
                onClick={() => {
                  save.mutate(saveBody);
                  submit.mutate();
                }}
              >
                <Check data-icon="inline-start" />
                Submit
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ManagerResultSurface({
  result,
}: {
  result: NonNullable<ParticipantWorkspaceDto["result"]>;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Final result</p>
          <p className="text-5xl font-semibold tabular-nums">
            {result.finalScore?.toFixed(1) ?? "—"}
          </p>
          <p className="font-medium">{result.finalRatingLabel ?? "—"}</p>
        </div>
        <div className="text-right text-sm">
          <p>Objectives {result.overallObjectivesRatingLabel ?? "—"}</p>
          <p>
            Skills{" "}
            {result.skillsWeightPercent > 0
              ? (result.overallSkillsRatingLabel ?? "—")
              : "Not included"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonObjectives({
  workspace,
  ratings,
  setRatings,
}: {
  workspace: ParticipantWorkspaceDto;
  ratings: Record<string, number>;
  setRatings: (value: Record<string, number>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {workspace.objectives.map((item) => {
        const value =
          ratings[item.objectiveSnapshotId] ?? item.managerRatingOrdinal;
        return (
          <Card
            key={item.objectiveSnapshotId}
            className={
              item.materialDifference ? "border-destructive" : undefined
            }
          >
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">{item.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {item.measurementIndicator ??
                      item.description ??
                      "Frozen objective"}
                  </p>
                </div>
                {item.materialDifference ? (
                  <Badge variant="destructive">Material difference</Badge>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ResultMetric
                  label="Employee"
                  value={String(item.selfRatingOrdinal ?? "—")}
                />
                <ResultMetric label="Manager" value={String(value ?? "—")} />
              </div>
              <LevelButtons
                levels={workspace.performanceScale}
                value={value}
                onChange={(next) =>
                  setRatings({ ...ratings, [item.objectiveSnapshotId]: next })
                }
                disabled={workspace.managerStatus === "Finalized"}
              />
              <p className="text-sm text-muted-foreground">
                Employee comment: {item.selfComment ?? "—"}
              </p>
              {workspace.managerStatus === "Finalized" ? (
                <p className="text-sm text-muted-foreground">
                  Manager comment: {item.managerComment ?? "—"}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
function ComparisonSkills({
  workspace,
  skillRatings,
  setSkillRatings,
}: {
  workspace: ParticipantWorkspaceDto;
  skillRatings: Record<string, number>;
  setSkillRatings: (value: Record<string, number>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {workspace.skills.map((item) => {
        const value =
          skillRatings[item.skillSnapshotItemId] ??
          item.managerProficiencyOrdinal;
        return (
          <Card
            key={item.skillSnapshotItemId}
            className={
              item.materialDifference || item.gapState === "Below"
                ? "border-destructive"
                : undefined
            }
          >
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">{item.skillName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {item.categoryName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.materialDifference ? (
                    <Badge variant="destructive">Material difference</Badge>
                  ) : null}
                  {item.gapState ? (
                    <Badge variant="outline">{item.gapState} expectation</Badge>
                  ) : null}
                </div>
              </div>
              <LevelTrack
                levels={workspace.proficiencyScale}
                expected={item.expectedLevelOrdinal}
                self={item.selfProficiencyOrdinal}
                manager={value}
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <ResultMetric
                  label="Expected"
                  value={String(item.expectedLevelOrdinal)}
                />
                <ResultMetric
                  label="Employee"
                  value={String(item.selfProficiencyOrdinal ?? "—")}
                />
                <ResultMetric label="Manager" value={String(value ?? "—")} />
              </div>
              <LevelButtons
                levels={workspace.proficiencyScale}
                value={value}
                onChange={(next) =>
                  setSkillRatings({
                    ...skillRatings,
                    [item.skillSnapshotItemId]: next,
                  })
                }
                disabled={workspace.managerStatus === "Finalized"}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
function LevelTrack({
  levels,
  expected,
  self,
  manager,
}: {
  levels: Array<{ ordinal: number; label: string }>;
  expected: number;
  self: number | null;
  manager: number | null;
}) {
  const max = Math.max(...levels.map((level) => level.ordinal), 1);
  const marker = (value: number | null, label: string, className: string) =>
    value == null ? null : (
      <span
        className={cn("absolute top-0 h-9 w-0.5", className)}
        style={{ left: `${((value - 1) / Math.max(max - 1, 1)) * 100}%` }}
        title={`${label}: ${value}`}
        aria-label={`${label}: ${value}`}
      />
    );
  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative h-9 rounded-full bg-muted"
        aria-label="Expected, employee, and manager proficiency markers"
      >
        {marker(expected, "Expected", "bg-amber-600")}
        {marker(self, "Employee", "bg-sky-600")}
        {marker(manager, "Manager", "bg-emerald-600")}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        {levels.map((level) => (
          <span key={level.ordinal} className="tabular-nums">
            {level.ordinal}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-600" />
          Expected
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-600" />
          Employee
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-600" />
          Manager
        </span>
      </div>
    </div>
  );
}
function FinalizePanel({
  workspace,
  objectivesRating,
  setObjectivesRating,
  skillsRating,
  setSkillsRating,
  summary,
  setSummary,
  finalize,
  reopenReason,
  setReopenReason,
  reopen,
}: any) {
  const submitted = workspace.managerStatus === "Submitted";
  const objectiveMean = workspace.meanManagerObjectiveRating ?? 0;
  const objectiveWeight = workspace.objectivesWeightPercent / 100;
  const skillsWeight = workspace.skillsWeightPercent / 100;
  const preview =
    objectivesRating == null
      ? null
      : Math.round(
          (objectivesRating * objectiveWeight +
            (skillsWeight > 0 && skillsRating != null ? skillsRating : 0) *
              skillsWeight) *
            10
        ) / 10;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-semibold">Finalize evaluation</h2>
          <p className="text-sm text-muted-foreground">
            {workspace.meanManagerObjectiveRating
              ? `Objective mean ${workspace.meanManagerObjectiveRating}`
              : "Objective mean —"}{" "}
            · {workspace.skillsBelowExpectation} skill gaps
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Weighted result preview
          </p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">
            {preview?.toFixed(1) ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {objectiveMean
              ? `Current objective mean ${objectiveMean}; area selectors drive the final result.`
              : "Choose area ratings to preview the result."}
          </p>
        </div>
        <Field>
          <FieldLabel>Objectives area rating</FieldLabel>
          <LevelButtons
            levels={workspace.performanceScale}
            value={objectivesRating}
            onChange={setObjectivesRating}
            disabled={!submitted}
          />
        </Field>
        {workspace.includesSkills ? (
          <Field>
            <FieldLabel>Skills area rating</FieldLabel>
            <LevelButtons
              levels={workspace.performanceScale}
              value={skillsRating}
              onChange={setSkillsRating}
              disabled={!submitted}
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="discussion-summary">
            Discussion summary
          </FieldLabel>
          <Textarea
            id="discussion-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={!submitted}
          />
        </Field>
        <Button
          disabled={
            !submitted ||
            !summary.trim() ||
            !objectivesRating ||
            (workspace.includesSkills && !skillsRating) ||
            finalize.isLoading
          }
          onClick={() =>
            finalize.mutate({
              overallObjectivesRatingOrdinal: objectivesRating,
              overallSkillsRatingOrdinal: workspace.includesSkills
                ? skillsRating
                : null,
              discussionSummary: summary,
            })
          }
        >
          Finalize evaluation
        </Button>
        {workspace.managerStatus === "Submitted" ? (
          <div className="border-t pt-4">
            <Field>
              <FieldLabel htmlFor="reopen-reason">
                Reopen self-assessment reason
              </FieldLabel>
              <Input
                id="reopen-reason"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
              />
            </Field>
            <Button
              variant="outline"
              className="mt-2"
              disabled={
                !reopenReason.trim() ||
                reopen.isLoading ||
                !workspace.selfAssignmentId
              }
              onClick={() => reopen.mutate({ reason: reopenReason.trim() })}
            >
              <RotateCcw data-icon="inline-start" />
              Reopen self-assessment
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(value)
      )
    : "No deadline";
}
