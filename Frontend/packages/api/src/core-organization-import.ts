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
  status: "Active" | "Discarded";
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
  };
}
