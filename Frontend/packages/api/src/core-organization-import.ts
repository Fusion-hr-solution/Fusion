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
  review: OrganizationImportReview | null;
  commitResult: OrganizationImportCommitResult | null;
  committedAt: string | null;
  committedByUserId: string | null;
  committedByDisplayName: string | null;
  finalProvenance: OrganizationImportProvenance[] | null;
  semanticAssistance?: OrganizationImportSemanticAssistance | null;
}

export type OrganizationImportShape = "Native" | "ParentReference" | "LevelColumns" | "Unresolved";
export type OrganizationImportResolutionStatus = "Resolved" | "Suggested" | "Unresolved";
export type OrganizationImportResolutionOrigin = "Native" | "Deterministic" | "Administrator" | "FutureSuggestion";
export type OrganizationImportNodeClassification = "Unchanged" | "Create" | "Conflict";
export type OrganizationImportIssueSeverity = "Blocker" | "Warning" | "Information";

export interface OrganizationImportFieldMapping {
  field: string;
  columnIndex: number | null;
  status: OrganizationImportResolutionStatus;
  origin: OrganizationImportResolutionOrigin;
}
export interface OrganizationImportRootDecision { name: string; businessCode: string }
export interface OrganizationImportNodeCorrection {
  name?: string | null;
  businessCode?: string | null;
  typeId?: string | null;
  parentNodeId?: string | null;
  parentCanonicalId?: string | null;
}
export interface OrganizationImportDecisions {
  shape?: OrganizationImportShape | null;
  fieldMappings?: Record<string, number | null>;
  typeMappings?: Record<string, string>;
  acceptedExistingMatches?: Record<string, string>;
  nodeCorrections?: Record<string, OrganizationImportNodeCorrection>;
  excludedNodeIds?: string[];
  keepCanonicalNodeIds?: string[];
  introducedRoot?: OrganizationImportRootDecision | null;
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
export interface OrganizationImportReviewNode {
  id: string; name: string; businessCode: string | null; businessCodeGenerated: boolean; rawType: string | null;
  typeId: string | null; typeName: string | null; parentNodeId: string | null; parentCanonicalId: string | null; rawParent: string | null;
  canonicalId: string | null; classification: OrganizationImportNodeClassification; isProposalRoot: boolean;
  descriptiveCandidates: OrganizationImportCandidate[]; sourceCells: OrganizationImportSourceCell[];
  identityEvidence: OrganizationImportIdentityEvidence[];
}
export interface OrganizationImportResultNode {
  id: string; canonicalId: string | null; name: string; businessCode: string; typeName: string;
  parentId: string | null; isNew: boolean; isRoot: boolean;
}
export interface OrganizationImportIssue {
  code: string; severity: OrganizationImportIssueSeverity; title: string; message: string; affectedCount: number;
  nodeIds: string[]; sourceCells: OrganizationImportSourceCell[]; recoveryActions: string[];
}
/** A source column Fusion set aside from the hierarchy because it is a row key, not a level. */
export interface OrganizationImportIgnoredColumn { columnIndex: number; label: string; reason: string }
export interface OrganizationImportReview {
  shape: OrganizationImportShape; shapeStatus: OrganizationImportResolutionStatus; shapeOrigin: OrganizationImportResolutionOrigin;
  fieldMappings: OrganizationImportFieldMapping[]; typeOptions: OrganizationImportTypeOption[];
  proposalNodes: OrganizationImportReviewNode[]; resultingOrganization: OrganizationImportResultNode[];
  issues: OrganizationImportIssue[]; existingCount: number; createCount: number; canCommit: boolean;
  semanticDigest: string; canonicalObservationDigest: string; decisionRevision: number;
  decisionsUpdatedAt: string | null; decisionsUpdatedByDisplayName: string | null;
  ignoredColumns: OrganizationImportIgnoredColumn[];
}
export interface OrganizationImportCreatedUnit { proposalNodeId: string; orgUnitId: string; businessCode: string; name: string }
export interface OrganizationImportCommitResult { sessionId: string; effectiveDate: string; createdUnits: OrganizationImportCreatedUnit[]; noChanges: boolean }
export interface OrganizationImportProvenance { proposalNodeId: string; orgUnitId: string | null; sourceCells: OrganizationImportSourceCell[]; resolution: string }

export type OrganizationImportSemanticAssistanceState =
  | "NotEligible"
  | "Eligible"
  | "Pending"
  | "Available"
  | "Failed"
  | "Applied";
export type OrganizationImportSemanticFailureCategory =
  | "NotConfigured"
  | "Timeout"
  | "RateLimited"
  | "ProviderUnavailable"
  | "InvalidOutput"
  | "Interrupted";
export type OrganizationImportSemanticReviewOutcome = "Accepted" | "Changed" | "Rejected";
export interface OrganizationImportSemanticTarget { key: string; label: string }
export interface OrganizationImportSemanticSuggestion {
  issueKey: string;
  kind: "source_shape" | "field_mapping" | "organization_type_mapping";
  sourceColumnIndex: number | null;
  sourceLabel: string | null;
  targetKey: string;
  targetLabel: string;
  rationale: string | null;
  allowedTargets: OrganizationImportSemanticTarget[];
}
export interface OrganizationImportSemanticAssistance {
  state: OrganizationImportSemanticAssistanceState;
  inputFingerprint: string | null;
  attemptId: string | null;
  attemptVersion: number | null;
  provider: string | null;
  model: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  failureCategory: OrganizationImportSemanticFailureCategory | null;
  retryAfter: string | null;
  suggestions: OrganizationImportSemanticSuggestion[];
}
export interface OrganizationImportSemanticReviewedItem {
  issueKey: string;
  targetKey: string | null;
  outcome: OrganizationImportSemanticReviewOutcome;
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
  decisions: (id: string) => `/corehr/organization/imports/${id}/decisions`,
  refresh: (id: string) => `/corehr/organization/imports/${id}/refresh`,
  semanticSuggestions: (id: string) => `/corehr/organization/imports/${id}/semantic-suggestions`,
  applySemanticSuggestions: (id: string, attemptId: string) =>
    `/corehr/organization/imports/${id}/semantic-suggestions/${attemptId}/apply`,
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
    replaceDecisions: (id: string, version: number, decisions: OrganizationImportDecisions) =>
      client.put<OrganizationImportSessionDto>(
        coreOrganizationImportPaths.decisions(id),
        { decisions },
        { headers: { "If-Match": organizationIfMatch(version) } }
      ),
    refresh: (id: string) =>
      client.post<OrganizationImportSessionDto>(coreOrganizationImportPaths.refresh(id)),
    generateSemanticSuggestions: (id: string, inputFingerprint: string, retry = false) =>
      client.post<OrganizationImportSemanticAssistance>(
        coreOrganizationImportPaths.semanticSuggestions(id),
        { inputFingerprint, retry }
      ),
    applySemanticSuggestions: (
      id: string,
      version: number,
      attemptId: string,
      inputFingerprint: string,
      attemptVersion: number,
      reviewedItems: OrganizationImportSemanticReviewedItem[]
    ) =>
      client.put<OrganizationImportSessionDto>(
        coreOrganizationImportPaths.applySemanticSuggestions(id, attemptId),
        { inputFingerprint, attemptVersion, reviewedItems },
        { headers: { "If-Match": organizationIfMatch(version) } }
      ),
    commit: (id: string, version: number, semanticDigest: string) =>
      client.post<OrganizationImportCommitResult>(
        coreOrganizationImportPaths.commit(id),
        { semanticDigest },
        { headers: { "If-Match": organizationIfMatch(version) } }
      ),
  };
}
