"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  LineChart,
  TrendingUp,
  UsersRound,
} from "lucide-react";
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

  const { data, error, isLoading, refetch } = useApiQuery<
    TeamProgressCampaignDto[]
  >(
    performanceQueryKeys.myTeamProgressCampaigns(),
    (signal) =>
      apiClient.get<TeamProgressCampaignDto[]>(
        performancePaths.myTeamProgressCampaigns(),
        { signal }
      ),
    { enabled: canView }
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
        <PageError
          title="Could not load team progress"
          description="Try again."
          onRetry={refetch}
        />
      ) : data?.length ? (
        <div className="max-w-5xl space-y-3">
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

function TeamProgressCampaignRow({
  campaign,
}: {
  campaign: TeamProgressCampaignDto;
}) {
  const attention = campaign.needsAttentionCount > 0;
  const onTrackCount = Math.max(
    0,
    campaign.participantCount - campaign.needsAttentionCount
  );
  const attentionShare = campaign.participantCount
    ? Math.round(
        (campaign.needsAttentionCount / campaign.participantCount) * 100
      )
    : 0;

  return (
    <Link
      href={`/team-progress/${campaign.slug}`}
      className="group block overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LineChart className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {campaign.name}
                </h3>
                {campaign.referenceYear ? (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {campaign.referenceYear}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {teamProgressTerms.participants(campaign.participantCount)}
              </p>
            </div>
          </div>
          <ChevronRight className="mt-3 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <div className="mb-2 flex items-center justify-between gap-4 text-xs font-medium">
              <span
                className={
                  attention
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-emerald-700 dark:text-emerald-300"
                }
              >
                {attention
                  ? teamProgressTerms.attentionCount(
                      campaign.needsAttentionCount
                    )
                  : teamProgressTerms.allOnTrack}
              </span>
              {attention && onTrackCount > 0 ? (
                <span className="text-muted-foreground">
                  {onTrackCount} on track
                </span>
              ) : null}
            </div>
            <div
              className="flex h-2.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${attentionShare}% of participants need attention`}
            >
              {attentionShare > 0 ? (
                <span
                  className="h-full bg-amber-500 dark:bg-amber-400"
                  style={{ width: `${attentionShare}%` }}
                />
              ) : null}
              {attentionShare < 100 ? (
                <span
                  className="h-full bg-emerald-500 dark:bg-emerald-400"
                  style={{ width: `${100 - attentionShare}%` }}
                />
              ) : null}
            </div>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {attention ? `${attentionShare}% attention` : "100% on track"}
          </span>
        </div>
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

  const {
    data: workspace,
    error,
    isLoading,
    refetch,
  } = useApiQuery<TeamProgressWorkspaceDto>(
    performanceQueryKeys.teamProgressWorkspace(slug),
    (signal) =>
      apiClient.get<TeamProgressWorkspaceDto>(
        performancePaths.teamProgressWorkspace(slug),
        { signal }
      ),
    { enabled: canView && !!slug }
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
            title={
              status === 404
                ? "Campaign not found"
                : "Could not load team progress"
            }
            description={
              status === 404
                ? "It may have been removed, or the link is wrong."
                : "Try again."
            }
            onRetry={status === 404 ? undefined : refetch}
          />
        )}
      </PageContainer>
    );
  }

  const attentionParticipants = workspace.participants.filter(
    (participant) => participant.needsAttention
  );
  const onTrackParticipants = workspace.participants.filter(
    (participant) => !participant.needsAttention
  );
  const attentionCount = attentionParticipants.length;
  const activeEmployeeId =
    selected ?? workspace.participants[0]?.employeeId ?? null;
  const averageProgress = workspace.participants.length
    ? Math.round(
        workspace.participants.reduce(
          (total, participant) => total + participant.weightedProgressPercent,
          0
        ) / workspace.participants.length
      )
    : 0;
  const staleCount = workspace.participants.reduce(
    (total, participant) => total + participant.staleObjectiveCount,
    0
  );
  const notStartedCount = workspace.participants.reduce(
    (total, participant) => total + participant.notStartedObjectiveCount,
    0
  );
  const setbackCount = workspace.participants.filter(
    (participant) => participant.hasRecentRegression
  ).length;

  return (
    <PageContainer>
      <PageHeader
        title={workspace.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {workspace.referenceYear ? (
              <span>{workspace.referenceYear}</span>
            ) : null}
            <span>
              {teamProgressTerms.participants(workspace.participants.length)}
            </span>
            <span
              className={cn(
                "font-medium",
                attentionCount > 0
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-emerald-700 dark:text-emerald-300"
              )}
            >
              {attentionCount > 0
                ? teamProgressTerms.attentionCount(attentionCount)
                : teamProgressTerms.allOnTrack}
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
        <div className="max-w-6xl space-y-5">
          <TeamProgressPulse
            averageProgress={averageProgress}
            attentionCount={attentionCount}
            onTrackCount={onTrackParticipants.length}
            staleCount={staleCount}
            notStartedCount={notStartedCount}
            setbackCount={setbackCount}
          />

          <div className="overflow-hidden rounded-2xl border bg-card lg:grid lg:min-h-[34rem] lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.65fr)]">
            <section className="bg-muted/20 lg:border-r">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UsersRound className="size-4 text-muted-foreground" />
                  People
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {workspace.participants.length}
                </span>
              </div>

              <div className="divide-y">
                {attentionParticipants.length > 0 ? (
                  <TeamProgressParticipantGroup
                    label={teamProgressTerms.needsAttention}
                    participants={attentionParticipants}
                    activeEmployeeId={activeEmployeeId}
                    onOpen={setSelected}
                    tone="warning"
                  />
                ) : null}
                {onTrackParticipants.length > 0 ? (
                  <TeamProgressParticipantGroup
                    label={teamProgressTerms.allOnTrack}
                    participants={onTrackParticipants}
                    activeEmployeeId={activeEmployeeId}
                    onOpen={setSelected}
                    tone="default"
                  />
                ) : null}
              </div>
            </section>

            <div className="hidden min-w-0 lg:block">
              {activeEmployeeId ? (
                <ParticipantDetail slug={slug} employeeId={activeEmployeeId} />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {selected ? (
        <MobileParticipantDetail
          slug={slug}
          employeeId={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </PageContainer>
  );
}

function MobileParticipantDetail({
  slug,
  employeeId,
  onClose,
}: {
  slug: string;
  employeeId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-y-0 left-[4.25rem] right-0 z-50 overflow-y-auto bg-background lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Participant progress"
    >
      <ParticipantDetail
        slug={slug}
        employeeId={employeeId}
        onClose={onClose}
      />
    </div>,
    document.body
  );
}

function TeamProgressPulse({
  averageProgress,
  attentionCount,
  onTrackCount,
  staleCount,
  notStartedCount,
  setbackCount,
}: {
  averageProgress: number;
  attentionCount: number;
  onTrackCount: number;
  staleCount: number;
  notStartedCount: number;
  setbackCount: number;
}) {
  const needsAttention = attentionCount > 0;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Activity className="size-4 text-primary" />
            Team pulse
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {averageProgress}% average progress
          </span>
        </div>
        <ProgressMeter
          percent={averageProgress}
          tone={
            needsAttention
              ? "warning"
              : averageProgress === 100
                ? "success"
                : "primary"
          }
          height="lg"
          className="mt-4"
        />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
          <span
            className={cn(
              "rounded-full px-2.5 py-1",
              needsAttention
                ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
            )}
          >
            {needsAttention
              ? teamProgressTerms.attentionCount(attentionCount)
              : teamProgressTerms.allOnTrack}
          </span>
          {onTrackCount > 0 ? (
            <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
              {onTrackCount} on track
            </span>
          ) : null}
          {staleCount > 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {staleCount} stale
            </span>
          ) : null}
          {notStartedCount > 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {notStartedCount} not started
            </span>
          ) : null}
          {setbackCount > 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {setbackCount === 1
                ? "Recent setback"
                : `${setbackCount} recent setbacks`}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TeamProgressParticipantGroup({
  label,
  participants,
  activeEmployeeId,
  onOpen,
  tone,
}: {
  label: string;
  participants: TeamProgressParticipantDto[];
  activeEmployeeId: string | null;
  onOpen: (employeeId: string) => void;
  tone: "warning" | "default";
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <h2
          className={cn(
            "text-xs font-semibold",
            tone === "warning"
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted-foreground"
          )}
        >
          {label}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {participants.length}
        </span>
      </div>
      <div className="space-y-1 px-2 pb-2">
        {participants.map((participant) => (
          <TeamProgressParticipantRow
            key={participant.employeeId}
            participant={participant}
            isActive={participant.employeeId === activeEmployeeId}
            onOpen={() => onOpen(participant.employeeId)}
          />
        ))}
      </div>
    </section>
  );
}

function TeamProgressParticipantRow({
  participant,
  isActive,
  onOpen,
}: {
  participant: TeamProgressParticipantDto;
  isActive: boolean;
  onOpen: () => void;
}) {
  const signals: string[] = [];
  if (participant.notStartedObjectiveCount > 0)
    signals.push(
      teamProgressTerms.notStartedSignal(participant.notStartedObjectiveCount)
    );
  if (participant.staleObjectiveCount > 0)
    signals.push(
      teamProgressTerms.staleSignal(participant.staleObjectiveCount)
    );
  if (participant.hasRecentRegression)
    signals.push(teamProgressTerms.regressionSignal);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={isActive}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive && "bg-background shadow-sm ring-1 ring-border"
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {initials(participant.employeeName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {participant.employeeName}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <ProgressMeter
            percent={participant.weightedProgressPercent}
            tone={
              participant.needsAttention
                ? "warning"
                : participant.weightedProgressPercent === 100
                  ? "success"
                  : "primary"
            }
            className="max-w-[16rem]"
          />
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {participant.weightedProgressPercent}%
          </span>
        </div>
        {signals.length > 0 ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {signals.join(" · ")}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            {participant.completedObjectiveCount} of{" "}
            {participant.objectiveCount} complete
          </p>
        )}
      </div>
      <ChevronRight
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform lg:rotate-0",
          isActive && "text-foreground lg:translate-x-0.5"
        )}
      />
    </button>
  );
}

function ParticipantDetail({
  slug,
  employeeId,
  onClose,
}: {
  slug: string;
  employeeId: string;
  onClose?: () => void;
}) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { download } = useEvidence();

  const { data, error, isLoading, refetch } =
    useApiQuery<TeamProgressParticipantDetailDto>(
      performanceQueryKeys.teamProgressParticipant(slug, employeeId),
      (signal) =>
        apiClient.get<TeamProgressParticipantDetailDto>(
          performancePaths.teamProgressParticipant(slug, employeeId),
          { signal }
        )
    );

  return (
    <div className="min-h-full p-5 sm:p-6 lg:p-7">
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
          {teamProgressTerms.backToTeam}
        </button>
      ) : null}

      {isLoading ? (
        <PageListSkeleton label="Loading progress" />
      ) : error || !data ? (
        <PageError
          title="Could not load this person's progress"
          description="Try again."
          onRetry={refetch}
        />
      ) : (
        <div>
          <div className="border-b pb-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initials(data.employeeName)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {data.employeeName}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {data.progress.completedObjectiveCount} of{" "}
                  {data.progress.objectiveCount} complete
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-4">
              <ProgressMeter
                percent={data.progress.weightedProgressPercent}
                tone={
                  data.progress.weightedProgressPercent === 100
                    ? "success"
                    : "primary"
                }
                height="lg"
                className="flex-1"
              />
              <span className="text-xl font-semibold tabular-nums text-foreground">
                {data.progress.weightedProgressPercent}%
              </span>
            </div>
          </div>

          <div className="pt-5">
            <div className="flex items-center justify-between gap-3 pb-1">
              <h3 className="text-sm font-semibold text-foreground">
                Objectives
              </h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {data.objectives.length}
              </span>
            </div>
            <div className="divide-y">
              {data.objectives.map((item) => (
                <section key={item.objective.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        {item.objective.title}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Weight:{" "}
                          <span className="tabular-nums text-foreground">
                            {item.objective.weight ?? 0}%
                          </span>
                        </span>
                        {item.objective.measurementMethod ? (
                          <span>
                            {measurementMethodLabel(
                              item.objective.measurementMethod
                            )}
                          </span>
                        ) : null}
                        {item.objective.deadline ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" />
                            {formatDate(item.objective.deadline)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ObjectiveStateBadge
                      state={item.state.state}
                      isStale={item.state.isStale}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressMeter
                      percent={item.state.currentPercent}
                      tone={toneForObjective(item.state)}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-sm font-semibold tabular-nums text-foreground">
                      {item.state.currentPercent}%
                    </span>
                  </div>
                  {item.history.length > 0 ? (
                    <div className="mt-4 border-t pt-4">
                      <ProgressHistoryTimeline
                        updates={item.history}
                        onDownloadEvidence={(id, name) =>
                          void download(id, name)
                        }
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
        </div>
      )}
    </div>
  );
}
