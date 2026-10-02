"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ComponentType } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Eye,
  Lightbulb,
  PencilLine,
  RotateCcw,
  Users,
} from "@/lib/icons";
import type {
  RosterActivityKind,
  RosterObjectiveProgressDto,
  RosterPlanStatus,
  TeamRosterDto,
  TeamRosterMemberDto,
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
  type SortingState,
} from "@repo/ds/data-table";
import { PageError, StatusBadge, type StatusTone } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { PROGRESS_TONE_BG, initials } from "../plan/plan-lib";
import { formatDateTime, formatRelativeTime } from "../../lib";

/**
 * Your People — the manager's operational roster for the current Cycle. It is the attention/index layer,
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

// Sorting the Plan column ascending puts what needs the manager first, then the plans in execution,
// then everyone still planning.
const STATUS_RANK: Record<RosterPlanStatus, number> = {
  Submitted: 0,
  Approved: 1,
  ReturnedForChanges: 2,
  Draft: 3,
  NotStarted: 4,
};

const ACTIVITY_LABEL: Record<RosterActivityKind, string | null> = {
  None: null,
  DraftUpdated: "Draft updated",
  Returned: "Returned for changes",
  Submitted: "Plan submitted",
  Resubmitted: "Resubmitted",
  Approved: "Plan approved",
  ProgressUpdated: "Progress updated",
};

export type RosterFilter =
  | "all"
  | "needsReview"
  | "planning"
  | "approved"
  | "noProgress";

const PLANNING_STATUSES: RosterPlanStatus[] = [
  "NotStarted",
  "Draft",
  "ReturnedForChanges",
];

function matchesFilter(
  member: TeamRosterMemberDto,
  filter: RosterFilter
): boolean {
  switch (filter) {
    case "needsReview":
      return member.canReview;
    case "planning":
      return PLANNING_STATUSES.includes(member.status);
    case "approved":
      return member.status === "Approved";
    case "noProgress":
      return member.status === "Approved" && !member.hasProgress;
    default:
      return true;
  }
}

// The roster's primary question, as its one pinned filter: always shown, resets to "All".
const ROSTER_FILTERS: DataTableFilterField<TeamRosterMemberDto>[] = [
  {
    id: "show",
    label: "Show",
    icon: Eye,
    type: "options",
    single: true,
    pinned: true,
    options: (
      ["needsReview", "planning", "approved", "noProgress"] as const
    ).map((id) => ({
      value: id,
      label: {
        needsReview: "Needs review",
        planning: "Planning",
        approved: "Approved",
        noProgress: "No updates",
      }[id],
      match: (m: TeamRosterMemberDto) => matchesFilter(m, id),
    })),
  },
];

function toRosterState(
  filter: RosterFilter | undefined
): DataTableFilterState | undefined {
  if (filter === undefined) return undefined;
  return { show: filter === "all" ? undefined : [filter] };
}

const DEFAULT_SORT: SortingState = [{ id: "plan", desc: false }];

function displayName(member: TeamRosterMemberDto): string {
  return member.employeeName ?? "Employee";
}

// Only open the plan when the caller may actually see it — a never-submitted Draft is the employee's
// private workspace and has no reviewable surface.
function planHref(member: TeamRosterMemberDto): string | null {
  return member.planId && (member.canReview || member.canView)
    ? `/team/${member.planId}`
    : null;
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
  if (member.status !== "Approved") return <DataTableCellEmpty />;
  const slices = member.objectiveProgress;
  const reporting = slices.filter((o) => o.hasProgress).length;
  const value = Math.round(member.planProgress);
  const overdue = member.overdueMilestoneCount;
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
          {overdue} milestone{overdue === 1 ? "" : "s"} overdue
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

/**
 * Recency only: what happened is already said by the Plan and Progress cells beside it, so the event
 * rides along for assistive tech and the exact-time tooltip rather than being printed a second time.
 */
function ActivityCell({ member }: { member: TeamRosterMemberDto }) {
  const label = ACTIVITY_LABEL[member.activityKind];
  if (!label || !member.activityAt) return <DataTableCellEmpty />;
  return (
    <span className="text-sm tabular-nums text-muted-foreground">
      <span className="sr-only">{label}, </span>
      <time
        dateTime={member.activityAt}
        title={`${label} · ${formatDateTime(member.activityAt)}`}
      >
        {formatRelativeTime(member.activityAt)}
      </time>
    </span>
  );
}

function rosterColumns(showOrgUnit: boolean) {
  return [
    column.accessor((m) => displayName(m), {
      id: "person",
      header: "Person",
      sortFn: "text",
      cell: ({ row }) => {
        const m = row.original;
        const context = [m.jobTitle, showOrgUnit ? m.orgUnitName : null]
          .filter(Boolean)
          .join(" · ");
        return (
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
      sortFn: (a, b) =>
        STATUS_RANK[a.original.status] - STATUS_RANK[b.original.status] ||
        displayName(a.original).localeCompare(
          displayName(b.original),
          undefined,
          { sensitivity: "base" }
        ),
      cell: ({ row }) => <PlanStateCell member={row.original} />,
      meta: {
        width: "18%",
        skeleton: <Skeleton className="h-5 w-24 rounded-full" />,
      },
    }),
    column.accessor(
      (m) => (m.status === "Approved" ? m.planProgress : undefined),
      {
        id: "progress",
        header: "Progress",
        sortFn: "basic",
        sortUndefined: "last",
        cell: ({ row }) => <ProgressCell member={row.original} />,
        meta: {
          width: "28%",
          skeleton: <Skeleton className="h-2 w-full rounded-full" />,
        },
      }
    ),
    column.accessor(
      (m) => (ACTIVITY_LABEL[m.activityKind] && m.activityAt) || undefined,
      {
        id: "activity",
        header: "Last activity",
        // ISO timestamps order correctly as strings; most recent first.
        sortFn: "basic",
        sortDescFirst: true,
        sortUndefined: "last",
        cell: ({ row }) => <ActivityCell member={row.original} />,
        meta: { skeleton: <Skeleton className="h-3.5 w-14" /> },
      }
    ),
    column.display({
      id: "action",
      header: () => <span className="sr-only">Open</span>,
      cell: ({ row }) => {
        const m = row.original;
        const href = planHref(m);
        if (!href) return null;
        // Deciding is the one action worth a button; every other openable row is the row itself.
        return m.canReview ? (
          <Button size="sm" asChild>
            <Link href={href}>Review plan</Link>
          </Button>
        ) : (
          <DataTableRowChevron />
        );
      },
      meta: {
        align: "end",
        width: "8rem",
        skeleton: <Skeleton className="h-7 w-24" />,
      },
    }),
  ];
}

const SKELETON_COLUMNS = rosterColumns(false);

const rosterSearchText = (m: TeamRosterMemberDto) =>
  `${m.employeeName ?? ""} ${m.jobTitle ?? ""}`;
const rosterRowId = (m: TeamRosterMemberDto) => m.employeeId;
const canOpenPlan = (m: TeamRosterMemberDto) => planHref(m) !== null;

export function YourPeople({
  roster,
  filter,
  onFilterChange,
}: {
  roster: {
    data: TeamRosterDto | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };
  /** Controlled view, so the page header can open the roster on "Needs review". */
  filter?: RosterFilter;
  onFilterChange?: (filter: RosterFilter) => void;
}) {
  const router = useRouter();
  const members = roster.data?.members;
  // The org unit only tells people apart when the roster spans more than one; otherwise it repeats.
  const showOrgUnit = useMemo(
    () => new Set(members?.map((m) => m.orgUnitName).filter(Boolean)).size > 1,
    [members]
  );
  const columns = useMemo(() => rosterColumns(showOrgUnit), [showOrgUnit]);
  const model = useDataTable({
    data: members,
    columns,
    getRowId: rosterRowId,
    search: rosterSearchText,
    filters: ROSTER_FILTERS,
    filterState: toRosterState(filter),
    onFilterStateChange: onFilterChange
      ? (state) =>
          onFilterChange(
            (state.show as RosterFilter[] | undefined)?.[0] ?? "all"
          )
      : undefined,
    initialSorting: DEFAULT_SORT,
  });

  if (!roster.isLoading && (roster.error || !roster.data)) {
    return (
      <PageError
        title="Your people are unavailable"
        description={roster.error?.message}
        onRetry={roster.refetch}
      />
    );
  }

  return (
    <RosterSection
      model={model}
      isLoading={roster.isLoading}
      count={members?.length}
      onOpen={(m) => {
        const href = planHref(m);
        if (href) router.push(href);
      }}
    />
  );
}

/** The roster's loading state: the same table with shimmer rows from the same columns, so nothing jumps. */
export function RosterSkeleton() {
  const model = useDataTable({
    data: undefined,
    columns: SKELETON_COLUMNS,
    getRowId: rosterRowId,
    search: rosterSearchText,
    filters: ROSTER_FILTERS,
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
        minWidth="880px"
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
