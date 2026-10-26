// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { WorkforceImportMatch } from "@repo/api";
import { WorkforceInterpretationPanel } from "./workforce-match-sections";

describe("Workforce interpretation decisions", () => {
  const base: WorkforceImportMatch = {
    columns: [{ columnIndex: 0, sourceLabel: "Name", field: "Ignored", origin: null, resolved: false, nonEmptyCount: 2, sampleValues: ["Ada"] }],
    dateFormat: null,
    nameFormat: null,
    dateFormatDecisionNeeded: true,
    nameFormatDecisionNeeded: false,
    identityStrategy: null,
    generateAllAllowed: false,
    lifecycleValues: [],
    managerReferenceKind: "None",
    readiness: {
      canContinue: false,
      completionKind: "Incomplete",
      requiredDecisions: [
        { key: "identity", kind: "IdentityStrategy", field: null, columnIndex: null, sourceValue: null, occurrenceCount: 0 },
        { key: "date-format", kind: "DateFormat", field: null, columnIndex: null, sourceValue: null, occurrenceCount: 0 },
      ],
    },
    semanticAssistance: null,
    previewRows: [],
  };
  const edits = () => ({ edit: vi.fn(async () => true), busy: false, pendingValue: () => undefined });

  it("offers generated numbers only where nobody could be duplicated", () => {
    const { rerender } = render(<WorkforceInterpretationPanel match={base} edits={edits()} locked={false} />);
    expect(screen.queryByRole("button", { name: "Generate employee numbers" })).not.toBeInTheDocument();
    const e = edits();
    rerender(<WorkforceInterpretationPanel match={{ ...base, generateAllAllowed: true }} edits={e} locked={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate employee numbers" }));
    expect(e.edit).toHaveBeenCalledWith("identity", "generate", { identityStrategy: "GenerateAll" });
  });

  it("saves the date format as soon as it is chosen", () => {
    const e = edits();
    render(<WorkforceInterpretationPanel match={base} edits={e} locked={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "Day / Month / Year" }));
    expect(e.edit).toHaveBeenCalledWith("date-format", "DayMonthYear", { dateFormat: "DayMonthYear" });
  });
});
