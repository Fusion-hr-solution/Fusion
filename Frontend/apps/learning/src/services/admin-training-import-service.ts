import type { TrainingImportPreview } from "@/types/admin";
import { client } from "./admin-service-mappers";

const BASE = "/training/admin/imports/trainings";

/** US-8.2.4 — download the pre-formatted .xlsx import template. */
export async function downloadImportTemplate(): Promise<Blob> {
  return client.get<Blob>(`${BASE}/template`, { responseType: "blob" });
}

/** US-8.2.3 — upload a workbook; returns a validated preview + a staged session id. */
export async function uploadTrainingImport(file: File): Promise<TrainingImportPreview> {
  const form = new FormData();
  form.append("file", file);
  return client.post<TrainingImportPreview>(BASE, form);
}

/** US-8.2.3 — re-read a staged import preview by session id. */
export async function getTrainingImportPreview(sessionId: string): Promise<TrainingImportPreview> {
  return client.get<TrainingImportPreview>(`${BASE}/${encodeURIComponent(sessionId)}`);
}
