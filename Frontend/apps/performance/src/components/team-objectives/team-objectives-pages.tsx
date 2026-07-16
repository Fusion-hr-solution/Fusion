"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronRight, Pencil, Plus, Target, Trash2, Users } from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  MyTeamObjectiveCampaignDto,
  TeamObjectiveDto,
  TeamObjectiveWorkspaceDto,
  UpsertTeamObjectiveRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { canAccessTeamObjectives, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/controls/confirm-dialog";
import { formatDate, measurementMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  teamObjectiveEditor,
  teamObjectiveTerms,
} from "@/components/campaigns/campaign-terminology";
import {
  CascadeRow,
  COVERED_COLOR,
  Leaf,
  LeafBody,
  LaneEmptyBranch,
  PersonRow,
} from "@/components/cascade-coverage/cascade-visuals";
import {
  TeamObjectiveEditorDialog,
  type TeamObjectiveEditorState,
} from "./team-objective-editor-dialog";

// ── Manager door: my team-objective campaigns ────────────────────────────────

export function TeamObjectiveCampaignsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canManage = canAccessTeamObjectives(user);

  const { data, error, isLoading, refetch } = useApiQuery<MyTeamObjectiveCampaignDto[]>(
    performanceQueryKeys.myTeamObjectiveCampaigns(),
    (signal) =>
      apiClient.get<MyTeamObjectiveCampaignDto[]>(
        performancePaths.myTeamObjectiveCampaigns(),
        { signal },
      ),
    { enabled: canManage },
  );

  if (authLoading) {
    return <TeamObjectiveListSkeleton />;
  }

  if (!canManage) {
    return (
      <PageContainer>
        <PageHeader title={teamObjectiveTerms.listTitle} />
        <PagePermissionNotice title="Team objective access required" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={teamObjectiveTerms.listTitle} />

      {isLoading ? <TeamObjectiveListSkeleton /> : null}
      {!isLoading && error ? (
        <PageError title="Could not load your campaigns" description="Try again." onRetry={refetch} />
      ) : null}

      {!isLoading && !error && data ? (
        data.length === 0 ? (
          <PageEmpty
            title={teamObjectiveTerms.emptyList.title}
            description={teamObjectiveTerms.emptyList.description}
          />
        ) : (
          <div className="space-y-3">
            {data.map((campaign, index) =>
              index === 0 ? (
                <TeamObjectiveCampaignHero key={campaign.id} campaign={campaign} />
              ) : (
                <TeamObjectiveCampaignRow key={campaign.id} campaign={campaign} />
              ),
            )}
          </div>
        )
      ) : null}
    </PageContainer>
  );
}

/** The lead campaign as a commanding door: your scope and what you've authored, read at a glance. */
function TeamObjectiveCampaignHero({ campaign }: { campaign: MyTeamObjectiveCampaignDto }) {
  const planningOpen =
    !!campaign.planningOpeningDate && new Date(campaign.planningOpeningDate) <= new Date();

  return (
    <Link
      href={`/team-objectives/${campaign.slug}`}
      className="group block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={planningOpen ? "success" : "info"} dot>
              {planningOpen
                ? teamObjectiveTerms.liveTag
                : campaign.planningOpeningDate
                  ? teamObjectiveTerms.planningOpens(formatDate(campaign.planningOpeningDate))
                  : "Scheduled"}
            </StatusBadge>
            {campaign.referenceYear ? (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {campaign.referenceYear}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
            {campaign.name}
          </h2>
        </div>

        <div className="flex items-center gap-8 lg:shrink-0">
          <div>
            <p className="font-heading text-3xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
              {campaign.scopeParticipantCount}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{teamObjectiveTerms.scopeLabel}</p>
          </div>
          <div>
            <p
              className={cn(
                "font-heading text-3xl font-semibold leading-none tabular-nums tracking-tight",
                campaign.myTeamObjectiveCount > 0 ? "text-foreground" : "text-muted-foreground/60",
              )}
            >
              {campaign.myTeamObjectiveCount}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {teamObjectiveTerms.objectivesAuthored}
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

/** Secondary campaigns — compact row. */
function TeamObjectiveCampaignRow({ campaign }: { campaign: MyTeamObjectiveCampaignDto }) {
  return (
    <Link
      href={`/team-objectives/${campaign.slug}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-foreground">{campaign.name}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-3.5" />
          {teamObjectiveTerms.scopeParticipants(campaign.scopeParticipantCount)}
          <span aria-hidden>·</span>
          <Target className="size-3.5" />
          {teamObjectiveTerms.objectiveCount(campaign.myTeamObjectiveCount)}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// ── Manager workspace: the campaign cascade cockpit ──────────────────────────

export function TeamObjectiveWorkspacePage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? "";
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canManage = canAccessTeamObjectives(user);

  const [editor, setEditor] = useState<TeamObjectiveEditorState | null>(null);
  const [editorErrors, setEditorErrors] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<TeamObjectiveDto | null>(null);

  const {
    data: workspace,
    error,
    isLoading,
    refetch,
  } = useApiQuery<TeamObjectiveWorkspaceDto>(
    performanceQueryKeys.teamObjectiveWorkspace(slug),
    (signal) =>
      apiClient.get<TeamObjectiveWorkspaceDto>(
        performancePaths.teamObjectiveWorkspace(slug),
        { signal },
      ),
    { enabled: canManage && !!slug },
  );

  const cycleId = workspace?.cycleId ?? "";

  /** Latest version of an objective, so a conflict retry uses fresh data after refetch. */
  const latestVersion = (objectiveId: string) =>
    workspace?.myTeamObjectives.find((item) => item.id === objectiveId)?.version ?? 0;

  const create = useApiMutation<TeamObjectiveDto, UpsertTeamObjectiveRequest>(
    (request) =>
      apiClient.post<TeamObjectiveDto>(performancePaths.teamObjectives(cycleId), request),
    {
      onSuccess: async () => {
        toast.success(teamObjectiveEditor.created);
        setEditor(null);
        setEditorErrors([]);
        await refetch();
      },
      onError: async (mutationError) => {
        setEditorErrors(editorErrorMessages(mutationError));
        await refetch();
      },
    },
  );

  const update = useApiMutation<
    TeamObjectiveDto,
    { objectiveId: string; request: UpsertTeamObjectiveRequest }
  >(
    ({ objectiveId, request }) =>
      apiClient.put<TeamObjectiveDto>(
        performancePaths.teamObjective(cycleId, objectiveId),
        request,
        { headers: { "If-Match": `"${latestVersion(objectiveId)}"` } },
      ),
    {
      onSuccess: async () => {
        toast.success(teamObjectiveEditor.updated);
        setEditor(null);
        setEditorErrors([]);
        await refetch();
      },
      onError: async (mutationError) => {
        setEditorErrors(editorErrorMessages(mutationError));
        await refetch();
      },
    },
  );

  const remove = useApiMutation<void, TeamObjectiveDto>(
    (objective) =>
      apiClient.delete<void>(performancePaths.teamObjective(cycleId, objective.id), {
        headers: { "If-Match": `"${objective.version}"` },
      }),
    {
      onSuccess: async () => {
        toast.success(teamObjectiveEditor.deleted);
        setDeleting(null);
        await refetch();
      },
      onError: async (mutationError) => {
        setDeleting(null);
        toast.error(editorErrorMessages(mutationError)[0]);
        await refetch();
      },
    },
  );

  if (authLoading) {
    return <TeamObjectiveWorkspaceSkeleton />;
  }

  if (!canManage) {
    return (
      <PageContainer>
        <PageHeader title={teamObjectiveTerms.listTitle} />
        <PagePermissionNotice title="Team objective access required" />
      </PageContainer>
    );
  }

  if (isLoading) {
    return <TeamObjectiveWorkspaceSkeleton />;
  }

  if (error || !workspace) {
    const status = error instanceof ApiError ? error.status : 0;
    const notFound = status === 404;
    const notResponsible = status === 403;
    return (
      <PageContainer>
        <PageHeader title={teamObjectiveTerms.listTitle} />
        {notResponsible ? (
          <PageEmpty
            title="Not your campaign scope"
            description={
              error instanceof ApiError && error.message
                ? error.message
                : "This campaign does not name you as responsible for any participants."
            }
          />
        ) : (
          <PageError
            title={notFound ? "Campaign not found" : "Could not load this workspace"}
            description={notFound ? "It may have been removed, or the link is wrong." : "Try again."}
            onRetry={notFound ? undefined : refetch}
          />
        )}
      </PageContainer>
    );
  }

  const planningOpen =
    !!workspace.planningOpeningDate && new Date(workspace.planningOpeningDate) <= new Date();
  const coveredObjectiveCount = workspace.strategicObjectives.filter((strategicObjective) =>
    workspace.myTeamObjectives.some(
      (objective) => objective.strategicObjectiveId === strategicObjective.id,
    ),
  ).length;
  const isBusy = create.isLoading || update.isLoading;

  const submitEditor = (request: UpsertTeamObjectiveRequest) => {
    setEditorErrors([]);
    if (editor?.mode === "edit" && editor.objective) {
      update.mutate({ objectiveId: editor.objective.id, request });
    } else {
      create.mutate(request);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={workspace.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              {teamObjectiveTerms.scopeParticipants(workspace.myScope.participantCount)}
            </span>
            <span className="flex items-center gap-1.5">
              {planningOpen ? (
                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
              ) : (
                <CalendarClock className="size-3.5" />
              )}
              {planningOpen
                ? teamObjectiveTerms.availabilityNoteOpen
                : teamObjectiveTerms.availabilityNote(formatDate(workspace.planningOpeningDate))}
            </span>
          </span>
        }
        actions={
          <CascadeMeter
            covered={coveredObjectiveCount}
            total={workspace.strategicObjectives.length}
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-3">
          {workspace.strategicObjectives.map((strategicObjective) => (
            <StrategicObjectiveBand
              key={strategicObjective.id}
              strategicObjective={strategicObjective}
              objectives={workspace.myTeamObjectives.filter(
                (objective) => objective.strategicObjectiveId === strategicObjective.id,
              )}
              disabled={isBusy}
              onAdd={() =>
                setEditor({ mode: "create", strategicObjectiveId: strategicObjective.id })
              }
              onEdit={(objective) => setEditor({ mode: "edit", objective })}
              onDelete={(objective) => setDeleting(objective)}
            />
          ))}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <ScopeCard workspace={workspace} />
        </aside>
      </div>

      <TeamObjectiveEditorDialog
        state={editor}
        workspace={workspace}
        isSaving={isBusy}
        errors={editorErrors}
        onSubmit={submitEditor}
        onClose={() => {
          setEditor(null);
          setEditorErrors([]);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        title={teamObjectiveEditor.deleteTitle}
        description={teamObjectiveEditor.deleteDescription}
        confirmLabel={teamObjectiveEditor.deleteConfirm}
        cancelLabel={teamObjectiveEditor.deleteCancel}
        destructive
        onConfirm={() => (deleting ? remove.mutate(deleting) : undefined)}
      />
    </PageContainer>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function StrategicObjectiveBand({
  strategicObjective,
  objectives,
  disabled,
  onAdd,
  onEdit,
  onDelete,
}: {
  strategicObjective: TeamObjectiveWorkspaceDto["strategicObjectives"][number];
  objectives: TeamObjectiveDto[];
  disabled: boolean;
  onAdd: () => void;
  onEdit: (objective: TeamObjectiveDto) => void;
  onDelete: (objective: TeamObjectiveDto) => void;
}) {
  const covered = objectives.length > 0;

  // Action-first default: gaps stay open (the add call is right there), done lanes fold away.
  return (
    <CascadeRow
      covered={covered}
      collapsible
      defaultOpen={!covered}
      title={strategicObjective.title}
      description={strategicObjective.description}
      functionLabel={strategicObjective.responsibleFunctionLabel}
      status={
        <StatusBadge tone={covered ? "success" : "warning"} dot>
          {covered
            ? teamObjectiveTerms.objectiveCount(objectives.length)
            : teamObjectiveTerms.needsObjective}
        </StatusBadge>
      }
    >
      {covered ? (
        <>
          <ul>
            {objectives.map((objective) => (
              <Leaf key={objective.id} last={false}>
                <LeafBody
                  title={objective.title}
                  successLabel={teamObjectiveTerms.successLabel}
                  successCriteria={objective.successCriteria}
                  description={objective.description}
                  measurementLabel={measurementMethodLabel(objective.measurementMethod)}
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${objective.title}`}
                    disabled={disabled}
                    onClick={() => onEdit(objective)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${objective.title}`}
                    className="text-muted-foreground hover:text-destructive"
                    disabled={disabled}
                    onClick={() => onDelete(objective)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </Leaf>
            ))}
          </ul>
          <LaneEmptyBranch>
            <button
              type="button"
              disabled={disabled}
              onClick={onAdd}
              aria-label={`Add team objective — ${strategicObjective.title}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="size-4" />
              {teamObjectiveTerms.addAnotherAction}
            </button>
          </LaneEmptyBranch>
        </>
      ) : (
        <LaneEmptyBranch>
          <button
            type="button"
            disabled={disabled}
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="size-4" />
            {teamObjectiveTerms.addFirstAction}
          </button>
        </LaneEmptyBranch>
      )}
    </CascadeRow>
  );
}

function CascadeMeter({ covered, total }: { covered: number; total: number }) {
  if (total === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2.5"
      role="img"
      aria-label={`${covered} of ${total} strategic objectives covered`}
    >
      {total <= 8 ? (
        <div aria-hidden className="flex items-center gap-1">
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={cn("h-1.5 w-5 rounded-full transition-colors sm:w-6", index >= covered && "bg-border")}
              style={index < covered ? { background: COVERED_COLOR } : undefined}
            />
          ))}
        </div>
      ) : (
        <div aria-hidden className="h-1.5 w-28 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${(covered / total) * 100}%`, background: COVERED_COLOR }}
          />
        </div>
      )}
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {teamObjectiveTerms.cascadeMeter(covered, total)}
      </span>
    </div>
  );
}

function ScopeCard({ workspace }: { workspace: TeamObjectiveWorkspaceDto }) {
  const preview = workspace.myScope.participants.slice(0, 6);
  const overflow = workspace.myScope.participantCount - preview.length;

  return (
    <Card size="sm">
      <CardContent density="compact" className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {teamObjectiveTerms.teamTitle}
          </h2>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {workspace.myScope.participantCount}
          </span>
        </div>

        {workspace.myScope.orgUnitNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {workspace.myScope.orgUnitNames.map((orgUnit) => (
              <Badge key={orgUnit} variant="outline">
                {orgUnit}
              </Badge>
            ))}
          </div>
        ) : null}

        <ul className="space-y-2.5">
          {preview.map((participant) => (
            <PersonRow
              key={participant.employeeId}
              name={participant.fullName}
              secondary={participant.jobTitle ?? participant.orgUnitName ?? undefined}
            />
          ))}
        </ul>
        {overflow > 0 ? (
          <p className="pl-[2.375rem] text-xs text-muted-foreground">
            {teamObjectiveTerms.moreInScope(overflow)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function TeamObjectiveListSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-5" aria-busy aria-label="Loading team objectives">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-7 w-64" />
            </div>
            <div className="flex items-center gap-8">
              <div className="space-y-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="size-5 shrink-0 rounded" />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function TeamObjectiveWorkspaceSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-5" aria-busy aria-label="Loading workspace">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          {/* Left column — strategic objective bands */}
          <div className="min-w-0 space-y-4">
            {[1, 2].map((band) => (
              <section
                key={band}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="bg-muted/40 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <Skeleton className="h-5 w-56" />
                      <Skeleton className="h-3 w-72 max-w-full" />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-md" />
                      <Skeleton className="h-8 w-24 rounded-md" />
                    </div>
                  </div>
                </div>

                <ul>
                  {[1, 2].map((obj) => (
                    <li
                      key={obj}
                      className="flex items-start justify-between gap-3 py-3 pl-10 pr-4"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-64 max-w-full" />
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Skeleton className="h-5 w-16 rounded-md" />
                        <Skeleton className="size-7 rounded-md" />
                        <Skeleton className="size-7 rounded-md" />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* Right sidebar — scope card */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Card size="sm">
              <CardContent density="compact" className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-6" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Skeleton className="size-6 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}

function editorErrorMessages(error: Error): string[] {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.status === 412 || error.status === 428) {
      return [teamObjectiveEditor.conflict];
    }
    if (error.status === 403) {
      return [error.message || "You do not have permission for this team objective action."];
    }
    return error.errors.length > 0 ? error.errors : [error.message];
  }
  return [error.message];
}
