import type {
  WorkforceImportField,
  WorkforceImportMatch,
  WorkforceLifecycle,
  WorkforceMatchColumn,
  WorkforceMatchUpdateRequest,
  WorkforceReferenceKind,
} from "@repo/api";
import { englishSay, type Say } from "@repo/ds/lib/say";
import { englishMessages } from "@/i18n/messages";

const ENGLISH = englishSay(englishMessages, "wfImport");

export type MappingStatus = "mapped" | "ignored" | "needs-review";
export type InterpretationState = "understood" | "needs-review" | "optional";

/** The Fusion fields an administrator can assign to a column, in the order people think of them. */
export const MAPPABLE_FIELDS: Array<{ value: Exclude<WorkforceImportField, "Ignored">; label: string }> = [
  { value: "EmployeeNumber", label: "Employee number" },
  { value: "FirstName", label: "First name" },
  { value: "LastName", label: "Last name" },
  { value: "FullName", label: "Full name" },
  { value: "PreferredName", label: "Preferred name" },
  { value: "WorkEmail", label: "Work email" },
  { value: "DisplayTitle", label: "Job title" },
  { value: "Organization", label: "Organization" },
  { value: "Manager", label: "Manager" },
  { value: "EmploymentStart", label: "Employment start" },
  { value: "WorkEffectiveFrom", label: "In current role since" },
  { value: "Location", label: "Location" },
  { value: "LifecycleStatus", label: "Employment status" },
  { value: "EmploymentEnd", label: "Employment end" },
];

const OTHER_FIELDS = new Set<string>([
  "Ignored",
  "FusionEmployeeReference",
  "FusionOrganizationReference",
  "FusionManagerReference",
  "WorkerReference",
  "ManagerReference",
]);

const KNOWN_FIELDS = new Set<string>([...MAPPABLE_FIELDS.map((f) => f.value), ...OTHER_FIELDS]);
export const fieldLabel = (field: string, say: Say = ENGLISH) =>
  KNOWN_FIELDS.has(field) ? say(`match.fields.${field}`) : field;
export const columnName = (c: WorkforceMatchColumn, say: Say = ENGLISH) =>
  c.sourceLabel ?? say("match.columns.column", { number: c.columnIndex + 1 });

export const LIFECYCLE_OPTIONS: Array<{ value: WorkforceLifecycle; label: string }> = [
  { value: "Active", label: "Active employee" },
  { value: "Former", label: "Former employee" },
];

const decisionsOf = (match: WorkforceImportMatch, kind: string) => match.readiness.requiredDecisions.filter((d) => d.kind === kind);
const used = (c: WorkforceMatchColumn) => c.resolved && c.field !== "Ignored";

export type WorkforceColumnRow = {
  columnIndex: number;
  label: string;
  samples: string[];
  /** The Fusion field, or "Ignored" when the column is not read. */
  field: WorkforceImportField;
  status: MappingStatus;
};

/** One row per source column, in file order. Two columns claiming one field both need review. */
export function deriveColumnRows(match: WorkforceImportMatch): WorkforceColumnRow[] {
  const contested = new Set(decisionsOf(match, "MappingConflict").map((d) => d.field));
  return match.columns.map((c) => {
    const field = used(c) || contested.has(c.field) ? c.field : "Ignored";
    const status: MappingStatus = contested.has(c.field) ? "needs-review" : field === "Ignored" ? "ignored" : "mapped";
    return { columnIndex: c.columnIndex, label: columnName(c), samples: c.sampleValues, field, status };
  });
}

/** Required fields no column supplies yet. */
export const missingRequiredFields = (match: WorkforceImportMatch) =>
  decisionsOf(match, "FieldMapping").map((d) => d.field as WorkforceImportField);

/**
 * The Match change for giving a column a new meaning. A field comes from one column: the column
 * that supplied it until now is ignored in the same change, and reported as displaced.
 */
export function columnFieldChange(
  match: WorkforceImportMatch,
  columnIndex: number,
  field: WorkforceImportField
): { change: WorkforceMatchUpdateRequest; displaced: WorkforceMatchColumn | null } {
  const mappings: Record<number, WorkforceImportField> = { [columnIndex]: field };
  const others = field === "Ignored" ? [] : match.columns.filter((c) => c.columnIndex !== columnIndex && c.field === field);
  for (const other of others) mappings[other.columnIndex] = "Ignored";
  return { change: { columnMappings: mappings }, displaced: others.find(used) ?? null };
}

export type LifecycleRow = { sourceValue: string; occurrences: number; meaning: WorkforceLifecycle | null; status: MappingStatus };

/** One row per distinct employment status value. An unknown value is emphasized in place. */
export function deriveLifecycleRows(match: WorkforceImportMatch): LifecycleRow[] {
  const open = new Set(decisionsOf(match, "VocabularyMapping").map((d) => d.sourceValue));
  return match.lifecycleValues.map((v) => ({
    sourceValue: v.sourceValue,
    occurrences: v.occurrenceCount,
    meaning: open.has(v.sourceValue) ? null : v.meaning,
    status: open.has(v.sourceValue) || v.meaning === null ? "needs-review" : "mapped",
  }));
}

const columnFor = (match: WorkforceImportMatch, ...fields: WorkforceImportField[]) =>
  fields.map((f) => match.columns.find((c) => used(c) && c.field === f)).find(Boolean) ?? null;

const MANAGER_BY = new Set<WorkforceReferenceKind>(["FusionId", "EmployeeNumber", "WorkerReference", "Email"]);

export type InterpretationItem = {
  key: "identity" | "names" | "organization" | "manager" | "dates";
  title: string;
  detail: string;
  state: InterpretationState;
  /** The decision this item hosts when it needs the administrator. */
  decision: "identity" | "name-format" | "date-format" | null;
};

/** How Fusion reads the workforce concepts the file carries, one item per concept. */
export function deriveInterpretation(match: WorkforceImportMatch, say: Say = ENGLISH): InterpretationItem[] {
  const open = new Set(match.readiness.requiredDecisions.map((d) => d.key));
  const missing = new Set(missingRequiredFields(match));
  const c = (key: string, values?: Record<string, string>) => say(`match.concepts.${key}`, values);
  const name = (column: WorkforceMatchColumn) => columnName(column, say);
  const join = (names: string[]) =>
    names.length === 2 ? c("and", { first: names[0]!, second: names[1]! }) : names.join(", ");

  const identityColumn = columnFor(match, "EmployeeNumber", "FusionEmployeeReference");
  const identity: InterpretationItem = open.has("identity")
    ? { key: "identity", title: c("identity"), detail: c("noIdentity"), state: "needs-review", decision: "identity" }
    : match.identityStrategy === "GenerateAll"
      ? { key: "identity", title: c("identity"), detail: c("generated"), state: "understood", decision: null }
      : { key: "identity", title: c("identity"), detail: c("using", { columns: identityColumn ? name(identityColumn) : c("theIdentifier") }), state: "understood", decision: null };

  const first = columnFor(match, "FirstName");
  const last = columnFor(match, "LastName");
  const full = columnFor(match, "FullName");
  const namesMissing = missing.has("FirstName") || missing.has("LastName") || missing.has("FullName");
  const names: InterpretationItem = open.has("name-format")
    ? { key: "names", title: c("names"), detail: c("nameFormat", { column: full ? name(full) : c("theNameColumn") }), state: "needs-review", decision: "name-format" }
    : namesMissing
      ? { key: "names", title: c("names"), detail: c("noName"), state: "needs-review", decision: null }
      : { key: "names", title: c("names"), detail: c("using", { columns: first && last ? join([name(first), name(last)]) : full ? name(full) : c("theNameColumns") }), state: "understood", decision: null };

  const org = columnFor(match, "Organization", "FusionOrganizationReference");
  const organization: InterpretationItem = org
    ? { key: "organization", title: c("organization"), detail: c("orgUsing", { column: name(org) }), state: "understood", decision: null }
    : { key: "organization", title: c("organization"), detail: c("noOrg"), state: "needs-review", decision: null };

  const managerColumn = columnFor(match, "Manager", "ManagerReference", "FusionManagerReference");
  const by = MANAGER_BY.has(match.managerReferenceKind) ? c(`by.${match.managerReferenceKind}`) : null;
  const manager: InterpretationItem = !managerColumn
    ? { key: "manager", title: c("manager"), detail: c("noManager"), state: "optional", decision: null }
    : by
      ? { key: "manager", title: c("manager"), detail: c("managerBy", { column: name(managerColumn), by }), state: "understood", decision: null }
      : { key: "manager", title: c("manager"), detail: c("managerConfirm", { column: name(managerColumn) }), state: "optional", decision: null };

  const start = columnFor(match, "EmploymentStart");
  const since = columnFor(match, "WorkEffectiveFrom");
  const dates: InterpretationItem = open.has("date-format")
    ? { key: "dates", title: c("dates"), detail: c("ambiguousDates"), state: "needs-review", decision: "date-format" }
    : !start
      ? { key: "dates", title: c("dates"), detail: c("noStart"), state: "needs-review", decision: null }
      : { key: "dates", title: c("dates"), detail: c("using", { columns: join([start, since].filter((col): col is WorkforceMatchColumn => col !== null).map(name)) }), state: "understood", decision: null };

  return [identity, manager, names, dates, organization];
}

/** A date value from the file, to show how an ambiguous format reads. */
export const sampleDate = (match: WorkforceImportMatch) =>
  columnFor(match, "EmploymentStart", "WorkEffectiveFrom", "EmploymentEnd")?.sampleValues[0] ?? null;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** How an ambiguous date from the file reads under a format, e.g. 01/02/2021 → "1 February 2021"; other languages as Intl writes them. */
export function readDate(value: string | null, format: "DayMonthYear" | "MonthDayYear", locale = "en"): string | null {
  const parts = value?.trim().split(/[/.-]/).map(Number);
  if (!parts || parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [a, b, year] = parts as [number, number, number];
  const [day, month] = format === "DayMonthYear" ? [a, b] : [b, a];
  const name = MONTHS[month - 1];
  if (!name || day < 1 || day > 31) return null;
  if (locale !== "en")
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, day))
    );
  return format === "DayMonthYear" ? `${day} ${name} ${year}` : `${name} ${day}, ${year}`;
}

/** Columns the preview shows: who each person is and where they land, as mapped right now. */
const PREVIEW_FIELDS: Array<{ fields: WorkforceImportField[]; label: string }> = [
  { fields: ["EmployeeNumber", "FusionEmployeeReference"], label: "EmployeeNumber" },
  { fields: ["FirstName"], label: "FirstName" },
  { fields: ["LastName"], label: "LastName" },
  { fields: ["FullName"], label: "Name" },
  { fields: ["WorkEmail"], label: "WorkEmail" },
  { fields: ["DisplayTitle"], label: "DisplayTitle" },
  { fields: ["Organization", "FusionOrganizationReference"], label: "Organization" },
];

export function previewColumns(match: WorkforceImportMatch, max = 5, say: Say = ENGLISH) {
  return PREVIEW_FIELDS.flatMap(({ fields, label }) => {
    const column = columnFor(match, ...fields);
    return column ? [{ key: fields[0]!, label: say(`match.fields.${label}`), columnIndex: column.columnIndex }] : [];
  }).slice(0, max);
}

export function previewRows(match: WorkforceImportMatch, limit: number) {
  const columns = previewColumns(match);
  return match.previewRows.slice(0, limit).map((cells, index) => ({
    key: index,
    cells: columns.map((c) => cells[c.columnIndex]?.trim() || null),
  }));
}

export type WorkforceMatchSummary = {
  columnsTotal: number;
  columnsMapped: number;
  needsReview: number;
  mostlyUnresolved: boolean;
};

export function summarizeWorkforceMatch(match: WorkforceImportMatch): WorkforceMatchSummary {
  const withData = match.columns.filter((c) => c.nonEmptyCount > 0);
  const mapped = match.columns.filter(used).length;
  const needsReview = match.readiness.requiredDecisions.length;
  return {
    columnsTotal: match.columns.length,
    columnsMapped: mapped,
    needsReview,
    mostlyUnresolved: mapped * 2 < withData.length,
  };
}
