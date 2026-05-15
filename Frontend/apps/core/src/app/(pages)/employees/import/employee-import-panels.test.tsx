// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AppliedResultPanel,
  ImportHistoryPanel,
} from "./employee-import-panels";
import type { EmployeeImportSessionDto } from "./employee-import.types";

function buildAppliedImportSession(
  overrides: Partial<EmployeeImportSessionDto> = {}
): EmployeeImportSessionDto {
  return {
    id: "session-1",
    stage: "Applied",
    version: 1,
    sourceFileName: "employees.csv",
    sourceFileSizeBytes: 512,
    sourceRowCount: 12,
    sourceHeaders: ["first_name", "last_name", "email"],
    sampleRows: [],
    previewRows: [],
    previewPageNumber: 1,
    previewPageSize: 10,
    previewPageCount: 1,
    totalPreviewRowCount: 12,
    hasMorePreviewRows: false,
    validationSummary: {
      totalRows: 12,
      validRows: 12,
      errorCount: 0,
      warningCount: 0,
    },
    validationIssues: [],
    appliedAt: "2026-05-13T09:00:00Z",
    expiresAt: "2026-05-14T09:00:00Z",
    employeeImportSchema: { canonicalFields: [] },
    canValidate: false,
    canApply: false,
    ...overrides,
  };
}

describe("AppliedResultPanel", () => {
  it("routes import completion into access review", () => {
    render(
      <AppliedResultPanel
        session={buildAppliedImportSession()}
        applyResult={null}
        onUpload={() => undefined}
        onReviewHistory={() => undefined}
      />
    );

    const reviewLink = screen.getByRole("link", {
      name: "Review access invitations",
    });
    expect(reviewLink.getAttribute("href")).toBe(
      "/employees?access=NotInvited&review=access"
    );

    const rosterLink = screen.getByRole("link", {
      name: "Open employee roster",
    });
    expect(rosterLink.getAttribute("href")).toBe(
      "/employees?access=NotInvited"
    );
  });
});

describe("ImportHistoryPanel", () => {
  it("renders unresolved follow-up items with fix links", () => {
    render(
      <ImportHistoryPanel
        historyPage={{
          items: [
            {
              id: "history-1",
              sessionId: "session-1",
              sourceFileName: "employees.csv",
              sourceFileSizeBytes: 512,
              sourceRowCount: 1,
              validRowCount: 1,
              createdCount: 1,
              skippedCount: 0,
              status: "Applied",
              appliedAt: "2026-05-13T09:00:00Z",
              actorUserId: "hr-1",
              actorFullName: "HR Admin",
              actorRole: "HRAdmin",
            },
          ],
          pageNumber: 1,
          pageSize: 5,
          totalCount: 1,
          pageCount: 1,
        }}
        historyDetail={{
          id: "history-1",
          sessionId: "session-1",
          version: 1,
          sourceFileName: "employees.csv",
          sourceFileSizeBytes: 512,
          sourceRowCount: 1,
          validRowCount: 1,
          createdCount: 1,
          skippedCount: 0,
          status: "Applied",
          appliedAt: "2026-05-13T09:00:00Z",
          actorUserId: "hr-1",
          actorFullName: "HR Admin",
          actorRole: "HRAdmin",
          failureReason: null,
          unresolvedFollowUpIssues: [
            {
              id: "follow-up-1",
              sourceRowNumber: 4,
              employeeId: "emp-1",
              employeeFullName: "Jordan Solo",
              employeeEmail: "jordan.solo@example.com",
              code: "MissingOrgUnit",
              label: "Org unit is missing",
              fieldKey: "orgUnitId",
              fixTarget: {
                kind: "ProfileOrganization",
                employeeId: "emp-1",
                fieldKey: "orgUnitId",
              },
            },
          ],
        }}
        selectedHistoryId="history-1"
        isHistoryLoading={false}
        isHistoryDetailLoading={false}
        historyError={null}
        historyDetailError={null}
        onSelectHistory={() => undefined}
        onPageChange={() => undefined}
      />
    );

    expect(screen.getByText("Unresolved follow-up items")).toBeTruthy();

    const fixLink = screen.getByRole("link", { name: "Open fix" });
    expect(fixLink.getAttribute("href")).toBe(
      "/employees/emp-1?sheet=organization"
    );
  });
});
