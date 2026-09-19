import { describe, expect, it } from "vitest";
import type {
  OrganizationHierarchyNodeDto,
  PopulationCandidateDto,
  ReadinessIssueDto,
} from "@repo/api";
import {
  candidateStatus,
  computeOrgStates,
  isBulkSelectable,
  primaryIssue,
  reviewerView,
} from "./population-model";

function unit(id: string, name: string): OrganizationHierarchyNodeDto["unit"] {
  return {
    id,
    code: id,
    name,
    typeId: "t",
    typeName: "Dept",
    parentId: null,
    parentName: null,
    path: name,
    lifecycleState: "Active",
    effectiveFrom: "2026-01-01",
    version: 1,
  };
}

function node(
  id: string,
  name: string,
  children: OrganizationHierarchyNodeDto[] = []
): OrganizationHierarchyNodeDto {
  return { unit: unit(id, name), children };
}

// root A → { B → { D }, C }
const roots: OrganizationHierarchyNodeDto[] = [
  node("A", "A", [node("B", "B", [node("D", "D")]), node("C", "C")]),
];

function issue(
  code: ReadinessIssueDto["code"],
  isHard = true
): ReadinessIssueDto {
  return { code, label: code, isHard };
}

function candidate(
  overrides: Partial<PopulationCandidateDto> = {}
): PopulationCandidateDto {
  return {
    employeeId: "e1",
    displayName: "Test Person",
    jobTitle: "Analyst",
    orgUnitId: "A",
    orgUnitName: "A",
    managerEmployeeId: "m1",
    managerDisplayName: "Manager One",
    managerIsActive: true,
    isActive: true,
    byExplicitInclusion: false,
    isExcluded: false,
    exclusionReason: null,
    isEligible: true,
    countsToRoster: true,
    hasValidReviewer: true,
    issues: [],
    ...overrides,
  };
}

describe("computeOrgStates", () => {
  it("marks the whole subtree inherited when a parent includes descendants", () => {
    const states = computeOrgStates(roots, [
      { orgUnitId: "A", includeDescendants: true },
    ]);
    expect(states.get("A")).toMatchObject({ selected: true, inherited: false });
    expect(states.get("B")).toMatchObject({ selected: false, inherited: true });
    expect(states.get("D")).toMatchObject({ selected: false, inherited: true });
  });

  it("does not inherit when a unit excludes its descendants", () => {
    const states = computeOrgStates(roots, [
      { orgUnitId: "A", includeDescendants: false },
    ]);
    expect(states.get("B")).toMatchObject({
      selected: false,
      inherited: false,
      indeterminate: false,
    });
  });

  it("resolves include-sub-units per unit, not globally", () => {
    // A chosen without descendants, B chosen with descendants.
    const states = computeOrgStates(roots, [
      { orgUnitId: "A", includeDescendants: false },
      { orgUnitId: "B", includeDescendants: true },
    ]);
    expect(states.get("A")).toMatchObject({ selected: true, inherited: false });
    expect(states.get("B")).toMatchObject({
      selected: true,
      includeDescendants: true,
    });
    expect(states.get("D")).toMatchObject({ selected: false, inherited: true });
    expect(states.get("C")).toMatchObject({
      selected: false,
      inherited: false,
    });
  });

  it("marks ancestors indeterminate when only a descendant is selected", () => {
    const states = computeOrgStates(roots, [
      { orgUnitId: "D", includeDescendants: true },
    ]);
    expect(states.get("D")!.selected).toBe(true);
    expect(states.get("B")!.indeterminate).toBe(true);
    expect(states.get("A")!.indeterminate).toBe(true);
    expect(states.get("C")!.indeterminate).toBe(false);
  });
});

describe("candidateStatus", () => {
  it("prioritizes excluded, then attention, then ready", () => {
    expect(
      candidateStatus(candidate({ isExcluded: true, isEligible: false }))
    ).toBe("excluded");
    expect(candidateStatus(candidate({ isEligible: false }))).toBe("attention");
    expect(candidateStatus(candidate())).toBe("ready");
  });
});

describe("isBulkSelectable", () => {
  it("allows active roster rows and rejects excluded rows", () => {
    expect(isBulkSelectable(candidate())).toBe(true);
    expect(isBulkSelectable(candidate({ isEligible: false }))).toBe(true);
    expect(isBulkSelectable(candidate({ isExcluded: true }))).toBe(false);
  });
});

describe("reviewerView", () => {
  it("reads unresolved, inactive, or resolved", () => {
    expect(reviewerView(candidate({ managerDisplayName: null })).kind).toBe(
      "unresolved"
    );
    expect(reviewerView(candidate({ managerIsActive: false })).kind).toBe(
      "inactive"
    );
    expect(reviewerView(candidate()).kind).toBe("resolved");
  });
});

describe("primaryIssue", () => {
  it("ranks a reviewer issue ahead of other hard issues", () => {
    const c = candidate({
      isEligible: false,
      issues: [issue("NoPrimaryAssignment"), issue("InactiveManager")],
    });
    expect(primaryIssue(c)?.code).toBe("InactiveManager");
  });

  it("falls back to the first hard issue when no reviewer issue exists", () => {
    const c = candidate({
      isEligible: false,
      issues: [issue("NoPrimaryAssignment")],
    });
    expect(primaryIssue(c)?.code).toBe("NoPrimaryAssignment");
  });
});
