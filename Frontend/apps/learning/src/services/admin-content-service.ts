import type { BackfillPdfTextResult } from "@/types/admin";
import { client } from "./admin-service-mappers";

/**
 * One-time, idempotent: extract and store text for existing uploaded PDFs that have none yet, so the AI
 * quiz generator can use them (US-8.2.5). Returns scanned / updated / skipped counts.
 */
export async function backfillPdfText(): Promise<BackfillPdfTextResult> {
  return client.post<BackfillPdfTextResult>("/training/admin/content/backfill-pdf-text", {});
}
