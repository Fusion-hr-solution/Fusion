import type { OrganizationImportMatch, OrganizationSourceTable } from "@repo/api";

export type PreviewType =
  | { kind: "matched"; label: string }
  | { kind: "unmatched"; sourceValue: string }
  | { kind: "empty" };

export type PreviewRow = {
  rowNumber: number;
  businessCode: string | null;
  name: string | null;
  parentCode: string | null;
  type: PreviewType;
};

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * The first source rows read through the current mapping: each column lands in the field it
 * is mapped to and each source term shows the Organization type it resolves to. A term that
 * has no meaning yet stays visible as the file wrote it, so the preview never invents one.
 */
export function buildMatchPreview(
  table: OrganizationSourceTable,
  match: OrganizationImportMatch,
  limit: number
): PreviewRow[] {
  const plan = match.mappingPlan;
  const columnOf = (field: string) =>
    plan.columnMappings.find((mapping) => mapping.field === field)?.columnIndex ?? null;
  const columns = {
    businessCode: columnOf("businessCode"),
    name: columnOf("name"),
    parentCode: columnOf("parentBusinessCode"),
    type: columnOf("type"),
  };
  const typeNames = new Map(match.typeOptions.map((option) => [option.id, option.name]));
  const typeByTerm = new Map<string, string | undefined>(
    Object.entries(plan.typeMappings).map(([term, typeId]) => [term.toLowerCase(), typeNames.get(typeId)])
  );
  for (const detail of plan.typeMappingDetails ?? []) {
    if (detail.typeId && detail.typeName) typeByTerm.set(detail.sourceValue.toLowerCase(), detail.typeName);
  }
  const cell = (row: Array<string | null>, column: number | null) =>
    column === null ? null : clean(row[column]);

  return table.rows.slice(0, limit).map((row, index) => {
    const term = cell(row, columns.type);
    const label = term ? typeByTerm.get(term.toLowerCase()) : undefined;
    return {
      rowNumber: index + 1,
      businessCode: cell(row, columns.businessCode),
      name: cell(row, columns.name),
      parentCode: cell(row, columns.parentCode),
      type: !term
        ? { kind: "empty" }
        : label
          ? { kind: "matched", label }
          : { kind: "unmatched", sourceValue: term },
    };
  });
}
