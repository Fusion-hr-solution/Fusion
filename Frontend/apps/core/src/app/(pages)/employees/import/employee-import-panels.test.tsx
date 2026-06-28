// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type {
  EmployeeImportSessionDto,
  EmployeeImportHistoryPageDto,
} from "./employee-import.types";
import { AppliedResultPanel, ImportHistoryPanel } from "./employee-import-panels";

const {
  mockCanAccessCoreAccess,
  mockCanAccessCorePeople,
  mockCanManageCoreAccessProfiles,
  mockUseAuth,
} =
  vi.hoisted(() => ({
    mockCanAccessCoreAccess: vi.fn(),
    mockCanAccessCorePeople: vi.fn(),
    mockCanManageCoreAccessProfiles: vi.fn(),
    mockUseAuth: vi.fn(),
  }));

vi.mock("@repo/auth", () => ({
  canAccessCoreAccess: mockCanAccessCoreAccess,
  canAccessCorePeople: mockCanAccessCorePeople,
  canManageCoreAccessProfiles: mockCanManageCoreAccessProfiles,
  useAuth: mockUseAuth,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string | URL;
    children: ReactNode;
  } & ComponentPropsWithoutRef<"a">) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

const historyItem = {
  id: "history-1",
  sessionId: "session-1",
  sourceFileName: "employees-june.csv",
  sourceFileSizeBytes: 2048,
  sourceRowCount: 5,
  validatedRowCount: 4,
  createdCount: 3,
  unchangedRowCount: 1,
  publishedRowCount: 3,
  status: "Applied",
  appliedAt: "2025-06-05T10:20:00.000Z",
  actorUserId: "user-1",
  actorFullName: "Alex Morgan",
  actorRole: "HR Admin",
  eventType: "Import" as const,
  errorCount: 0,
  warningCount: 0,
};

const historyPage: EmployeeImportHistoryPageDto = {
  items: [historyItem],
  pageNumber: 1,
  pageSize: 10,
  totalCount: 1,
  pageCount: 1,
};

describe("ImportHistoryPanel", () => {
  vi.mocked(mockCanAccessCoreAccess).mockReturnValue(true);
  vi.mocked(mockCanAccessCorePeople).mockReturnValue(false);
  vi.mocked(mockCanManageCoreAccessProfiles).mockReturnValue(true);
  vi.mocked(mockUseAuth).mockReturnValue({
    user: {
      userId: "user-1",
      tenantId: "tenant-1",
      email: "alex.morgan@example.com",
      fullName: "Alex Morgan",
      roles: ["HRAdmin"],
      employeeId: "emp-1",
      accessProfiles: [],
      effectivePermissions: [],
    },
    isLoading: false,
  });

  it("renders a compact history row with the useful summary fields", async () => {
    render(
      <ImportHistoryPanel
        historyPage={historyPage}
        isHistoryLoading={false}
        historyError={null}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText("employees-june.csv")).toBeInTheDocument();
    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(screen.getByText("3 published · 1 unchanged · 5 rows")).toBeInTheDocument();
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.queryByText("session-1")).not.toBeInTheDocument();
    expect(screen.queryByText("user-1")).not.toBeInTheDocument();
  });

  it("routes the import CTA to plain access without query context", () => {
    const appliedSession = {
      stage: "Applied",
      sourceFileName: "employees-june.csv",
      sourceRowCount: 5,
      sourceFileSizeBytes: 2048,
      appliedAt: "2025-06-05T10:20:00.000Z",
      canApply: false,
      canValidate: false,
      validationSummary: {
        validRows: 3,
        errorCount: 0,
        warningCount: 0,
      },
    } as unknown as EmployeeImportSessionDto;

    render(
      <AppliedResultPanel
        session={appliedSession}
        applyResult={null}
        onUpload={vi.fn()}
      />
    );

    const link = screen.getByRole("link", { name: /activate access/i });

    expect(link).toHaveAttribute("href", "/access");
    expect(link.getAttribute("href")).not.toContain("access=NotInvited");
  });
});
