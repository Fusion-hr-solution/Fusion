/**
 * Triggers a browser download for an arbitrary blob.
 * Used by export endpoints that return binary content (xlsx, pdf, csv, …).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revocation so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
