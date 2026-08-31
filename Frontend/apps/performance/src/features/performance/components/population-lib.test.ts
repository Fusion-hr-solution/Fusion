import { describe, expect, it } from "vitest";
import type { OrganizationHierarchyNodeDto } from "@repo/api";
import { computeOrgStates } from "./population-lib";

// Minimal hierarchy: Root → [A → [A1], B].
function node(id: string, children: OrganizationHierarchyNodeDto[] = []): OrganizationHierarchyNodeDto {
  return {
    unit: {
      id,
      name: id,
      code: id,
      parentId: null,
      parentName: null,
      typeName: "Unit",
      lifecycleState: "Active",
    },
    children,
  } as unknown as OrganizationHierarchyNodeDto;
}

const roots = [node("Root", [node("A", [node("A1")]), node("B")])];

describe("computeOrgStates — Population truthfulness", () => {
  it("marks an explicitly selected unit as selected", () => {
    const states = computeOrgStates(roots, new Set(["A"]), false);
    expect(states.get("A")).toEqual({ selected: true, inherited: false, indeterminate: false });
  });

  it("marks descendants inherited when a selected ancestor includes sub-units", () => {
    const states = computeOrgStates(roots, new Set(["A"]), true);
    // A1 is genuinely in the population via inheritance, so it must not read as unchecked.
    expect(states.get("A1")).toEqual({ selected: false, inherited: true, indeterminate: false });
  });

  it("does not inherit to descendants when sub-units are excluded", () => {
    const states = computeOrgStates(roots, new Set(["A"]), false);
    expect(states.get("A1")).toEqual({ selected: false, inherited: false, indeterminate: false });
  });

  it("marks an ancestor indeterminate when only a descendant is selected", () => {
    const states = computeOrgStates(roots, new Set(["A1"]), true);
    expect(states.get("Root")?.indeterminate).toBe(true);
    expect(states.get("A")?.indeterminate).toBe(true);
    expect(states.get("A1")?.selected).toBe(true);
  });

  it("keeps an unrelated sibling fully unselected", () => {
    const states = computeOrgStates(roots, new Set(["A"]), true);
    expect(states.get("B")).toEqual({ selected: false, inherited: false, indeterminate: false });
  });

  it("selected takes precedence over inherited", () => {
    const states = computeOrgStates(roots, new Set(["A", "A1"]), true);
    // A1 is explicitly selected even though A would also inherit it.
    expect(states.get("A1")).toEqual({ selected: true, inherited: false, indeterminate: false });
  });
});
