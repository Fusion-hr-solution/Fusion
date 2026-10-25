"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { CheckCircle2, CircleDashed, Clock, Download, Eye, PencilLine, RotateCcw, Users } from "@/lib/icons";
import type {
  RosterAttentionDto,
  RosterPhaseFactsDto,
  RosterPlanStatus,
  TeamPhase,
  TeamRosterMemberDto,
  YourPeopleFilter,
  YourPeoplePageDto,
  YourPeopleQuery,
} from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import {
  DataTable,
  DataTableCellEmpty,
  DataTableCellStack,
  DataTableRowChevron,
  createDataTableColumnHelper,
  useDataTable,
  type DataTableFilterField,
  type DataTableFilterState,
  type DataTableModel,
} from "@repo/ds/data-table";
import { PageError, StatusBadge, type StatusTone } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { initials } from "../plan/plan-lib";
import { formatDateTime, formatRelativeTime } from "../../lib";
import { planHref as canonicalPlanHref, peerListHref, reviewHref, withCycle } from "@/lib/performance-routes";
import { useDownloadReviewPdf } from "../../api/use-review-work";
import { RequestUpdateDialog } from "../update-requests/update-requests";
import { latestRosterActivity } from "./roster-activity";
import { ago, day, plural } from "../overview/overview-model";

/**
 * Your People — the manager's roster for the selected Cycle, served a page at a time. The server owns
 * responsibility, the phase, each person's group (what needs the manager first) and their facts for the
 * phase, ordering, the views and paging; this table renders the phase's columns under the server's groups.
 * Rows open the record the phase is about: the plan while planning and executing, the review once a round runs.
 */

const STATUS_META: Record<RosterPlanStatus, { label: string; tone: StatusTone; icon: ComponentType<{ className?: string }> }> = {
  NotStarted: { label: "Not started", tone: "muted", icon: CircleDashed },
  Draft: { label: "Drafting", tone: "neutral", icon: PencilLine },
  ReturnedForChanges: { label: "Returned", tone: "info", icon: RotateCcw },
  Submitted: { label: "Submitted", tone: "warning", icon: Clock },
  Approved: { label: "Approved", tone: "success", icon: CheckCircle2 },
};

/** Each phase's groups, in the server's order. */
export const GROUP_LABEL: Record<TeamPhase, Record<string, string>> = {
  Planning: { waiting: "Waiting for you", planning: "Still planning", approved: "Approved" },
  Execution: { needsYou: "Needs you", rest: "The rest" },
  Review: { ready: "Ready for you", waiting: "Waiting on them", submitted: "Submitted", notInRound: "Not in this round" },
  Closed: { notAcknowledged: "Not acknowledged yet", acknowledged: "Acknowledged", noResult: "No result" },
};

const VIEW_LABEL: Record<Exclude<YourPeopleFilter, "All">, string> = {
  NeedsReview: "Needs review",
  Planning: "Planning",
  Approved: "Approved",
  NoProgress: "No updates",
};

// The plan views only mean something while plans are made and executed.
const ROSTER_FILTERS: DataTableFilterField<TeamRosterMemberDto>[] = [
  {
    id: "show",
    label: "Show",
    icon: Eye,
    type: "options",
    single: true,
    pinned: true,
    options: (Object.keys(VIEW_LABEL) as (keyof typeof VIEW_LABEL)[]).map((id) => ({ value: id, label: VIEW_LABEL[id] })),
  },
];

const NO_FILTERS: DataTableFilterField<TeamRosterMemberDto>[] = [];

const toRosterState = (filter: YourPeopleFilter): DataTableFilterState => ({ show: filter === "All" ? undefined : [filter] });

const displayName = (member: TeamRosterMemberDto) => member.employeeName ?? "Employee";
const first = (member: TeamRosterMemberDto) => displayName(member).split(/\s+/)[0];

/** Where a row leads: the review once one exists for the phase, otherwise the plan the caller may open. */
export function rowHref(cycleId: string, phase: TeamPhase, member: TeamRosterMemberDto): string | null {
  const closed = member.facts?.closed;
  if (phase === "Closed" && closed) return withCycle(reviewHref(closed.reviewId), cycleId);
  if (phase === "Review" && member.review) return withCycle(reviewHref(member.review.reviewId), cycleId);
  if (member.planId && (member.canReview || member.canView)) return canonicalPlanHref({ cycleId, planId: member.planId });
  return null;
}

type Tone = "attention" | "ok" | "risk" | "off" | "quiet";
const DOT: Record<Tone, string> = {
  attention: "bg-primary",
  ok: "bg-success",
  risk: "bg-warning",
  off: "bg-destructive",
  quiet: "bg-muted-foreground/60",
};
const TEXT: Record<Tone, string> = {
  attention: "text-primary",
  ok: "text-success",
  risk: "text-warning",
  off: "text-destructive",
  quiet: "text-muted-foreground",
};

/** A state word with its dot, and its date or detail beside it in the quiet tone. */
function StateLine({ tone, label, detail }: { tone: Tone; label: ReactNode; detail?: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      <span className={cn("size-2 shrink-0 rounded-full", DOT[tone])} aria-hidden />
      <span className="min-w-0 truncate">
        <span className={TEXT[tone]}>{label}</span>
        {detail ? <span className="text-muted-foreground"> {detail}</span> : null}
      </span>
    </span>
  );
}

const column = createDataTableColumnHelper<TeamRosterMemberDto>();

function personColumn(showOrgUnit: boolean) {
  return column.accessor((m) => displayName(m), {
    id: "person",
    header: "Person",
    enableSorting: false,
    cell: ({ row }) => {
      const m = row.original;
      const context = [m.jobTitle, showOrgUnit ? m.orgUnitName : null].filter(Boolean).join(" · ");
      return (
        <DataTableCellStack
          leading={
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials(m.employeeName)}</AvatarFallback>
            </Avatar>
          }
          primary={
            <Link
              href={`/people/${m.employeeId}`}
              onClick={(event) => event.stopPropagation()}
              className="rounded-detail hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {displayName(m)}
            </Link>
          }
          secondary={context || undefined}
        />
      );
    },
    meta: {
      width: "26%",
      skeleton: (
        <div className="flex w-full items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="w-full space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ),
    },
  });
}

function PlanStateCell({ member }: { member: TeamRosterMemberDto }) {
  const meta = STATUS_META[member.status];
  return (
    <StatusBadge tone={meta.tone}>
      <meta.icon className="size-3.5" aria-hidden />
      {member.activityKind === "Resubmitted" ? "Resubmitted" : meta.label}
    </StatusBadge>
  );
}

/** "3 · weights 100%": how much of the plan is laid out, from the plan's own weights. */
function ObjectivesCell({ member }: { member: TeamRosterMemberDto }) {
  const planning = member.facts?.planning;
  if (!planning || member.status === "NotStarted") return <DataTableCellEmpty />;
  const weight =
    member.status === "Approved"
      ? member.objectiveProgress.reduce((sum, o) => sum + o.weight, 0)
      : (member.allocatedWeight ?? 0);
  return (
    <span className="whitespace-nowrap text-sm tabular-nums text-foreground">
      {planning.objectives} · weights {Math.round(weight)}%
    </span>
  );
}

function AlignedCell({ member }: { member: TeamRosterMemberDto }) {
  const planning = member.facts?.planning;
  if (!planning || planning.objectives === 0) return <DataTableCellEmpty />;
  return (
    <span className="text-sm tabular-nums text-foreground">
      {planning.alignedToTeam} of {planning.objectives}
    </span>
  );
}

function ActivityCell({ member }: { member: TeamRosterMemberDto }) {
  const activity = latestRosterActivity(member);
  if (!activity) return <DataTableCellEmpty />;
  return (
    <span
      className="block min-w-0 truncate text-sm text-foreground"
      title={`${activity.label} · ${formatDateTime(activity.at)}${activity.objectiveTitle ? ` · ${activity.objectiveTitle}` : ""}`}
    >
      {activity.label}{" "}
      <time className="tabular-nums text-muted-foreground" dateTime={activity.at}>
        {formatRelativeTime(activity.at)}
      </time>
    </span>
  );
}

/** The owner-set status mix of an executing plan, one segment per state sized by its count. */
function StatusMixCell({ member }: { member: TeamRosterMemberDto }) {
  const status = member.facts?.execution?.status;
  const total = status ? status.onTrack + status.atRisk + status.offTrack + status.noStatus : 0;
  if (!status || total === 0) return <DataTableCellEmpty />;
  const segments = [
    { count: status.onTrack, className: "bg-success" },
    { count: status.atRisk, className: "bg-warning" },
    { count: status.offTrack, className: "bg-destructive" },
    { count: status.noStatus, className: "bg-inlay ring-1 ring-inset ring-border" },
  ].filter((s) => s.count > 0);
  const label = `${status.onTrack} on track, ${status.atRisk} at risk, ${status.offTrack} off track, ${status.noStatus} no status yet`;
  return (
    <div role="img" aria-label={label} title={label} className="flex h-2 w-24 gap-[3px]">
      {segments.map((s, i) => (
        <span key={i} className={cn("min-w-1.5 rounded-full", s.className)} style={{ flexGrow: s.count, flexBasis: 0 }} />
      ))}
    </div>
  );
}

function attentionLine(attention: RosterAttentionDto, noStatus: number): { tone: Tone; title: string; detail: string | null } {
  const since = attention.since ? `since ${day(attention.since)}` : null;
  const reason = attention.reason ? `"${attention.reason}"` : null;
  switch (attention.kind) {
    case "offTrack":
    case "atRisk":
      return {
        tone: attention.kind === "offTrack" ? "off" : "risk",
        title: `${attention.objectiveTitle ?? "An objective"} · ${attention.kind === "offTrack" ? "off track" : "at risk"}`,
        detail: [reason, since].filter(Boolean).join(" · ") || null,
      };
    case "noUpdate":
      return {
        tone: "risk",
        title: "No update in 30 days",
        detail: noStatus > 0 ? `${plural(noStatus, "objective")} ${noStatus === 1 ? "has" : "have"} no status yet` : null,
      };
    case "openRequest":
      return { tone: "attention", title: "Update requested", detail: [attention.objectiveTitle, since].filter(Boolean).join(" · ") || null };
    case "planWaiting":
      return { tone: "attention", title: "Plan waiting for your decision", detail: since };
    case "notApproved":
      return { tone: "quiet", title: "Plan not approved yet", detail: null };
  }
}

function AttentionCell({ member }: { member: TeamRosterMemberDto }) {
  const execution = member.facts?.execution;
  if (!execution?.attention) return <DataTableCellEmpty />;
  const line = attentionLine(execution.attention, execution.status.noStatus);
  return (
    <div className="min-w-0 py-2">
      <p className={cn("flex items-start gap-2 text-sm", TEXT[line.tone])}>
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[line.tone])} aria-hidden />
        <span className="min-w-0">{line.title}</span>
      </p>
      {/* The owner's reason, clamped to two lines: the full text is on the objective. */}
      {line.detail ? <p className="mt-0.5 line-clamp-2 pl-4 text-xs text-muted-foreground" title={line.detail}>{line.detail}</p> : null}
    </div>
  );
}

function PlanProgressCell({ member }: { member: TeamRosterMemberDto }) {
  if (member.status !== "Approved") return <DataTableCellEmpty />;
  const value = Math.max(0, Math.min(100, member.planProgress));
  return (
    <span className="flex items-center gap-3">
      <span className="relative h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-inlay">
        {member.hasProgress ? <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${value}%` }} /> : null}
      </span>
      <span className={cn("w-9 shrink-0 text-right text-sm font-medium tabular-nums", member.hasProgress ? "text-foreground" : "text-muted-foreground")}>
        {Math.round(value)}%
      </span>
    </span>
  );
}

function LastUpdateCell({ member }: { member: TeamRosterMemberDto }) {
  const execution = member.facts?.execution;
  if (!execution?.lastUpdateAt) return <DataTableCellEmpty />;
  return (
    <time
      dateTime={execution.lastUpdateAt}
      className={cn("text-sm tabular-nums", execution.attention?.kind === "noUpdate" ? "text-warning" : "text-foreground")}
    >
      {ago(execution.lastUpdateAt)}
    </time>
  );
}

function UpdateRequestCell({ member, onRequestUpdate }: { member: TeamRosterMemberDto; onRequestUpdate?: (m: TeamRosterMemberDto) => void }) {
  const request = member.updateRequest;
  if (request?.state === "Open") {
    return (
      <span className="text-sm text-foreground">
        1 open <span className="text-muted-foreground">· asked {day(request.requestedAt)}</span>
      </span>
    );
  }
  if (member.facts?.execution?.attention?.kind === "noUpdate" && member.canRequestUpdate && onRequestUpdate) {
    return (
      <Button size="sm" variant="outline" onClick={() => onRequestUpdate(member)}>
        Ask for an update
      </Button>
    );
  }
  return <DataTableCellEmpty />;
}

type ReviewFacts = NonNullable<RosterPhaseFactsDto["review"]>;

function SelfCell({ review }: { review: ReviewFacts | null | undefined }) {
  if (!review || review.selfState === "off") return <DataTableCellEmpty />;
  if (review.selfState === "submitted")
    return <StateLine tone="ok" label="Submitted" detail={review.selfSubmittedAt ? day(review.selfSubmittedAt) : null} />;
  if (review.selfState === "writing") return <StateLine tone="risk" label="Writing" detail={review.selfDue ? `due ${day(review.selfDue)}` : null} />;
  return <StateLine tone="quiet" label="Not started" />;
}

function PeersCell({ review }: { review: ReviewFacts | null | undefined }) {
  if (!review?.peers.enabled) return <DataTableCellEmpty />;
  const { peers } = review;
  if (peers.waitingForYou) return <StateLine tone="attention" label={`${peers.proposed} proposed, waiting for you`} />;
  if (peers.asked > 0)
    return (
      <span className="text-sm tabular-nums text-foreground">
        {peers.answered} of {peers.asked} answered
      </span>
    );
  return <span className="text-sm text-muted-foreground">Not chosen yet</span>;
}

function YourReviewCell({ member }: { member: TeamRosterMemberDto }) {
  const review = member.facts?.review;
  if (!review) return <DataTableCellEmpty />;
  if (review.yourReview === "submitted") return <StateLine tone="ok" label="Submitted" />;
  if (review.yourReview === "draftSaved")
    return <StateLine tone="quiet" label="Draft saved" detail={review.yourDraftSavedAt ? day(review.yourDraftSavedAt) : null} />;
  return member.group === "ready" ? <StateLine tone="quiet" label="Not started" /> : <DataTableCellEmpty />;
}

function LevelCell({ level, label }: { level: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-sm text-foreground">
      <span className="grid size-6 place-items-center rounded-detail bg-inlay text-xs font-semibold tabular-nums ring-1 ring-inset ring-border">
        {level}
      </span>
      {label}
    </span>
  );
}

function PdfButton({ reviewId, name }: { reviewId: string; name: string }) {
  const download = useDownloadReviewPdf();
  return (
    <Button size="sm" variant="ghost" onClick={() => void download(reviewId, `${name}.pdf`)}>
      <Download className="size-4" data-icon="inline-start" aria-hidden />
      PDF
    </Button>
  );
}

const SKELETON = <Skeleton className="h-4 w-24" />;

function phaseColumns(
  phase: TeamPhase,
  cycleId: string,
  showOrgUnit: boolean,
  onRequestUpdate?: (member: TeamRosterMemberDto) => void,
) {
  const person = personColumn(showOrgUnit);
  const open = column.display({
    id: "action",
    header: () => <span className="sr-only">Open</span>,
    cell: ({ row }) => {
      const m = row.original;
      const href = rowHref(cycleId, phase, m);
      if (phase === "Planning" && m.canReview && href) {
        return (
          <Button size="sm" asChild>
            <Link href={href}>Review plan</Link>
          </Button>
        );
      }
      if (phase === "Review" && m.group === "ready" && m.review) {
        if (m.facts?.review?.peers.waitingForYou) {
          return (
            <Button size="sm" variant="outline" asChild>
              <Link href={withCycle(peerListHref(m.review.reviewId), cycleId)}>Approve peers</Link>
            </Button>
          );
        }
        return (
          <Button size="sm" asChild>
            <Link href={withCycle(reviewHref(m.review.reviewId), cycleId)}>Review</Link>
          </Button>
        );
      }
      if (phase === "Closed" && m.facts?.closed) return <PdfButton reviewId={m.facts.closed.reviewId} name={displayName(m)} />;
      return href ? <DataTableRowChevron /> : null;
    },
    meta: { align: "end", width: "9rem", hideBelow: "sm", skeleton: <Skeleton className="h-7 w-24" /> },
  });

  switch (phase) {
    case "Planning":
      return [
        person,
        column.accessor("status", {
          id: "plan",
          header: "Plan",
          enableSorting: false,
          cell: ({ row }) => <PlanStateCell member={row.original} />,
          meta: { width: "14%", hideBelow: "sm", skeleton: <Skeleton className="h-5 w-24 rounded-full" /> },
        }),
        column.display({ id: "objectives", header: "Objectives", cell: ({ row }) => <ObjectivesCell member={row.original} />, meta: { width: "15%", hideBelow: "md", skeleton: SKELETON } }),
        column.display({ id: "aligned", header: "Aligned to your team", cell: ({ row }) => <AlignedCell member={row.original} />, meta: { width: "15%", hideBelow: "lg", skeleton: SKELETON } }),
        column.display({ id: "activity", header: "Last activity", cell: ({ row }) => <ActivityCell member={row.original} />, meta: { hideBelow: "lg", skeleton: SKELETON } }),
        open,
      ];
    case "Execution":
      return [
        person,
        column.display({ id: "objectives", header: "Objectives", cell: ({ row }) => <StatusMixCell member={row.original} />, meta: { width: "10rem", hideBelow: "md", skeleton: SKELETON } }),
        column.display({ id: "attention", header: "Needs attention", cell: ({ row }) => <AttentionCell member={row.original} />, meta: { width: "24%", skeleton: SKELETON } }),
        column.display({ id: "progress", header: "Plan progress", cell: ({ row }) => <PlanProgressCell member={row.original} />, meta: { width: "12rem", hideBelow: "md", skeleton: SKELETON } }),
        column.display({ id: "lastUpdate", header: "Last update", cell: ({ row }) => <LastUpdateCell member={row.original} />, meta: { hideBelow: "lg", skeleton: SKELETON } }),
        column.display({
          id: "requests",
          header: "Update requests",
          cell: ({ row }) => <UpdateRequestCell member={row.original} onRequestUpdate={onRequestUpdate} />,
          meta: { width: "11rem", hideBelow: "lg", skeleton: SKELETON },
        }),
        { ...open, meta: { ...open.meta, width: "3rem" } },
      ];
    case "Review":
      return [
        person,
        column.display({ id: "self", header: "Self-assessment", cell: ({ row }) => <SelfCell review={row.original.facts?.review} />, meta: { width: "20%", skeleton: SKELETON } }),
        column.display({ id: "peers", header: "Peers", cell: ({ row }) => <PeersCell review={row.original.facts?.review} />, meta: { width: "22%", hideBelow: "md", skeleton: SKELETON } }),
        column.display({ id: "yours", header: "Your review", cell: ({ row }) => <YourReviewCell member={row.original} />, meta: { hideBelow: "md", skeleton: SKELETON } }),
        open,
      ];
    case "Closed":
      return [
        person,
        column.display({
          id: "result",
          header: "Result",
          cell: ({ row }) => {
            const closed = row.original.facts?.closed;
            return closed ? <LevelCell level={closed.level} label={closed.label} /> : <DataTableCellEmpty />;
          },
          meta: { width: "20%", skeleton: SKELETON },
        }),
        column.display({
          id: "yourRating",
          header: "Your rating",
          cell: ({ row }) => {
            const closed = row.original.facts?.closed;
            if (!closed) return <DataTableCellEmpty />;
            if (closed.yourLevel != null && closed.yourLevel !== closed.level)
              return (
                <span className="text-sm tabular-nums text-foreground">
                  {closed.yourLevel} → {closed.level} <span className="text-muted-foreground">in calibration</span>
                </span>
              );
            return <span className="text-sm tabular-nums text-foreground">{closed.level}</span>;
          },
          meta: { width: "13%", hideBelow: "md", skeleton: SKELETON },
        }),
        column.display({
          id: "acknowledged",
          header: "Acknowledged",
          cell: ({ row }) => {
            const closed = row.original.facts?.closed;
            if (!closed) return <DataTableCellEmpty />;
            return closed.acknowledgedAt ? (
              <StateLine tone="ok" label={day(closed.acknowledgedAt)} detail={closed.acknowledgedWithComment ? "with a comment" : null} />
            ) : (
              <StateLine tone="quiet" label="Not yet" />
            );
          },
          meta: { width: "20%", hideBelow: "md", skeleton: SKELETON },
        }),
        column.display({
          id: "development",
          header: "Development",
          cell: ({ row }) => {
            const closed = row.original.facts?.closed;
            if (!closed) return <DataTableCellEmpty />;
            return closed.openGrowthGoals > 0 ? (
              <span className="text-sm text-foreground">{plural(closed.openGrowthGoals, "open goal")}</span>
            ) : (
              <span className="text-sm text-muted-foreground">None open</span>
            );
          },
          meta: { hideBelow: "lg", skeleton: SKELETON },
        }),
        open,
      ];
  }
}

const SKELETON_COLUMNS = phaseColumns("Planning", "", false);
const rosterRowId = (m: TeamRosterMemberDto) => m.employeeId;

export const DEFAULT_PEOPLE_QUERY: YourPeopleQuery = { filter: "All", search: "", page: 1, pageSize: 25 };

/** The header action that starts the most pressing piece of work in the phase, if any. */
export function leadAction(cycleId: string, data: YourPeoplePageDto | undefined): { href: string; label: string } | null {
  if (!data) return null;
  if (data.phase === "Planning") {
    const waiting = data.items.find((m) => m.canReview && m.planId);
    return waiting ? { href: canonicalPlanHref({ cycleId, planId: waiting.planId! }), label: `Review ${first(waiting)}'s plan` } : null;
  }
  if (data.phase === "Review" && data.summary?.firstReadyReviewId) {
    return {
      href: withCycle(reviewHref(data.summary.firstReadyReviewId), cycleId),
      label: `Review ${data.summary.firstReadyName?.split(/\s+/)[0] ?? "the next one"}`,
    };
  }
  return null;
}

export function YourPeople({
  cycleId,
  people,
  query,
  onQueryChange,
}: {
  cycleId: string;
  people: { data: YourPeoplePageDto | undefined; isLoading: boolean; error: Error | null; refetch: () => void };
  /** Controlled, so the page can open the roster on "Needs review". */
  query: YourPeopleQuery;
  onQueryChange: (query: YourPeopleQuery) => void;
}) {
  const router = useRouter();
  const data = people.data;
  const members = data?.items;
  const phase = data?.phase ?? "Planning";
  // The org unit only tells people apart when the page spans more than one; otherwise it repeats.
  const showOrgUnit = useMemo(() => new Set(members?.map((m) => m.orgUnitName).filter(Boolean)).size > 1, [members]);
  const [requesting, setRequesting] = useState<TeamRosterMemberDto | null>(null);
  const columns = useMemo(() => phaseColumns(phase, cycleId, showOrgUnit, setRequesting), [phase, cycleId, showOrgUnit]);
  const counts = useMemo(() => new Map(data?.groups.map((g) => [g.key, g.count])), [data?.groups]);
  // Any change of view or search starts again from the first page.
  const change = (next: Partial<YourPeopleQuery>) => onQueryChange({ ...query, page: 1, ...next });
  const model = useDataTable({
    data: members,
    columns,
    getRowId: rosterRowId,
    filters: phase === "Planning" || phase === "Execution" ? ROSTER_FILTERS : NO_FILTERS,
    manual: { rowCount: data?.matchCount ?? 0 },
    filterState: toRosterState(query.filter),
    onFilterStateChange: (state) => change({ filter: (state.show as YourPeopleFilter[] | undefined)?.[0] ?? "All" }),
    filterCounts: data
      ? {
          show: {
            NeedsReview: data.counts.needsReview,
            Planning: data.counts.planning,
            Approved: data.counts.approved,
            NoProgress: data.counts.noProgress,
          },
        }
      : undefined,
    searchQuery: query.search,
    onSearchQueryChange: (search) => change({ search }),
    pagination: { pageIndex: query.page - 1, pageSize: query.pageSize },
    onPaginationChange: (next) =>
      next.pageSize !== query.pageSize ? change({ pageSize: next.pageSize }) : onQueryChange({ ...query, page: next.pageIndex + 1 }),
  });

  if (!people.isLoading && (people.error || !data)) {
    return <PageError title="Your people are unavailable" description={people.error?.message} onRetry={people.refetch} />;
  }

  return (
    <>
      <RosterSection
        model={model}
        isLoading={people.isLoading}
        rowGroup={(m) => {
          if (!m.group) return null;
          const label = GROUP_LABEL[phase][m.group] ?? m.group;
          const count = counts.get(m.group);
          return { key: m.group, label: count != null ? `${label} · ${count}` : label };
        }}
        canOpen={(m) => rowHref(cycleId, phase, m) !== null}
        onOpen={(m) => {
          const href = rowHref(cycleId, phase, m);
          if (href) router.push(href);
        }}
      />
      {requesting?.planId ? (
        <RequestUpdateDialog cycleId={cycleId} planId={requesting.planId} personName={displayName(requesting)} onClose={() => setRequesting(null)} />
      ) : null}
    </>
  );
}

/** The roster's loading state: the same table with shimmer rows, so nothing jumps. */
export function RosterSkeleton() {
  const model = useDataTable({
    data: undefined,
    columns: SKELETON_COLUMNS,
    getRowId: rosterRowId,
    filters: ROSTER_FILTERS,
    manual: { rowCount: 0 },
    onSearchQueryChange: () => {},
  });
  return <RosterSection model={model} isLoading />;
}

function RosterSection({
  model,
  isLoading,
  rowGroup,
  canOpen,
  onOpen,
}: {
  model: DataTableModel<TeamRosterMemberDto>;
  isLoading: boolean;
  rowGroup?: (member: TeamRosterMemberDto) => { key: string; label: ReactNode } | null;
  canOpen?: (member: TeamRosterMemberDto) => boolean;
  onOpen?: (member: TeamRosterMemberDto) => void;
}) {
  return (
    <section id="your-people" aria-label="Your people" className="scroll-mt-6">
      <DataTable
        model={model}
        isLoading={isLoading}
        searchPlaceholder="Find a person"
        noun={["person", "people"]}
        noResults="No people match this view"
        emptyState={<EmptyRoster />}
        rowGroup={rowGroup}
        onRowClick={onOpen}
        canClickRow={canOpen}
      />
    </section>
  );
}

function EmptyRoster() {
  return (
    <>
      <Users className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
      <p className="mt-3 text-sm font-medium text-foreground">No one reports to you this cycle</p>
    </>
  );
}
