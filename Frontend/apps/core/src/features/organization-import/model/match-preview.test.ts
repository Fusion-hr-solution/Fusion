import { describe, expect, it } from "vitest";
import type { OrganizationImportMatch, OrganizationSourceTable } from "@repo/api";
import { buildMatchPreview } from "./match-preview";

const table: OrganizationSourceTable = {
  columns: [0, 1, 2, 3].map((index) => ({ index, sourceLabel: `c${index}` })),
  rows: [
    ["LUM", "Lumera Group", "", "Group"],
    ["LUM-OPS", "Operations", "LUM", "Tribe"],
    ["LUM-FIN", " Finance ", "LUM", ""],
  ],
};

const match = {
  mappingPlan: {
    columnMappings: [
      { field: "businessCode", columnIndex: 0 },
      { field: "name", columnIndex: 1 },
      { field: "parentBusinessCode", columnIndex: 2 },
      { field: "type", columnIndex: 3 },
    ],
    typeMappings: { group: "t-1" },
    typeMappingDetails: [],
  },
  typeOptions: [{ id: "t-1", name: "Corporate Group" }],
} as unknown as OrganizationImportMatch;

describe("buildMatchPreview", () => {
  it("reads rows through the mapping and keeps unmatched terms as written", () => {
    expect(buildMatchPreview(table, match, 5)).toEqual([
      { rowNumber: 1, businessCode: "LUM", name: "Lumera Group", parentCode: null, type: { kind: "matched", label: "Corporate Group" } },
      { rowNumber: 2, businessCode: "LUM-OPS", name: "Operations", parentCode: "LUM", type: { kind: "unmatched", sourceValue: "Tribe" } },
      { rowNumber: 3, businessCode: "LUM-FIN", name: "Finance", parentCode: "LUM", type: { kind: "empty" } },
    ]);
  });

  it("respects the row limit and leaves unmapped fields empty", () => {
    const unmapped = { ...match, mappingPlan: { ...match.mappingPlan, columnMappings: [{ field: "name", columnIndex: 1 }] } } as OrganizationImportMatch;
    const rows = buildMatchPreview(table, unmapped, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ businessCode: null, parentCode: null, name: "Lumera Group", type: { kind: "empty" } });
  });
});
