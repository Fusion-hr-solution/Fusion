import { formatDateParts, formatTime } from "@repo/ds/lib/dates";
import { englishSay, type Say } from "@repo/ds/lib/say";
import { englishMessages } from "@/i18n/messages";

/** The shape every import domain's error translation produces. */
export type IntakeProblemInput = { kind: string; code: string | null; message: string };

/**
 * Upload's own logic, shared by every import domain: source-level checks only. Whether the file's columns, types or
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

/**
 * How Upload words a problem: the `dataImport` namespace, and whether the server's own wording may be shown (it is
 * written in English). English by default.
 */
export type UploadWords = { say: Say; english: boolean };

const ENGLISH: UploadWords = { say: englishSay(englishMessages, "dataImport"), english: true };

function problem(category: UploadProblemCategory, words: UploadWords, message?: string | null): UploadProblem {
  return {
    category,
    message: (words.english ? message?.trim() : null) || words.say(`problems.${category}`),
    retryable: category === "IntakeFailed",
  };
}

/** Checks Fusion can make before sending anything: extension and size. */
export function checkLocalSource(file: File, words: UploadWords = ENGLISH): UploadProblem | null {
  const name = file.name.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension)))
    return problem("UnsupportedFileType", words);
  if (file.size === 0) return { ...problem("EmptySource", words), message: words.say("problems.emptyFile") };
  if (file.size > MAX_SOURCE_BYTES) return problem("SourceTooLarge", words);
  return null;
}

/** Maps an intake failure onto Upload's categories by its stable code or HTTP class. */
export function classifyIntakeProblem(error: IntakeProblemInput, words: UploadWords = ENGLISH): UploadProblem {
  const category = error.code ? CATEGORY_BY_CODE[error.code] : undefined;
  if (category)
    // Source defects carry specific server wording; a conflict gets Fusion's own.
    return problem(category, words, category === "SourceConflict" ? null : error.message);
  if (error.kind === "access-denied") return problem("PermissionDenied", words);
  if (error.kind === "rejected") return problem("UnreadableSource", words, error.message);
  return problem("IntakeFailed", words);
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

/** "Modified today at 10:24", "Modified yesterday at …", or "Modified 1 Sept 2027". */
export function formatModified(lastModified: number, now = new Date(), say: Say = ENGLISH.say, locale?: string) {
  const date = new Date(lastModified);
  if (!lastModified || Number.isNaN(date.getTime())) return null;
  const time = formatTime(date, undefined, locale);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (date.getTime() >= startOfToday && date.getTime() < startOfToday + dayMs)
    return say("modified.today", { time });
  if (date.getTime() >= startOfToday - dayMs && date.getTime() < startOfToday)
    return say("modified.yesterday", { time });
  return say("modified.on", { date: formatDateParts(date, { day: "numeric", month: "short", year: "numeric" }, undefined, locale) });
}
