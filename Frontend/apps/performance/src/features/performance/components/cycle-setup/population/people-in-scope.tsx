"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  Ban,
  Eye,
  ExternalLink,
  MoreHorizontal,
  RotateCcw,
  Search,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import type { PopulationCandidateDto } from "@repo/api";
import { Input } from "@repo/ds/components/ui/input";
import { Button } from "@repo/ds/components/ui/button";
import { Checkbox } from "@repo/ds/components/ui/checkbox";
import { StatusBadge } from "@repo/ds/shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ds/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ds/components/ui/table";
import { cn } from "@repo/ds/lib/utils";
import {
  candidateStatus,
  isBulkSelectable,
  reviewerView,
  type CandidateStatus,
} from "./population-model";
import {
  EmployeeCell,
  OrgCell,
  ReviewerCell,
  StatusCell,
} from "./population-cells";
import { coreProfileHref } from "./needs-attention";
import { ExcludeDialog } from "./exclude-dialog";

type Filter = "all" | CandidateStatus;
type SortField = "employee" | "organization" | "reviewer" | "status";
type SortDir = "asc" | "desc";
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const STATUS_RANK: Record<CandidateStatus, number> = {
  ready: 0,
  attention: 1,
  excluded: 2,
};

function reviewerName(candidate: PopulationCandidateDto): string {
  const view = reviewerView(candidate);
  return view.kind === "unresolved" ? "" : view.name;
}

function matches(candidate: PopulationCandidateDto, term: string): boolean {
  if (!term) return true;
  const haystack = [
    candidate.displayName,
    candidate.jobTitle ?? "",
    candidate.orgUnitName ?? "",
    reviewerName(candidate),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function sortValue(
  candidate: PopulationCandidateDto,
  field: SortField
): string | number {
  switch (field) {
    case "organization":
      return (candidate.orgUnitName ?? "").toLowerCase();
    case "reviewer":
      return reviewerName(candidate).toLowerCase();
    case "status":
      return STATUS_RANK[candidateStatus(candidate)];
    default:
      return candidate.displayName.toLowerCase();
  }
}

/**
 * The full resolved roster: searchable, filterable, sortable, selectable, and paged. It is the
 * calm reference list — the actionable blockers live above in Needs attention — so a row opens
 * details; exclusion happens per-row from the overflow or in bulk from the selection bar.
 */
export function PeopleInScope({
  candidates,
  onExclude,
  onRestore,
  onExcludeMany,
  onRemoveInclusion,
  onInspect,
}: {
  candidates: PopulationCandidateDto[];
  onExclude: (candidate: PopulationCandidateDto) => void;
  onRestore: (candidate: PopulationCandidateDto) => void;
  onExcludeMany: (
    candidates: PopulationCandidateDto[],
    reason: string
  ) => Promise<void>;
  onRemoveInclusion: (candidate: PopulationCandidateDto) => void;
  onInspect: (candidate: PopulationCandidateDto) => void;
}) {
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir } | null>(
    null
  );
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const counts = useMemo(() => {
    const result = {
      all: candidates.length,
      ready: 0,
      attention: 0,
      excluded: 0,
    };
    for (const candidate of candidates) result[candidateStatus(candidate)] += 1;
    return result;
  }, [candidates]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const rows = candidates.filter(
      (candidate) =>
        (filter === "all" || candidateStatus(candidate) === filter) &&
        matches(candidate, needle)
    );
    if (sort) {
      rows.sort((a, b) => {
        const av = sortValue(a, sort.field);
        const bv = sortValue(b, sort.field);
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [candidates, filter, term, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > pageCount - 1) setPage(0);
  }, [page, pageCount]);
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const actionableIds = useMemo(
    () =>
      new Set(
        candidates
          .filter(isBulkSelectable)
          .map((candidate) => candidate.employeeId)
      ),
    [candidates]
  );
  useEffect(() => {
    setSelected((current) => {
      const next = new Set([...current].filter((id) => actionableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [actionableIds]);

  const selectedCandidates = candidates.filter(
    (candidate) =>
      selected.has(candidate.employeeId) && isBulkSelectable(candidate)
  );
  const selectedCount = selectedCandidates.length;
  const selectionVisible = filter !== "excluded";
  const pageIds = pageRows
    .filter(isBulkSelectable)
    .map((candidate) => candidate.employeeId);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleSort(field: SortField) {
    setSort((prev) =>
      prev?.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  }

  function changeFilter(next: Filter) {
    setFilter(next);
    setPage(0);
    if (next === "excluded") setSelected(new Set());
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Users className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="type-section-title text-foreground">
              People in scope
            </h2>
            <p className="type-meta text-muted-foreground">
              Review everyone resolved from the selected scope, including
              readiness and exclusions.
            </p>
          </div>
          <StatusBadge tone="neutral">{counts.all} resolved</StatusBadge>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:max-w-sm lg:flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search employees, organization, or reviewer…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              active={filter === "all"}
              onClick={() => changeFilter("all")}
              label="All"
              count={counts.all}
            />
            <FilterChip
              active={filter === "ready"}
              onClick={() => changeFilter("ready")}
              label="Ready"
              count={counts.ready}
              dot="bg-emerald-500"
            />
            <FilterChip
              active={filter === "attention"}
              onClick={() => changeFilter("attention")}
              label="Needs attention"
              count={counts.attention}
              dot="bg-amber-500"
            />
            <FilterChip
              active={filter === "excluded"}
              onClick={() => changeFilter("excluded")}
              label="Excluded"
              count={counts.excluded}
              dot="bg-muted-foreground/60"
            />
          </div>
        </div>

        {selectionVisible && selectedCount > 0 ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/[0.06] px-4 py-2.5">
            <p className="type-label text-foreground">
              {selectedCount} selected
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkOpen(true)}
              >
                Exclude selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                <X className="size-4" data-icon="inline-start" />
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border">
        <Table className="table-fixed [&_th:first-child]:pl-3 [&_td:first-child]:pl-3 [&_th:last-child]:pr-3 [&_td:last-child]:pr-3 md:table-auto md:[&_th:first-child]:pl-5 md:[&_td:first-child]:pl-5 md:[&_th:last-child]:pr-5 md:[&_td:last-child]:pr-5">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectionVisible ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allPageSelected
                        ? true
                        : somePageSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={togglePage}
                    disabled={pageIds.length === 0}
                    aria-label="Select all non-excluded people on this page"
                  />
                </TableHead>
              ) : null}
              <SortableHead
                label="Employee"
                field="employee"
                sort={sort}
                onSort={toggleSort}
              />
              <SortableHead
                label="Organization"
                field="organization"
                sort={sort}
                onSort={toggleSort}
                className="hidden md:table-cell"
              />
              <SortableHead
                label="Reviewer"
                field="reviewer"
                sort={sort}
                onSort={toggleSort}
                className="hidden lg:table-cell"
              />
              <SortableHead
                label="Status"
                field="status"
                sort={sort}
                onSort={toggleSort}
                className="w-28 md:w-auto"
              />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={selectionVisible ? 6 : 5}
                  className="py-12 text-center type-body-secondary text-muted-foreground"
                >
                  No people match these filters.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((candidate) => {
                const isSelected = selected.has(candidate.employeeId);
                return (
                  <TableRow
                    key={candidate.employeeId}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer",
                      candidate.isExcluded && "opacity-60"
                    )}
                    onClick={() => onInspect(candidate)}
                  >
                    {selectionVisible ? (
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        {isBulkSelectable(candidate) ? (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() =>
                              toggleRow(candidate.employeeId)
                            }
                            aria-label={`Select ${candidate.displayName}`}
                          />
                        ) : null}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <EmployeeCell candidate={candidate} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <OrgCell candidate={candidate} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <ReviewerCell candidate={candidate} />
                    </TableCell>
                    <TableCell>
                      <StatusCell candidate={candidate} />
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onSelect={() => onInspect(candidate)}
                          >
                            <Eye className="size-4" data-icon="inline-start" />
                            {candidateStatus(candidate) === "attention"
                              ? "View issue details"
                              : "View details"}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={coreProfileHref(candidate.employeeId)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink
                                className="size-4"
                                data-icon="inline-start"
                              />
                              View in Core
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {candidate.isExcluded ? (
                            <DropdownMenuItem
                              onSelect={() => onRestore(candidate)}
                            >
                              <RotateCcw className="size-4" data-icon="inline-start" />
                              Restore to population
                            </DropdownMenuItem>
                          ) : candidate.byExplicitInclusion ? (
                            <DropdownMenuItem
                              onSelect={() => onRemoveInclusion(candidate)}
                            >
                              <UserMinus className="size-4" data-icon="inline-start" />
                              Remove explicit addition
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => onExclude(candidate)}
                            >
                              <Ban className="size-4" data-icon="inline-start" />
                              Exclude from cycle
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-meta text-muted-foreground">
            Showing{" "}
            <span className="tabular-nums text-foreground">
              {filtered.length === 0 ? 0 : page * pageSize + 1}–
              {Math.min(filtered.length, (page + 1) * pageSize)}
            </span>{" "}
            of{" "}
            <span className="tabular-nums text-foreground">
              {filtered.length}
            </span>
          </p>
          <div className="flex items-center gap-4">
            <Pager page={page} pageCount={pageCount} onChange={setPage} />
            <div className="flex items-center gap-2">
              <span className="type-meta text-muted-foreground">
                Rows per page
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(0);
                }}
              >
                <SelectTrigger size="sm" className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <ExcludeDialog
        name={`${selectedCount} ${selectedCount === 1 ? "employee" : "employees"}`}
        confirmLabel={`Exclude ${selectedCount} ${selectedCount === 1 ? "employee" : "employees"}`}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onExclude={async (reason) => {
          await onExcludeMany(selectedCandidates, reason);
          setSelected(new Set());
        }}
      />
    </section>
  );
}

function SortableHead({
  label,
  field,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  sort: { field: SortField; dir: SortDir } | null;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = sort?.field === field;
  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === "asc"
      ? ChevronUp
      : ChevronDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "flex items-center gap-1.5 transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon
          className={cn("size-3.5", active ? "text-primary" : "opacity-60")}
          aria-hidden
        />
      </button>
    </TableHead>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 type-label transition-colors",
        active
          ? "border-primary/50 bg-primary/[0.08] text-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {dot ? (
        <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      ) : null}
      {label}
      <span
        className={cn(
          "tabular-nums",
          active ? "text-foreground" : "text-muted-foreground/70"
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** Numbered pager with prev/next and an ellipsis for long ranges. */
function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const current = page + 1; // 1-based for display
  const pages: (number | "…")[] = [];
  const push = (n: number) => pages.push(n);
  push(1);
  const start = Math.max(2, current - 1);
  const end = Math.min(pageCount - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let n = start; n <= end; n += 1) push(n);
  if (end < pageCount - 1) pages.push("…");
  if (pageCount > 1) push(pageCount);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>
      {pages.map((entry, index) =>
        entry === "…" ? (
          <span
            key={`gap-${index}`}
            className="px-1.5 type-meta text-muted-foreground"
          >
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry - 1)}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg type-label tabular-nums transition-colors",
              entry === current
                ? "border border-primary/50 bg-primary/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {entry}
          </button>
        )
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
