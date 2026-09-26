import { describe, expect, it } from "vitest";
import type { WorkforceImportSessionDto, WorkforceMatchReadiness } from "@repo/api";
import { deriveWorkforceImportStage, deriveWorkforceMatchOutcome, workforceImportExitHref, workforceImportGuardTarget } from "./import-stage";

function session(overrides: Partial<WorkforceImportSessionDto> = {}, readiness?: Partial<WorkforceMatchReadiness>, semantic?: string): WorkforceImportSessionDto {
  return {
    id: "a1",
    status: "Active",
    baselineDate: "2026-09-25",
    version: 1,
    updatedAt: "2026-09-25T10:00:00Z",
    source: { fileName: "wf.xlsx", format: "xlsx", rowCount: 80, selectedSheet: "Sheet1" },
    counts: { create: 76, existing: 0, notImported: 4, blocked: 0, withWarnings: 4 },
    matchComplete: readiness?.canContinue ?? false,
    canPublish: false,
    proposalFingerprint: "fp",
    publication: null,
    commitResult: null,
    match: {
      columns: [],
      dateFormat: null,
      nameFormat: null,
      dateFormatDecisionNeeded: false,
      nameFormatDecisionNeeded: false,
      identityStrategy: null,
      generateAllAllowed: true,
      lifecycleValues: [],
      managerReferenceKind: "EmployeeNumber",
      readiness: { canContinue: false, requiredDecisions: [], completionKind: "Incomplete", ...readiness },
      semanticAssistance: semantic ? ({ state: semantic } as never) : null,
      previewRows: [],
    },
    ...overrides,
  };
}

describe("deriveWorkforceImportStage", () => {
  it("sends finished attempts out of the import", () => {
    expect(deriveWorkforceImportStage(session({ status: "Committed" }))).toBe("committed");
    expect(deriveWorkforceImportStage(session({ status: "Discarded" }))).toBe("discarded");
    expect(workforceImportExitHref(session({ status: "Committed" }))).toBe("/people?importBatch=a1");
    expect(workforceImportExitHref(session({ status: "Discarded" }))).toBe("/people/import");
  });

  it("is Review exactly when every required meaning is settled", () => {
    expect(deriveWorkforceImportStage(session({}, { canContinue: false }))).toBe("match");
    expect(deriveWorkforceImportStage(session({}, { canContinue: true, completionKind: "Automatic" }))).toBe("review");
  });

  it.each(["Running", "Failed", "AwaitingConsent", "Ready", "NotNeeded"])(
    "never lets semantic assistance (%s) decide the stage",
    (state) => {
      expect(deriveWorkforceImportStage(session({}, { canContinue: true }, state))).toBe("review");
      expect(deriveWorkforceImportStage(session({}, { canContinue: false }, state))).toBe("match");
    }
  );

  it("keeps a publication in flight on Review", () => {
    const publishing = session(
      { publication: { status: "Running", phase: "Saving", processed: 3, total: 76, result: null, reviewOutdated: null, message: null } },
      { canContinue: true }
    );
    expect(deriveWorkforceImportStage(publishing)).toBe("review");
  });
});

describe("deriveWorkforceMatchOutcome", () => {
  it("reports how Match was satisfied", () => {
    expect(deriveWorkforceMatchOutcome(session({}, { canContinue: true, completionKind: "Automatic" }))).toBe("automatic");
    expect(deriveWorkforceMatchOutcome(session({}, { canContinue: true, completionKind: "Confirmed" }))).toBe("confirmed");
    expect(deriveWorkforceMatchOutcome(session())).toBe("needed");
  });
});

describe("workforceImportGuardTarget", () => {
  const s = session();
  it("resolves the bare attempt URL to its stage", () => {
    expect(workforceImportGuardTarget(s, "match", null)).toBe("/people/import/a1/match");
    expect(workforceImportGuardTarget(s, "review", null)).toBe("/people/import/a1/review");
  });
  it("bounces Review back to Match until Match is complete", () => {
    expect(workforceImportGuardTarget(s, "match", "review")).toBe("/people/import/a1/match");
  });
  it("lets the administrator revisit Match from Review", () => {
    expect(workforceImportGuardTarget(s, "review", "match")).toBeNull();
    expect(workforceImportGuardTarget(s, "review", "review")).toBeNull();
  });
  it("sends finished attempts to People or Upload", () => {
    expect(workforceImportGuardTarget(session({ status: "Committed" }), "committed", "review")).toBe("/people?importBatch=a1");
    expect(workforceImportGuardTarget(session({ status: "Discarded" }), "discarded", "match")).toBe("/people/import");
  });
});
