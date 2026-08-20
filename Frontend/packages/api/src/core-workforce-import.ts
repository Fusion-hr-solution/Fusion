import type { ApiClient } from "./types";
import { ApiError } from "./types";

/** Quoted If-Match ETag from the session/review version. */
export function workforceImportIfMatch(version: number): string {
  return `"${version}"`;
}

export type WorkforceImportStatus =
  | "Intake"
  | "Interpreting"
  | "Reviewing"
  | "Ready"
  | "Applying"
  | "Committed"
  | "Discarded"
  | "Expired";

export interface WorkforceImportSessionDto {
  id: string;
  status: WorkforceImportStatus;
  baselineDate: string;
  version: number;
  source: {
    fileName: string | null;
    format: "csv" | "xlsx" | null;
    rowCount: number | null;
    selectedSheet: string | null;
  };
  counts: {
    newCount: number;
    existingAnchorCount: number;
    needsAttentionCount: number;
    excludedCount: number;
  };
  expiresAt: string;
}

export interface WorkforceImportSheetSummary {
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface WorkforceHeaderCandidate {
  rowIndex: number;
  preview: Array<string | null>;
}

export type WorkforceImportIntakeKind =
  | "Ready"
  | "SheetSelectionRequired"
  | "HeaderClarificationRequired"
  | "ActiveSessionExists"
  | "Conflict";

export interface WorkforceImportIntakeResult {
  kind: WorkforceImportIntakeKind;
  replayed: boolean;
  session: WorkforceImportSessionDto | null;
  sheetChoice: {
    fileName: string;
    format: string;
    byteLength: number;
    sha256: string;
    sheets: WorkforceImportSheetSummary[];
  } | null;
  headerCandidates: WorkforceHeaderCandidate[] | null;
  conflictReason: string | null;
}

export type WorkforceReviewResult = "New" | "Existing" | "NeedsAttention" | "Excluded";
export type WorkforceIssueSeverity = "blocker" | "warning" | "information";

export interface WorkforceReviewIssueDto {
  code: string;
  severity: WorkforceIssueSeverity;
  message: string;
  field: string;
  decisionKey: string | null;
  affectedCount: number;
}

export interface WorkforceReviewRowDto {
  sourceRowNumber: number;
  result: WorkforceReviewResult;
  employee: {
    displayName: string;
    employeeNumber: string | null;
    numberGenerated: boolean;
    identityState: "New" | "Existing";
  };
  employment: { startDate: string | null };
  work: {
    displayTitle: string | null;
    organization: string | null;
    location: string | null;
    effectiveFrom: string | null;
  };
  manager: { state: "Resolved" | "NoManager" | "Unresolved"; display: string | null; subtext: string | null };
  issues: WorkforceReviewIssueDto[];
}

export interface WorkforceReviewCountsDto {
  needsAttention: number;
  new: number;
  existing: number;
  excluded: number;
  total: number;
  /** Distinct decisions still to make (grouped), not affected-row count. */
  openIssueCount: number;
}

export type WorkforceReviewState = "NoRows" | "NothingNew" | "NothingIncluded" | "Reviewable";

export interface WorkforceReviewSummaryDto {
  counts: WorkforceReviewCountsDto;
  canCommit: boolean;
  state: WorkforceReviewState;
  version: number;
  reviewDigest: string | null;
  affectedRows: number;
}

export interface WorkforceReviewPageDto {
  rows: WorkforceReviewRowDto[];
  page: number;
  pageSize: number;
  totalMatching: number;
  summary: WorkforceReviewSummaryDto;
}

export interface WorkforceColumnMappingDto {
  columnIndex: number;
  sourceLabel: string | null;
  field: string;
  origin: "native" | "deterministic" | "administrator" | "unresolved" | string;
}

export interface WorkforceInterpretationSummaryDto {
  mappings: WorkforceColumnMappingDto[];
  unresolvedColumnIndexes: number[];
  unresolvedRequiredFields: string[];
  nameFormatDecisionNeeded: boolean;
  dateFormatDecisionNeeded: boolean;
}

export interface WorkforcePrepareResultDto {
  interpretation: WorkforceInterpretationSummaryDto;
  review: WorkforceReviewSummaryDto;
}

export interface WorkforceApplyResultDto {
  sessionId: string;
  alreadyApplied: boolean;
  addedEmployeeCount: number;
  managerRelationshipCount: number;
  addedEmployeeKeys: string[];
}

export interface WorkforceReviewOutdatedItemDto {
  sourceRowNumber: number;
  field: string;
  reason: string;
  decisionKey: string | null;
}

export interface WorkforceReviewOutdatedResultDto {
  affectedCount: number;
  preservedDecisionCount: number;
  newBlockerCount: number;
  version: number;
  items: WorkforceReviewOutdatedItemDto[];
}

export type WorkforceApplyStatusKind =
  | "Queued"
  | "Running"
  | "Succeeded"
  | "Failed"
  | "ReviewOutdated";

export interface WorkforceApplyStatusDto {
  status: WorkforceApplyStatusKind;
  phase: string;
  processed: number;
  total: number | null;
  result: WorkforceApplyResultDto | null;
  reviewOutdated: WorkforceReviewOutdatedResultDto | null;
  message: string | null;
}

export interface WorkforceSemanticSuggestionDto {
  columnIndex: number;
  sourceLabel: string | null;
  targetField: string;
  targetDisplayName: string;
  rationale: string | null;
}

export interface WorkforceSemanticSuggestionsDto {
  available: boolean;
  reason: string | null;
  suggestions: WorkforceSemanticSuggestionDto[];
}

/** Broadest-safe-scope decision; exactly one decision kind per call is applied server-side. */
export interface WorkforceDecisionRequest {
  columnMappings?: Record<number, string>;
  dateFormat?: string;
  nameFormat?: string;
  organizationSourceValue?: string;
  organizationUnitId?: string;
  managerRowNumber?: number;
  managerEmployeeKey?: string;
  noManager?: boolean;
  excludeRow?: number;
  includeRow?: number;
  keepFusionUnchangedRow?: number;
  keepAsDistinctRow?: number;
  /** Establish current work details (and the initial manager relationship) at the baseline for
   *  people whose source work dates predate their Organization's history in Fusion. */
  normalizeWorkDatesToBaseline?: boolean;
}

export interface WorkforceImportProblem {
  kind: "rejected" | "conflict" | "concurrency" | "not-found" | "access-denied" | "temporary";
  code: string | null;
  message: string;
}

const base = "/corehr/employees/import";
export const coreWorkforceImportPaths = {
  active: () => `${base}/active`,
  session: (id: string) => `${base}/${id}`,
  intake: () => `${base}/intake`,
  header: (id: string) => `${base}/${id}/header`,
  baseline: (id: string) => `${base}/${id}/baseline`,
  replaceSource: (id: string) => `${base}/${id}/replace-source`,
  prepare: (id: string) => `${base}/${id}/prepare`,
  review: (id: string) => `${base}/${id}/review`,
  decisions: (id: string) => `${base}/${id}/decisions`,
  semanticSuggestions: (id: string) => `${base}/${id}/semantic-suggestions`,
  finish: (id: string) => `${base}/${id}/finish`,
  discard: (id: string) => `${base}/${id}/discard`,
  commit: (id: string) => `${base}/${id}/commit`,
} as const;

export const coreWorkforceImportQueryKeys = {
  all: () => ["coreWorkforceImport"] as const,
  active: () => [...coreWorkforceImportQueryKeys.all(), "active"] as const,
  session: (id: string) => [...coreWorkforceImportQueryKeys.all(), "session", id] as const,
  review: (id: string, filter: string, query: string, page: number) =>
    [...coreWorkforceImportQueryKeys.all(), "review", id, filter, query, page] as const,
  commit: (id: string) => [...coreWorkforceImportQueryKeys.all(), "commit", id] as const,
} as const;

export function translateWorkforceImportError(error: unknown): WorkforceImportProblem {
  if (!(error instanceof ApiError)) {
    return {
      kind: "temporary",
      code: null,
      message: error instanceof Error ? error.message : "Something went wrong. Try again.",
    };
  }
  const code = error.code ?? null;
  const message =
    error.status === 413 ? "Choose a file no larger than 10 MB." : error.errors[0] ?? "Something went wrong.";
  const kind: WorkforceImportProblem["kind"] =
    error.status === 403
      ? "access-denied"
      : error.status === 404
        ? "not-found"
        : error.status === 409 || error.status === 412 || error.status === 428
          ? "concurrency"
          : error.status === 413 || error.status === 422
            ? "rejected"
            : "temporary";
  return { kind, code, message };
}

export function createCoreWorkforceImportApi(client: ApiClient) {
  const ifMatch = (version: number) => ({ headers: { "If-Match": workforceImportIfMatch(version) } });
  return {
    active: (signal?: AbortSignal) =>
      client.get<WorkforceImportSessionDto | null>(coreWorkforceImportPaths.active(), { signal }),
    session: (id: string, signal?: AbortSignal) =>
      client.get<WorkforceImportSessionDto>(coreWorkforceImportPaths.session(id), { signal }),
    intake: (input: { file: File; creationToken: string; baselineDate: string; selectedSheet?: string }) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("creationToken", input.creationToken);
      form.append("baselineDate", input.baselineDate);
      if (input.selectedSheet) form.append("selectedSheet", input.selectedSheet);
      return client.post<WorkforceImportIntakeResult>(coreWorkforceImportPaths.intake(), form);
    },
    selectHeader: (id: string, version: number, headerRowIndex: number) =>
      client.put<WorkforceImportSessionDto>(coreWorkforceImportPaths.header(id), { headerRowIndex }, ifMatch(version)),
    changeBaseline: (id: string, version: number, baselineDate: string) =>
      client.put<WorkforceImportSessionDto>(coreWorkforceImportPaths.baseline(id), { baselineDate }, ifMatch(version)),
    replaceSource: (id: string, version: number, file: File, selectedSheet?: string) => {
      const form = new FormData();
      form.append("file", file);
      if (selectedSheet) form.append("selectedSheet", selectedSheet);
      return client.post<WorkforceImportSessionDto>(coreWorkforceImportPaths.replaceSource(id), form, ifMatch(version));
    },
    prepare: (id: string, version: number) =>
      client.post<WorkforcePrepareResultDto>(coreWorkforceImportPaths.prepare(id), undefined, ifMatch(version)),
    review: (
      id: string,
      params: { filter?: string; query?: string; page?: number; pageSize?: number },
      signal?: AbortSignal
    ) => client.get<WorkforceReviewPageDto>(coreWorkforceImportPaths.review(id), { params, signal }),
    decide: (id: string, version: number, decision: WorkforceDecisionRequest) =>
      client.put<WorkforceReviewSummaryDto>(coreWorkforceImportPaths.decisions(id), decision, ifMatch(version)),
    suggestMeanings: (id: string) =>
      client.post<WorkforceSemanticSuggestionsDto>(coreWorkforceImportPaths.semanticSuggestions(id)),
    finish: (id: string, version: number) =>
      client.post<WorkforceImportSessionDto>(coreWorkforceImportPaths.finish(id), undefined, ifMatch(version)),
    discard: (id: string, version: number) =>
      client.post<void>(coreWorkforceImportPaths.discard(id), undefined, ifMatch(version)),
    commit: (id: string, version: number) =>
      client.post<WorkforceApplyStatusDto>(coreWorkforceImportPaths.commit(id), undefined, ifMatch(version)),
    commitStatus: (id: string, signal?: AbortSignal) =>
      client.get<WorkforceApplyStatusDto>(coreWorkforceImportPaths.commit(id), { signal }),
  };
}
