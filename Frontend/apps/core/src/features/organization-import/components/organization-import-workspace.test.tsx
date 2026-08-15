// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OrganizationImportActiveSummaryDto,
  OrganizationImportIntakeResult,
  OrganizationImportSemanticAssistance,
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
  replaceDecisions: { mutateAsync: vi.fn(), isLoading: false },
  refresh: { mutateAsync: vi.fn(), isLoading: false },
  generateSuggestions: { mutateAsync: vi.fn(), isLoading: false },
  applySuggestions: { mutateAsync: vi.fn(), isLoading: false },
  commit: { mutateAsync: vi.fn(), isLoading: false },
  downloadTemplate: vi.fn(),
  exportStructure: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
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
vi.mock("sonner", () => ({ toast: mocks.toast }));
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
    replaceDecisions: mocks.replaceDecisions,
    refresh: mocks.refresh,
    generateSuggestions: mocks.generateSuggestions,
    applySuggestions: mocks.applySuggestions,
    commit: mocks.commit,
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
      decisions: {},
      review: {
        shape: "ParentReference",
        shapeStatus: "Resolved",
        shapeOrigin: "Deterministic",
        fieldMappings: [],
        typeOptions: [],
        proposalNodes: [],
        resultingOrganization: [],
        issues: [],
        existingCount: 0,
        createCount: 0,
        canCommit: true,
        semanticDigest: "a".repeat(64),
        canonicalObservationDigest: "b".repeat(64),
        decisionRevision: 0,
        decisionsUpdatedAt: null,
        decisionsUpdatedByDisplayName: null,
      },
      commitResult: null,
      committedAt: null,
      committedByUserId: null,
      committedByDisplayName: null,
      finalProvenance: null,
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

function semanticAssistance(
  state: OrganizationImportSemanticAssistance["state"],
  overrides: Partial<OrganizationImportSemanticAssistance> = {}
): OrganizationImportSemanticAssistance {
  return {
    state,
    inputFingerprint: "f".repeat(64),
    attemptId: state === "Available" ? "attempt-1" : null,
    attemptVersion: state === "Available" ? 2 : null,
    provider: state === "Available" ? "Groq" : null,
    model: state === "Available" ? "openai/gpt-oss-120b" : null,
    requestedAt: null,
    completedAt: null,
    failureCategory: null,
    retryAfter: null,
    suggestions: [],
    ...overrides,
  };
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
  mocks.replaceDecisions.mutateAsync.mockReset();
  mocks.refresh.mutateAsync.mockReset();
  mocks.generateSuggestions.mutateAsync.mockReset();
  mocks.applySuggestions.mutateAsync.mockReset();
  mocks.commit.mutateAsync.mockReset();
  mocks.toast.mockReset();
  mocks.toast.error.mockReset();
  mocks.toast.success.mockReset();
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
  // Radix menus and the outline's reveal-on-select rely on DOM APIs happy-dom omits.
  for (const [name, value] of [
    ["scrollIntoView", vi.fn()],
    ["hasPointerCapture", vi.fn(() => false)],
    ["releasePointerCapture", vi.fn()],
    ["setPointerCapture", vi.fn()],
  ] as const)
    Object.defineProperty(window.HTMLElement.prototype, name, { configurable: true, value });
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
  it("requests eligible semantic help once and shows the restrained persisted pending state", async () => {
    const eligible = sourceReady({ semanticAssistance: semanticAssistance("Eligible") }).session;
    const refetch = vi.fn();
    mocks.sessionQuery = { data: eligible, isLoading: false, error: null, refetch };
    mocks.generateSuggestions.mutateAsync.mockResolvedValue(semanticAssistance("Pending"));
    const view = render(<OrganizationImportWorkspace sessionId="session-1" />);

    await waitFor(() => expect(mocks.generateSuggestions.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      inputFingerprint: "f".repeat(64),
    }));
    expect(refetch).toHaveBeenCalledTimes(1);

    mocks.sessionQuery = {
      data: sourceReady({ semanticAssistance: semanticAssistance("Pending") }).session,
      isLoading: false,
      error: null,
      refetch,
    };
    view.rerender(<OrganizationImportWorkspace sessionId="session-1" />);
    expect(screen.getByRole("status")).toHaveTextContent("Interpreting unfamiliar organization terms…");
    expect(mocks.generateSuggestions.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("offers an explicit retry after a transport failure and scopes generation to the session", async () => {
    const first = sourceReady({ semanticAssistance: semanticAssistance("Eligible") }).session;
    const refetch = vi.fn();
    mocks.sessionQuery = { data: first, isLoading: false, error: null, refetch };
    mocks.generateSuggestions.mutateAsync
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValue(semanticAssistance("Pending"));
    const view = render(<OrganizationImportWorkspace sessionId="session-1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(mocks.generateSuggestions.mutateAsync).toHaveBeenLastCalledWith({
      id: "session-1",
      inputFingerprint: "f".repeat(64),
      retry: true,
    });

    mocks.sessionQuery = {
      data: sourceReady({ id: "session-2", semanticAssistance: semanticAssistance("Eligible") }).session,
      isLoading: false,
      error: null,
      refetch,
    };
    view.rerender(<OrganizationImportWorkspace sessionId="session-2" />);
    await waitFor(() => expect(mocks.generateSuggestions.mutateAsync).toHaveBeenLastCalledWith({
      id: "session-2",
      inputFingerprint: "f".repeat(64),
    }));
  });

  it("restores persisted suggestions, supports changed and rejected outcomes, and applies once", async () => {
    const available = semanticAssistance("Available", {
      suggestions: [
        {
          issueKey: "level-type:0",
          kind: "organization_type_mapping",
          sourceColumnIndex: 0,
          sourceLabel: "Entity",
          targetKey: "type:organization",
          targetLabel: "Organization",
          rationale: "Entity represents the organization level.",
          allowedTargets: [
            { key: "type:organization", label: "Organization" },
            { key: "type:division", label: "Division" },
          ],
        },
        {
          issueKey: "level-type:1",
          kind: "organization_type_mapping",
          sourceColumnIndex: 1,
          sourceLabel: "Strategic Pillar",
          targetKey: "type:division",
          targetLabel: "Division",
          rationale: null,
          allowedTargets: [
            { key: "type:division", label: "Division" },
            { key: "type:department", label: "Department" },
          ],
        },
      ],
    });
    const refetch = vi.fn();
    mocks.sessionQuery = {
      data: sourceReady({ semanticAssistance: available }).session,
      isLoading: false,
      error: null,
      refetch,
    };
    mocks.applySuggestions.mutateAsync.mockResolvedValue(sourceReady().session);
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    expect(mocks.generateSuggestions.mutateAsync).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "2 suggestions to review" }));
    const panel = screen.getByRole("complementary", { name: "Import review panel" });
    expect(within(panel).getByRole("heading", { name: "Suggested meanings" })).toBeInTheDocument();
    await userEvent.selectOptions(within(panel).getByLabelText("Entity"), "type:division");
    await userEvent.selectOptions(within(panel).getByLabelText("Strategic Pillar"), "");
    await userEvent.click(within(panel).getByRole("button", { name: "Apply suggestions · 1" }));

    await waitFor(() => expect(mocks.applySuggestions.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      attemptId: "attempt-1",
      inputFingerprint: "f".repeat(64),
      attemptVersion: 2,
      reviewedItems: [
        { issueKey: "level-type:0", targetKey: "type:division", outcome: "Changed" },
        { issueKey: "level-type:1", targetKey: null, outcome: "Rejected" },
      ],
    }));
    expect(refetch).toHaveBeenCalled();
    expect(screen.queryByRole("complementary", { name: "Import review panel" })).not.toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Resulting organization review" })).toHaveFocus();
  });

  it("keeps manual review available and makes retry explicit when assistance is not configured", async () => {
    const refetch = vi.fn();
    const base = sourceReady().session;
    mocks.sessionQuery = {
      data: sourceReady({
        semanticAssistance: semanticAssistance("Failed", { failureCategory: "NotConfigured" }),
        review: {
          ...base.review!,
          canCommit: false,
          issues: [{
            code: "UnknownType",
            severity: "Blocker",
            title: "Choose a type for Entity.",
            message: "Choose a type for Entity.",
            affectedCount: 1,
            nodeIds: [],
            sourceCells: [],
            recoveryActions: ["Map organization type"],
          }],
        },
      }).session,
      isLoading: false,
      error: null,
      refetch,
    };
    mocks.generateSuggestions.mutateAsync.mockResolvedValue(semanticAssistance("Pending"));
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    expect(screen.getByText("Suggestions unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.generateSuggestions.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      inputFingerprint: "f".repeat(64),
      retry: true,
    });
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
  });

  it("makes the resulting hierarchy the surface and reads a valid no-op as a calm finish", () => {
    const base = sourceReady().session;
    const noop = sourceReady({
      review: {
        ...base.review!,
        existingCount: 2,
        createCount: 0,
        canCommit: true,
        resultingOrganization: [
          { id: "canonical:1", canonicalId: "1", name: "Demo Eight", businessCode: "DE", typeName: "Organization", parentId: null, isNew: false, isRoot: true },
          { id: "canonical:2", canonicalId: "2", name: "Engineering", businessCode: "ENG", typeName: "Department", parentId: "canonical:1", isNew: false, isRoot: false },
        ],
      },
    }).session;
    mocks.sessionQuery = { data: noop, isLoading: false, error: null, refetch: vi.fn() };
    render(<OrganizationImportWorkspace sessionId="session-1" />);
    expect(screen.getByText(/organization\.csv · saved/)).toBeInTheDocument();
    expect(screen.getByRole("treegrid", { name: "Resulting organization" })).toBeInTheDocument();
    expect(
      screen.getByText(/Everything in this file already exists in Organization/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish import" })).toBeEnabled();
    // No empty attention rail and no disabled completion ceremony.
    expect(screen.queryByText("No issues found.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete import" })).not.toBeInTheDocument();
  });

  it("represents one missing root as one issue and resolves it in the contextual inspector", async () => {
    const base = sourceReady().session;
    const blocked = sourceReady({
      review: {
        ...base.review!,
        canCommit: false,
        issues: [{
          code: "FreshRootRequired",
          severity: "Blocker",
          title: "This fresh tenant needs one explicit Organization root above the source top-level units.",
          message: "This fresh tenant needs one explicit Organization root above the source top-level units.",
          affectedCount: 0,
          nodeIds: [],
          sourceCells: [],
          recoveryActions: ["Introduce Organization root"],
        }],
      },
    }).session;
    mocks.sessionQuery = { data: blocked, isLoading: false, error: null, refetch: vi.fn() };
    mocks.replaceDecisions.mutateAsync.mockResolvedValue(blocked);
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    // Blocked review never advertises a completion action.
    expect(screen.queryByRole("button", { name: "Complete import" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish import" })).not.toBeInTheDocument();
    expect(screen.getByText(/1 thing needs your attention before you can finish/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const panel = screen.getByRole("complementary", { name: "Import review panel" });
    fireEvent.change(within(panel).getByLabelText("Name"), { target: { value: "Asteria" } });
    fireEvent.change(within(panel).getByLabelText("Business code"), { target: { value: "ASTERIA" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Add root" }));

    await waitFor(() => expect(mocks.replaceDecisions.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      decisions: expect.objectContaining({ introducedRoot: { name: "Asteria", businessCode: "ASTERIA" } }),
    }));
  });

  it("finishes a valid no-op immediately without a mutation confirmation modal", async () => {
    const active = sourceReady().session;
    mocks.sessionQuery = { data: active, isLoading: false, error: null, refetch: vi.fn() };
    mocks.commit.mutateAsync.mockResolvedValue({ sessionId: active.id, effectiveDate: active.effectiveDate, createdUnits: [], noChanges: true });
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Finish import" }));
    // The no-op path commits directly; no create-confirmation dialog is shown.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.commit.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      semanticDigest: "a".repeat(64),
    }));
    expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("/organization?asOf="));
  });

  it("confirms an additive commit with create count and effective date, then hands off", async () => {
    const base = sourceReady().session;
    const additive = sourceReady({
      review: {
        ...base.review!,
        existingCount: 3,
        createCount: 1,
        canCommit: true,
        resultingOrganization: [
          { id: "canonical:1", canonicalId: "1", name: "Demo Eight", businessCode: "DE", typeName: "Organization", parentId: null, isNew: false, isRoot: true },
          { id: "row:2", canonicalId: null, name: "Finance", businessCode: "FINANCE", typeName: "Department", parentId: "canonical:1", isNew: true, isRoot: false },
        ],
      },
    }).session;
    mocks.sessionQuery = { data: additive, isLoading: false, error: null, refetch: vi.fn() };
    mocks.commit.mutateAsync.mockResolvedValue({
      sessionId: additive.id,
      effectiveDate: additive.effectiveDate,
      createdUnits: [{ proposalNodeId: "row:2", orgUnitId: "unit-9", businessCode: "FINANCE", name: "Finance" }],
      noChanges: false,
    });
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    // Source summary describes the file, not all visible hierarchy context.
    expect(screen.getByText(/3 matched/)).toBeInTheDocument();
    expect(screen.getByText(/1 new organizational unit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Complete import" }));
    const dialog = await screen.findByRole("alertdialog");
    // The business facts stay emphasized in the confirmation.
    expect(within(dialog).getByText("1 organizational unit")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Complete import" }));

    await waitFor(() => expect(mocks.commit.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      semanticDigest: "a".repeat(64),
    }));
    expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("reveal=unit-9"));
  });

  it("shows both conflicting canonical units for an identity contradiction", () => {
    const base = sourceReady().session;
    const conflict = sourceReady({
      review: {
        ...base.review!,
        canCommit: false,
        existingCount: 2,
        createCount: 0,
        proposalNodes: [{
          id: "row:3",
          name: "Engineering",
          businessCode: "PEOPLE",
          businessCodeGenerated: false,
          rawType: "Department",
          typeId: null,
          typeName: "Department",
          parentNodeId: null,
          parentCanonicalId: null,
          rawParent: "DE",
          canonicalId: null,
          classification: "Conflict",
          isProposalRoot: false,
          descriptiveCandidates: [],
          sourceCells: [],
          identityEvidence: [
            { identifier: "fusionOrgUnitId", suppliedValue: "id-eng", unitId: "1", unitName: "Engineering", unitCode: "ENGINEER" },
            { identifier: "businessCode", suppliedValue: "PEOPLE", unitId: "2", unitName: "People", unitCode: "PEOPLE" },
          ],
        }],
        issues: [{
          code: "StrongIdentityContradiction",
          severity: "Blocker",
          title: "This row identifies two units",
          message: "The supplied Fusion ID and Business Code identify two different existing units.",
          affectedCount: 1,
          nodeIds: ["row:3"],
          sourceCells: [],
          recoveryActions: ["Correct field mapping", "Replace source"],
        }],
      },
    }).session;
    mocks.sessionQuery = { data: conflict, isLoading: false, error: null, refetch: vi.fn() };
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const panel = screen.getByRole("complementary", { name: "Import review panel" });
    // The user can tell exactly which two existing units conflict.
    expect(within(panel).getAllByText("Engineering").length).toBeGreaterThan(0);
    expect(within(panel).getByText("ENGINEER")).toBeInTheDocument();
    expect(within(panel).getByText("People")).toBeInTheDocument();
    expect(within(panel).getAllByText("PEOPLE").length).toBeGreaterThan(0);
    // The recovery is a corrected re-import, never an invalid "pick one".
    expect(within(panel).getByRole("link", { name: "Start a corrected import" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Choose Engineering|Choose People/ })).not.toBeInTheDocument();
  });

  it("renders a committed deep link without reopening proposal controls", () => {
    const committed = sourceReady({
      status: "Committed",
      review: null,
      committedAt: "2026-08-14T12:00:00Z",
      committedByUserId: "admin-1",
      committedByDisplayName: "Ada Admin",
      commitResult: { sessionId: "session-1", effectiveDate: todayCalendarDate(), createdUnits: [], noChanges: true },
    }).session;
    mocks.sessionQuery = { data: committed, isLoading: false, error: null, refetch: vi.fn() };
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    expect(screen.getByText("Nothing new to add")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Organization" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Complete|Finish/ })).not.toBeInTheDocument();
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

  it("keeps discard as a confirmed action in the overflow menu, then returns to the generic workspace", async () => {
    const user = userEvent.setup();
    mocks.sessionQuery = { data: sourceReady().session, isLoading: false, error: null, refetch: vi.fn() };
    mocks.discard.mutateAsync.mockResolvedValue(sourceReady({ status: "Discarded" }).session);
    render(<OrganizationImportWorkspace sessionId="session-1" />);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Discard import" }));
    expect(mocks.discard.mutateAsync).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Discard import" }));
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

  it("summarizes what the file contributed when nothing matched", () => {
    const base = sourceReady().session;
    const newOnly = sourceReady({
      review: {
        ...base.review!,
        createCount: 3,
        existingCount: 0,
        canCommit: true,
        resultingOrganization: [
          { id: "canonical:1", canonicalId: "1", name: "Demo Eight", businessCode: "DE", typeName: "Organization", parentId: null, isNew: false, isRoot: true },
          { id: "row:2", canonicalId: null, name: "Finance", businessCode: "FIN", typeName: "Department", parentId: "canonical:1", isNew: true, isRoot: false },
        ],
      },
    }).session;
    mocks.sessionQuery = { data: newOnly, isLoading: false, error: null, refetch: vi.fn() };
    render(<OrganizationImportWorkspace sessionId="session-1" />);
    expect(screen.getByText(/from this file/)).toBeInTheDocument();
    expect(screen.queryByText(/matched/)).not.toBeInTheDocument();
  });

  it("shows an unresolved parent honestly and resolves it in a direct resolver", async () => {
    const base = sourceReady().session;
    const unresolved = sourceReady({
      review: {
        ...base.review!,
        canCommit: false,
        createCount: 1,
        existingCount: 0,
        proposalNodes: [{
          id: "row:2", name: "Analytics", businessCode: "ANALYT", businessCodeGenerated: false,
          rawType: "Department", typeId: "t1", typeName: "Department", parentNodeId: null, parentCanonicalId: null,
          rawParent: "DIGITL", canonicalId: null, classification: "Create", isProposalRoot: false,
          descriptiveCandidates: [], sourceCells: [], identityEvidence: [],
        }],
        resultingOrganization: [
          { id: "canonical:1", canonicalId: "1", name: "Demo Eight", businessCode: "DE", typeName: "Organization", parentId: null, isNew: false, isRoot: true },
          { id: "row:2", canonicalId: null, name: "Analytics", businessCode: "ANALYT", typeName: "Department", parentId: null, isNew: true, isRoot: false },
        ],
        issues: [{
          code: "ParentUnresolved", severity: "Blocker", title: "Choose a parent",
          message: "The parent reference 'DIGITL' is not unique or available.",
          affectedCount: 1, nodeIds: ["row:2"], sourceCells: [], recoveryActions: ["Choose parent"],
        }],
      },
    }).session;
    mocks.sessionQuery = { data: unresolved, isLoading: false, error: null, refetch: vi.fn() };
    mocks.replaceDecisions.mutateAsync.mockResolvedValue(unresolved);
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    // Honest placement: not silently parented under the root.
    expect(screen.getByText("Unresolved placement")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const panel = screen.getByRole("complementary", { name: "Import review panel" });
    expect(within(panel).getByText("DIGITL")).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText("Parent"), { target: { value: "canonical:1" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Apply resolution" }));

    await waitFor(() => expect(mocks.replaceDecisions.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      decisions: expect.objectContaining({
        nodeCorrections: { "row:2": expect.objectContaining({ parentCanonicalId: "1", parentNodeId: null }) },
      }),
    }));
  });

  it("excludes a leaf immediately with undo and no consequence dialog", async () => {
    const base = sourceReady().session;
    const additive = sourceReady({
      review: {
        ...base.review!,
        canCommit: true,
        createCount: 1,
        existingCount: 1,
        proposalNodes: [{
          id: "row:2", name: "Finance", businessCode: "FIN", businessCodeGenerated: false,
          rawType: "Department", typeId: "t1", typeName: "Department", parentNodeId: null, parentCanonicalId: "1",
          rawParent: null, canonicalId: null, classification: "Create", isProposalRoot: false,
          descriptiveCandidates: [], sourceCells: [], identityEvidence: [],
        }],
        resultingOrganization: [
          { id: "canonical:1", canonicalId: "1", name: "Demo Eight", businessCode: "DE", typeName: "Organization", parentId: null, isNew: false, isRoot: true },
          { id: "row:2", canonicalId: null, name: "Finance", businessCode: "FIN", typeName: "Department", parentId: "canonical:1", isNew: true, isRoot: false },
        ],
      },
    }).session;
    mocks.sessionQuery = { data: additive, isLoading: false, error: null, refetch: vi.fn() };
    mocks.replaceDecisions.mutateAsync.mockResolvedValue(additive);
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    fireEvent.click(screen.getByText("Finance"));
    const panel = screen.getByRole("complementary", { name: "Import review panel" });
    fireEvent.click(within(panel).getByRole("button", { name: "Exclude from import" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await waitFor(() => expect(mocks.replaceDecisions.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      decisions: expect.objectContaining({ excludedNodeIds: ["row:2"] }),
    }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    const call = mocks.toast.mock.calls.at(-1)!;
    expect(String(call[0])).toMatch(/Excluded Finance/);
    expect(call[1].action.label).toBe("Undo");
    call[1].action.onClick();
    await waitFor(() => expect(mocks.replaceDecisions.mutateAsync).toHaveBeenCalledTimes(2));
  });

  it("shows the subtree consequence before excluding a parent unit", async () => {
    const base = sourceReady().session;
    const withChild = sourceReady({
      review: {
        ...base.review!,
        canCommit: true,
        createCount: 2,
        existingCount: 0,
        proposalNodes: [{
          id: "row:2", name: "Consulting", businessCode: "CONS", businessCodeGenerated: false,
          rawType: "Division", typeId: "t1", typeName: "Division", parentNodeId: null, parentCanonicalId: "1",
          rawParent: null, canonicalId: null, classification: "Create", isProposalRoot: false,
          descriptiveCandidates: [], sourceCells: [], identityEvidence: [],
        }],
        resultingOrganization: [
          { id: "canonical:1", canonicalId: "1", name: "Demo Eight", businessCode: "DE", typeName: "Organization", parentId: null, isNew: false, isRoot: true },
          { id: "row:2", canonicalId: null, name: "Consulting", businessCode: "CONS", typeName: "Division", parentId: "canonical:1", isNew: true, isRoot: false },
          { id: "row:3", canonicalId: null, name: "Transformation", businessCode: "TRAN", typeName: "Team", parentId: "row:2", isNew: true, isRoot: false },
        ],
      },
    }).session;
    mocks.sessionQuery = { data: withChild, isLoading: false, error: null, refetch: vi.fn() };
    mocks.replaceDecisions.mutateAsync.mockResolvedValue(withChild);
    render(<OrganizationImportWorkspace sessionId="session-1" />);

    fireEvent.click(screen.getByText("Consulting"));
    const panel = screen.getByRole("complementary", { name: "Import review panel" });
    fireEvent.click(within(panel).getByRole("button", { name: "Exclude from import" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/1 proposed unit/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Exclude 2 units" }));

    await waitFor(() => expect(mocks.replaceDecisions.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      decisions: expect.objectContaining({
        excludedNodeIds: expect.arrayContaining(["row:2", "row:3"]),
      }),
    }));
  });
});
