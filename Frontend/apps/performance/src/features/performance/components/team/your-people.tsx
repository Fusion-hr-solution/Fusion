"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock,
  Lightbulb,
  ListFilter,
  PencilLine,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import type {
  RosterActivityKind,
  RosterPlanStatus,
  TeamRosterDto,
  TeamRosterMemberDto,
} from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ds/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ds/components/ui/pagination";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { PageError, StatusBadge } from "@repo/ds/shell";
import type { StatusTone } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { initials, pct, progressPct } from "../plan/plan-lib";
import { formatDate } from "../../lib";

/**
 * Your People — the manager's operational roster for the current Cycle. It is the attention/index layer,
 * not another plan workspace: each person shows where their canonical Plan sits in the lifecycle, whether
 * it needs the manager now, and how execution is progressing, then links to the canonical Plan surface.
 *
 * Every fact is real: lifecycle and progress come from the Plan aggregate and canonical progress truth,
 * "Not started" means no Plan exists (never a fabricated Draft), and the strong "Review plan" action
 * appears only when the caller actually holds decision authority — roster membership never implies it.
 */

const PAGE_SIZE = 8;

// One column template shared by the header, the rows, and the loading skeleton so they stay aligned.
const ROW_COLS =
  "grid grid-cols-[minmax(200px,1.9fr)_minmax(150px,1.15fr)_minmax(108px,0.85fr)_minmax(150px,1.2fr)_minmax(116px,0.95fr)_minmax(104px,auto)] items-center gap-4 px-5";

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
  ReturnedForChanges: { label: "Returned for changes", tone: "warning", icon: RotateCcw },
  Submitted: { label: "Submitted", tone: "warning", icon: Clock },
  Approved: { label: "Approved", tone: "success", icon: CheckCircle2 },
};

const ACTIVITY_LABEL: Record<RosterActivityKind, string | null> = {
  None: null,
  DraftUpdated: "Draft updated",
  Returned: "Returned",
  Submitted: "Submitted",
  ProgressUpdated: "Progress updated",
};

type RosterFilter = "all" | "needsReview" | "planning" | "approved" | "noProgress";
type RosterSort = "nameAsc" | "nameDesc";

const PLANNING_STATUSES: RosterPlanStatus[] = ["NotStarted", "Draft", "ReturnedForChanges"];

function matchesFilter(member: TeamRosterMemberDto, filter: RosterFilter): boolean {
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

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] ?? "the employee";
}

export function YourPeople({
  roster,
}: {
  roster: {
    data: TeamRosterDto | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [sort, setSort] = useState<RosterSort>("nameAsc");
  const [page, setPage] = useState(1);

  // Narrowing or re-sorting the roster should return the manager to the first page, so the visible
  // window always reflects the current query rather than a stale offset.
  useEffect(() => {
    setPage(1);
  }, [query, filter, sort]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = (roster.data?.members ?? [])
      .filter((m) => matchesFilter(m, filter))
      .filter(
        (m) =>
          term === "" ||
          (m.employeeName ?? "").toLowerCase().includes(term) ||
          (m.jobTitle ?? "").toLowerCase().includes(term)
      );
    rows.sort((a, b) => {
      const cmp = (a.employeeName ?? "").localeCompare(b.employeeName ?? "", undefined, {
        sensitivity: "base",
      });
      return sort === "nameAsc" ? cmp : -cmp;
    });
    return rows;
  }, [roster.data?.members, query, filter, sort]);

  if (roster.isLoading) return <RosterSkeleton />;
  if (roster.error || !roster.data) {
    return (
      <PageError
        title="Your people are unavailable"
        description={roster.error?.message}
        onRetry={roster.refetch}
      />
    );
  }

  const data = roster.data;
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const pageRows = visible.slice(start, start + PAGE_SIZE);

  return (
    <section
      aria-labelledby="your-people-heading"
      className="mt-6 space-y-5 rounded-2xl border border-border bg-muted/20 p-5 sm:p-6"
    >
      <div>
        <h2 id="your-people-heading" className="type-page-title text-foreground">
          Your People
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.totalPeople} {data.totalPeople === 1 ? "person" : "people"} in your team. Track plan
          status and progress throughout the cycle.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} count={data.totalPeople}>
            All
          </FilterChip>
          <FilterChip
            active={filter === "needsReview"}
            onClick={() => setFilter("needsReview")}
            count={data.needsReviewCount}
          >
            Needs review
          </FilterChip>
          <FilterChip
            active={filter === "planning"}
            onClick={() => setFilter("planning")}
            count={data.planningCount}
          >
            Planning
          </FilterChip>
          <FilterChip
            active={filter === "approved"}
            onClick={() => setFilter("approved")}
            count={data.approvedCount}
          >
            Approved
          </FilterChip>
          <FilterChip
            active={filter === "noProgress"}
            onClick={() => setFilter("noProgress")}
            count={data.noProgressCount}
          >
            No progress
          </FilterChip>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as RosterSort)}>
          <SelectTrigger className="ml-auto" aria-label="Sort people">
            <ListFilter className="size-4 text-muted-foreground" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            <SelectItem value="nameAsc">Name (A–Z)</SelectItem>
            <SelectItem value="nameDesc">Name (Z–A)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.totalPeople === 0 ? (
        <EmptyRoster />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <div className="min-w-[880px]">
                <div role="row" className={cn(ROW_COLS, "border-b border-border bg-muted/30 py-2.5")}>
                  <HeaderCell>Person</HeaderCell>
                  <HeaderCell>Plan</HeaderCell>
                  <HeaderCell>Objectives</HeaderCell>
                  <HeaderCell>Plan progress</HeaderCell>
                  <HeaderCell>Latest activity</HeaderCell>
                  <HeaderCell className="text-right">Action</HeaderCell>
                </div>

                {pageRows.length === 0 ? (
                  <p className="px-5 py-14 text-center text-sm text-muted-foreground">
                    No people match this view.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {pageRows.map((member) => (
                      <RosterRow key={member.employeeId} member={member} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {pageRows.length} of {visible.length}{" "}
              {visible.length === 1 ? "person" : "people"}
            </p>
            {pageCount > 1 ? (
              <Pager page={current} pageCount={pageCount} onChange={setPage} />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Membership is owned by the organization, not the cycle — a manager who is missing someone can't add
 * them here, so this points them to where it is actually done rather than dead-ending. It sits outside the
 * roster section as a page-level footer. Plain anchor: the Organization area lives in a different MFE, so
 * the link must escape this app's basePath through the shell.
 */
export function AddPeopleCallout() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
      <Lightbulb className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Need to add someone to your team?</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Team membership is managed in the organization settings. Contact your administrator if
          someone is missing.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild className="shrink-0">
        <a href="/core/org-chart">Go to Organization</a>
      </Button>
    </div>
  );
}

// ── Summary + toolbar pieces ──────────────────────────────────────────────────────

function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {children}
      <span className={cn("tabular-nums", active ? "text-primary" : "text-muted-foreground/70")}>
        {count}
      </span>
    </button>
  );
}

function HeaderCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="columnheader" className={cn("type-eyebrow text-muted-foreground", className)}>
      {children}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────────

function RosterRow({ member }: { member: TeamRosterMemberDto }) {
  const meta = STATUS_META[member.status];
  const actionable = member.canReview;
  // Only link into the plan when the caller may actually open it — a never-submitted Draft is the
  // employee's private workspace and has no reviewable surface, so it stays un-linked.
  const planHref = member.planId && (member.canReview || member.canView) ? `/team/${member.planId}` : null;

  return (
    <div
      role="row"
      data-actionable={actionable || undefined}
      className={cn(
        ROW_COLS,
        "border-l-2 border-transparent py-3.5 transition-colors",
        actionable ? "border-l-primary bg-warning-subtle/25" : "hover:bg-muted/30"
      )}
    >
      {/* Person */}
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="text-xs">{initials(member.employeeName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {planHref ? (
            <Link
              href={planHref}
              className="truncate font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {member.employeeName ?? "Employee"}
            </Link>
          ) : (
            <p className="truncate font-medium text-foreground">
              {member.employeeName ?? "Employee"}
            </p>
          )}
          <p className="truncate text-xs text-muted-foreground">{member.jobTitle ?? "—"}</p>
        </div>
      </div>

      {/* Plan */}
      <div className="min-w-0">
        <StatusBadge tone={meta.tone}>
          <meta.icon className="size-3.5" />
          {meta.label}
        </StatusBadge>
        <PlanContext member={member} />
      </div>

      {/* Objectives */}
      <ObjectivesCell member={member} />

      {/* Plan progress */}
      <ProgressCell member={member} />

      {/* Latest activity */}
      <ActivityCell member={member} />

      {/* Action */}
      <div className="flex justify-end">
        {member.canReview && planHref ? (
          <Button size="sm" asChild>
            <Link href={planHref}>Review plan</Link>
          </Button>
        ) : member.canView && planHref ? (
          <Link
            href={planHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:underline"
          >
            View plan
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground/60">—</span>
        )}
      </div>
    </div>
  );
}

function PlanContext({ member }: { member: TeamRosterMemberDto }) {
  let text: string | null = null;
  switch (member.status) {
    case "Draft":
      text = "Employee is planning";
      break;
    case "ReturnedForChanges":
      text = `Waiting on ${firstName(member.employeeName)}`;
      break;
    case "Submitted":
      text = member.activityAt ? `Submitted ${formatDate(member.activityAt.slice(0, 10))}` : null;
      break;
    default:
      text = null;
  }
  if (!text) return null;
  return <p className="mt-1.5 truncate text-xs text-muted-foreground">{text}</p>;
}

function ObjectivesCell({ member }: { member: TeamRosterMemberDto }) {
  if (member.status === "NotStarted") return <Muted />;
  const secondary =
    member.status === "Approved"
      ? `${member.updatedCount} updated`
      : `${pct(member.weightTotal)}% allocated`;
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium tabular-nums text-foreground">
        {member.objectiveCount} {member.objectiveCount === 1 ? "objective" : "objectives"}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{secondary}</p>
    </div>
  );
}

function ProgressCell({ member }: { member: TeamRosterMemberDto }) {
  if (member.status !== "Approved") return <Muted />;
  if (!member.hasProgress) {
    return (
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">No progress reported yet</p>
        <span className="mt-2 block h-1.5 rounded-full bg-muted" />
      </div>
    );
  }
  const value = Math.max(0, Math.min(100, Math.round(member.planProgress)));
  const complete = value >= 100;
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          complete ? "text-success" : "text-foreground"
        )}
      >
        {progressPct(member.planProgress)}%
      </p>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", complete ? "bg-success" : "bg-primary")}
          style={{ width: `${value}%` }}
        />
      </span>
    </div>
  );
}

function ActivityCell({ member }: { member: TeamRosterMemberDto }) {
  const label = ACTIVITY_LABEL[member.activityKind];
  if (!label || !member.activityAt) return <Muted />;
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatDate(member.activityAt.slice(0, 10))}
      </p>
    </div>
  );
}

function Muted() {
  return <span className="text-sm text-muted-foreground/60">—</span>;
}

// ── Pager + empty ───────────────────────────────────────────────────────────────────

function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const go = (n: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (n >= 1 && n <= pageCount) onChange(n);
  };
  const disabled = "pointer-events-none opacity-50";
  return (
    <Pagination className="mx-0 w-auto">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={go(page - 1)}
            aria-disabled={page <= 1}
            className={cn(page <= 1 && disabled)}
          />
        </PaginationItem>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
          <PaginationItem key={n}>
            <PaginationLink
              href="#"
              isActive={n === page}
              onClick={go(n)}
              className="tabular-nums"
            >
              {n}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={go(page + 1)}
            aria-disabled={page >= pageCount}
            className={cn(page >= pageCount && disabled)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

/**
 * The roster's own loading state — the real section shape (header, summary, toolbar, table) rendered as
 * shimmer, so the layout does not jump when the data lands. Shares ROW_COLS with the live table so the
 * skeleton columns align exactly with the real ones.
 */
function RosterSkeleton() {
  return (
    <section
      aria-hidden
      className="mt-6 space-y-5 rounded-2xl border border-border bg-muted/20 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 min-w-52 flex-1" />
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="ml-auto h-9 w-36" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-[880px]">
            <div className={cn(ROW_COLS, "border-b border-border bg-muted/30 py-2.5")}>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-3 w-16" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }, (_, r) => (
                <div key={r} className={cn(ROW_COLS, "py-3.5")}>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="w-full space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-10" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                  <div className="flex justify-end">
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyRoster() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-16 text-center">
      <Users className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
      <p className="mt-3 text-sm font-medium text-foreground">No one reports to you this cycle</p>
      <p className="mt-1 text-sm text-muted-foreground">
        People you manage in this cycle will appear here as they plan and report progress.
      </p>
    </div>
  );
}
