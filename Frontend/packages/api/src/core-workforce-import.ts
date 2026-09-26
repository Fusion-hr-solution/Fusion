import type { ApiClient } from "./types";
import { ApiError } from "./types";
import type { OrganizationImportSemanticAssistance } from "./core-organization-import";

/** Quoted If-Match ETag from the attempt version. */
export function workforceImportIfMatch(version: number): string {
  return `"${version}"`;
}

/** The shared CoreHR import lifecycle: an attempt is in progress until it is published or discarded. */
export type WorkforceImportStatus = "Active" | "Discarded" | "Committed";

/** Where a Match decision came from. An administrator decision always outranks a suggestion. */
export type ImportResolutionOrigin = "Native" | "Deterministic" | "Administrator" | "SemanticSuggestion";

/** Semantic assistance state; the same contract as Organization Import. */
export type WorkforceSemanticAssistance = OrganizationImportSemanticAssistance;

export type WorkforceImportField =
  | "Ignored"
  | "FusionEmployeeReference"
  | "FusionOrganizationReference"
  | "FusionManagerReference"
  | "EmployeeNumber"
  | "FirstName"
  | "LastName"
  | "FullName"
  | "PreferredName"
  | "WorkEmail"
  | "EmploymentStart"
  | "WorkEffectiveFrom"
  | "Organization"
  | "DisplayTitle"
  | "Location"
  | "Manager"
  | "WorkerReference"
  | "ManagerReference"
  | "LifecycleStatus"
  | "EmploymentEnd";

export type WorkforceDateFormat = "Iso" | "DayMonthYear" | "MonthDayYear";
export type WorkforceNameFormat = "FirstLast" | "LastCommaFirst" | "LastFirst";
export type WorkforceLifecycle = "Active" | "Former";
export type WorkforceIdentityStrategy = "SourceIdentifier" | "GenerateAll";
export type WorkforceReferenceKind =
  | "None"
  | "FusionId"
  | "Code"
  | "Path"
  | "Name"
  | "EmployeeNumber"
  | "WorkerReference"
  | "Email"
  | "Unrecognized";

export type WorkforceRequiredDecisionKind =
  | "FieldMapping"
  | "IdentityStrategy"
  | "DateFormat"
  | "NameFormat"
  | "VocabularyMapping"
  | "MappingConflict";

export interface WorkforceRequiredDecision {
  key: string;
  kind: WorkforceRequiredDecisionKind;
  field: string | null;
  columnIndex: number | null;
  sourceValue: string | null;
  occurrenceCount: number;
}

export interface WorkforceMatchReadiness {
  canContinue: boolean;
  requiredDecisions: WorkforceRequiredDecision[];
  completionKind: "Incomplete" | "Automatic" | "Confirmed";
}

export interface WorkforceMatchColumn {
  columnIndex: number;
  sourceLabel: string | null;
  field: WorkforceImportField;
  /** Null when Fusion could not resolve the column's meaning. */
  origin: ImportResolutionOrigin | null;
  resolved: boolean;
  nonEmptyCount: number;
  sampleValues: string[];
}

export interface WorkforceLifecycleValue {
  sourceValue: string;
  meaning: WorkforceLifecycle | null;
  origin: ImportResolutionOrigin | null;
  occurrenceCount: number;
}

/** Match: what the source means. */
export interface WorkforceImportMatch {
  columns: WorkforceMatchColumn[];
  dateFormat: WorkforceDateFormat | null;
  nameFormat: WorkforceNameFormat | null;
  dateFormatDecisionNeeded: boolean;
  nameFormatDecisionNeeded: boolean;
  identityStrategy: WorkforceIdentityStrategy | null;
  /** "Create everyone with generated numbers" is only offered where nobody could be duplicated. */
  generateAllAllowed: boolean;
  lifecycleValues: WorkforceLifecycleValue[];
  managerReferenceKind: WorkforceReferenceKind;
  readiness: WorkforceMatchReadiness;
  semanticAssistance: WorkforceSemanticAssistance | null;
  /** The file's first rows as read (bounded), for previewing the mapping. */
  previewRows: Array<Array<string | null>>;
}

export interface WorkforceImportSessionDto {
  id: string;
  status: WorkforceImportStatus;
  baselineDate: string;
  version: number;
  updatedAt: string;
  source: {
    fileName: string | null;
    format: "csv" | "xlsx" | null;
    rowCount: number | null;
    selectedSheet: string | null;
  };
  counts: {
    create: number;
    existing: number;
    notImported: number;
    blocked: number;
    withWarnings: number;
  };
  matchComplete: boolean;
  canPublish: boolean;
  proposalFingerprint: string | null;
  /** The publication in flight, or the last one that did not succeed. */
  publication: WorkforceApplyStatusDto | null;
  commitResult: WorkforceApplyStatusDto | null;
  /** Present when the attempt is fetched to render it. */
  match: WorkforceImportMatch | null;
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

export type WorkforceImportIntakeKind = "Ready" | "SheetSelectionRequired" | "HeaderClarificationRequired" | "Conflict";

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

/** What publication will do with a row. Derived, never chosen. */
export type WorkforceRowClassification = "Unresolved" | "Create" | "Existing" | "NotImported" | "Blocked";
export type WorkforceIssueSeverity = "Blocker" | "Warning";
export type WorkforceResolutionKind =
  | "ReturnToMatch"
  | "CorrectSource"
  | "ChooseOrgUnit"
  | "ChooseManager"
  | "NoManager"
  | "KeepDistinct"
  | "UseBaselineForWorkDates"
  | "ChangeBaselineDate";

/** Stable issue-category keys the review breaks its remaining work down by. */
export type WorkforceIssueCategory =
  | "organization"
  | "manager"
  | "identity"
  | "dates"
  | "data"
  | "lifecycle"
  | "existing";

export interface WorkforceReviewIssueDto {
  code: string;
  severity: WorkforceIssueSeverity;
  title: string;
  message: string;
  field: string;
  decisionKey: string | null;
  category: WorkforceIssueCategory;
  resolutions: WorkforceResolutionKind[];
  affectedCount: number;
}

export interface WorkforceReviewRowDto {
  sourceRowNumber: number;
  classification: WorkforceRowClassification;
  employee: {
    displayName: string;
    employeeNumber: string | null;
    numberGenerated: boolean;
    existingEmployeeName: string | null;
    workEmail: string | null;
  };
  employment: { startDate: string | null; endDate: string | null };
  work: {
    displayTitle: string | null;
    /** The canonical unit, once resolved. */
    organization: string | null;
    /** What the file said. */
    sourceOrganization: string | null;
    location: string | null;
    effectiveFrom: string | null;
  };
  manager: {
    state: "Resolved" | "NoManager" | "Unresolved";
    display: string | null;
    subtext: string | null;
    /** The manager's employee number, when they are someone Fusion knows or is adding. */
    employeeNumber: string | null;
  };
  issues: WorkforceReviewIssueDto[];
}

export interface WorkforceReviewCountsDto {
  create: number;
  existing: number;
  notImported: number;
  blocked: number;
  total: number;
  withWarnings: number;
  /** Distinct blocking decisions still to make (grouped), not affected-row count. */
  openDecisionCount: number;
}

/** One kind of remaining work or notice, named by category and counted by grouped decisions. */
export interface WorkforceReviewIssueGroupDto {
  category: WorkforceIssueCategory;
  severity: WorkforceIssueSeverity;
  decisionCount: number;
  affectedPeople: number;
}

export type WorkforceReviewState = "NoRows" | "NothingToImport" | "Reviewable";

export interface WorkforceReviewSummaryDto {
  counts: WorkforceReviewCountsDto;
  canPublish: boolean;
  state: WorkforceReviewState;
  version: number;
  proposalFingerprint: string | null;
  issueGroups: WorkforceReviewIssueGroupDto[];
}

export type WorkforceReviewFilter = "Create" | "Existing" | "NotImported" | "Blocked" | "Warnings";

export interface WorkforceReviewPageDto {
  rows: WorkforceReviewRowDto[];
  page: number;
  pageSize: number;
  totalMatching: number;
  summary: WorkforceReviewSummaryDto;
}

/** A person being added in this same import, offered as a candidate manager. */
export interface WorkforceManagerCandidateDto {
  sourceRowNumber: number;
  displayName: string;
  employeeNumber: string | null;
  numberGenerated: boolean;
  title: string | null;
}

export interface WorkforceApplyResultDto {
  sessionId: string;
  alreadyApplied: boolean;
  addedEmployeeCount: number;
  managerRelationshipCount: number;
  addedEmployeeKeys: string[];
  existingCount: number;
  notImportedCount: number;
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

export type WorkforceApplyStatusKind = "Queued" | "Running" | "Succeeded" | "Failed" | "ReviewOutdated";

export interface WorkforceApplyStatusDto {
  status: WorkforceApplyStatusKind;
  phase: string;
  processed: number;
  total: number | null;
  result: WorkforceApplyResultDto | null;
  reviewOutdated: WorkforceReviewOutdatedResultDto | null;
  message: string | null;
}

/** A Match change. Only the fields present change. */
export interface WorkforceMatchUpdateRequest {
  columnMappings?: Record<number, WorkforceImportField>;
  dateFormat?: WorkforceDateFormat;
  nameFormat?: WorkforceNameFormat;
  identityStrategy?: WorkforceIdentityStrategy;
  lifecycleVocabulary?: Record<string, WorkforceLifecycle>;
}

/** A bounded Review resolution for a live issue. It never changes a source fact. */
export interface WorkforceResolutionsUpdateRequest {
  organizationSourceValue?: string;
  organizationUnitId?: string;
  managerReference?: string;
  managerEmployeeKey?: string;
  managerImportRowNumber?: number;
  noManager?: boolean;
  keepAsDistinctRow?: number;
  useBaselineForWorkDates?: boolean;
}

export interface WorkforceImportProblem {
  kind: "rejected" | "conflict" | "concurrency" | "not-found" | "access-denied" | "temporary";
  code: string | null;
  message: string;
}

const base = "/corehr/employees/import";
export const coreWorkforceImportPaths = {
  template: () => `${base}/template`,
  active: () => `${base}/active`,
  session: (id: string) => `${base}/${id}`,
  intake: () => `${base}/intake`,
  header: (id: string) => `${base}/${id}/header`,
  baseline: (id: string) => `${base}/${id}/baseline`,
  match: (id: string) => `${base}/${id}/match`,
  runSemanticAssistance: (id: string) => `${base}/${id}/semantic-assistance/run`,
  refresh: (id: string) => `${base}/${id}/refresh`,
  review: (id: string) => `${base}/${id}/review`,
  resolutions: (id: string) => `${base}/${id}/review/resolutions`,
  managerCandidates: (id: string) => `${base}/${id}/manager-candidates`,
  discard: (id: string) => `${base}/${id}/discard`,
  commit: (id: string) => `${base}/${id}/commit`,
} as const;

export const coreWorkforceImportQueryKeys = {
  all: () => ["coreWorkforceImport"] as const,
  active: () => [...coreWorkforceImportQueryKeys.all(), "active"] as const,
  session: (id: string) => [...coreWorkforceImportQueryKeys.all(), "session", id] as const,
  review: (id: string, filter: string, query: string, page: number) =>
    [...coreWorkforceImportQueryKeys.all(), "review", id, filter, query, page] as const,
  managerCandidates: (id: string, reference: string, query: string) =>
    [...coreWorkforceImportQueryKeys.all(), "managerCandidates", id, reference, query] as const,
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
        : code === "ProposalChanged" || code === "NotPublishable"
          ? "conflict"
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
    downloadTemplate: (signal?: AbortSignal) =>
      client.get<Blob>(coreWorkforceImportPaths.template(), { responseType: "blob", signal }),
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
    updateMatch: (id: string, version: number, change: WorkforceMatchUpdateRequest) =>
      client.put<WorkforceImportSessionDto>(coreWorkforceImportPaths.match(id), change, ifMatch(version)),
    runSemanticAssistance: (id: string, inputFingerprint: string, grantTenantConsent = false) =>
      client.post<WorkforceImportSessionDto>(coreWorkforceImportPaths.runSemanticAssistance(id), {
        inputFingerprint,
        grantTenantConsent,
      }),
    refresh: (id: string, version: number) =>
      client.post<WorkforceImportSessionDto>(coreWorkforceImportPaths.refresh(id), undefined, ifMatch(version)),
    review: (
      id: string,
      params: { filter?: WorkforceReviewFilter; query?: string; page?: number; pageSize?: number },
      signal?: AbortSignal
    ) => client.get<WorkforceReviewPageDto>(coreWorkforceImportPaths.review(id), { params, signal }),
    updateResolutions: (id: string, version: number, resolution: WorkforceResolutionsUpdateRequest) =>
      client.put<WorkforceReviewSummaryDto>(coreWorkforceImportPaths.resolutions(id), resolution, ifMatch(version)),
    managerCandidates: (id: string, params: { reference?: string; query?: string }, signal?: AbortSignal) =>
      client.get<WorkforceManagerCandidateDto[]>(coreWorkforceImportPaths.managerCandidates(id), { params, signal }),
    discard: (id: string, version: number) =>
      client.post<void>(coreWorkforceImportPaths.discard(id), undefined, ifMatch(version)),
    /** Publish exactly the reviewed proposal. */
    commit: (id: string, version: number, proposalFingerprint: string) =>
      client.post<WorkforceApplyStatusDto>(coreWorkforceImportPaths.commit(id), { proposalFingerprint }, ifMatch(version)),
    commitStatus: (id: string, signal?: AbortSignal) =>
      client.get<WorkforceApplyStatusDto>(coreWorkforceImportPaths.commit(id), { signal }),
  };
}
