import { describe, expect, it } from "vitest";
import type { OrganizationImportMatch, OrganizationSourceTable } from "@repo/api";
import {
  columnTargetChange,
  deriveColumnRows,
  deriveTypeRows,
  missingRequiredFields,
  sampleValues,
} from "./match-mapping";

const table: OrganizationSourceTable = {
  columns: ["Org Key", "Structure Label", "Upstream Ref", "Layer Label", "Country Footprint"].map(
    (sourceLabel, index) => ({ index, sourceLabel })
  ),
  rows: [
    ["LUM-001", "Group", null, "Corporate Group", "Tunisia"],
    ["LUM-002", "Finance", "LUM-001", "Business Pillar", "france"],
    ["LUM-003", "IT", "LUM-001", "Shared Service", "France"],
    ["LUM-004", "Ops", "LUM-001", "Business Pillar", "UAE"],
  ],
};

const mapping = (field: string, columnIndex: number | null, matchStatus: "Matched" | "NeedsReview" = "Matched") => ({
  field,
  columnIndex,
  status: columnIndex === null ? ("Unresolved" as const) : ("Resolved" as const),
  origin: "Deterministic" as const,
  matchStatus,
});

function match(overrides: Partial<OrganizationImportMatch["mappingPlan"]> = {}, typeDecisions: string[] = []): OrganizationImportMatch {
  return {
    mappingPlan: {
      sourceShape: "ParentReference",
      shapeStatus: "Resolved",
      shapeOrigin: "Deterministic",
      columnMappings: [
        mapping("fusionOrgUnitId", null, "NeedsReview"),
        mapping("businessCode", 0),
        mapping("name", 1),
        mapping("type", 3),
        mapping("parentBusinessCode", 2),
      ],
      typeMappings: {},
      orderedLevelColumns: [],
      ignoredColumns: [],
      generatedIdentityStrategy: "SourceBusinessCode",
      sourceFingerprint: "f",
      typeMappingDetails: [
        { sourceValue: "Business Pillar", typeId: "bu", typeName: "Business Unit", occurrenceCount: 2, status: "Matched", origin: "Deterministic" },
        { sourceValue: "Shared Service", typeId: null, typeName: null, occurrenceCount: 1, status: "NeedsReview", origin: "Deterministic" },
      ],
      ...overrides,
    },
    readiness: {
      state: "Incomplete",
      canContinue: false,
      requiredDecisions: typeDecisions.map((value) => ({ key: `type:${value}`, kind: "TypeMapping", sourceValue: value, targetField: null })),
      recommendedStage: "Match",
    },
    completionKind: "Incomplete",
    typeOptions: [],
    semanticAssistance: null,
  };
}

describe("match mapping", () => {
  it("samples a few distinct values, never the whole column", () => {
    expect(sampleValues(table, 4)).toEqual(["Tunisia", "france", "UAE"]);
  });

  it("reads each column in file order, with unused columns ignored", () => {
    const rows = deriveColumnRows(table, match());
    expect(rows.map((row) => [row.label, row.target, row.status])).toEqual([
      ["Org Key", "businessCode", "mapped"],
      ["Structure Label", "name", "mapped"],
      ["Upstream Ref", "parentBusinessCode", "mapped"],
      ["Layer Label", "type", "mapped"],
      ["Country Footprint", "ignore", "ignored"],
    ]);
  });

  it("flags a column two fields claim at once", () => {
    const rows = deriveColumnRows(table, match({ columnMappings: [mapping("name", 1), mapping("type", 1), mapping("parentBusinessCode", 2)] }));
    expect(rows[1]!.status).toBe("needs-review");
  });

  it("names required fields no column supplies, but not Business Code", () => {
    expect(missingRequiredFields(match({ columnMappings: [mapping("businessCode", null), mapping("name", 1), mapping("type", null), mapping("parentBusinessCode", 2)] }))).toEqual(["type"]);
  });

  it("moves a field to the chosen column and releases what the column held", () => {
    expect(columnTargetChange(match(), 4, "name")).toEqual({ fieldMappings: { name: 4 } });
    expect(columnTargetChange(match(), 3, "name")).toEqual({ fieldMappings: { type: null, name: 3 } });
    expect(columnTargetChange(match(), 1, "name")).toBeNull();
  });

  it("switches identity to generated codes when Business Code is ignored", () => {
    expect(columnTargetChange(match(), 0, "ignore")).toEqual({
      fieldMappings: { businessCode: null },
      identityStrategy: "DeterministicFromNameAndPath",
    });
    expect(columnTargetChange(match(), 4, "businessCode")).toEqual({
      fieldMappings: { businessCode: 4 },
      identityStrategy: "SourceBusinessCode",
    });
  });

  it("keeps type labels in plan order and marks unresolved ones", () => {
    expect(deriveTypeRows(match({}, ["Shared Service"])).map((row) => [row.sourceValue, row.occurrences, row.status])).toEqual([
      ["Business Pillar", 2, "mapped"],
      ["Shared Service", 1, "needs-review"],
    ]);
  });
});
