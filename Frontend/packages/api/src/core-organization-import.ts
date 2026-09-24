import type { ApiClient } from "./types";
import { ApiError } from "./types";
import { organizationCalendarDate, organizationIfMatch } from "./core-organization";

export interface OrganizationSourceColumn {
  index: number;
  sourceLabel: string | null;
}

export interface OrganizationSourceTable {
  columns: OrganizationSourceColumn[];
  rows: Array<Array<string | null>>;
}

export interface CanonicalOrganizationBaselineSummary {
  hasPermanentRootIdentity: boolean;
  hasRootAsOfEffectiveDate: boolean;
}

export interface OrganizationImportSourceDto {
  originalFileName: string;
  sourceFormat: "csv" | "xlsx";
  contentType: string;
  byteLength: number;
  sha256: string;
  selectedSheetName: string;
  selectedRange: string;
  columnCount: number;
  rowCount: number;
  payloadPurgedAt: string | null;
  table: OrganizationSourceTable | null;
}

export interface OrganizationImportSessionDto {
  id: string;
  status: "Active" | "Discarded" | "Committed";
  effectiveDate: string;
  version: number;
  startedByUserId: string;
  startedByDisplayName: string;
  lastUpdatedByUserId: string;
  lastUpdatedByDisplayName: string;
  createdAt: string;
  updatedAt: string | null;
  discardedAt: string | null;
  source: OrganizationImportSourceDto;
  baseline: CanonicalOrganizationBaselineSummary;
  decisions: OrganizationImportDecisions;
  /** The authoritative Review read. Null until Match is complete. */
  review: OrganizationImportReview | null;
  commitResult: OrganizationImportCommitResult | null;
  committedAt: string | null;
  committedByUserId: string | null;
  committedByDisplayName: string | null;
  finalProvenance: OrganizationImportProvenance[] | null;
  mappingReview?: OrganizationImportMappingReview | null;
  semanticAssistance?: OrganizationImportSemanticAssistance | null;
  match?: OrganizationImportMatch | null;
}

export type OrganizationImportShape = "Native" | "ParentReference" | "LevelColumns" | "Unresolved";
export type OrganizationImportResolutionStatus = "Resolved" | "Suggested" | "Unresolved";
export type OrganizationImportResolutionOrigin = "Native" | "Deterministic" | "Administrator" | "SemanticSuggestion";
export type OrganizationImportNodeClassification = "Create" | "Existing" | "Conflict";
export type OrganizationImportIssueSeverity = "Blocker" | "Warning";
/** Where the fix for a Review issue belongs. Review never edits a proposed unit directly. */
export type OrganizationImportResolutionKind =
  | "ReturnToMatch"
  | "CorrectSource"
  | "AddOrganizationRoot"
  | "KeepExisting"
  | "ChooseExistingUnit"
  | "ChangeEffectiveDate";
export type OrganizationImportReviewState = "Ready" | "ReadyWithWarnings" | "Blocked";
export type OrganizationImportMappingStatus = "Matched" | "Suggested" | "NeedsReview" | "Ignored";
export type OrganizationImportMatchReadinessState = "Incomplete" | "Complete";
export type OrganizationImportMatchCompletionKind = "Incomplete" | "Automatic" | "Confirmed";
export type OrganizationImportStage = "Match" | "Review";
export type OrganizationImportRequiredDecisionKind = "SourceShape" | "FieldMapping" | "TypeMapping" | "IdentityStrategy" | "MappingConflict";

export interface OrganizationImportFieldMapping {
  field: string;
  columnIndex: number | null;
  status: OrganizationImportResolutionStatus;
  origin: OrganizationImportResolutionOrigin;
  evidence?: string | null;
  matchStatus?: OrganizationImportMappingStatus;
}
export interface OrganizationImportMappingReview {
  requiresConfirmation: boolean;
  isConfirmed: boolean;
  digest: string;
  fieldMappings: OrganizationImportFieldMapping[];
}
export interface OrganizationImportRootDecision { name: string; businessCode: string }
export interface OrganizationImportDecisions {
  shape?: OrganizationImportShape | null;
  fieldMappings?: Record<string, number | null>;
  typeMappings?: Record<string, string>;
  acceptedExistingMatches?: Record<string, string>;
  keepExistingNodeIds?: string[];
  introducedRoot?: OrganizationImportRootDecision | null;
  shapeDecisionOrigin?: OrganizationImportResolutionOrigin | null;
  fieldMappingOrigins?: Record<string, OrganizationImportResolutionOrigin>;
  typeMappingOrigins?: Record<string, OrganizationImportResolutionOrigin>;
  identityStrategy?: OrganizationImportGeneratedIdentityStrategy | null;
}
export interface OrganizationImportTypeOption { id: string; name: string }
export interface OrganizationImportCandidate { id: string; code: string; name: string; typeId: string; typeName: string; parentId: string | null }
export interface OrganizationImportSourceCell { rowNumber: number; columnIndex: number; value: string | null }
export interface OrganizationImportIdentityEvidence {
  identifier: "fusionOrgUnitId" | "businessCode";
  suppliedValue: string;
  unitId: string;
  unitName: string;
  unitCode: string;
}
/** One unit of the canonical proposal, in a flat list with parent ids and depth. */
export interface OrganizationImportReviewNode {
  proposalNodeId: string;
  businessCode: string;
  businessCodeGenerated: boolean;
  name: string;
  typeId: string | null;
  typeName: string | null;
  parentProposalNodeId: string | null;
  /** An existing unit this one sits under: an anchor, or a node whose `existingOrgUnitId` matches. */
  parentExistingUnitId: string | null;
  existingOrgUnitId: string | null;
  classification: OrganizationImportNodeClassification;
  isRoot: boolean;
  depth: number;
  blockingIssueCount: number;
  warningCount: number;
  sourceCells: OrganizationImportSourceCell[];
  candidates: OrganizationImportCandidate[];
  identityEvidence: OrganizationImportIdentityEvidence[];
}
/** An existing unit the proposal hangs from, with its ancestors. */
export interface OrganizationImportReviewAnchor {
  id: string;
  name: string;
  businessCode: string;
  typeName: string | null;
  parentId: string | null;
  isRoot: boolean;
}
/** A structured Review finding; its resolution pathways are decided by the server. */
export interface OrganizationImportIssue {
  code: string;
  severity: OrganizationImportIssueSeverity;
  title: string;
  message: string;
  proposalNodeId: string | null;
  relatedNodeIds: string[];
  field: string | null;
  sourceCells: OrganizationImportSourceCell[];
  preferredResolution: OrganizationImportResolutionKind | null;
  allowedResolutions: OrganizationImportResolutionKind[];
}
export interface OrganizationImportReviewReadiness {
  state: OrganizationImportReviewState;
  canPublish: boolean;
  blockingIssueCount: number;
  warningCount: number;
  createCount: number;
  existingCount: number;
}
export interface OrganizationImportReviewSummary {
  totalUnits: number;
  newUnits: number;
  existingUnits: number;
  conflictUnits: number;
  rootCount: number;
  countsByType: { typeId: string | null; typeName: string; count: number }[];
}
export interface OrganizationImportReviewResolutions {
  introducedRoot: OrganizationImportRootDecision | null;
  acceptedExistingMatches: Record<string, string>;
  keepExistingNodeIds: string[];
}
/** The complete set of bounded Review resolutions; it replaces the current set. */
export interface OrganizationImportReviewResolutionsInput {
  introducedRoot?: OrganizationImportRootDecision | null;
  acceptedExistingMatches?: Record<string, string>;
  keepExistingNodeIds?: string[];
}
/** A source column Fusion set aside from the hierarchy because it is a row key, not a level. */
export interface OrganizationImportIgnoredColumn { columnIndex: number; label: string; reason: string }
export type OrganizationImportGeneratedIdentityStrategy = "SourceBusinessCode" | "DeterministicFromNameAndPath";
export interface OrganizationImportTypeMapping {
  sourceValue: string;
  typeId: string | null;
  typeName: string | null;
  occurrenceCount: number;
  status: OrganizationImportMappingStatus;
  origin: OrganizationImportResolutionOrigin;
  evidence?: string | null;
}
export interface OrganizationImportIdentityMapping {
  strategy: OrganizationImportGeneratedIdentityStrategy;
  sourceColumnIndex: number | null;
  status: OrganizationImportMappingStatus;
  origin: OrganizationImportResolutionOrigin;
  evidence: string;
}
export interface OrganizationImportRequiredDecision {
  key: string;
  kind: OrganizationImportRequiredDecisionKind;
  sourceValue: string | null;
  targetField: string | null;
}
export interface OrganizationImportMatchReadiness {
  state: OrganizationImportMatchReadinessState;
  canContinue: boolean;
  requiredDecisions: OrganizationImportRequiredDecision[];
  recommendedStage: OrganizationImportStage;
}
export interface OrganizationImportMappingPlan {
  sourceShape: OrganizationImportShape;
  shapeStatus: OrganizationImportResolutionStatus;
  shapeOrigin: OrganizationImportResolutionOrigin;
  columnMappings: OrganizationImportFieldMapping[];
  typeMappings: Record<string, string>;
  orderedLevelColumns: number[];
  ignoredColumns: OrganizationImportIgnoredColumn[];
  generatedIdentityStrategy: OrganizationImportGeneratedIdentityStrategy;
  sourceFingerprint: string;
  typeMappingOrigins?: Record<string, OrganizationImportResolutionOrigin> | null;
  typeMappingDetails?: OrganizationImportTypeMapping[] | null;
  identity?: OrganizationImportIdentityMapping | null;
  revision?: number;
  digest?: string | null;
}
/**
 * The exact canonical organization Fusion intends to establish: its deterministic issues and
 * publication readiness. Publish sends `proposalFingerprint` back so the server can refuse a
 * proposal that changed after it was reviewed.
 */
export interface OrganizationImportReview {
  effectiveDate: string;
  proposalFingerprint: string;
  decisionRevision: number;
  readiness: OrganizationImportReviewReadiness;
  summary: OrganizationImportReviewSummary;
  nodes: OrganizationImportReviewNode[];
  anchors: OrganizationImportReviewAnchor[];
  issues: OrganizationImportIssue[];
  resolutions: OrganizationImportReviewResolutions;
}
export interface OrganizationImportCreatedUnit { proposalNodeId: string; orgUnitId: string; businessCode: string; name: string }
export interface OrganizationImportCommitResult { sessionId: string; effectiveDate: string; createdUnits: OrganizationImportCreatedUnit[]; noChanges: boolean }
export interface OrganizationImportProvenance { proposalNodeId: string; orgUnitId: string | null; sourceCells: OrganizationImportSourceCell[]; resolution: string }

/**
 * Semantic assistance as the product sees it. Independent of Match readiness: a successful run
 * can leave items for the administrator, and a failed one never blocks finishing Match manually.
 */
export type OrganizationImportSemanticAssistanceState =
  | "NotNeeded"
  | "AwaitingConsent"
  | "Ready"
  | "Running"
  | "Succeeded"
  | "Failed"
  | "Stale"
  | "Skipped";
export type OrganizationImportSemanticFailureCategory =
  | "NotConfigured"
  | "Unauthorized"
  | "ProviderRejected"
  | "Timeout"
  | "RateLimited"
  | "ProviderUnavailable"
  | "InvalidOutput"
  | "Interrupted";
export interface OrganizationImportSemanticAssistance {
  state: OrganizationImportSemanticAssistanceState;
  /** Identifies the questions a run would answer; a run request must carry the current one. */
  inputFingerprint: string | null;
  examinedCount: number;
  appliedCount: number;
  abstainedCount: number;
  /** Semantic questions still open in the current interpretation. */
  remainingCount: number;
  lastCompletedAt: string | null;
  canRetry: boolean;
  retryAfter: string | null;
  failureCategory: OrganizationImportSemanticFailureCategory | null;
  /** What turning automatic matching on from Match covers: the whole tenant or just this import. */
  consentScope: "Tenant" | "Import";
}
export interface OrganizationImportMatch {
  mappingPlan: OrganizationImportMappingPlan;
  readiness: OrganizationImportMatchReadiness;
  completionKind: OrganizationImportMatchCompletionKind;
  typeOptions: OrganizationImportTypeOption[];
  semanticAssistance: OrganizationImportSemanticAssistance | null;
}

export interface OrganizationImportActiveSummaryDto {
  id: string;
  effectiveDate: string;
  version: number;
  originalFileName: string;
  sourceFormat: "csv" | "xlsx";
  rowCount: number;
  startedByDisplayName: string;
  lastUpdatedByDisplayName: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface OrganizationSourceChoice {
  originalFileName: string;
  sourceFormat: "xlsx";
  byteLength: number;
  sha256: string;
  candidateSheetNames: string[];
}

export type OrganizationImportIntakeResult =
  | {
      kind: "SourceReady";
      replayed: boolean;
      session: OrganizationImportSessionDto;
      sheetSelection: null;
    }
  | {
      kind: "SheetSelectionRequired";
      replayed: false;
      session: null;
      sheetSelection: OrganizationSourceChoice;
    };

export interface OrganizationImportProblem {
  kind: "rejected" | "needs-input" | "conflict" | "concurrency" | "not-found" | "access-denied" | "temporary";
  code: string | null;
  message: string;
}

export const coreOrganizationImportPaths = {
  template: () => "/corehr/organization/imports/template",
  export: () => "/corehr/organization/imports/export",
  intake: () => "/corehr/organization/imports/intake",
  active: () => "/corehr/organization/imports/active",
  session: (id: string) => `/corehr/organization/imports/${id}`,
  effectiveDate: (id: string) => `/corehr/organization/imports/${id}/effective-date`,
  discard: (id: string) => `/corehr/organization/imports/${id}/discard`,
  reviewResolutions: (id: string) => `/corehr/organization/imports/${id}/review/resolutions`,
  match: (id: string) => `/corehr/organization/imports/${id}/match`,
  refresh: (id: string) => `/corehr/organization/imports/${id}/refresh`,
  runSemanticAssistance: (id: string) => `/corehr/organization/imports/${id}/semantic-assistance/run`,
  commit: (id: string) => `/corehr/organization/imports/${id}/commit`,
} as const;

export const coreOrganizationImportQueryKeys = {
  all: () => ["coreOrganizationImport"] as const,
  active: () => [...coreOrganizationImportQueryKeys.all(), "active"] as const,
  session: (id: string) => [...coreOrganizationImportQueryKeys.all(), "session", id] as const,
} as const;

export function translateOrganizationImportError(error: unknown): OrganizationImportProblem {
  if (!(error instanceof ApiError)) {
    return {
      kind: "temporary",
      code: null,
      message: error instanceof Error ? error.message : "The source could not be inspected right now.",
    };
  }
  const code = error.code ?? null;
  const message =
    error.status === 413
      ? "Choose a file no larger than 10 MB."
      : error.errors[0] ?? "The source could not be inspected right now.";
  return {
    kind:
      error.status === 403
        ? "access-denied"
        : error.status === 404
          ? "not-found"
          : error.status === 409 && code?.toLowerCase().includes("idempotency")
            ? "conflict"
            : error.status === 409 || error.status === 412
              ? "concurrency"
              : error.status === 413 || error.status === 422
                ? "rejected"
                : "temporary",
    code,
    message,
  };
}

export function createCoreOrganizationImportApi(client: ApiClient) {
  return {
    downloadTemplate: (signal?: AbortSignal) =>
      client.get<Blob>(coreOrganizationImportPaths.template(), { responseType: "blob", signal }),
    exportStructure: (asOf: string, signal?: AbortSignal) =>
      client.get<Blob>(coreOrganizationImportPaths.export(), {
        params: { asOf: organizationCalendarDate(asOf) },
        responseType: "blob",
        signal,
      }),
    intake: (input: {
      file: File;
      effectiveDate: string;
      creationToken: string;
      selectedSheetName?: string;
    }) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("effectiveDate", organizationCalendarDate(input.effectiveDate));
      form.append("creationToken", input.creationToken);
      if (input.selectedSheetName) form.append("selectedSheetName", input.selectedSheetName);
      return client.post<OrganizationImportIntakeResult>(coreOrganizationImportPaths.intake(), form);
    },
    active: (signal?: AbortSignal) =>
      client.get<OrganizationImportActiveSummaryDto[]>(coreOrganizationImportPaths.active(), { signal }),
    session: (id: string, signal?: AbortSignal) =>
      client.get<OrganizationImportSessionDto>(coreOrganizationImportPaths.session(id), { signal }),
    changeEffectiveDate: (id: string, version: number, effectiveDate: string) =>
      client.patch<OrganizationImportSessionDto>(
        coreOrganizationImportPaths.effectiveDate(id),
        { effectiveDate: organizationCalendarDate(effectiveDate) },
        { headers: { "If-Match": organizationIfMatch(version) } }
      ),
    discard: (id: string, version: number) =>
      client.post<OrganizationImportSessionDto>(
        coreOrganizationImportPaths.discard(id),
        undefined,
        { headers: { "If-Match": organizationIfMatch(version) } }
      ),
    updateReviewResolutions: (id: string, version: number, resolutions: OrganizationImportReviewResolutionsInput) =>
      client.put<OrganizationImportSessionDto>(
        coreOrganizationImportPaths.reviewResolutions(id),
        resolutions,
        { headers: { "If-Match": organizationIfMatch(version) } }
      ),
    updateMatch: (id: string, version: number, input: {
      shape?: OrganizationImportShape | null;
      fieldMappings?: Record<string, number | null>;
      typeMappings?: Record<string, string>;
      identityStrategy?: OrganizationImportGeneratedIdentityStrategy | null;
    }) => client.put<OrganizationImportSessionDto>(
      coreOrganizationImportPaths.match(id),
      input,
      { headers: { "If-Match": organizationIfMatch(version) } }
    ),
    refresh: (id: string) =>
      client.post<OrganizationImportSessionDto>(coreOrganizationImportPaths.refresh(id)),
    /** Runs automatic matching from Match, optionally turning it on for the tenant first. */
    runSemanticAssistance: (id: string, inputFingerprint: string, grantTenantConsent = false) =>
      client.post<OrganizationImportSessionDto>(
        coreOrganizationImportPaths.runSemanticAssistance(id),
        { inputFingerprint, grantTenantConsent }
      ),
    commit: (id: string, version: number, proposalFingerprint: string) =>
      client.post<OrganizationImportCommitResult>(
        coreOrganizationImportPaths.commit(id),
        { proposalFingerprint },
        { headers: { "If-Match": organizationIfMatch(version) } }
      ),
  };
}
