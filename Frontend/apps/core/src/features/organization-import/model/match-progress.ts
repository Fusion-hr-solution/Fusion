import type {
  OrganizationImportMatch,
  OrganizationSourceTable,
} from "@repo/api";

/** Source columns the plan reads from: mapped fields and hierarchy level columns. */
export function countMappedColumns(table: OrganizationSourceTable, match: OrganizationImportMatch) {
  const plan = match.mappingPlan;
  const used = new Set<number | null>([
    ...plan.columnMappings.map((mapping) => mapping.columnIndex),
    ...plan.orderedLevelColumns,
  ]);
  const total = table.columns.length;
  return { total, mapped: [...used].filter((index) => index !== null && index >= 0 && index < total).length };
}
