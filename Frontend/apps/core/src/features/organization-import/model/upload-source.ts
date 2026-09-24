import type { OrganizationImportProblem } from "@repo/api";

/**
 * Upload's own logic: source-level checks only. Whether the file's columns, types or
 * hierarchy make sense is Match's and Review's business. A readable table with
 * unfamiliar headers always leaves Upload.
 */

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = [".xlsx", ".csv"] as const;

/** Stable Upload failure categories; the UI branches on these, never on backend prose. */
export type UploadProblemCategory =
  | "UnsupportedFileType"
  | "UnreadableSource"
  | "EmptySource"
  | "NoUsableTable"
  | "SourceTooLarge"
  | "InvalidEffectiveDate"
  | "SourceConflict"
  | "PermissionDenied"
  | "IntakeFailed";

export type UploadProblem = {
  category: UploadProblemCategory;
  message: string;
  /** Transient: the same file may be submitted again. Otherwise the file must change. */
  retryable: boolean;
};

const CATEGORY_BY_CODE: Record<string, UploadProblemCategory> = {
  UnsupportedFormat: "UnsupportedFileType",
  SignatureMismatch: "UnsupportedFileType",
  Unreadable: "UnreadableSource",
  PasswordProtected: "UnreadableSource",
  UnsafeWorkbookContent: "UnreadableSource",
  InvalidSheetSelection: "UnreadableSource",
  Empty: "EmptySource",
  NoUsableTable: "NoUsableTable",
  FileTooLarge: "SourceTooLarge",
  RowLimitExceeded: "SourceTooLarge",
  ColumnLimitExceeded: "SourceTooLarge",
  CellLimitExceeded: "SourceTooLarge",
  TextLimitExceeded: "SourceTooLarge",
  PackageLimitExceeded: "SourceTooLarge",
  IdempotencyConflict: "SourceConflict",
};

const FALLBACK_MESSAGE: Record<UploadProblemCategory, string> = {
  UnsupportedFileType: "Choose an XLSX or CSV file.",
  UnreadableSource: "Fusion could not read this file.",
  EmptySource: "This file has no rows to import.",
  NoUsableTable: "This file doesn’t contain a table Fusion can read.",
  SourceTooLarge: "This file is larger than the 10 MB limit.",
  InvalidEffectiveDate: "Choose a valid effective date.",
  SourceConflict: "This file changed while it was being uploaded. Choose it again.",
  PermissionDenied: "You no longer have permission to import Organization structure.",
  IntakeFailed: "Fusion couldn’t start the import right now.",
};

function problem(category: UploadProblemCategory, message?: string | null): UploadProblem {
  return {
    category,
    message: message?.trim() || FALLBACK_MESSAGE[category],
    retryable: category === "IntakeFailed",
  };
}

/** Checks Fusion can make before sending anything: extension and size. */
export function checkLocalSource(file: File): UploadProblem | null {
  const name = file.name.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension)))
    return problem("UnsupportedFileType");
  if (file.size === 0) return problem("EmptySource", "The selected file is empty.");
  if (file.size > MAX_SOURCE_BYTES) return problem("SourceTooLarge");
  return null;
}

/** Maps an intake failure onto Upload's categories by its stable code or HTTP class. */
export function classifyIntakeProblem(error: OrganizationImportProblem): UploadProblem {
  const category = error.code ? CATEGORY_BY_CODE[error.code] : undefined;
  if (category)
    // Source defects carry specific server wording; a conflict gets Fusion's own.
    return problem(category, category === "SourceConflict" ? null : error.message);
  if (error.kind === "access-denied") return problem("PermissionDenied");
  if (error.kind === "rejected") return problem("UnreadableSource", error.message);
  return problem("IntakeFailed");
}

export function isValidEffectiveDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function sourceKind(fileName: string): "xlsx" | "csv" | "other" {
  const name = fileName.toLowerCase();
  if (name.endsWith(".xlsx")) return "xlsx";
  if (name.endsWith(".csv")) return "csv";
  return "other";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Modified today at 10:24 AM", "Modified yesterday at …", or "Modified 1 Sep 2027". */
export function formatModified(lastModified: number, now = new Date()) {
  const date = new Date(lastModified);
  if (!lastModified || Number.isNaN(date.getTime())) return null;
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (date.getTime() >= startOfToday && date.getTime() < startOfToday + dayMs)
    return `Modified today at ${time}`;
  if (date.getTime() >= startOfToday - dayMs && date.getTime() < startOfToday)
    return `Modified yesterday at ${time}`;
  return `Modified ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}
