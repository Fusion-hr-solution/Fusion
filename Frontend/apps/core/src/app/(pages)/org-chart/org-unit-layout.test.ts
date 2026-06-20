import { describe, expect, it, vi } from "vitest";
import {
  buildOrgUnitSearchIndex,
  createOrgUnitFlow,
  findUnitPath,
  flattenOrgUnitTree,
} from "./org-chart-layout";
import type { OrgUnitTreeNodeDto } from "./org-chart.types";

function unit(
  id: string,
  children: OrgUnitTreeNodeDto[] = [],
  level = 0
): OrgUnitTreeNodeDto {
  return {
    id,
    code: id.toUpperCase(),
    name: `${id} unit`,
    type: "Department",
    level,
    isOrphaned: false,
    children,
  };
}

describe("org-unit layout", () => {
  const leaf = unit("eng-fe", [], 2);
  const eng = unit("eng", [leaf], 1);
  const company = unit("company", [eng], 0);
  const roots = [company];

  it("flattens and indexes org units", () => {
    expect(flattenOrgUnitTree(roots)).toHaveLength(3);
    const index = buildOrgUnitSearchIndex(roots);
    expect(index).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orgUnitId: "eng", childUnitCount: 1 }),
        expect.objectContaining({ orgUnitId: "eng-fe", childUnitCount: 0 }),
      ])
    );
  });

  it("finds the ancestor path for a nested unit", () => {
    expect(findUnitPath(roots, "eng-fe")).toEqual(["company", "eng", "eng-fe"]);
  });

  it("builds a flow and hides descendants of collapsed units", () => {
    const onSelectUnit = vi.fn();
    const onToggleCollapse = vi.fn();

    const expanded = createOrgUnitFlow({
      roots,
      collapsedUnitIds: new Set(),
      selectedUnitId: "eng",
      highlightedUnitId: null,
      onSelectUnit,
      onToggleCollapse,
    });
    expect(expanded.nodes).toHaveLength(3);
    expect(expanded.edges).toHaveLength(2);
    expect(
      expanded.nodes.find((n) => n.id === "company")?.data.isOnSelectedPath
    ).toBe(true);

    const collapsed = createOrgUnitFlow({
      roots,
      collapsedUnitIds: new Set(["eng"]),
      selectedUnitId: null,
      highlightedUnitId: null,
      onSelectUnit,
      onToggleCollapse,
    });
    expect(collapsed.nodes).toHaveLength(2);
    expect(collapsed.nodes.find((n) => n.id === "eng-fe")).toBeUndefined();
  });
});
