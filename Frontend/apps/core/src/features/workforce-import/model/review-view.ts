import type {
  WorkforceReviewCountsDto,
  WorkforceReviewFilter,
  WorkforceReviewIssueGroupDto,
  WorkforceReviewRowDto,
} from "@repo/api";

/** "" is every row in the proposal. */
export type ReviewFilter = WorkforceReviewFilter | "";

export type ReviewChip = { key: ReviewFilter; label: string; count: number; tone?: "destructive" };

/** The views worth offering: All always, the rest only when they hold someone. */
export function reviewChips(counts: WorkforceReviewCountsDto): ReviewChip[] {
  const chips: ReviewChip[] = [
    { key: "", label: "All", count: counts.total },
    { key: "Blocked", label: "Needs attention", count: counts.blocked, tone: "destructive" },
    { key: "Create", label: "Create", count: counts.create },
    { key: "Existing", label: "Already in Fusion", count: counts.existing },
    { key: "NotImported", label: "Not imported", count: counts.notImported },
    { key: "Warnings", label: "With warnings", count: counts.withWarnings },
  ];
  return chips.filter((chip) => chip.key === "" || chip.count > 0);
}

export type EmploymentState = { label: string; date: string | null };

/** Where the person's employment stands on the workforce-as-of date. */
export function employmentState(row: WorkforceReviewRowDto, baseline: string): EmploymentState {
  const { startDate, endDate } = row.employment;
  if (endDate && endDate <= baseline) return { label: "Ended on", date: endDate };
  if (row.issues.some((i) => i.code === "NotImportedEndedBeforeToday") && endDate) return { label: "Ended on", date: endDate };
  if (startDate && startDate > baseline) return { label: "Starts on", date: startDate };
  if (startDate) return { label: "Active since", date: startDate };
  return { label: "Start date missing", date: null };
}

const NOT_IMPORTED_REASON: Record<string, string> = {
  NotImportedEndedBeforeToday: "Has since left",
  NotImportedFutureStart: "Starts after workforce date",
};

/** Why a row stays out of Fusion, short enough to sit under its result. */
export function notImportedReason(row: WorkforceReviewRowDto, baseline: string): string | null {
  if (row.classification !== "NotImported") return null;
  const code = row.issues.find((i) => i.category === "lifecycle")?.code;
  if (code === "NotImportedFormerWorker")
    return row.employment.endDate && row.employment.endDate <= baseline ? "Former before workforce date" : "Former employee";
  return (code && NOT_IMPORTED_REASON[code]) ?? null;
}

export type ReviewNotice = {
  key: string;
  tone: "destructive" | "warning" | "info";
  /** The number the finding is about, or null for a finding without one. */
  count: number | null;
  title: string;
  detail: string;
  action: string;
  filter: ReviewFilter;
};

const people = (n: number) => (n === 1 ? "employee" : "employees");
const TONE_ORDER = { destructive: 0, warning: 1, info: 2 } as const;

/**
 * What deserves a look before publishing, one finding per kind, most severe first: blockers stop
 * publication, warnings deserve a look, and not-imported people are information.
 */
export function reviewNotices(
  counts: WorkforceReviewCountsDto,
  groups: WorkforceReviewIssueGroupDto[],
  asOf: string
): ReviewNotice[] {
  const notices: ReviewNotice[] = [];
  if (counts.blocked > 0) {
    const decisions = counts.openDecisionCount;
    notices.push({
      key: "blocked",
      tone: "destructive",
      count: decisions,
      title: decisions === 1 ? "Decision before you can publish" : "Decisions before you can publish",
      detail: `${counts.blocked} ${people(counts.blocked)} can't be created until ${decisions === 1 ? "it's" : "these are"} resolved.`,
      action: "Resolve",
      filter: "Blocked",
    });
  }
  for (const group of groups.filter((g) => g.severity === "Warning")) {
    const n = group.affectedPeople;
    if (group.category === "lifecycle")
      notices.push({
        key: "lifecycle",
        tone: "info",
        count: n,
        title: n === 1 ? "Employee won't be imported" : "Employees won't be imported",
        detail: `They aren't employed on ${asOf}, so they're outside this workforce snapshot.`,
        action: "View employees",
        filter: "NotImported",
      });
    else if (group.category === "existing")
      notices.push({
        key: "existing",
        tone: "warning",
        count: n,
        title: n === 1 ? "Existing employee differs from this file" : "Existing employees differ from this file",
        detail: "Fusion keeps their current records. The differences aren't applied.",
        action: "View employees",
        filter: "Existing",
      });
    else if (!notices.some((notice) => notice.key === "other"))
      notices.push({
        key: "other",
        tone: "warning",
        count: n,
        title: n === 1 ? "Employee to double-check" : "Employees to double-check",
        detail: "Fusion can create them, but a generated number or similar name deserves a look.",
        action: "View employees",
        filter: "Warnings",
      });
  }
  return notices.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

/** Page numbers to show, with gaps: 1 2 3 4 5 … 8. */
export function pageList(page: number, pages: number): Array<number | "gap"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "gap", pages];
  if (page >= pages - 3) return [1, "gap", pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, "gap", page - 1, page, page + 1, "gap", pages];
}
