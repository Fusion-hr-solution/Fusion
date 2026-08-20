// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { WorkforceInterpretationSummaryDto } from "@repo/api";
import { WorkforceInterpretation } from "./workforce-interpretation";
import { BaselineControl } from "./workforce-baseline";

const noop = () => {};

function interpretation(overrides: Partial<WorkforceInterpretationSummaryDto> = {}): WorkforceInterpretationSummaryDto {
  return {
    mappings: [],
    unresolvedColumnIndexes: [],
    unresolvedRequiredFields: [],
    nameFormatDecisionNeeded: false,
    dateFormatDecisionNeeded: false,
    ...overrides,
  };
}

describe("WorkforceInterpretation", () => {
  it("elevates the unresolved column and keeps confident mappings quiet", () => {
    render(
      <WorkforceInterpretation
        interpretation={interpretation({
          mappings: [
            { columnIndex: 0, sourceLabel: "Matricule", field: "EmployeeNumber", origin: "deterministic" },
            { columnIndex: 1, sourceLabel: "N+1", field: "Ignored", origin: "unresolved" },
          ],
          unresolvedColumnIndexes: [1],
        })}
        suggesting={false}
        committing={false}
        onSuggest={noop}
        suggestions={null}
        suggestionsUnavailableReason={null}
        onCommit={noop}
      />
    );
    // The unresolved column is asked about; the confident one stays in the collapsed ledger.
    expect(screen.getByText("N+1")).toBeInTheDocument();
    expect(screen.queryByText("Matricule")).not.toBeInTheDocument();
    expect(screen.getByText(/to confirm/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Suggest meanings/i })).toBeInTheDocument();
  });

  it("stages a date-format read and commits it in one batch on continue", () => {
    const onCommit = vi.fn();
    render(
      <WorkforceInterpretation
        interpretation={interpretation({ dateFormatDecisionNeeded: true })}
        suggesting={false}
        committing={false}
        onSuggest={noop}
        suggestions={null}
        suggestionsUnavailableReason={null}
        onCommit={onCommit}
      />
    );
    // Choosing a format stages it locally — no callback yet.
    fireEvent.click(screen.getByText("Day / Month / Year"));
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Continue to review/i }));
    expect(onCommit).toHaveBeenCalledWith({ columnMappings: {}, dateFormat: "DayMonthYear", nameFormat: undefined });
  });

  it("keeps the manual path when suggestions are unavailable", () => {
    render(
      <WorkforceInterpretation
        interpretation={interpretation({
          mappings: [{ columnIndex: 0, sourceLabel: "Weird", field: "Ignored", origin: "unresolved" }],
          unresolvedColumnIndexes: [0],
        })}
        suggesting={false}
        committing={false}
        onSuggest={noop}
        suggestions={[]}
        suggestionsUnavailableReason="Suggestions aren't available right now. You can continue manually."
        onCommit={noop}
      />
    );
    expect(screen.getByText(/continue manually/i)).toBeInTheDocument();
    // The manual Choose-meaning control is still present.
    expect(screen.getByText(/Choose meaning/)).toBeInTheDocument();
  });
});

describe("BaselineControl", () => {
  it("states the carry-forward consequence for a past date", () => {
    render(<BaselineControl value="2026-07-31" onChange={noop} />);
    expect(screen.getByText(/treat them as current until you record a later change/i)).toBeInTheDocument();
  });

  it("refuses a future date with direction to Hire", () => {
    const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    render(<BaselineControl value={future} onChange={noop} />);
    expect(screen.getByText(/Use Hire for future employees/i)).toBeInTheDocument();
  });
});
