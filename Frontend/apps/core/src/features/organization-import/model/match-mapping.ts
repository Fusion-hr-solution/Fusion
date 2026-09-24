import type {
  OrganizationImportGeneratedIdentityStrategy,
  OrganizationImportMatch,
  OrganizationImportTypeMapping,
  OrganizationSourceTable,
} from "@repo/api";

/** What a mapping row says about its source meaning: business state, never provenance. */
export type MappingStatus = "mapped" | "ignored" | "needs-review";

/** The canonical fields a source column can supply, in the order the administrator reads them. */
export const MAPPABLE_FIELDS = [
  { key: "businessCode", label: "Business Code" },
  { key: "name", label: "Name" },
  { key: "parentBusinessCode", label: "Parent Business Code" },
  { key: "type", label: "Type" },
  { key: "fusionOrgUnitId", label: "Fusion Unit ID" },
] as const;

export type MappableField = (typeof MAPPABLE_FIELDS)[number]["key"];
export const IGNORE = "ignore";
export type ColumnTarget = MappableField | typeof IGNORE;

/** Fields a parent-referenced source cannot do without. Business Code is optional: Fusion generates codes. */
const REQUIRED_FIELDS: readonly MappableField[] = ["name", "parentBusinessCode", "type"];

export type ColumnMappingRow = {
  columnIndex: number;
  label: string;
  samples: string[];
  /** The field this column supplies, a hierarchy level, or nothing. */
  target: ColumnTarget | { level: number };
  status: MappingStatus;
};

export const fieldLabel = (field: string) =>
  MAPPABLE_FIELDS.find((item) => item.key === field)?.label ?? field;

/** The first few distinct values of a column, as evidence of what it holds, never the column itself. */
export function sampleValues(table: OrganizationSourceTable, columnIndex: number, limit = 3): string[] {
  const values: string[] = [];
  const keys = new Set<string>();
  for (const row of table.rows) {
    const value = row[columnIndex]?.trim();
    if (!value || keys.has(value.toLowerCase())) continue;
    keys.add(value.toLowerCase());
    values.push(value);
    if (values.length === limit) break;
  }
  return values;
}

/** Whether the file's columns are read as named fields or as hierarchy levels. */
export const readsLevelColumns = (match: OrganizationImportMatch) =>
  match.mappingPlan.sourceShape === "LevelColumns";

/**
 * One row per source column, in file order, read from the current Mapping Plan. A column the
 * plan doesn't use is Ignored: a valid outcome, not an error. A column two fields claim at
 * once needs review until the administrator settles it.
 */
export function deriveColumnRows(table: OrganizationSourceTable, match: OrganizationImportMatch): ColumnMappingRow[] {
  const plan = match.mappingPlan;
  const levels = readsLevelColumns(match);
  return table.columns.map((column) => {
    const base = {
      columnIndex: column.index,
      label: column.sourceLabel?.trim() || `Column ${column.index + 1}`,
      samples: sampleValues(table, column.index),
    };
    if (levels) {
      const level = plan.orderedLevelColumns.indexOf(column.index);
      return level >= 0
        ? { ...base, target: { level: level + 1 }, status: "mapped" as const }
        : { ...base, target: IGNORE, status: "ignored" as const };
    }
    const claims = plan.columnMappings.filter((mapping) => mapping.columnIndex === column.index);
    const claim = claims[0];
    if (!claim) return { ...base, target: IGNORE, status: "ignored" as const };
    const settled = claims.length === 1 && (claim.matchStatus ?? "Matched") === "Matched";
    return { ...base, target: claim.field as MappableField, status: settled ? "mapped" : "needs-review" };
  });
}

/** Required fields no column supplies yet. They block Match just like an unresolved row. */
export function missingRequiredFields(match: OrganizationImportMatch): MappableField[] {
  if (readsLevelColumns(match)) return [];
  return REQUIRED_FIELDS.filter(
    (field) => !match.mappingPlan.columnMappings.some((mapping) => mapping.field === field && mapping.columnIndex !== null)
  );
}

/** The column currently supplying each field, so a choice can say what it would take over. */
export function fieldSources(table: OrganizationSourceTable, match: OrganizationImportMatch) {
  const labels = new Map(table.columns.map((column) => [column.index, column.sourceLabel?.trim() || `Column ${column.index + 1}`]));
  const sources = new Map<string, { columnIndex: number; label: string }>();
  for (const mapping of match.mappingPlan.columnMappings)
    if (mapping.columnIndex !== null)
      sources.set(mapping.field, { columnIndex: mapping.columnIndex, label: labels.get(mapping.columnIndex) ?? "" });
  return sources;
}

export type FieldChange = {
  fieldMappings: Record<string, number | null>;
  identityStrategy?: OrganizationImportGeneratedIdentityStrategy;
};

/**
 * The Mapping Plan change behind choosing a target for one column. A field has one source, so
 * taking a field moves it here and the column that held it becomes Ignored; whatever field this
 * column supplied before is released. Business Code decides identity: without it Fusion
 * generates stable codes, so it is never re-inferred behind the administrator's back.
 */
export function columnTargetChange(
  match: OrganizationImportMatch,
  columnIndex: number,
  target: ColumnTarget
): FieldChange | null {
  const fieldMappings: Record<string, number | null> = {};
  for (const mapping of match.mappingPlan.columnMappings)
    if (mapping.columnIndex === columnIndex && mapping.field !== target) fieldMappings[mapping.field] = null;
  if (target !== IGNORE) {
    const current = match.mappingPlan.columnMappings.find((mapping) => mapping.field === target);
    if (current?.columnIndex !== columnIndex || current.matchStatus !== "Matched") fieldMappings[target] = columnIndex;
  }
  if (Object.keys(fieldMappings).length === 0) return null;
  const change: FieldChange = { fieldMappings };
  if (target === "businessCode") change.identityStrategy = "SourceBusinessCode";
  else if ("businessCode" in fieldMappings) change.identityStrategy = "DeterministicFromNameAndPath";
  return change;
}

export type TypeMeaningRow = {
  sourceValue: string;
  occurrences: number;
  typeId: string | null;
  status: MappingStatus;
};

/** One row per distinct source type label, in the plan's own stable order. */
export function deriveTypeRows(match: OrganizationImportMatch): TypeMeaningRow[] {
  const unresolved = new Set(
    match.readiness.requiredDecisions
      .filter((decision) => decision.kind === "TypeMapping")
      .map((decision) => (decision.sourceValue ?? "").toLowerCase())
  );
  return (match.mappingPlan.typeMappingDetails ?? []).map((mapping: OrganizationImportTypeMapping) => {
    const settled = mapping.typeId !== null && mapping.status === "Matched" && !unresolved.has(mapping.sourceValue.toLowerCase());
    return {
      sourceValue: mapping.sourceValue,
      occurrences: mapping.occurrenceCount,
      typeId: settled ? mapping.typeId : null,
      status: settled ? "mapped" : "needs-review",
    };
  });
}
