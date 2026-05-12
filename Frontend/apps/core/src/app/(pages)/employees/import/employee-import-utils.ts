import { ApiError } from "@repo/api";
import type { EmployeeImportSessionDto } from "./employee-import.types";

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.errors.join(", ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export function getPreviewDescription(session: EmployeeImportSessionDto) {
  if (session.stage === "Applied") {
    return "Open the applied batch preview only if you need to double-check the normalized rows that were created.";
  }

  if (
    session.stage === "Validated" &&
    session.validationSummary.errorCount > 0
  ) {
    return "Use the normalized preview to inspect the rows that need to be fixed in the source CSV.";
  }

  if (session.stage === "Validated") {
    return "This is the normalized view of the validated batch.";
  }

  if (session.stage === "Expired") {
    return "This is the last normalized preview from the expired batch.";
  }

  return "Review the normalized preview, then validate the batch.";
}
