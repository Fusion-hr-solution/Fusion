"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Lightbulb,
  PencilLine,
  RotateCcw,
  Users,
  Eye,
} from "@/lib/icons";
import type {
  RosterActivityKind,
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
  DataTableCellNumber,
  DataTableCellProgress,
  DataTableCellStack,
  DataTableRowChevron,
  createDataTableColumnHelper,
  useDataTable,
  type DataTableFilterField,
  type DataTableFilterState,
  type DataTableModel,
  type SortingState,
} from "@repo/ds/data-table";
import { PageError, StatusBadge } from "@repo/ds/shell";
import type { StatusTone } from "@repo/ds/shell";
import { initials, pct } from "../plan/plan-lib";
import { formatDate } from "../../lib";

/**
 * Your People — the manager's operational roster for the current Cycle. It is the attention/index layer,
 * not another plan workspace: each person shows where their canonical Plan sits in the lifecycle and how
 * execution is progressing, and the row opens the canonical Plan surface.
 *
 * Every fact is real: lifecycle and progress come from the Plan aggregate and canonical progress truth,
 * "Not started" means no Plan exists (never a fabricated Draft), and the "Review" action appears only
 * when the caller actually holds decision authority — roster membership never implies it.
 */

type StatusMeta = {
  label: string;
  tone: StatusTone;
  icon: ComponentType<{ className?: string }>;
};

// Lifecycle language + restrained Fusion tones. Amber (warning) is the one attention state
// (Submitted); a returned plan the employee now owns stays quiet so it never competes with it.
const STATUS_META: Record<RosterPlanStatus, StatusMeta> = {
  NotStarted: { label: "Not started", tone: "muted", icon: CircleDashed },
  Draft: { label: "Draft", tone: "info", icon: PencilLine },
  ReturnedForChanges: { label: "Returned", tone: "muted", icon: RotateCcw },
  Submitted: { label: "Submitted", tone: "warning", icon: Clock },
  Approved: { label: "Approved", tone: "success", icon: CheckCircle2 },
};

// Sorting the Plan column ascending puts what needs the manager first.
const STATUS_RANK: Record<RosterPlanStatus, number> = {
  Submitted: 0,
  ReturnedForChanges: 1,
  Draft: 2,
  NotStarted: 3,
  Approved: 4,
};

const ACTIVITY_LABEL: Record<RosterActivityKind, string | null> = {
  None: null,
  DraftUpdated: "Draft updated",
  Returned: "Returned",
  Submitted: "Submitted",
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
        noProgress: "No progress",
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

const TWO_LINES = (
  <div className="w-full space-y-1.5">
    <Skeleton className="h-3.5 w-20" />
    <Skeleton className="h-3 w-14" />
  </div>
);

const ROSTER_COLUMNS = [
  column.accessor((m) => displayName(m), {
    id: "person",
    header: "Person",
    sortFn: "text",
    cell: ({ row }) => {
      const m = row.original;
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
          secondary={m.jobTitle ?? undefined}
        />
      );
    },
    meta: {
      width: "30%",
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
    cell: ({ row }) => {
      const meta = STATUS_META[row.original.status];
      return (
        <StatusBadge tone={meta.tone}>
          <meta.icon className="size-3.5" />
          {meta.label}
        </StatusBadge>
      );
    },
    meta: {
      width: "16%",
      skeleton: <Skeleton className="h-5 w-24 rounded-full" />,
    },
  }),
  column.accessor(
    (m) => (m.status === "NotStarted" ? undefined : m.objectiveCount),
    {
      id: "objectives",
      header: "Objectives",
      sortFn: "basic",
      sortUndefined: "last",
      cell: ({ row }) => {
        const m = row.original;
        if (m.status === "NotStarted") return <DataTableCellEmpty />;
        return (
          <DataTableCellNumber
            value={m.objectiveCount}
            secondary={
              m.status === "Approved"
                ? `${m.updatedCount} of ${m.objectiveCount} updated`
                : `${pct(m.weightTotal)}% weighted`
            }
          />
        );
      },
      meta: { width: "14%", skeleton: TWO_LINES },
    }
  ),
  column.accessor(
    (m) =>
      m.status === "Approved" && m.hasProgress ? m.planProgress : undefined,
    {
      id: "progress",
      header: "Progress",
      sortFn: "basic",
      sortUndefined: "last",
      cell: ({ row }) => {
        const m = row.original;
        if (m.status !== "Approved") return <DataTableCellEmpty />;
        if (!m.hasProgress)
          return <DataTableCellEmpty>No updates</DataTableCellEmpty>;
        return (
          <DataTableCellProgress
            value={m.planProgress}
            tone={m.planProgress >= 100 ? "success" : "primary"}
          />
        );
      },
      meta: {
        width: "18%",
        skeleton: <Skeleton className="h-1.5 w-full rounded-full" />,
      },
    }
  ),
  column.accessor(
    (m) => (ACTIVITY_LABEL[m.activityKind] && m.activityAt) || undefined,
    {
      id: "activity",
      header: "Latest activity",
      // ISO timestamps order correctly as strings.
      sortFn: "basic",
      sortUndefined: "last",
      cell: ({ row }) => {
        const m = row.original;
        const label = ACTIVITY_LABEL[m.activityKind];
        if (!label || !m.activityAt) return <DataTableCellEmpty />;
        return (
          <DataTableCellStack
            primary={<span className="font-normal">{label}</span>}
            secondary={formatDate(m.activityAt.slice(0, 10))}
          />
        );
      },
      meta: { skeleton: TWO_LINES },
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
          <Link href={href}>Review</Link>
        </Button>
      ) : (
        <DataTableRowChevron />
      );
    },
    meta: {
      align: "end",
      width: "7rem",
      skeleton: <Skeleton className="h-7 w-16" />,
    },
  }),
];

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
  const model = useDataTable({
    data: roster.data?.members,
    columns: ROSTER_COLUMNS,
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
    columns: ROSTER_COLUMNS,
    getRowId: rosterRowId,
    search: rosterSearchText,
    filters: ROSTER_FILTERS,
  });
  return <RosterSection model={model} isLoading />;
}

function RosterSection({
  model,
  isLoading,
  onOpen,
}: {
  model: DataTableModel<TeamRosterMemberDto>;
  isLoading: boolean;
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
        className="type-section-title text-foreground"
      >
        Your people
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
