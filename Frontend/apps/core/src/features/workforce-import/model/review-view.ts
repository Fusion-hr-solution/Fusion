import type {
  WorkforceReviewCountsDto,
  WorkforceReviewFilter,
  WorkforceReviewIssueGroupDto,
  WorkforceReviewRowDto,
} from "@repo/api";
import { englishSay, type Say } from "@repo/ds/lib/say";
import { englishMessages } from "@/i18n/messages";

const ENGLISH = englishSay(englishMessages, "wfImport");

/** "" is every row in the proposal. */
export type ReviewFilter = WorkforceReviewFilter | "";

export type ReviewChip = { key: ReviewFilter; label: string; count: number; tone?: "destructive" };

/** The views worth offering: All always, the rest only when they hold someone. */
export function reviewChips(counts: WorkforceReviewCountsDto, say: Say = ENGLISH): ReviewChip[] {
  const chips: ReviewChip[] = [
    { key: "", label: say("chips.all"), count: counts.total },
    { key: "Blocked", label: say("chips.Blocked"), count: counts.blocked, tone: "destructive" },
    { key: "Create", label: say("chips.Create"), count: counts.create },
    { key: "Existing", label: say("chips.Existing"), count: counts.existing },
    { key: "NotImported", label: say("chips.NotImported"), count: counts.notImported },
    { key: "Warnings", label: say("chips.Warnings"), count: counts.withWarnings },
  ];
  return chips.filter((chip) => chip.key === "" || chip.count > 0);
}

export type EmploymentState = { label: string; date: string | null };

/** Where the person's employment stands on the workforce-as-of date. */
export function employmentState(row: WorkforceReviewRowDto, baseline: string, say: Say = ENGLISH): EmploymentState {
  const { startDate, endDate } = row.employment;
  if (endDate && endDate <= baseline) return { label: say("employment.endedOn"), date: endDate };
  if (row.issues.some((i) => i.code === "NotImportedEndedBeforeToday") && endDate)
    return { label: say("employment.endedOn"), date: endDate };
  if (startDate && startDate > baseline) return { label: say("employment.startsOn"), date: startDate };
  if (startDate) return { label: say("employment.activeSince"), date: startDate };
  return { label: say("employment.missingStart"), date: null };
}

const NOT_IMPORTED_REASONS = new Set(["NotImportedEndedBeforeToday", "NotImportedFutureStart"]);

/** Why a row stays out of Fusion, short enough to sit under its result. */
export function notImportedReason(row: WorkforceReviewRowDto, baseline: string, say: Say = ENGLISH): string | null {
  if (row.classification !== "NotImported") return null;
  const code = row.issues.find((i) => i.category === "lifecycle")?.code;
  if (code === "NotImportedFormerWorker")
    return row.employment.endDate && row.employment.endDate <= baseline ? say("reasons.formerBefore") : say("reasons.former");
  return code && NOT_IMPORTED_REASONS.has(code) ? say(`reasons.${code}`) : null;
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

const TONE_ORDER = { destructive: 0, warning: 1, info: 2 } as const;

/**
 * What deserves a look before publishing, one finding per kind, most severe first: blockers stop
 * publication, warnings deserve a look, and not-imported people are information.
 */
export function reviewNotices(
  counts: WorkforceReviewCountsDto,
  groups: WorkforceReviewIssueGroupDto[],
  asOf: string,
  say: Say = ENGLISH
): ReviewNotice[] {
  const notices: ReviewNotice[] = [];
  if (counts.blocked > 0) {
    const decisions = counts.openDecisionCount;
    notices.push({
      key: "blocked",
      tone: "destructive",
      count: decisions,
      title: say("notices.decisionsTitle", { count: decisions }),
      detail: say("notices.decisionsDetail", { people: counts.blocked, count: decisions }),
      action: say("notices.resolve"),
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
        title: say("notices.lifecycleTitle", { count: n }),
        detail: say("notices.lifecycleDetail", { date: asOf }),
        action: say("notices.view"),
        filter: "NotImported",
      });
    else if (group.category === "existing")
      notices.push({
        key: "existing",
        tone: "warning",
        count: n,
        title: say("notices.existingTitle", { count: n }),
        detail: say("notices.existingDetail"),
        action: say("notices.view"),
        filter: "Existing",
      });
    else if (!notices.some((notice) => notice.key === "other"))
      notices.push({
        key: "other",
        tone: "warning",
        count: n,
        title: say("notices.otherTitle", { count: n }),
        detail: say("notices.otherDetail"),
        action: say("notices.view"),
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
