// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OrganizationImportActiveSummaryDto,
  OrganizationImportIntakeResult,
  OrganizationImportSessionDto,
} from "@repo/api";
import { todayCalendarDate } from "@/features/organization/model/workspace-state";
import OrganizationImportWorkspace from "./organization-import-workspace";

const mocks = vi.hoisted(() => ({
  canView: true,
  canManage: true,
  authLoading: false,
  replace: vi.fn(),
  activeData: [] as OrganizationImportActiveSummaryDto[],
  sessionQuery: null as Record<string, unknown> | null,
  readiness: { hasPermanentRoot: true } as { hasPermanentRoot: boolean },
  intake: { mutateAsync: vi.fn(), isLoading: false },
  changeDate: { mutateAsync: vi.fn(), isLoading: false },
  discard: { mutateAsync: vi.fn(), isLoading: false },
  downloadTemplate: vi.fn(),
  exportStructure: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@repo/auth", () => ({
  useAuth: () => ({ user: {}, isLoading: mocks.authLoading, isAuthenticated: true }),
  canViewCoreOrganization: () => mocks.canView,
  canManageCoreOrganization: () => mocks.canManage,
}));
vi.mock("@repo/api", () => ({
  translateOrganizationImportError: (error: unknown) => ({
    kind: error instanceof Error && error.message === "rejected" ? "rejected" : "temporary",
    message: error instanceof Error ? error.message : "Request failed",
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/features/organization/api/use-organization", () => ({
  useOrganizationReadiness: () => ({ data: mocks.readiness }),
}));
vi.mock("@/shell/breadcrumb-overrides", () => ({
  useBreadcrumbLabel: () => undefined,
}));
vi.mock("../api/use-organization-import", () => ({
  useOrganizationImportApi: () => ({
    downloadTemplate: mocks.downloadTemplate,
    exportStructure: mocks.exportStructure,
  }),
  useOrganizationImportMutations: () => ({
    intake: mocks.intake,
    changeDate: mocks.changeDate,
    discard: mocks.discard,
  }),
  useActiveOrganizationImports: () => ({ data: mocks.activeData }),
  useOrganizationImportSession: () => mocks.sessionQuery,
}));

function sourceReady(
  overrides: Partial<OrganizationImportSessionDto> = {}
): Extract<OrganizationImportIntakeResult, { kind: "SourceReady" }> {
  return {
    kind: "SourceReady",
    replayed: false,
    session: {
      id: "session-1",
      status: "Active",
      effectiveDate: todayCalendarDate(),
      version: 1,
      startedByUserId: "admin-1",
      startedByDisplayName: "Ada Admin",
      lastUpdatedByUserId: "admin-1",
      lastUpdatedByDisplayName: "Ada Admin",
      createdAt: "2026-08-12T10:00:00Z",
      updatedAt: null,
      discardedAt: null,
      source: {
        originalFileName: "organization.csv",
        sourceFormat: "csv",
        contentType: "text/csv",
        byteLength: 18,
        sha256: "a".repeat(64),
        selectedSheetName: "CSV",
        selectedRange: "A1:A2",
        columnCount: 1,
        rowCount: 1,
        payloadPurgedAt: null,
        table: { columns: [{ index: 0, sourceLabel: "Name" }], rows: [["Root"]] },
      },
      baseline: { hasPermanentRootIdentity: true, hasRootAsOfEffectiveDate: false },
      ...overrides,
    },
    sheetSelection: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.canView = true;
  mocks.canManage = true;
  mocks.authLoading = false;
  mocks.activeData = [];
  mocks.sessionQuery = null;
  mocks.readiness = { hasPermanentRoot: true };
  mocks.replace.mockReset();
  mocks.intake.mutateAsync.mockReset();
  mocks.changeDate.mutateAsync.mockReset();
  mocks.discard.mutateAsync.mockReset();
  mocks.downloadTemplate.mockReset().mockResolvedValue(new Blob());
  mocks.exportStructure.mockReset().mockResolvedValue(new Blob());
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");
  Object.defineProperty(globalThis.URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test"),
  });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("OrganizationImportWorkspace access and composition", () => {
  it("denies callers without Organization view access before import queries render", () => {
    mocks.canView = false;
    render(<OrganizationImportWorkspace />);
    expect(screen.getByText("Organization access required")).toBeInTheDocument();
    expect(screen.queryByText("Source file")).not.toBeInTheDocument();
  });

  it("gives View-only callers a read-only management notice", () => {
    mocks.canManage = false;
    render(<OrganizationImportWorkspace />);
    expect(screen.getByText("Organization management access required")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Organization" })).toHaveAttribute("href", "/organization");
  });

  it("keeps the first viewport in task, date, active, source, utility order", () => {
    mocks.activeData = [{
      id: "active-1",
      effectiveDate: "2026-08-12",
      version: 1,
      originalFileName: "north.xlsx",
      sourceFormat: "xlsx",
      rowCount: 8,
      startedByDisplayName: "Ada Admin",
      lastUpdatedByDisplayName: "Lin Admin",
      createdAt: "2026-08-12T10:00:00Z",
      updatedAt: "2026-08-12T11:00:00Z",
    }];
    render(<OrganizationImportWorkspace />);
    const task = screen.getByRole("heading", { name: "Import structure" });
    const active = screen.getByRole("heading", { name: "Import in progress" });
    // Effective date now lives in the page header (context), before the body sections.
    const date = document.getElementById("organization-import-date")!;
    const source = screen.getByRole("heading", { name: "Upload your file" });
    const utilities = screen.getByRole("region", { name: "Import utilities" });
    expect(task.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(date.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(active.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(source.compareDocumentPosition(utilities) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute("href", "/organization/import/active-1");
    // Active work carries real recency, not just actor identity.
    expect(screen.getByText(/updated .* by Lin Admin/i)).toBeInTheDocument();
  });
});

describe("OrganizationImportWorkspace source intake", () => {
  it("uses the picker and routes only after the source is durable", async () => {
    mocks.intake.mutateAsync.mockResolvedValue(sourceReady());
    render(<OrganizationImportWorkspace />);
    const file = new File(["Name\nRoot"], "organization.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose an organization source file"), { target: { files: [file] } });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1"));
  });

  it("uses drag/drop through the same durable intake path", async () => {
    mocks.intake.mutateAsync.mockResolvedValue(sourceReady());
    render(<OrganizationImportWorkspace />);
    const file = new File(["Name\nRoot"], "organization.csv", { type: "text/csv" });
    fireEvent.drop(screen.getByRole("region", { name: "Organization source drop area" }), {
      dataTransfer: { files: [file] },
    });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1"));
  });

  it("retains the file and creation token while selecting a worksheet", async () => {
    mocks.intake.mutateAsync
      .mockResolvedValueOnce({ kind: "SheetSelectionRequired", sheetSelection: { candidateSheetNames: ["North", "South"] } })
      .mockResolvedValueOnce(sourceReady());
    render(<OrganizationImportWorkspace />);
    const file = new File(["xlsx"], "organization.xlsx");
    fireEvent.change(screen.getByLabelText("Choose an organization source file"), { target: { files: [file] } });
    await screen.findByText("Which sheet contains the organization structure?");
    fireEvent.click(screen.getByRole("button", { name: "South" }));
    await waitFor(() => expect(mocks.intake.mutateAsync).toHaveBeenCalledTimes(2));
    expect(mocks.intake.mutateAsync.mock.calls[1]![0]).toMatchObject({
      file,
      creationToken: "11111111-1111-4111-8111-111111111111",
      selectedSheetName: "South",
    });
  });

  it("reconciles the latest intended date after an in-flight replay response", async () => {
    const pending = deferred<ReturnType<typeof sourceReady>>();
    mocks.intake.mutateAsync.mockReturnValue(pending.promise);
    mocks.changeDate.mutateAsync.mockResolvedValue(sourceReady({ effectiveDate: "2026-10-01", version: 2 }).session);
    render(<OrganizationImportWorkspace />);
    const file = new File(["Name\nRoot"], "organization.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose an organization source file"), { target: { files: [file] } });
    fireEvent.change(document.getElementById("organization-import-date")!, { target: { value: "2026-10-01" } });
    await act(async () => pending.resolve(sourceReady({ effectiveDate: "2026-08-12" })));
    await waitFor(() => expect(mocks.changeDate.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      effectiveDate: "2026-10-01",
    }));
    expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1");
  });

  it("keeps the selected source while the pre-durable Effective date changes", async () => {
    const pending = deferred<ReturnType<typeof sourceReady>>();
    mocks.intake.mutateAsync.mockReturnValue(pending.promise);
    render(<OrganizationImportWorkspace />);
    const file = new File(["Name\nRoot"], "organization.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose an organization source file"), { target: { files: [file] } });
    fireEvent.change(document.getElementById("organization-import-date")!, { target: { value: "2026-11-01" } });

    expect(screen.getByText("organization.csv")).toBeInTheDocument();
    expect(document.getElementById("organization-import-date")).toHaveValue("2026-11-01");
    pending.resolve(sourceReady({ effectiveDate: "2026-11-01" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1"));
  });

  it("downloads a date-independent template and a date-aware current export", async () => {
    render(<OrganizationImportWorkspace />);
    fireEvent.change(document.getElementById("organization-import-date")!, { target: { value: "2026-12-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Download Fusion template" }));
    fireEvent.click(screen.getByRole("button", { name: "Export current structure" }));

    await waitFor(() => expect(mocks.downloadTemplate).toHaveBeenCalledWith());
    await waitFor(() => expect(mocks.exportStructure).toHaveBeenCalledWith("2026-12-15"));
  });

  it("rejects an oversized picker selection locally with source-fix recovery, not Retry", async () => {
    render(<OrganizationImportWorkspace />);
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose an organization source file"), { target: { files: [file] } });
    expect(
      await screen.findByText("This file is larger than the 10 MB upload limit.")
    ).toBeInTheDocument();
    // Deterministic source defect: fix/replace the file, never Retry the same bytes.
    expect(screen.getByRole("button", { name: "Choose another file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(mocks.intake.mutateAsync).not.toHaveBeenCalled();
  });

  it("accepts a structurally valid but unrelated employee CSV and hands off to a durable session", async () => {
    mocks.intake.mutateAsync.mockResolvedValue(sourceReady());
    render(<OrganizationImportWorkspace />);
    const employeeCsv = new File(
      [
        "employeeNumber,firstName,lastName,email,orgUnitCode,managerEmail\n1,Ada,Byron,ada@x.io,ENG,mgr@x.io",
      ],
      "employees.csv",
      { type: "text/csv" }
    );
    fireEvent.change(screen.getByLabelText("Choose an organization source file"), {
      target: { files: [employeeCsv] },
    });
    // Phase 1 introduces no semantic Organization gate: a usable table is accepted.
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1"));
  });

  it("classifies deterministic source rejection into fix-the-file recovery", async () => {
    mocks.intake.mutateAsync.mockRejectedValue(new Error("rejected"));
    render(<OrganizationImportWorkspace />);
    const file = new File(["oops"], "organization.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose an organization source file"), { target: { files: [file] } });
    // Recovery is fix-the-file, in place: the source object keeps the file name
    // and offers Choose another file, never Retry.
    expect(await screen.findByRole("button", { name: "Choose another file" })).toBeInTheDocument();
    expect(screen.getByText("organization.csv")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("classifies a temporary failure into a source-preserving Retry", async () => {
    mocks.intake.mutateAsync.mockRejectedValue(new Error("service down"));
    render(<OrganizationImportWorkspace />);
    const file = new File(["Name\nRoot"], "organization.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose an organization source file"), { target: { files: [file] } });
    // Technical failure keeps the source in place and offers Retry, not a fix.
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByText(/service down/)).toBeInTheDocument();
    expect(screen.getByText("organization.csv")).toBeInTheDocument();
  });

  it("hides Export current structure when no canonical Organization exists yet", () => {
    mocks.readiness = { hasPermanentRoot: false };
    render(<OrganizationImportWorkspace />);
    expect(screen.getByRole("button", { name: "Download Fusion template" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Export current structure" })
    ).not.toBeInTheDocument();
  });
});

describe("OrganizationImportWorkspace durable route", () => {
  it("renders a truthful Source ready workspace without phase or semantic leakage", () => {
    mocks.sessionQuery = { data: sourceReady().session, isLoading: false, error: null, refetch: vi.fn() };
    render(<OrganizationImportWorkspace sessionId="session-1" />);
    expect(screen.getByText("organization.csv")).toBeInTheDocument();
    expect(screen.getByText("Source ready")).toBeInTheDocument();
    // No implementation-phase or semantic-acceptance language leaks into the product.
    expect(screen.queryByText("Accepted source")).not.toBeInTheDocument();
    expect(screen.queryByText(/next import phase|Details/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/permanent Organization root/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/proposal|mapping|conflict/i)).not.toBeInTheDocument();
  });

  it("persists date edits with the current ETag version", async () => {
    const refetch = vi.fn();
    mocks.sessionQuery = { data: sourceReady().session, isLoading: false, error: null, refetch };
    mocks.changeDate.mutateAsync.mockResolvedValue(sourceReady({ effectiveDate: "2026-09-01", version: 2 }).session);
    render(<OrganizationImportWorkspace sessionId="session-1" />);
    fireEvent.change(screen.getByLabelText("Effective date"), { target: { value: "2026-09-01" } });
    await waitFor(() => expect(mocks.changeDate.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      effectiveDate: "2026-09-01",
    }));
    expect(refetch).toHaveBeenCalled();
  });

  it("requires explicit confirmation before discard and then returns to the generic workspace", async () => {
    mocks.sessionQuery = { data: sourceReady().session, isLoading: false, error: null, refetch: vi.fn() };
    mocks.discard.mutateAsync.mockResolvedValue(sourceReady({ status: "Discarded" }).session);
    render(<OrganizationImportWorkspace sessionId="session-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Discard import" }));
    expect(mocks.discard.mutateAsync).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Discard import" }));
    await waitFor(() => expect(mocks.discard.mutateAsync).toHaveBeenCalledWith({ id: "session-1", version: 1 }));
    expect(mocks.replace).toHaveBeenCalledWith("/organization/import");
  });

  it("shows a non-resumable discarded deep link without source cells", () => {
    const discarded = sourceReady({ status: "Discarded" }).session;
    discarded.source = { ...discarded.source, table: null, payloadPurgedAt: "2026-08-12T12:00:00Z" };
    mocks.sessionQuery = { data: discarded, isLoading: false, error: null, refetch: vi.fn() };
    render(<OrganizationImportWorkspace sessionId="session-1" />);
    expect(screen.getByText("Import discarded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start another import" })).toHaveAttribute("href", "/organization/import");
    expect(screen.queryByText("Root")).not.toBeInTheDocument();
  });

  it("renders durable loading and recoverable not-available states", () => {
    mocks.sessionQuery = { data: null, isLoading: true, error: null, refetch: vi.fn() };
    const view = render(<OrganizationImportWorkspace sessionId="session-1" />);
    expect(screen.getByText("Loading your import.")).toBeInTheDocument();

    const refetch = vi.fn();
    mocks.sessionQuery = { data: null, isLoading: false, error: new Error("not found"), refetch };
    view.rerender(<OrganizationImportWorkspace sessionId="session-1" />);
    expect(screen.getByText("Import not available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
