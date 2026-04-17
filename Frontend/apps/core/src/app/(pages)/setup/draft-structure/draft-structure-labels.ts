import type {
  DraftStructureImportSchemaDto,
  DraftStructureSchemaDto,
} from "@repo/api";

const defaultFieldLabels: Record<string, string> = {
  referenceKey: "Unit Code",
  displayName: "Unit Name",
  orgUnitKindKey: "Unit Type",
  parentId: "Parent Unit",
  parentReferenceKey: "Parent Unit Code",
  parentDisplayName: "Parent Unit",
  businessCode: "Business Code",
  description: "Description",
};

export function getDraftFieldLabel(
  fieldKey: string,
  schema?: DraftStructureSchemaDto | null
) {
  const normalizedKey = normalizeFieldKey(fieldKey);
  const attribute = schema?.attributes.find(
    (candidate) => candidate.key.toLowerCase() === normalizedKey.toLowerCase()
  );

  if (attribute) {
    return attribute.displayLabel;
  }

  return (
    defaultFieldLabels[fieldKey] ??
    defaultFieldLabels[normalizedKey] ??
    humanizeFieldKey(normalizedKey)
  );
}

export function getImportFieldLabel(
  fieldKey: string | null | undefined,
  importSchema?: DraftStructureImportSchemaDto | null
) {
  if (!fieldKey) {
    return "General";
  }

  const canonicalField = importSchema?.canonicalFields.find(
    (candidate) =>
      candidate.key.toLowerCase() === fieldKey.toLowerCase() ||
      candidate.displayLabel.toLowerCase() === fieldKey.toLowerCase()
  );

  if (canonicalField) {
    return canonicalField.displayLabel;
  }

  return getDraftFieldLabel(fieldKey, importSchema?.draftStructureSchema);
}

function normalizeFieldKey(fieldKey: string) {
  return fieldKey.startsWith("attributes.")
    ? fieldKey.slice("attributes.".length)
    : fieldKey;
}

function humanizeFieldKey(fieldKey: string) {
  return fieldKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}