// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationImportActiveSummaryDto } from "@repo/api";
import { todayCalendarDate } from "@/features/organization/model/workspace-state";
import OrganizationImportWorkspace from "./organization-import-workspace";
import { uploadHandoffTiming } from "./upload-stage";

const mocks = vi.hoisted(() => ({
  canView: true,
  canManage: true,
  replace: vi.fn(),
  activeData: [] as OrganizationImportActiveSummaryDto[],
  readiness: { hasPermanentRoot: true },
  intake: { mutateAsync: vi.fn() },
  downloadTemplate: vi.fn(),
  exportStructure: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  problem: null as null | { kind: string; code: string | null; message: string },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, push: vi.fn() }) }));
vi.mock("@repo/auth", () => ({
  useAuth: () => ({ user: {}, isLoading: false, isAuthenticated: true }),
  canViewCoreOrganization: () => mocks.canView,
  canManageCoreOrganization: () => mocks.canManage,
}));
vi.mock("@repo/api", () => ({
  translateOrganizationImportError: () => mocks.problem ?? { kind: "temporary", code: null, message: "Request failed" },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/features/organization/api/use-organization", () => ({
  useOrganizationReadiness: () => ({ data: mocks.readiness }),
}));
vi.mock("../api/use-organization-import", () => ({
  useOrganizationImportApi: () => ({
    downloadTemplate: mocks.downloadTemplate,
    exportStructure: mocks.exportStructure,
  }),
  useOrganizationImportMutations: () => ({ intake: mocks.intake }),
  useActiveOrganizationImports: () => ({ data: mocks.activeData }),
}));

const TOKEN = "11111111-1111-4111-8111-111111111111";

function ready(id = "session-1") {
  return { kind: "SourceReady", replayed: false, session: { id }, sheetSelection: null };
}

function csv(name = "Lumera-organization.csv", content = "Org Key,Structure Label\nL1,Lumera") {
  return new File([content], name, { type: "text/csv" });
}

function pick(file: File) {
  fireEvent.change(screen.getByLabelText("Choose an organization source file"), { target: { files: [file] } });
}

const startButton = () => screen.getByRole("button", { name: /Start import/ });

beforeEach(() => {
  uploadHandoffTiming.minProcessingMs = 0;
  uploadHandoffTiming.settleMs = 0;
  mocks.canView = true;
  mocks.canManage = true;
  mocks.activeData = [];
  mocks.readiness = { hasPermanentRoot: true };
  mocks.problem = null;
  mocks.replace.mockReset();
  mocks.intake.mutateAsync.mockReset();
  mocks.toast.error.mockReset();
  mocks.downloadTemplate.mockReset().mockResolvedValue(new Blob());
  mocks.exportStructure.mockReset().mockResolvedValue(new Blob());
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(TOKEN);
  Object.defineProperty(globalThis.URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

describe("Upload access", () => {
  it("denies callers without Organization view access", () => {
    mocks.canView = false;
    render(<OrganizationImportWorkspace />);
    expect(screen.getByText("Organization access required")).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose an organization source file")).not.toBeInTheDocument();
  });

  it("gives view-only callers a management notice instead of Upload", () => {
    mocks.canManage = false;
    render(<OrganizationImportWorkspace />);
    expect(screen.getByText("Organization management access required")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start import/ })).not.toBeInTheDocument();
  });
});

describe("Upload surface", () => {
  it("opens on the first of three stages with a file, an effective date and the template", () => {
    render(<OrganizationImportWorkspace />);
    expect(screen.getByRole("heading", { level: 1, name: "Import organization structure" })).toBeInTheDocument();
    const steps = within(screen.getByRole("list", { name: "Import steps" })).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual(["1Upload", "2Match", "3Review"]);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("region", { name: "Organization source drop area" })).toBeInTheDocument();
    // Supported formats are programmatically tied to the file input.
    expect(screen.getByLabelText("Choose an organization source file")).toHaveAccessibleDescription(
      /XLSX, CSV/
    );
    expect(screen.getByLabelText("Effective date")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Fusion template" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/organization");
    // No attempt yet: nothing to resume, nothing to start.
    expect(screen.queryByText("Resume previous attempt")).not.toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  it("never creates an attempt just because a file was chosen", () => {
    render(<OrganizationImportWorkspace />);
    pick(csv());
    expect(screen.getByText("Lumera-organization.csv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Replace file/ })).toBeInTheDocument();
    expect(mocks.intake.mutateAsync).not.toHaveBeenCalled();
    expect(startButton()).toBeEnabled();
  });

  it("accepts drag and drop through the same source", () => {
    render(<OrganizationImportWorkspace />);
    fireEvent.drop(screen.getByRole("region", { name: "Organization source drop area" }), {
      dataTransfer: { files: [csv()] },
    });
    expect(screen.getByText("Lumera-organization.csv")).toBeInTheDocument();
  });

  it("starts an unfamiliar file with the explicit date and hands off to the attempt resolver", async () => {
    mocks.intake.mutateAsync.mockResolvedValue(ready());
    render(<OrganizationImportWorkspace />);
    pick(csv());
    fireEvent.click(startButton());
    // Upload never decides Match vs Review; the resolver at /{id} does.
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1/match"));
    expect(mocks.intake.mutateAsync).toHaveBeenCalledWith({
      file: expect.any(File),
      creationToken: TOKEN,
      effectiveDate: todayCalendarDate(),
      selectedSheetName: undefined,
    });
  });

  it("holds one calm processing state while the source is read", async () => {
    let resolve!: (value: unknown) => void;
    mocks.intake.mutateAsync.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<OrganizationImportWorkspace />);
    pick(csv());
    fireEvent.click(startButton());
    expect(await screen.findByText("Reading your file…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Starting import/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Replace file/ })).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "Starting import" })).toBeInTheDocument();
    uploadHandoffTiming.settleMs = 50;
    resolve(ready());
    expect(await screen.findByText("Opening your import…")).toBeInTheDocument();
    // Success advances the journey: Upload is done, Match is where the attempt goes next.
    const steps = within(screen.getByRole("list", { name: "Import steps" })).getAllByRole("listitem");
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1/match"));
  });

  it("rejects an unsupported or oversized file locally, without contacting Fusion", () => {
    render(<OrganizationImportWorkspace />);
    pick(new File(["%PDF"], "structure.pdf", { type: "application/pdf" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an XLSX or CSV file.");
    expect(startButton()).toBeDisabled();

    pick(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.csv", { type: "text/csv" }));
    expect(screen.getByRole("alert")).toHaveTextContent("larger than the 10 MB limit");
    // A source defect is fixed by choosing another file, never by retrying the same bytes.
    expect(screen.getByRole("button", { name: /Choose another file/ })).toHaveAccessibleDescription(
      /10 MB limit/
    );
    expect(mocks.intake.mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps the file and date after a source rejection and asks for another file", async () => {
    mocks.problem = { kind: "rejected", code: "NoUsableTable", message: "The workbook does not contain a usable visible table." };
    mocks.intake.mutateAsync.mockRejectedValue(new Error("422"));
    render(<OrganizationImportWorkspace />);
    pick(csv());
    fireEvent.click(startButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("usable visible table");
    expect(screen.getByText("Lumera-organization.csv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose another file/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again/ })).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("retries a transient failure with the same creation token", async () => {
    mocks.intake.mutateAsync.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce(ready());
    render(<OrganizationImportWorkspace />);
    pick(csv());
    fireEvent.click(startButton());
    const retry = await screen.findByRole("button", { name: /Try again/ });
    expect(screen.getByText("Fusion couldn’t start the import right now.")).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1/match"));
    const tokens = mocks.intake.mutateAsync.mock.calls.map(([input]) => input.creationToken);
    expect(tokens).toEqual([TOKEN, TOKEN]);
  });

  it("asks which sheet to import inline, then continues the same intake", async () => {
    mocks.intake.mutateAsync
      .mockResolvedValueOnce({ kind: "SheetSelectionRequired", sheetSelection: { candidateSheetNames: ["North", "South"] } })
      .mockResolvedValueOnce(ready());
    render(<OrganizationImportWorkspace />);
    pick(new File(["xlsx"], "organization.xlsx"));
    fireEvent.click(startButton());
    expect(await screen.findByText("This workbook contains several data sheets.")).toBeInTheDocument();
    // Still Upload: the journey never grows a sheet step.
    expect(within(screen.getByRole("list", { name: "Import steps" })).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(screen.getByRole("radio", { name: "South" }));
    fireEvent.click(startButton());
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1/match"));
    expect(mocks.intake.mutateAsync.mock.calls[1]![0]).toMatchObject({
      creationToken: TOKEN,
      selectedSheetName: "South",
    });
  });
});

describe("Upload secondary actions", () => {
  it("downloads the template without creating an attempt, and exports the live structure when one exists", async () => {
    render(<OrganizationImportWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Download Fusion template" }));
    await waitFor(() => expect(mocks.downloadTemplate).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Export current structure" }));
    await waitFor(() => expect(mocks.exportStructure).toHaveBeenCalledWith(todayCalendarDate()));
    expect(mocks.intake.mutateAsync).not.toHaveBeenCalled();
  });

  it("offers only the template when there is no structure yet", () => {
    mocks.readiness = { hasPermanentRoot: false };
    render(<OrganizationImportWorkspace />);
    expect(screen.queryByRole("button", { name: "Export current structure" })).not.toBeInTheDocument();
  });

  it("resumes the latest unfinished attempt through its resolver", () => {
    mocks.activeData = [
      {
        id: "active-2",
        effectiveDate: "2026-09-01",
        version: 3,
        originalFileName: "Asteria-organization-2027.xlsx",
        sourceFormat: "xlsx",
        rowCount: 40,
        startedByDisplayName: "Ada Admin",
        lastUpdatedByDisplayName: "Ada Admin",
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
      {
        id: "active-1",
        effectiveDate: "2026-08-01",
        version: 1,
        originalFileName: "older.csv",
        sourceFormat: "csv",
        rowCount: 4,
        startedByDisplayName: "Ada Admin",
        lastUpdatedByDisplayName: "Ada Admin",
        createdAt: "2026-08-01T10:00:00Z",
        updatedAt: null,
      },
    ];
    render(<OrganizationImportWorkspace />);
    expect(screen.getByText("Resume previous attempt")).toBeInTheDocument();
    expect(screen.getByText(/Saved 12 min ago/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Resume Asteria/ })).toHaveAttribute(
      "href",
      "/organization/import/active-2"
    );
    expect(screen.queryByText("older.csv")).not.toBeInTheDocument();
  });
});
