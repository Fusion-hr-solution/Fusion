// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OrganizationImportActiveSummaryDto,
  OrganizationImportIntakeResult,
  OrganizationImportIssue,
  OrganizationImportMatch,
  OrganizationImportReview,
  OrganizationImportReviewNode,
  OrganizationImportSessionDto,
} from "@repo/api";
import { todayCalendarDate } from "@/features/organization/model/workspace-state";
import { OrganizationImportFrame } from "./import-frame";
import { MatchStage } from "./match-stage";
import { ReviewStage } from "./review-stage";

const mocks = vi.hoisted(() => ({
  canView: true,
  canManage: true,
  authLoading: false,
  replace: vi.fn(),
  push: vi.fn(),
  segment: null as string | null,
  activeData: [] as OrganizationImportActiveSummaryDto[],
  sessionQuery: null as Record<string, unknown> | null,
  readiness: { hasPermanentRoot: true } as { hasPermanentRoot: boolean },
  intake: { mutateAsync: vi.fn(), isLoading: false },
  changeDate: { mutateAsync: vi.fn(), isLoading: false },
  discard: { mutateAsync: vi.fn(), isLoading: false },
  resolveReview: { mutateAsync: vi.fn(), isLoading: false },
  updateMatch: { mutateAsync: vi.fn(), isLoading: false },
  refresh: { mutateAsync: vi.fn(), isLoading: false },
  runSemanticAssistance: { mutateAsync: vi.fn(), isLoading: false },
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  useSelectedLayoutSegment: () => mocks.segment,
}));
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
    resolveReview: mocks.resolveReview,
    updateMatch: mocks.updateMatch,
    refresh: mocks.refresh,
    runSemanticAssistance: mocks.runSemanticAssistance,
    commit: mocks.commit,
  }),
  useActiveOrganizationImports: () => ({ data: mocks.activeData }),
  useOrganizationImportSession: () => mocks.sessionQuery,
}));

const TYPE_OPTIONS = [
  { id: "organization", name: "Organization" },
  { id: "division", name: "Division" },
  { id: "department", name: "Department" },
  { id: "team", name: "Team" },
];

const ANCHOR = { id: "1", name: "Demo Eight", businessCode: "DE", typeName: "Organization", parentId: null, isRoot: true };

function sourceReady(
  overrides: Partial<OrganizationImportSessionDto> = {}
): Extract<OrganizationImportIntakeResult, { kind: "SourceReady" }> {
  const result: Extract<OrganizationImportIntakeResult, { kind: "SourceReady" }> = {
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
      review: review(),
      commitResult: null,
      committedAt: null,
      committedByUserId: null,
      committedByDisplayName: null,
      finalProvenance: null,
      ...overrides,
    },
    sheetSelection: null,
  };
  if (overrides.match === undefined) result.session.match = matchFromFixture(result.session);
  return result;
}

function review(overrides: Partial<OrganizationImportReview> = {}): OrganizationImportReview {
  const nodes = overrides.nodes ?? [];
  const issues = overrides.issues ?? [];
  const blockers = issues.filter((issue) => issue.severity === "Blocker").length;
  const createCount = nodes.filter((node) => node.classification === "Create").length;
  const existingCount = nodes.filter((node) => node.classification === "Existing").length;
  return {
    effectiveDate: todayCalendarDate(),
    proposalFingerprint: "a".repeat(64),
    decisionRevision: 0,
    readiness: {
      state: blockers > 0 ? "Blocked" : issues.length > 0 ? "ReadyWithWarnings" : "Ready",
      canPublish: blockers === 0,
      blockingIssueCount: blockers,
      warningCount: issues.length - blockers,
      createCount,
      existingCount,
    },
    summary: {
      totalUnits: createCount + existingCount,
      newUnits: createCount,
      existingUnits: existingCount,
      conflictUnits: nodes.length - createCount - existingCount,
      rootCount: 1,
      countsByType: [],
    },
    nodes,
    anchors: [],
    issues,
    resolutions: { introducedRoot: null, acceptedExistingMatches: {}, keepExistingNodeIds: [] },
    ...overrides,
  };
}

function node(overrides: Partial<OrganizationImportReviewNode> & { proposalNodeId: string; name: string }): OrganizationImportReviewNode {
  return {
    businessCode: overrides.name.toUpperCase(),
    businessCodeGenerated: false,
    typeId: "department",
    typeName: "Department",
    parentProposalNodeId: null,
    parentExistingUnitId: null,
    existingOrgUnitId: null,
    classification: "Create",
    isRoot: false,
    depth: 0,
    blockingIssueCount: 0,
    warningCount: 0,
    sourceCells: [],
    candidates: [],
    identityEvidence: [],
    ...overrides,
  };
}

function issue(overrides: Partial<OrganizationImportIssue> & { code: string }): OrganizationImportIssue {
  return {
    severity: "Blocker",
    title: overrides.code,
    message: overrides.code,
    proposalNodeId: null,
    relatedNodeIds: [],
    field: null,
    sourceCells: [],
    preferredResolution: null,
    allowedResolutions: [],
    ...overrides,
  };
}

function matchFromFixture(
  session: OrganizationImportSessionDto,
  requiredTypes: { rawType: string; count: number }[] = []
): OrganizationImportMatch {
  const requiredDecisions = requiredTypes.map(({ rawType }) => ({
    key: `type:${rawType}`, kind: "TypeMapping" as const, sourceValue: rawType, targetField: null,
  }));
  const canContinue = requiredDecisions.length === 0;
  return {
    mappingPlan: {
      sourceShape: "ParentReference",
      shapeStatus: "Resolved",
      shapeOrigin: "Deterministic",
      columnMappings: [],
      typeMappings: session.decisions.typeMappings ?? {},
      orderedLevelColumns: [],
      ignoredColumns: [],
      generatedIdentityStrategy: "DeterministicFromNameAndPath",
      sourceFingerprint: "source",
      typeMappingDetails: requiredTypes.map(({ rawType, count }) => ({
        sourceValue: rawType,
        typeId: null,
        typeName: null,
        occurrenceCount: count,
        status: "NeedsReview" as const,
        origin: "Deterministic" as const,
      })),
      identity: {
        strategy: "DeterministicFromNameAndPath",
        sourceColumnIndex: null,
        status: "Matched",
        origin: "Deterministic",
        evidence: "Generated",
      },
      revision: 0,
      digest: "mapping",
    },
    readiness: {
      state: canContinue ? "Complete" : "Incomplete",
      canContinue,
      requiredDecisions,
      recommendedStage: canContinue ? "Review" : "Match",
    },
    completionKind: canContinue ? "Automatic" : "Incomplete",
    typeOptions: TYPE_OPTIONS,
    semanticAssistance: session.semanticAssistance ?? null,
  };
}

/** Render one attempt route: the frame plus the stage page the URL segment selects. */
function renderAttempt(segment: "match" | "review" | null = null) {
  mocks.segment = segment;
  const ui = () => (
    <OrganizationImportFrame sessionId="session-1">
      {segment === "match" ? <MatchStage /> : segment === "review" ? <ReviewStage /> : null}
    </OrganizationImportFrame>
  );
  const view = render(ui());
  return { ...view, rerender: () => view.rerender(ui()) };
}


/** An attempt whose only unresolved work is unfamiliar type vocabulary: Match, with no Review yet. */
function vocabularyAttempt(terms: { rawType: string; count: number }[]): OrganizationImportSessionDto {
  const session = sourceReady({ review: null }).session;
  return { ...session, match: matchFromFixture(session, terms) };
}

beforeEach(() => {
  mocks.canView = true;
  mocks.canManage = true;
  mocks.authLoading = false;
  mocks.activeData = [];
  mocks.sessionQuery = null;
  mocks.readiness = { hasPermanentRoot: true };
  mocks.replace.mockReset();
  mocks.push.mockReset();
  mocks.segment = null;
  mocks.intake.mutateAsync.mockReset();
  mocks.changeDate.mutateAsync.mockReset();
  mocks.discard.mutateAsync.mockReset();
  mocks.resolveReview.mutateAsync.mockReset();
  mocks.updateMatch.mutateAsync.mockReset();
  mocks.refresh.mutateAsync.mockReset();
  mocks.runSemanticAssistance.mutateAsync.mockReset();
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

describe("Organization import attempt: frame, Match and Review", () => {
  it("makes the resulting hierarchy the surface and reads a valid no-op as a calm finish", () => {
    const noop = sourceReady({
      review: review({
        nodes: [
          node({ proposalNodeId: "row:1", name: "Demo Eight", typeName: "Organization", classification: "Existing", existingOrgUnitId: "1", isRoot: true }),
          node({ proposalNodeId: "row:2", name: "Engineering", classification: "Existing", existingOrgUnitId: "2", parentExistingUnitId: "1" }),
        ],
      }),
    }).session;
    mocks.sessionQuery = { data: noop, isLoading: false, error: null, refetch: vi.fn() };
    renderAttempt("review");
    const tree = screen.getByRole("tree", { name: "Resulting organization" });
    expect(within(tree).getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Everything in this file already exists in Organization.")).toBeInTheDocument();
    expect(screen.getByText("No blocking issues")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish import" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Publish organization/ })).not.toBeInTheDocument();
  });

  it("represents several top-level units as one check and resolves it by adding a root", async () => {
    const blocked = sourceReady({
      review: review({
        nodes: [
          node({ proposalNodeId: "row:1", name: "Alpha" }),
          node({ proposalNodeId: "row:2", name: "Beta" }),
        ],
        issues: [issue({
          code: "MultipleRoots",
          title: "More than one top-level unit",
          message: "2 units have no parent. An organization has a single top-level unit.",
          relatedNodeIds: ["row:1", "row:2"],
          preferredResolution: "AddOrganizationRoot",
          allowedResolutions: ["AddOrganizationRoot", "CorrectSource"],
        })],
      }),
    }).session;
    mocks.sessionQuery = { data: blocked, isLoading: false, error: null, refetch: vi.fn() };
    mocks.resolveReview.mutateAsync.mockResolvedValue(blocked);
    renderAttempt("review");

    // Blocked review can't publish, and says why.
    expect(screen.getByRole("button", { name: /Publish organization/ })).toBeDisabled();
    expect(screen.getByText("Not ready to publish")).toBeInTheDocument();
    expect(screen.getByText(/1 thing needs your attention before you can publish/)).toBeInTheDocument();
    expect(screen.getByText("Organization root")).toBeInTheDocument();

    const checks = screen.getByRole("region", { name: "Review checks" });
    expect(within(checks).getByRole("link", { name: "Upload a corrected file" })).toHaveAttribute("href", "/organization/import");
    fireEvent.change(within(checks).getByLabelText("Organization name"), { target: { value: "Asteria" } });
    fireEvent.change(within(checks).getByLabelText("Business code"), { target: { value: "ASTERIA" } });
    fireEvent.click(within(checks).getByRole("button", { name: "Add root" }));

    await waitFor(() => expect(mocks.resolveReview.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      resolutions: expect.objectContaining({ introducedRoot: { name: "Asteria", businessCode: "ASTERIA" } }),
    }));
  });

  it("confirms a valid no-op before finishing it", async () => {
    const active = sourceReady().session;
    mocks.sessionQuery = { data: active, isLoading: false, error: null, refetch: vi.fn() };
    mocks.commit.mutateAsync.mockResolvedValue({ sessionId: active.id, effectiveDate: active.effectiveDate, createdUnits: [], noChanges: true });
    renderAttempt("review");

    fireEvent.click(screen.getByRole("button", { name: "Finish import" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Finish this organization import?")).toBeInTheDocument();
    expect(within(dialog).getByText(/No new organization units will be created/)).toBeInTheDocument();
    expect(mocks.commit.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Finish import" }));
    await waitFor(() => expect(mocks.commit.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      proposalFingerprint: "a".repeat(64),
    }));
    expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("/organization?asOf="));
  });

  it("publishes an additive proposal through a confirmation, then hands off with the reveal", async () => {
    const additive = sourceReady({
      review: review({
        nodes: [
          node({ proposalNodeId: "row:1", name: "Demo Eight", classification: "Existing", existingOrgUnitId: "1", isRoot: true }),
          node({ proposalNodeId: "row:3", name: "Legal", classification: "Existing", existingOrgUnitId: "3", parentExistingUnitId: "1" }),
          node({ proposalNodeId: "row:4", name: "Sales", classification: "Existing", existingOrgUnitId: "4", parentExistingUnitId: "1" }),
          node({ proposalNodeId: "row:2", name: "Finance", businessCode: "FINANCE", parentExistingUnitId: "1" }),
        ],
      }),
    }).session;
    mocks.sessionQuery = { data: additive, isLoading: false, error: null, refetch: vi.fn() };
    mocks.commit.mutateAsync.mockResolvedValue({
      sessionId: additive.id,
      effectiveDate: additive.effectiveDate,
      createdUnits: [{ proposalNodeId: "row:2", orgUnitId: "unit-9", businessCode: "FINANCE", name: "Finance" }],
      noChanges: false,
    });
    renderAttempt("review");

    // The structure says what is new and what already exists.
    expect(screen.getByText("1 new · 3 already in Organization")).toBeInTheDocument();
    expect(screen.getAllByText("Existing").length).toBe(3);
    // Publishing is a confirmed action: the dialog states what will change before anything is written.
    fireEvent.click(screen.getByRole("button", { name: /Publish organization/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Publish 1 new unit?")).toBeInTheDocument();
    expect(within(dialog).getByText(/3 units already in Organization stay as they are/)).toBeInTheDocument();
    expect(mocks.commit.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish organization" }));

    await waitFor(() => expect(mocks.commit.mutateAsync).toHaveBeenCalledWith({
      id: "session-1",
      version: 1,
      proposalFingerprint: "a".repeat(64),
    }));
    expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("reveal=unit-9"));
  });

  it("shows both conflicting canonical units for an identity contradiction", () => {
    const conflict = sourceReady({
      review: review({
        nodes: [node({
          proposalNodeId: "row:3",
          name: "Engineering",
          businessCode: "PEOPLE",
          classification: "Conflict",
          identityEvidence: [
            { identifier: "fusionOrgUnitId", suppliedValue: "id-eng", unitId: "1", unitName: "Engineering", unitCode: "ENGINEER" },
            { identifier: "businessCode", suppliedValue: "PEOPLE", unitId: "2", unitName: "People", unitCode: "PEOPLE" },
          ],
        })],
        issues: [issue({
          code: "IdentityContradiction",
          title: "Row points to two units",
          message: "The ID and the business code in this row belong to two different existing units.",
          proposalNodeId: "row:3",
          preferredResolution: "CorrectSource",
          allowedResolutions: ["CorrectSource"],
        })],
      }),
    }).session;
    mocks.sessionQuery = { data: conflict, isLoading: false, error: null, refetch: vi.fn() };
    renderAttempt("review");

    const checks = screen.getByRole("region", { name: "Review checks" });
    // The recovery is the one the server allowed: a corrected file, never an invalid "pick one".
    expect(within(checks).getByRole("link", { name: "Upload a corrected file" })).toBeInTheDocument();
    expect(within(checks).queryByRole("link", { name: "Change matching" })).not.toBeInTheDocument();
    expect(within(checks).queryByRole("button", { name: /Choose Engineering|Choose People|Use existing/ })).not.toBeInTheDocument();
    // The user can tell exactly which two existing units conflict.
    expect(within(checks).getByText("ENGINEER")).toBeInTheDocument();
    expect(within(checks).getByText("People")).toBeInTheDocument();
  });

  it("resolves the bare attempt URL to its current stage", () => {
    mocks.sessionQuery = { data: sourceReady().session, isLoading: false, error: null, refetch: vi.fn() };
    const complete = renderAttempt(null);
    expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1/review");
    complete.unmount();

    mocks.replace.mockReset();
    mocks.sessionQuery = {
      data: vocabularyAttempt([{ rawType: "Pôle", count: 2 }]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
    renderAttempt(null);
    expect(mocks.replace).toHaveBeenCalledWith("/organization/import/session-1/match");
  });

  it("marks Match as automatic when Fusion needed no help, and lets Review go back to it", () => {
    mocks.sessionQuery = { data: sourceReady().session, isLoading: false, error: null, refetch: vi.fn() };
    renderAttempt("review");
    const journey = screen.getByRole("list", { name: "Import steps" });
    expect(within(journey).getByRole("link", { name: /Match · Automatically matched/ })).toHaveAttribute(
      "href",
      "/organization/import/session-1/match"
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("lets a settled Match be revisited without forcing it back to Review", () => {
    mocks.sessionQuery = { data: sourceReady().session, isLoading: false, error: null, refetch: vi.fn() };
    renderAttempt("match");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Match" })).toBeInTheDocument();
  });

  it("sends a committed deep link to the live Organization without reopening proposal controls", () => {
    const committed = sourceReady({
      status: "Committed",
      review: null,
      committedAt: "2026-08-14T12:00:00Z",
      committedByUserId: "admin-1",
      committedByDisplayName: "Ada Admin",
      commitResult: { sessionId: "session-1", effectiveDate: todayCalendarDate(), createdUnits: [], noChanges: true },
    }).session;
    mocks.sessionQuery = { data: committed, isLoading: false, error: null, refetch: vi.fn() };
    renderAttempt("review");

    // A published attempt has no job left in import: it leaves for the live Organization.
    expect(mocks.replace).toHaveBeenCalledWith(`/organization?asOf=${todayCalendarDate()}`);
    expect(screen.queryByRole("button", { name: /Publish|Finish/ })).not.toBeInTheDocument();
  });

  it("sends a discarded deep link back to Upload without source cells", () => {
    const discarded = sourceReady({ status: "Discarded" }).session;
    discarded.source = { ...discarded.source, table: null, payloadPurgedAt: "2026-08-12T12:00:00Z" };
    mocks.sessionQuery = { data: discarded, isLoading: false, error: null, refetch: vi.fn() };
    renderAttempt("match");
    expect(mocks.replace).toHaveBeenCalledWith("/organization/import");
    expect(screen.queryByText("Root")).not.toBeInTheDocument();
  });

  it("renders durable loading and recoverable not-available states", () => {
    mocks.sessionQuery = { data: null, isLoading: true, error: null, refetch: vi.fn() };
    const view = renderAttempt();
    expect(screen.getByLabelText("Loading your import")).toBeInTheDocument();

    const refetch = vi.fn();
    mocks.sessionQuery = { data: null, isLoading: false, error: new Error("not found"), refetch };
    view.rerender();
    expect(screen.getByText("Import not available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("summarizes what the file contributed when nothing matched", () => {
    const newOnly = sourceReady({
      review: review({
        anchors: [ANCHOR],
        nodes: [
          node({ proposalNodeId: "row:2", name: "Finance", businessCode: "FIN", parentExistingUnitId: "1" }),
          node({ proposalNodeId: "row:3", name: "Legal", businessCode: "LEG", parentExistingUnitId: "1" }),
          node({ proposalNodeId: "row:4", name: "Sales", businessCode: "SAL", parentExistingUnitId: "1" }),
        ],
      }),
    }).session;
    mocks.sessionQuery = { data: newOnly, isLoading: false, error: null, refetch: vi.fn() };
    renderAttempt("review");
    expect(screen.getByText("Ready to publish", { selector: "h2" })).toBeInTheDocument();
    expect(screen.queryByText("Existing")).not.toBeInTheDocument();
    expect(screen.getByText("Demo Eight")).toBeInTheDocument();
  });

  it("shows an unresolved parent honestly, points at it, and offers only the server's pathways", () => {
    const unresolved = sourceReady({
      review: review({
        anchors: [ANCHOR],
        nodes: [node({ proposalNodeId: "row:2", name: "Analytics", businessCode: "ANALYT" })],
        issues: [issue({
          code: "MissingParent",
          title: "Parent not found",
          message: "'Analytics' reports to 'DIGITL', which isn't a unit in this file or in your organization.",
          proposalNodeId: "row:2",
          field: "parentBusinessCode",
          preferredResolution: "CorrectSource",
          allowedResolutions: ["CorrectSource", "ReturnToMatch"],
        })],
      }),
    }).session;
    mocks.sessionQuery = { data: unresolved, isLoading: false, error: null, refetch: vi.fn() };
    renderAttempt("review");

    // Honest placement: not silently parented under the root.
    expect(screen.getByText("Unresolved placement")).toBeInTheDocument();
    const checks = screen.getByRole("region", { name: "Review checks" });
    expect(within(checks).getByText(/DIGITL/)).toBeInTheDocument();
    expect(within(checks).getByRole("link", { name: "Upload a corrected file" })).toHaveAttribute("href", "/organization/import");
    expect(within(checks).getByRole("link", { name: "Change matching" })).toHaveAttribute("href", "/organization/import/session-1/match");
    fireEvent.click(within(checks).getByRole("button", { name: /View unit/ }));
    expect(screen.getByRole("treeitem", { name: /Analytics/ })).toHaveClass("bg-warning-subtle");
  });

  it("keeps the hierarchy read-only and searchable", () => {
    const additive = sourceReady({
      review: review({
        anchors: [ANCHOR],
        nodes: [
          node({ proposalNodeId: "row:2", name: "Finance", businessCode: "FIN", parentExistingUnitId: "1" }),
          node({ proposalNodeId: "row:3", name: "Legal", businessCode: "LEG", parentExistingUnitId: "1" }),
        ],
      }),
    }).session;
    mocks.sessionQuery = { data: additive, isLoading: false, error: null, refetch: vi.fn() };
    renderAttempt("review");

    fireEvent.click(screen.getByText("Finance"));
    expect(screen.getByRole("treeitem", { name: /Finance/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: /Edit|Exclude/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search units"), { target: { value: "leg" } });
    const tree = screen.getByRole("tree", { name: "Resulting organization" });
    expect(within(tree).getByText("Legal")).toBeInTheDocument();
    expect(within(tree).queryByText("Finance")).not.toBeInTheDocument();
    expect(within(tree).getByText("Demo Eight")).toBeInTheDocument();
  });

});
