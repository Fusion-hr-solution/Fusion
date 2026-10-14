"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ComponentType } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Eye,
  Lightbulb,
  MessageSquare,
  MoreHorizontal,
  PencilLine,
  RotateCcw,
  Users,
} from "@/lib/icons";
import type {
  RosterObjectiveProgressDto,
  RosterPlanStatus,
  PerformanceReviewState,
  TeamRosterMemberDto,
  YourPeopleFilter,
  YourPeoplePageDto,
  YourPeopleQuery,
} from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@repo/ds/components/ui/dropdown-menu";
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
import { PROGRESS_TONE_BG, initials } from "../plan/plan-lib";
import { formatDate, formatDateTime, formatRelativeTime } from "../../lib";
import { planHref as canonicalPlanHref, reviewHref, withCycle } from "@/lib/performance-routes";
import { reviewStageLabel } from "./review-stage";
import { RequestUpdateDialog } from "../update-requests/update-requests";
import { latestRosterActivity } from "./roster-activity";

/**
 * Your People — the manager's operational roster for the current Cycle, served a page at a time: the
 * server owns responsibility, standing, execution facts, ordering (action required first), the views and
 * paging, so this table only renders and reports what the manager asked for. It is the attention/index layer,
 * not another plan workspace: each person shows where their canonical Plan sits in the lifecycle and how
 * execution is progressing, and the row opens the canonical Plan surface.
 *
 * Every fact is real: lifecycle and progress come from the Plan aggregate and canonical progress truth,
 * "Not started" means no Plan exists (never a fabricated Draft), and the "Review" action appears only
 * when the caller actually holds decision authority — roster membership never implies it.
 */

// Lifecycle in the same tones the plan surfaces use (Draft muted, Submitted warning, Approved success),
// each with its icon so the state never rests on colour alone. Amber stays the one state the manager acts
// on; a returned plan the employee now owns reads as in-flight, and a plan not yet started as an outline.
const STATUS_META: Record<
  RosterPlanStatus,
  { label: string; tone: StatusTone; icon: ComponentType<{ className?: string }> }
> = {
  NotStarted: { label: "Not started", tone: "muted", icon: CircleDashed },
  Draft: { label: "Draft", tone: "neutral", icon: PencilLine },
  ReturnedForChanges: { label: "Returned", tone: "info", icon: RotateCcw },
  Submitted: { label: "Submitted", tone: "warning", icon: Clock },
  Approved: { label: "Approved", tone: "success", icon: CheckCircle2 },
};

const REVIEW_STAGE_TONE: Record<PerformanceReviewState, StatusTone> = {
  SelfAssessment: "info",
  ManagerAssessment: "warning",
  Calibration: "info",
  ReadyToFinalize: "warning",
  Finalized: "success",
  Closed: "muted",
};

const VIEW_LABEL: Record<Exclude<YourPeopleFilter, "All">, string> = {
  NeedsReview: "Needs review",
  Planning: "Planning",
  Approved: "Approved",
  NoProgress: "No updates",
};

// The roster's primary question, as its one pinned filter: always shown, resets to "All". The server
// decides membership of each view and sizes it.
const ROSTER_FILTERS: DataTableFilterField<TeamRosterMemberDto>[] = [
  {
    id: "show",
    label: "Show",
    icon: Eye,
    type: "options",
    single: true,
    pinned: true,
    options: (Object.keys(VIEW_LABEL) as (keyof typeof VIEW_LABEL)[]).map((id) => ({
      value: id,
      label: VIEW_LABEL[id],
    })),
  },
];

function toRosterState(filter: YourPeopleFilter): DataTableFilterState {
  return { show: filter === "All" ? undefined : [filter] };
}

function displayName(member: TeamRosterMemberDto): string {
  return member.employeeName ?? "Employee";
}

// Only open the plan when the caller may actually see it — a never-submitted Draft is the employee's
// private workspace and has no reviewable surface.
function canOpen(member: TeamRosterMemberDto): boolean {
  return Boolean(member.planId && (member.canReview || member.canView));
}

function planHref(cycleId: string, member: TeamRosterMemberDto): string | null {
  return canOpen(member) ? canonicalPlanHref({ cycleId, planId: member.planId! }) : null;
}

const column = createDataTableColumnHelper<TeamRosterMemberDto>();

/** Lifecycle position as a toned badge. The plan's contents are the Progress column's job. */
function PlanStateCell({ member }: { member: TeamRosterMemberDto }) {
  const meta = STATUS_META[member.status];
  return (
    <StatusBadge tone={meta.tone}>
      <meta.icon className="size-3.5" aria-hidden />
      {member.activityKind === "Resubmitted" ? "Resubmitted" : meta.label}
    </StatusBadge>
  );
}

/**
 * Execution as one shape: a segment per objective, sized by its plan weight and filled by its reported
 * progress, so composition, coverage and the weighted total read at a glance with no counting labels.
 * Each segment keeps its objective's identity — aligned in the accent, standalone in info blue — even
 * when complete; a milestone objective stays one bar, divided by hairlines at each milestone and filled
 * where milestones are done.
 */
function ProgressCell({ member }: { member: TeamRosterMemberDto }) {
  // Progress does not apply before approval; a plan in progress shows how much of it is laid out instead.
  if (member.status !== "Approved") {
    if (member.allocatedWeight == null || member.status === "NotStarted") return <DataTableCellEmpty />;
    return (
      <span className="text-sm tabular-nums text-muted-foreground">
        {Math.round(member.allocatedWeight)}% allocated
      </span>
    );
  }
  const slices = member.objectiveProgress;
  const reporting = slices.filter((o) => o.hasProgress).length;
  const value = Math.round(member.planProgress);
  const overdue = member.overdueObjectiveCount;
  const summary = `${value}% weighted progress · ${reporting} of ${slices.length} objectives reporting`;
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-3">
        <div
          role="img"
          aria-label={summary}
          title={summary}
          className="flex h-2 min-w-16 flex-1 gap-1"
        >
          {slices.map((slice, index) => (
            <ObjectiveSlice key={index} slice={slice} />
          ))}
        </div>
        <span
          className={cn(
            "w-9 shrink-0 text-right text-sm font-medium tabular-nums",
            member.hasProgress ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {value}%
        </span>
      </div>
      {overdue > 0 ? (
        <div className="mt-1 truncate text-xs font-medium text-destructive">
          {overdue} objective{overdue === 1 ? "" : "s"} overdue
        </div>
      ) : null}
    </div>
  );
}

const TRACK = "bg-muted-foreground/25";

/**
 * One objective's share of the bar. A milestone objective splits into its milestones (sized by their
 * weight within the objective, filled when completed), so its slice reads exactly like the plan's own
 * milestone bar; any other method is one continuous fill to its reported progress.
 */
function ObjectiveSlice({ slice }: { slice: RosterObjectiveProgressDto }) {
  const fill = PROGRESS_TONE_BG[slice.isAligned ? "primary" : "info"];
  const grow = { flexGrow: slice.weight || 1, flexBasis: 0 };
  if (slice.milestones.length > 0) {
    return (
      // One bar like any other slice, with hairline separators marking where each milestone ends.
      <span
        className={cn("flex h-full min-w-1 overflow-hidden rounded-full", TRACK)}
        style={grow}
      >
        {slice.milestones.map((milestone, index) => (
          <span
            key={index}
            className={cn(
              "h-full",
              index > 0 && "border-l-2 border-card",
              milestone.isCompleted
                ? fill
                : milestone.isOverdue && "bg-destructive"
            )}
            style={{ flexGrow: milestone.weight || 1, flexBasis: 0 }}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      className={cn("relative h-full min-w-1 overflow-hidden rounded-full", TRACK)}
      style={grow}
    >
      <span
        className={cn("absolute inset-y-0 left-0 rounded-full", fill)}
        style={{ width: `${slice.progress}%` }}
      />
    </span>
  );
}

/** One event and time, selected from the plan/progress activity and the latest update request. */
function ActivityCell({ member }: { member: TeamRosterMemberDto }) {
  const activity = latestRosterActivity(member);
  if (!activity) return <DataTableCellEmpty />;
  return (
    <span className="block min-w-0 truncate text-sm text-foreground" title={`${activity.label} · ${formatDateTime(activity.at)}${activity.objectiveTitle ? ` · ${activity.objectiveTitle}` : ""}`}>
      {activity.label}{" "}
      <time className="tabular-nums text-muted-foreground" dateTime={activity.at}>
        {formatRelativeTime(activity.at)}
      </time>
    </span>
  );
}

function ReviewStageCell({ member, cycleId }: { member: TeamRosterMemberDto; cycleId: string }) {
  const review = member.review;
  if (!review) return <DataTableCellEmpty />;
  return (
    <Link href={withCycle(reviewHref(review.reviewId), cycleId)} className="inline-flex flex-col items-start gap-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <StatusBadge tone={REVIEW_STAGE_TONE[review.state]}>{reviewStageLabel(review.state)}</StatusBadge>
      {review.dueDate ? <span className="text-xs text-muted-foreground">Due {formatDate(review.dueDate)}</span> : null}
    </Link>
  );
}

function rosterColumns(showOrgUnit: boolean, cycleId: string, showReviewStage: boolean, onRequestUpdate?: (member: TeamRosterMemberDto) => void) {
  return [
    column.accessor((m) => displayName(m), {
      id: "person",
      header: "Person",
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original;
        const context = [m.jobTitle, showOrgUnit ? m.orgUnitName : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <>
            <DataTableCellStack
              leading={
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">
                    {initials(m.employeeName)}
                  </AvatarFallback>
                </Avatar>
              }
              primary={displayName(m)}
              secondary={context || undefined}
            />
            {/* On a phone the Plan column folds in under the person; the row itself opens the plan. */}
            <div className="mt-2 pl-11 sm:hidden">
              <PlanStateCell member={m} />
            </div>
            {showReviewStage ? <div className="mt-2 pl-11 md:hidden"><ReviewStageCell member={m} cycleId={cycleId} /></div> : null}
          </>
        );
      },
      meta: {
        width: "32%",
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
    }),
    column.accessor("status", {
      id: "plan",
      header: "Plan",
      enableSorting: false,
      cell: ({ row }) => <PlanStateCell member={row.original} />,
      meta: {
        width: "18%",
        hideBelow: "sm",
        skeleton: <Skeleton className="h-5 w-24 rounded-full" />,
      },
    }),
    ...(showReviewStage ? [column.accessor((m) => m.review?.state, {
      id: "reviewStage",
      header: "Review stage",
      enableSorting: false,
      cell: ({ row }) => <ReviewStageCell member={row.original} cycleId={cycleId} />,
      meta: { width: "18%", hideBelow: "md", skeleton: <Skeleton className="h-5 w-32 rounded-full" /> },
    })] : []),
    column.accessor(
      (m) => (m.status === "Approved" ? m.planProgress : undefined),
      {
        id: "progress",
        header: "Progress",
        enableSorting: false,
        cell: ({ row }) => <ProgressCell member={row.original} />,
        meta: {
          width: "28%",
          hideBelow: "md",
          skeleton: <Skeleton className="h-2 w-full rounded-full" />,
        },
      }
    ),
    column.accessor(
      (m) => latestRosterActivity(m)?.at,
      {
        id: "activity",
        header: "Last activity",
        enableSorting: false,
        cell: ({ row }) => <ActivityCell member={row.original} />,
        meta: { hideBelow: "lg", skeleton: <Skeleton className="h-3.5 w-14" /> },
      }
    ),
    column.display({
      id: "action",
      header: () => <span className="sr-only">Open</span>,
      cell: ({ row }) => {
        const m = row.original;
        const href = planHref(cycleId, m);
        if (!href) return null;
        // Deciding is the one action worth a button; every other openable row is the row itself.
        if (m.canReview) {
          return (
            <Button size="sm" asChild>
              <Link href={href}>Review plan</Link>
            </Button>
          );
        }
        // An Approved plan the caller reviews gains a row menu; a row never shows both a menu and a chevron.
        if (m.canRequestUpdate && onRequestUpdate) {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${displayName(m)}`} onClick={(event) => event.stopPropagation()}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                <DropdownMenuItem asChild>
                  <Link href={href}>
                    <Eye className="size-3.5" data-icon="inline-start" /> Open plan
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onRequestUpdate(m)}>
                  <MessageSquare className="size-3.5" data-icon="inline-start" /> Request update
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        return <DataTableRowChevron />;
      },
      meta: {
        align: "end",
        width: "8rem",
        hideBelow: "sm",
        skeleton: <Skeleton className="h-7 w-24" />,
      },
    }),
  ];
}

const SKELETON_COLUMNS = rosterColumns(false, "", false);

const rosterRowId = (m: TeamRosterMemberDto) => m.employeeId;
const canOpenPlan = canOpen;

export const DEFAULT_PEOPLE_QUERY: YourPeopleQuery = { filter: "All", search: "", page: 1, pageSize: 25 };

export function YourPeople({
  cycleId,
  people,
  query,
  onQueryChange,
}: {
  cycleId: string;
  people: {
    data: YourPeoplePageDto | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };
  /** Controlled, so the page header can open the roster on "Needs review". */
  query: YourPeopleQuery;
  onQueryChange: (query: YourPeopleQuery) => void;
}) {
  const router = useRouter();
  const data = people.data;
  const members = data?.items;
  // The org unit only tells people apart when the page spans more than one; otherwise it repeats.
  const showOrgUnit = useMemo(
    () => new Set(members?.map((m) => m.orgUnitName).filter(Boolean)).size > 1,
    [members]
  );
  const [requesting, setRequesting] = useState<TeamRosterMemberDto | null>(null);
  const columns = useMemo(
    () => rosterColumns(showOrgUnit, cycleId, data?.hasActiveReviewRound ?? false, setRequesting),
    [showOrgUnit, cycleId, data?.hasActiveReviewRound],
  );
  // Any change of view or search starts again from the first page.
  const change = (next: Partial<YourPeopleQuery>) => onQueryChange({ ...query, page: 1, ...next });
  const model = useDataTable({
    data: members,
    columns,
    getRowId: rosterRowId,
    filters: ROSTER_FILTERS,
    manual: { rowCount: data?.matchCount ?? 0 },
    filterState: toRosterState(query.filter),
    onFilterStateChange: (state) =>
      change({ filter: (state.show as YourPeopleFilter[] | undefined)?.[0] ?? "All" }),
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
      next.pageSize !== query.pageSize
        ? change({ pageSize: next.pageSize })
        : onQueryChange({ ...query, page: next.pageIndex + 1 }),
  });

  if (!people.isLoading && (people.error || !data)) {
    return (
      <PageError
        title="Your people are unavailable"
        description={people.error?.message}
        onRetry={people.refetch}
      />
    );
  }

  return (
    <>
      <RosterSection
        model={model}
        isLoading={people.isLoading}
        count={data?.totalCount}
        onOpen={(m) => {
          const href = planHref(cycleId, m);
          if (href) router.push(href);
        }}
      />
      {requesting?.planId ? (
        <RequestUpdateDialog cycleId={cycleId} planId={requesting.planId} personName={displayName(requesting)} onClose={() => setRequesting(null)} />
      ) : null}
    </>
  );
}

/** The roster's loading state: the same table with shimmer rows from the same columns, so nothing jumps. */
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
  count,
  onOpen,
}: {
  model: DataTableModel<TeamRosterMemberDto>;
  isLoading: boolean;
  count?: number;
  onOpen?: (member: TeamRosterMemberDto) => void;
}) {
  return (
    <section
      id="your-people"
      aria-labelledby="your-people-heading"
      className="scroll-mt-6 space-y-4"
    >
      <h2
        id="your-people-heading"
        className="flex items-baseline gap-2 type-section-title text-foreground"
      >
        Your people
        {count ? (
          <span className="type-meta tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </h2>
      <DataTable
        model={model}
        isLoading={isLoading}
        searchPlaceholder="Search people…"
        noun={["person", "people"]}
        noResults="No people match this view"
        emptyState={<EmptyRoster />}
        onRowClick={onOpen}
        canClickRow={canOpenPlan}
      />
    </section>
  );
}

/**
 * Membership is owned by the organization, not the cycle — a manager who is missing someone can't add
 * them here, so this points them to where it is actually done rather than dead-ending. Plain anchor: the
 * Organization area lives in a different MFE, so the link must escape this app's basePath through the shell.
 */
export function AddPeopleCallout() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-surface border border-border bg-section px-5 py-4">
      <Lightbulb className="size-5 shrink-0 text-primary-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          Need to add someone to your team?
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Team membership is managed in the organization settings. Contact your
          administrator if someone is missing.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild className="shrink-0">
        {/* Core is another app: a full document navigation, not a Performance route (the catch-all route makes the lint rule think otherwise). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/core/org-chart">Go to Organization</a>
      </Button>
    </div>
  );
}

function EmptyRoster() {
  return (
    <>
      <Users className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
      <p className="mt-3 text-sm font-medium text-foreground">
        No one reports to you this cycle
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        People you manage in this cycle appear here as they plan and report
        progress.
      </p>
    </>
  );
}
