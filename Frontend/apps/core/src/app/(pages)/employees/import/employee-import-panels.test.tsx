// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImportHistoryPanel } from "./employee-import-panels";

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