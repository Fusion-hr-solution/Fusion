import { describe, expect, it } from "vitest";
import type { OrganizationImportMatch, OrganizationImportSessionDto } from "@repo/api";
import { deriveImportStage, deriveMatchOutcome } from "./import-stage";

function match(overrides: Partial<OrganizationImportMatch> = {}): OrganizationImportMatch {
  return {
    mappingPlan: {
      sourceShape: "ParentReference", shapeStatus: "Resolved", shapeOrigin: "Deterministic",
      columnMappings: [], typeMappings: {}, orderedLevelColumns: [], ignoredColumns: [],
      generatedIdentityStrategy: "DeterministicFromNameAndPath", sourceFingerprint: "source",
      typeMappingDetails: [],
      identity: { strategy: "DeterministicFromNameAndPath", sourceColumnIndex: null, status: "Matched", origin: "Deterministic", evidence: "Generated" },
      revision: 0, digest: "plan",
    },
    readiness: { state: "Complete", canContinue: true, requiredDecisions: [], recommendedStage: "Review" },
    completionKind: "Automatic", typeOptions: [], semanticAssistance: null,
    ...overrides,
  };
}

function session(overrides: Partial<OrganizationImportSessionDto> = {}): OrganizationImportSessionDto {
  return {
    id: "s", status: "Active", effectiveDate: "2026-09-23", version: 1,
    startedByUserId: "u", startedByDisplayName: "U", lastUpdatedByUserId: "u", lastUpdatedByDisplayName: "U",
    createdAt: "2026-09-23T00:00:00Z", updatedAt: null, discardedAt: null,
    source: {} as OrganizationImportSessionDto["source"],
    baseline: { hasPermanentRootIdentity: true, hasRootAsOfEffectiveDate: true }, decisions: {}, review: null,
    commitResult: null, committedAt: null, committedByUserId: null, committedByDisplayName: null, finalProvenance: null,
    match: match(), ...overrides,
  } as OrganizationImportSessionDto;
}

describe("deriveImportStage", () => {
  it("leaves the import for finished attempts", () => {
    expect(deriveImportStage(session({ status: "Committed", match: null }))).toBe("committed");
    expect(deriveImportStage(session({ status: "Discarded", match: null }))).toBe("discarded");
  });

  it("uses the backend readiness contract as the only active-stage authority", () => {
    expect(deriveImportStage(session())).toBe("review");
    expect(deriveImportStage(session({ match: match({
      readiness: {
        state: "Incomplete", canContinue: false,
        requiredDecisions: [{ key: "type:Pôle", kind: "TypeMapping", sourceValue: "Pôle", targetField: null }],
        recommendedStage: "Match",
      },
      completionKind: "Incomplete",
    }) }))).toBe("match");
  });

  it("does not reconstruct readiness from legacy review, confirmation, decisions, or AI state", () => {
    const contradictory = session({
      decisions: { typeMappings: {} },
      mappingReview: { requiresConfirmation: true, isConfirmed: false, digest: "old", fieldMappings: [] },
      review: { issues: [{ code: "UnknownType", severity: "Blocker" }] } as OrganizationImportSessionDto["review"],
      semanticAssistance: { state: "Failed" } as unknown as OrganizationImportSessionDto["semanticAssistance"],
    });
    expect(deriveImportStage(contradictory)).toBe("review");
  });
});

describe("deriveMatchOutcome", () => {
  it("maps the backend completion kind without inspecting provenance", () => {
    expect(deriveMatchOutcome(session({ match: match({ completionKind: "Incomplete" }) }))).toBe("needed");
    expect(deriveMatchOutcome(session())).toBe("automatic");
    expect(deriveMatchOutcome(session({ match: match({ completionKind: "Confirmed" }) }))).toBe("confirmed");
  });
});
