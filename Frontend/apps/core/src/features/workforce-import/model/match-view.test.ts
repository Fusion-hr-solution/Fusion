import { describe, expect, it } from "vitest";
import type { WorkforceImportMatch, WorkforceMatchColumn, WorkforceRequiredDecision } from "@repo/api";
import {
  columnFieldChange,
  deriveColumnRows,
  deriveInterpretation,
  deriveLifecycleRows,
  missingRequiredFields,
  previewColumns,
  previewRows,
  readDate,
  summarizeWorkforceMatch,
} from "./match-view";

function column(columnIndex: number, sourceLabel: string, field: WorkforceMatchColumn["field"], resolved = true): WorkforceMatchColumn {
  return { columnIndex, sourceLabel, field, origin: resolved ? "Deterministic" : null, resolved, nonEmptyCount: 2, sampleValues: [`${sourceLabel}-1`] };
}

function decision(overrides: Partial<WorkforceRequiredDecision>): WorkforceRequiredDecision {
  return { key: "k", kind: "FieldMapping", field: null, columnIndex: null, sourceValue: null, occurrenceCount: 0, ...overrides };
}

function match(overrides: Partial<WorkforceImportMatch> = {}, decisions: WorkforceRequiredDecision[] = []): WorkforceImportMatch {
  return {
    columns: [
      column(0, "Employee Number", "EmployeeNumber"),
      column(1, "First Name", "FirstName"),
      column(2, "Last Name", "LastName"),
      column(3, "Organization", "Organization"),
      column(4, "Manager", "Manager"),
      column(5, "Employment Start", "EmploymentStart"),
      column(6, "Badge", "Ignored", false),
    ],
    dateFormat: null,
    nameFormat: null,
    dateFormatDecisionNeeded: false,
    nameFormatDecisionNeeded: false,
    identityStrategy: null,
    generateAllAllowed: false,
    lifecycleValues: [],
    managerReferenceKind: "EmployeeNumber",
    readiness: { canContinue: decisions.length === 0, requiredDecisions: decisions, completionKind: decisions.length ? "Incomplete" : "Automatic" },
    semanticAssistance: null,
    previewRows: [
      ["LUM-1", "Sarah", "Chen", "Engineering", "", "2023-01-15", "x"],
      ["LUM-2", "Priya", "Patel", "Finance", "LUM-1", "2022-06-01", "y"],
    ],
    ...overrides,
  };
}

describe("workforce Match view", () => {
  it("keeps mapped columns quiet and unread columns ignored", () => {
    const rows = deriveColumnRows(match());
    expect(rows.map((r) => r.status)).toEqual(["mapped", "mapped", "mapped", "mapped", "mapped", "mapped", "ignored"]);
    expect(rows[6]!.field).toBe("Ignored");
  });

  it("flags every column claiming a contested field", () => {
    const m = match({ columns: [column(0, "Emp #", "EmployeeNumber"), column(1, "Matricule", "EmployeeNumber", false)] }, [
      decision({ key: "conflict:EmployeeNumber", kind: "MappingConflict", field: "EmployeeNumber" }),
    ]);
    expect(deriveColumnRows(m).map((r) => r.status)).toEqual(["needs-review", "needs-review"]);
  });

  it("lists required fields no column supplies", () => {
    expect(missingRequiredFields(match({}, [decision({ key: "field:DisplayTitle", field: "DisplayTitle" })]))).toEqual(["DisplayTitle"]);
  });

  it("moves a field to a new column and ignores the one that supplied it", () => {
    const { change, displaced } = columnFieldChange(match(), 6, "Organization");
    expect(change.columnMappings).toEqual({ 6: "Organization", 3: "Ignored" });
    expect(displaced?.sourceLabel).toBe("Organization");
    expect(columnFieldChange(match(), 6, "Ignored").displaced).toBeNull();
  });

  it("emphasizes an unknown status value in place", () => {
    const m = match(
      {
        lifecycleValues: [
          { sourceValue: "Active", meaning: "Active", origin: "Deterministic", occurrenceCount: 76 },
          { sourceValue: "On Leave", meaning: null, origin: null, occurrenceCount: 2 },
        ],
      },
      [decision({ key: "status:on leave", kind: "VocabularyMapping", sourceValue: "On Leave", occurrenceCount: 2 })]
    );
    expect(deriveLifecycleRows(m).map((r) => [r.sourceValue, r.status])).toEqual([
      ["Active", "mapped"],
      ["On Leave", "needs-review"],
    ]);
  });

  it("reads each workforce concept from the mapping", () => {
    const items = new Map(deriveInterpretation(match()).map((i) => [i.key, i]));
    expect(items.get("identity")).toMatchObject({ state: "understood", detail: "Using Employee Number." });
    expect(items.get("names")!.detail).toBe("Using First Name and Last Name.");
    expect(items.get("manager")!.detail).toBe("Using Manager, by employee number.");
    expect(items.get("dates")!.state).toBe("understood");
  });

  it("hosts the identity, name and date decisions where they belong", () => {
    const m = match({}, [
      decision({ key: "identity", kind: "IdentityStrategy" }),
      decision({ key: "date-format", kind: "DateFormat" }),
      decision({ key: "name-format", kind: "NameFormat" }),
    ]);
    const decisions = Object.fromEntries(deriveInterpretation(m).map((i) => [i.key, i.decision]));
    expect(decisions).toMatchObject({ identity: "identity", dates: "date-format", names: "name-format" });
  });

  it("never treats a manager given by name as understood", () => {
    const item = deriveInterpretation(match({ managerReferenceKind: "Unrecognized" })).find((i) => i.key === "manager")!;
    expect(item.state).toBe("optional");
    expect(item.detail).toMatch(/confirmed in Review/);
  });

  it("previews who each person is through the current mapping", () => {
    const m = match();
    expect(previewColumns(m).map((c) => c.label)).toEqual(["Employee number", "First name", "Last name", "Organization"]);
    expect(previewRows(m, 1)).toEqual([{ key: 0, cells: ["LUM-1", "Sarah", "Chen", "Engineering"] }]);
  });

  it("summarizes how much of the file is matched", () => {
    expect(summarizeWorkforceMatch(match())).toEqual({ columnsTotal: 7, columnsMapped: 6, needsReview: 0, mostlyUnresolved: false });
  });

  it("reads an ambiguous date both ways", () => {
    expect(readDate("01/02/2021", "DayMonthYear")).toBe("1 February 2021");
    expect(readDate("01/02/2021", "MonthDayYear")).toBe("January 2, 2021");
    expect(readDate("13/02/2021", "MonthDayYear")).toBeNull();
    expect(readDate("2021", "DayMonthYear")).toBeNull();
  });
});
