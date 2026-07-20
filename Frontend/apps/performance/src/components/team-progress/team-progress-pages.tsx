"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, ChevronRight, LineChart, TrendingUp } from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type TeamProgressCampaignDto,
  type TeamProgressParticipantDetailDto,
  type TeamProgressParticipantDto,
  type TeamProgressWorkspaceDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { canAccessTeamProgress, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PageListSkeleton,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { formatDate, initials, measurementMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ProgressHistoryTimeline } from "@/components/my-objectives/progress/progress-history-timeline";
import {
  ObjectiveStateBadge,
  ProgressMeter,
  toneForObjective,
} from "@/components/my-objectives/progress/progress-visuals";
import { useEvidence } from "@/components/my-objectives/progress/use-evidence";
import { teamProgressTerms } from "@/components/my-objectives/progress/progress-terms";

// ── Door: my team-progress campaigns ─────────────────────────────────────────

export function TeamProgressCampaignsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canAccessTeamProgress(user);

  const { data, error, isLoading, refetch } = useApiQuery<TeamProgressCampaignDto[]>(
    performanceQueryKeys.myTeamProgressCampaigns(),
    (signal) =>
      apiClient.get<TeamProgressCampaignDto[]>(
        performancePaths.myTeamProgressCampaigns(),
        { signal },
      ),
    { enabled: canView },
  );

  if (authLoading || (isLoading && canView)) {
    return (
      <PageContainer>
        <PageHeader title={teamProgressTerms.listTitle} />
        <PageListSkeleton label="Loading team progress" />
      </PageContainer>
    );
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={teamProgressTerms.listTitle} />
        <PagePermissionNotice title={teamProgressTerms.accessTitle} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={teamProgressTerms.listTitle} />

      {error ? (
        <PageError title="Could not load team progress" description="Try again." onRetry={refetch} />
      ) : data?.length ? (
        <div className="space-y-3">
          {data.map((campaign) => (
            <TeamProgressCampaignRow key={campaign.id} campaign={campaign} />
          ))}
        </div>
      ) : (
        <PageEmpty
          title={teamProgressTerms.emptyListTitle}
          description={teamProgressTerms.emptyListDescription}
        />
      )}
    </PageContainer>
  );
}

function TeamProgressCampaignRow({ campaign }: { campaign: TeamProgressCampaignDto }) {
  const attention = campaign.needsAttentionCount > 0;
  return (
    <Link
      href={`/team-progress/${campaign.slug}`}
      className="group flex items-center justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <LineChart className="size-4 text-muted-foreground" />
          <h3 className="truncate text-sm font-semibold text-foreground">{campaign.name}</h3>
          {campaign.referenceYear ? (
            <span className="text-xs text-muted-foreground">{campaign.referenceYear}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {teamProgressTerms.participants(campaign.participantCount)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            attention
              ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
              : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
          )}
        >
          {attention ? teamProgressTerms.attentionCount(campaign.needsAttentionCount) : teamProgressTerms.allOnTrack}
        </span>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

// ── Workspace: attention-first team progress ─────────────────────────────────

export function TeamProgressWorkspacePage() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug ?? "";
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canAccessTeamProgress(user);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: workspace, error, isLoading, refetch } = useApiQuery<TeamProgressWorkspaceDto>(
    performanceQueryKeys.teamProgressWorkspace(slug),
    (signal) =>
      apiClient.get<TeamProgressWorkspaceDto>(
        performancePaths.teamProgressWorkspace(slug),
        { signal },
      ),
    { enabled: canView && !!slug },
  );

  if (authLoading || (isLoading && canView && !!slug)) {
    return (
      <PageContainer>
        <PageHeader title={teamProgressTerms.listTitle} />
        <PageListSkeleton label="Loading team progress" />
      </PageContainer>
    );
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={teamProgressTerms.listTitle} />
        <PagePermissionNotice title={teamProgressTerms.accessTitle} />
      </PageContainer>
    );
  }

  if (error || !workspace) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <PageContainer>
        <PageHeader title={teamProgressTerms.listTitle} />
        {status === 403 ? (
          <PagePermissionNotice title="Team progress access denied" />
        ) : (
          <PageError
            title={status === 404 ? "Campaign not found" : "Could not load team progress"}
            description={status === 404 ? "It may have been removed, or the link is wrong." : "Try again."}
            onRetry={status === 404 ? undefined : refetch}
          />
        )}
      </PageContainer>
    );
  }

  const attentionCount = workspace.participants.filter((participant) => participant.needsAttention).length;

  return (
    <PageContainer>
      <PageHeader
        title={workspace.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {workspace.referenceYear ? <span>{workspace.referenceYear}</span> : null}
            <span>{teamProgressTerms.participants(workspace.participants.length)}</span>
            <span
              className={cn(
                "font-medium",
                attentionCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300",
              )}
            >
              {attentionCount > 0 ? teamProgressTerms.attentionCount(attentionCount) : teamProgressTerms.allOnTrack}
            </span>
          </span>
        }
      />

      {workspace.participants.length === 0 ? (
        <PageEmpty
          title={teamProgressTerms.emptyScopeTitle}
          description={teamProgressTerms.emptyScopeDescription}
        />
      ) : (
        <div className="space-y-2.5">
          {workspace.participants.map((participant) => (
            <TeamProgressParticipantRow
              key={participant.employeeId}
              participant={participant}
              onOpen={() => setSelected(participant.employeeId)}
            />
          ))}
        </div>
      )}

      {selected ? (
        <ParticipantDetailDialog
          slug={slug}
          employeeId={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </PageContainer>
  );
}

function TeamProgressParticipantRow({
  participant,
  onOpen,
}: {
  participant: TeamProgressParticipantDto;
  onOpen: () => void;
}) {
  const signals: string[] = [];
  if (participant.notStartedObjectiveCount > 0)
    signals.push(teamProgressTerms.notStartedSignal(participant.notStartedObjectiveCount));
  if (participant.staleObjectiveCount > 0)
    signals.push(teamProgressTerms.staleSignal(participant.staleObjectiveCount));
  if (participant.hasRecentRegression) signals.push(teamProgressTerms.regressionSignal);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40",
        participant.needsAttention && "border-amber-500/30",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {initials(participant.employeeName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{participant.employeeName}</span>
          {participant.needsAttention ? (
            <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              {teamProgressTerms.needsAttention}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <ProgressMeter
            percent={participant.weightedProgressPercent}
            tone={participant.needsAttention ? "warning" : participant.weightedProgressPercent === 100 ? "success" : "primary"}
            className="max-w-[16rem]"
          />
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {participant.weightedProgressPercent}%
          </span>
        </div>
        {signals.length > 0 ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{signals.join(" · ")}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            {participant.completedObjectiveCount} of {participant.objectiveCount} complete
          </p>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ParticipantDetailDialog({
  slug,
  employeeId,
  onClose,
}: {
  slug: string;
  employeeId: string;
  onClose: () => void;
}) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { download } = useEvidence();

  const { data, error, isLoading, refetch } = useApiQuery<TeamProgressParticipantDetailDto>(
    performanceQueryKeys.teamProgressParticipant(slug, employeeId),
    (signal) =>
      apiClient.get<TeamProgressParticipantDetailDto>(
        performancePaths.teamProgressParticipant(slug, employeeId),
        { signal },
      ),
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-background p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {teamProgressTerms.backToTeam}
        </button>

        {isLoading ? (
          <PageListSkeleton label="Loading progress" />
        ) : error || !data ? (
          <PageError title="Could not load this person's progress" description="Try again." onRetry={refetch} />
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{data.employeeName}</h2>
              <div className="mt-2 flex items-center gap-3">
                <ProgressMeter
                  percent={data.progress.weightedProgressPercent}
                  tone={data.progress.weightedProgressPercent === 100 ? "success" : "primary"}
                  height="lg"
                  className="max-w-[18rem]"
                />
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  {data.progress.weightedProgressPercent}%
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.progress.completedObjectiveCount} of {data.progress.objectiveCount} complete
              </p>
            </div>

            <div className="space-y-3">
              {data.objectives.map((item) => (
                <section key={item.objective.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground">{item.objective.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Weight: <span className="tabular-nums text-foreground">{item.objective.weight ?? 0}%</span>
                        </span>
                        {item.objective.measurementMethod ? (
                          <span>{measurementMethodLabel(item.objective.measurementMethod)}</span>
                        ) : null}
                        {item.objective.deadline ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" />
                            {formatDate(item.objective.deadline)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ObjectiveStateBadge state={item.state.state} isStale={item.state.isStale} />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressMeter percent={item.state.currentPercent} tone={toneForObjective(item.state)} className="flex-1" />
                    <span className="w-12 text-right text-sm font-semibold tabular-nums text-foreground">
                      {item.state.currentPercent}%
                    </span>
                  </div>
                  {item.history.length > 0 ? (
                    <div className="mt-4 border-t pt-4">
                      <ProgressHistoryTimeline
                        updates={item.history}
                        onDownloadEvidence={(id, name) => void download(id, name)}
                      />
                    </div>
                  ) : (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="size-3.5" />
                      {teamProgressTerms.noActivity}
                    </p>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
