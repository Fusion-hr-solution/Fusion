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
import { canManageTeamObjectives, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/controls/confirm-dialog";
import { formatDate, measurementMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  teamObjectiveEditor,
  teamObjectiveTerms,
} from "@/components/campaigns/campaign-terminology";
import {
  TeamObjectiveEditorDialog,
  type TeamObjectiveEditorState,
} from "./team-objective-editor-dialog";

// ── Manager door: my team-objective campaigns ────────────────────────────────

export function TeamObjectiveCampaignsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canManage = canManageTeamObjectives(user);

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
    return <PageSkeleton />;
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

      {isLoading ? <PageSkeleton /> : null}
      {!isLoading && error ? (
        <PageError title="Could not load your campaigns" description="Try again." onRetry={refetch} />
      ) : null}

      {!isLoading && !error && data ? (
        data.length === 0 ? (
          <PageEmpty
            title={teamObjectiveTerms.emptyList.title}
            description={
              user?.employeeId
                ? teamObjectiveTerms.emptyList.description
                : teamObjectiveTerms.noLinkedEmployee
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((campaign) => (
              <CampaignDoorCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )
      ) : null}
    </PageContainer>
  );
}

function CampaignDoorCard({ campaign }: { campaign: MyTeamObjectiveCampaignDto }) {
  return (
    <Link
      href={`/team-objectives/${campaign.slug}`}
      className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {campaign.referenceYear ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {campaign.referenceYear}
            </p>
          ) : null}
          <h3 className="mt-0.5 truncate text-base font-semibold text-foreground">
            {campaign.name}
          </h3>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarClock className="size-3.5" />
        {campaign.planningOpeningDate
          ? `Planning opens ${formatDate(campaign.planningOpeningDate)}`
          : "Schedule to be announced"}
      </p>

      <Separator className="my-4" />

      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="size-3.5" />
          {teamObjectiveTerms.scopeParticipants(campaign.scopeParticipantCount)}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5",
            campaign.myTeamObjectiveCount > 0
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          )}
        >
          <Target className="size-3.5" />
          {teamObjectiveTerms.objectiveCount(campaign.myTeamObjectiveCount)}
        </span>
      </div>
    </Link>
  );
}

// ── Manager workspace: the campaign cascade cockpit ──────────────────────────

export function TeamObjectiveWorkspacePage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? "";
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canManage = canManageTeamObjectives(user);

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
    return <PageSkeleton />;
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
    return <PageSkeleton />;
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
  const translatedPillarCount = workspace.strategicObjectives.filter((pillar) =>
    workspace.myTeamObjectives.some(
      (objective) => objective.strategicObjectiveId === pillar.id,
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
            translated={translatedPillarCount}
            total={workspace.strategicObjectives.length}
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-4">
          {workspace.strategicObjectives.map((pillar) => (
            <StrategyPillarBand
              key={pillar.id}
              pillar={pillar}
              objectives={workspace.myTeamObjectives.filter(
                (objective) => objective.strategicObjectiveId === pillar.id,
              )}
              disabled={isBusy}
              onAdd={() =>
                setEditor({ mode: "create", strategicObjectiveId: pillar.id })
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

function StrategyPillarBand({
  pillar,
  objectives,
  disabled,
  onAdd,
  onEdit,
  onDelete,
}: {
  pillar: TeamObjectiveWorkspaceDto["strategicObjectives"][number];
  objectives: TeamObjectiveDto[];
  disabled: boolean;
  onAdd: () => void;
  onEdit: (objective: TeamObjectiveDto) => void;
  onDelete: (objective: TeamObjectiveDto) => void;
}) {
  const translated = objectives.length > 0;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        translated ? "border-border" : "border-dashed border-border",
      )}
    >
      <div className="bg-muted/40 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {pillar.title}
            </h2>
            {pillar.description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{pillar.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pillar.responsibleFunctionLabel ? (
              <Badge variant="outline">{pillar.responsibleFunctionLabel}</Badge>
            ) : null}
            {translated ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Add team objective — ${pillar.title}`}
                disabled={disabled}
                onClick={onAdd}
              >
                <Plus /> {teamObjectiveTerms.addAction}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {translated ? (
        <ul className="divide-y divide-border border-t border-border">
          {objectives.map((objective) => (
            <li key={objective.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{objective.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{objective.successCriteria}</p>
                {objective.description ? (
                  <p className="mt-1 text-sm text-muted-foreground/80">{objective.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="secondary">
                  {measurementMethodLabel(objective.measurementMethod)}
                </Badge>
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
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-border px-4 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="size-4" />
          {teamObjectiveTerms.translateAction}
        </button>
      )}
    </section>
  );
}

function CascadeMeter({ translated, total }: { translated: number; total: number }) {
  if (total === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2.5"
      role="img"
      aria-label={`${translated} of ${total} pillars translated`}
    >
      <div aria-hidden className="flex items-center gap-1">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 w-7 rounded-full transition-colors",
              index < translated ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {teamObjectiveTerms.cascadeMeter(translated, total)}
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

        <ul className="space-y-1.5">
          {preview.map((participant) => (
            <li key={participant.employeeId} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{participant.fullName}</span>
              {participant.jobTitle ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {participant.jobTitle}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {overflow > 0 ? (
          <p className="text-xs text-muted-foreground">
            {teamObjectiveTerms.moreInScope(overflow)}
          </p>
        ) : null}
      </CardContent>
    </Card>
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
