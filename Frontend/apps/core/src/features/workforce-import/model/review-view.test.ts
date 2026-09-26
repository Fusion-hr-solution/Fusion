import { describe, expect, it } from "vitest";
import type { WorkforceReviewCountsDto, WorkforceReviewRowDto } from "@repo/api";
import { employmentState, notImportedReason, pageList, reviewChips, reviewNotices } from "./review-view";

const counts = (over: Partial<WorkforceReviewCountsDto> = {}): WorkforceReviewCountsDto => ({
  create: 76, existing: 0, notImported: 4, blocked: 0, total: 80, withWarnings: 4, openDecisionCount: 0, ...over,
});

const row = (over: Partial<WorkforceReviewRowDto> & { start?: string; end?: string | null; code?: string } = {}): WorkforceReviewRowDto => ({
  sourceRowNumber: 2,
  classification: "Create",
  employee: { displayName: "Sarah Martin", employeeNumber: "LUM-0001", numberGenerated: false, existingEmployeeName: null, workEmail: null },
  employment: { startDate: over.start ?? "2020-01-10", endDate: over.end ?? null },
  work: { displayTitle: "CEO", organization: "Lumera Group", sourceOrganization: "Lumera Group", location: null, effectiveFrom: null },
  manager: { state: "NoManager", display: null, subtext: null, employeeNumber: null },
  issues: over.code
    ? [{ code: over.code, severity: "Warning", title: "", message: "", field: "", decisionKey: null, category: "lifecycle", resolutions: [], affectedCount: 1 }]
    : [],
  ...over,
});

describe("workforce review view", () => {
  it("offers All plus only the views that hold someone", () => {
    expect(reviewChips(counts()).map((c) => c.label)).toEqual(["All", "Create", "Not imported", "With warnings"]);
    expect(reviewChips(counts({ blocked: 2 })).map((c) => c.key)).toContain("Blocked");
  });

  it("reads employment on the workforce-as-of date", () => {
    expect(employmentState(row(), "2026-09-25")).toEqual({ label: "Active since", date: "2020-01-10" });
    expect(employmentState(row({ end: "2026-08-15" }), "2026-09-25")).toEqual({ label: "Ended on", date: "2026-08-15" });
    expect(employmentState(row({ start: "2026-10-01" }), "2026-09-25")).toEqual({ label: "Starts on", date: "2026-10-01" });
  });

  it("names why a row stays out of Fusion", () => {
    const former = row({ classification: "NotImported", end: "2026-08-15", code: "NotImportedFormerWorker" });
    expect(notImportedReason(former, "2026-09-25")).toBe("Former before workforce date");
    expect(notImportedReason(row({ classification: "NotImported", code: "NotImportedFutureStart" }), "2026-09-25")).toBe("Starts after workforce date");
    expect(notImportedReason(row(), "2026-09-25")).toBeNull();
  });

  it("puts blockers before warnings and leads each to its people", () => {
    const notices = reviewNotices(
      counts({ blocked: 3, openDecisionCount: 1 }),
      [{ category: "lifecycle", severity: "Warning", decisionCount: 4, affectedPeople: 4 }],
      "Sep 25, 2026"
    );
    expect(notices.map((n) => [n.key, n.filter])).toEqual([["blocked", "Blocked"], ["lifecycle", "NotImported"]]);
    expect(notices[0]!.title).toBe("Decision before you can publish");
    expect(notices[1]!.title).toBe("Employees won't be imported");
  });

  it("pages with gaps", () => {
    expect(pageList(1, 8)).toEqual([1, 2, 3, 4, 5, "gap", 8]);
    expect(pageList(8, 8)).toEqual([1, "gap", 4, 5, 6, 7, 8]);
    expect(pageList(5, 12)).toEqual([1, "gap", 4, 5, 6, "gap", 12]);
    expect(pageList(2, 3)).toEqual([1, 2, 3]);
  });
});
