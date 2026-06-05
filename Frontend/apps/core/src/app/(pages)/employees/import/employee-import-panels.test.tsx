// @vitest-environment jsdom
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const authState = vi.hoisted(() => ({
  user: {
    userId: "hr-1",
    email: "hr@example.com",
    fullName: "HR Admin",
    roles: ["HRAdmin"],
  },
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => authState,
  canAccessCoreAccess: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("AccessAdmin"),
  canManageCoreAccessProfiles: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin"),
  canAccessCorePeople: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin"),
  canAccessCoreTeam: () => false,
  canAccessOwnCoreProfile: () => false,
}));

import {
  AppliedResultPanel,
  BatchActionPanel,
  ImportHistoryPanel,
} from "./employee-import-panels";
import type { EmployeeImportSessionDto } from "./employee-import.types";

function buildImportSession(
  overrides: Partial<EmployeeImportSessionDto> = {}
): EmployeeImportSessionDto {
  return {
    id: "session-1",
    stage: "PreviewReady",
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
    appliedAt: null,
    expiresAt: "2026-05-14T09:00:00Z",
    employeeImportSchema: { canonicalFields: [] },
    canValidate: true,
    canApply: false,
    ...overrides,
  };
}

function buildAppliedImportSession(
  overrides: Partial<EmployeeImportSessionDto> = {}
): EmployeeImportSessionDto {
  return buildImportSession({
    stage: "Applied",
    appliedAt: "2026-05-13T09:00:00Z",
    canValidate: false,
    canApply: false,
    ...overrides,
  });
}

beforeEach(() => {
  authState.user = {
    userId: "hr-1",
    email: "hr@example.com",
    fullName: "HR Admin",
    roles: ["HRAdmin"],
  };
});

describe("BatchActionPanel", () => {
  it("focuses the next step on validation for preview-ready batches", () => {
    render(
      <BatchActionPanel
        session={buildImportSession()}
        isValidating={false}
        isUploading={false}
        isDownloadingTemplate={false}
        isApplying={false}
        applyError={null}
        onValidate={() => undefined}
        onUpload={() => undefined}
        onDownloadTemplate={() => undefined}
        onApply={async () => false}
      />
    );

    expect(screen.getByText("Preview ready")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Validate file" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Import employees" })).toBeNull();
  });

  it("summarizes blocking validation issues and points to a corrected upload", () => {
    render(
      <BatchActionPanel
        session={buildImportSession({
          stage: "Validated",
          validationSummary: {
            totalRows: 12,
            validRows: 7,
            errorCount: 4,
            warningCount: 2,
          },
        })}
        isValidating={false}
        isUploading={false}
        isDownloadingTemplate={false}
        isApplying={false}
        applyError={null}
        onValidate={() => undefined}
        onUpload={() => undefined}
        onDownloadTemplate={() => undefined}
        onApply={async () => false}
      />
    );

    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Upload corrected file" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Validate file" })).toBeNull();
    expect(screen.getByText("4 issues · 2 warnings")).toBeTruthy();
  });

  it("surfaces apply as the primary action for validated clean batches", () => {
    render(
      <BatchActionPanel
        session={buildImportSession({
          stage: "Validated",
          canApply: true,
        })}
        isValidating={false}
        isUploading={false}
        isDownloadingTemplate={false}
        isApplying={false}
        applyError={null}
        onValidate={() => undefined}
        onUpload={() => undefined}
        onDownloadTemplate={() => undefined}
        onApply={async () => true}
      />
    );

    expect(screen.getByText("Ready to import")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import employees" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Upload another file" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Validate file" })).toBeNull();
  });

  it("keeps the confirmation open when apply fails", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn(async () => false);

    function FailingApplyPanel({ apply }: { apply: () => Promise<boolean> }) {
      const [applyError, setApplyError] = useState<string | null>(null);

      return (
        <BatchActionPanel
          session={buildImportSession({
            stage: "Validated",
            canApply: true,
          })}
          isValidating={false}
          isUploading={false}
          isDownloadingTemplate={false}
          isApplying={false}
          applyError={applyError}
          onValidate={() => undefined}
          onUpload={() => undefined}
          onDownloadTemplate={() => undefined}
          onApply={async () => {
            setApplyError("Database rejected the batch.");
            return apply();
          }}
        />
      );
    }

    render(<FailingApplyPanel apply={onApply} />);

    await user.click(screen.getByRole("button", { name: "Import employees" }));

    const dialog = screen.getByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Import employees" })
    );

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Database rejected the batch.")
    ).toBeTruthy();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("closes the confirmation after a successful apply", async () => {
    const user = userEvent.setup();

    render(
      <BatchActionPanel
        session={buildImportSession({
          stage: "Validated",
          canApply: true,
        })}
        isValidating={false}
        isUploading={false}
        isDownloadingTemplate={false}
        isApplying={false}
        applyError={null}
        onValidate={() => undefined}
        onUpload={() => undefined}
        onDownloadTemplate={() => undefined}
        onApply={async () => true}
      />
    );
 
    await user.click(screen.getByRole("button", { name: "Import employees" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Import employees",
      })
    );

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });
});

describe("AppliedResultPanel", () => {
  it("routes import completion into the Access workspace", () => {
    render(
      <AppliedResultPanel
        session={buildAppliedImportSession()}
        applyResult={null}
        onUpload={() => undefined}
      />
    );

    const reviewLink = screen.getByRole("link", {
      name: "Activate access",
    });
    expect(reviewLink.getAttribute("href")).toBe("/access");

    const rosterLink = screen.getByRole("link", {
      name: "See employees",
    });
    expect(rosterLink.getAttribute("href")).toBe("/employees");
    expect(
      screen.queryByRole("button", { name: "Review history" })
    ).toBeNull();
  });

  it("hides completion links when the user lacks directory and access permissions", () => {
    authState.user = {
      userId: "viewer-1",
      email: "viewer@example.com",
      fullName: "Viewer",
      roles: [],
    };

    render(
      <AppliedResultPanel
        session={buildAppliedImportSession()}
        applyResult={null}
        onUpload={() => undefined}
      />
    );

    expect(
      screen.queryByRole("link", { name: "Activate access" })
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "See employees" })).toBeNull();
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
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
              eventType: "Import",
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
                employeeKey: "E-EMP1",
                fieldKey: "orgUnitId",
              },
            },
          ],
          eventType: "Import",
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
      "/employees/E-EMP1?sheet=organization"
    );
  });

  it("renders selected history detail outside the current page", () => {
    render(
      <ImportHistoryPanel
        historyPage={{
          items: [
            {
              id: "history-2",
              sessionId: "session-2",
              sourceFileName: "other.csv",
              sourceFileSizeBytes: 128,
              sourceRowCount: 2,
              validRowCount: 2,
              createdCount: 2,
              skippedCount: 0,
              status: "Applied",
              appliedAt: "2026-05-13T10:00:00Z",
              actorUserId: "hr-2",
              actorFullName: "Other Admin",
              actorRole: "HRAdmin",
              eventType: "Import",
            },
          ],
          pageNumber: 1,
          pageSize: 5,
          totalCount: 6,
          pageCount: 2,
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
          unresolvedFollowUpIssues: [],
          eventType: "Import",
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

    expect(screen.getByText("Selected import record")).toBeTruthy();
    expect(screen.getByText("employees.csv")).toBeTruthy();
  });

  it("renders upload history items with correct labels", () => {
    render(
      <ImportHistoryPanel
        historyPage={{
          items: [
            {
              id: "upload-1",
              sessionId: "session-1",
              sourceFileName: "employees.csv",
              sourceFileSizeBytes: 512,
              sourceRowCount: 12,
              validRowCount: 0,
              createdCount: 0,
              skippedCount: 0,
              status: "Uploaded",
              appliedAt: "2026-05-13T08:00:00Z",
              actorUserId: "hr-1",
              actorFullName: "HR Uploader",
              actorRole: "HRAdmin",
              eventType: "Upload",
            },
          ],
          pageNumber: 1,
          pageSize: 5,
          totalCount: 1,
          pageCount: 1,
        }}
        historyDetail={undefined}
        selectedHistoryId={null}
        isHistoryLoading={false}
        isHistoryDetailLoading={false}
        historyError={null}
        historyDetailError={null}
        onSelectHistory={() => undefined}
        onPageChange={() => undefined}
      />
    );

    expect(screen.getAllByText("Uploaded").length).toBeGreaterThan(0);
    expect(screen.getByText(/12 rows/)).toBeTruthy();
    expect(screen.queryByText("created")).toBeNull();
  });

  it("renders validation history items with error count", () => {
    render(
      <ImportHistoryPanel
        historyPage={{
          items: [
            {
              id: "val-1",
              sessionId: "session-1",
              sourceFileName: "employees.csv",
              sourceFileSizeBytes: 512,
              sourceRowCount: 12,
              validRowCount: 8,
              createdCount: 0,
              skippedCount: 0,
              status: "Validated",
              appliedAt: "2026-05-13T09:00:00Z",
              actorUserId: "hr-1",
              actorFullName: "HR Validator",
              actorRole: "HRAdmin",
              eventType: "Validation",
              errorCount: 3,
              warningCount: 1,
            },
          ],
          pageNumber: 1,
          pageSize: 5,
          totalCount: 1,
          pageCount: 1,
        }}
        historyDetail={undefined}
        selectedHistoryId={null}
        isHistoryLoading={false}
        isHistoryDetailLoading={false}
        historyError={null}
        historyDetailError={null}
        onSelectHistory={() => undefined}
        onPageChange={() => undefined}
      />
    );

    expect(screen.getAllByText("Validated").length).toBeGreaterThan(0);
    expect(screen.getByText(/3 errors/)).toBeTruthy();
    expect(screen.getByText(/1 warning/)).toBeTruthy();
  });
});
