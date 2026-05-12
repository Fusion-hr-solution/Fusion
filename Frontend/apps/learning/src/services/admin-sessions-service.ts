import { createPlatformApiClient } from "@repo/api";
import type {
  AdminTrainingPart,
  AdminSessionListItem,
  AdminSessionDetail,
  CreatePartInput,
  UpdatePartInput,
  CreateSessionInput,
  UpdateSessionInput,
  CancelSessionInput,
  DuplicateSessionInput,
  RoomConflict,
  SessionsListFilters,
} from "@/types/admin";

const client = createPlatformApiClient();

interface BackendPagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface BackendAddSessionResult {
  sessionId: string;
  roomConflicts: RoomConflict[];
}

interface BackendUpdateSessionResult {
  roomConflicts: RoomConflict[];
}

interface BackendDuplicateSessionResult {
  createdSessionIds: string[];
  roomConflicts: RoomConflict[];
}

// --- Parts ---

export async function getPartsForTraining(trainingId: string): Promise<AdminTrainingPart[]> {
  return client.get<AdminTrainingPart[]>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/parts`);
}

export async function addPart(trainingId: string, input: CreatePartInput): Promise<string> {
  return client.post<string>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/parts`, input);
}

export async function updatePart(trainingId: string, partId: string, input: UpdatePartInput): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/parts/${encodeURIComponent(partId)}`, input);
}

export async function deletePart(trainingId: string, partId: string): Promise<void> {
  await client.delete(`/training/admin/trainings/${encodeURIComponent(trainingId)}/parts/${encodeURIComponent(partId)}`);
}

export async function reorderParts(trainingId: string, partIds: string[]): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/parts/reorder`, { partIds });
}

// --- Sessions ---

export async function getSessions(filters: SessionsListFilters = {}): Promise<BackendPagedResponse<AdminSessionListItem>> {
  const params: Record<string, string | number | boolean | null | undefined> = { ...filters };
  return client.get<BackendPagedResponse<AdminSessionListItem>>("/training/admin/sessions", { params });
}

export async function getSessionDetail(sessionId: string): Promise<AdminSessionDetail> {
  return client.get<AdminSessionDetail>(`/training/admin/sessions/${encodeURIComponent(sessionId)}`);
}

export async function addSession(
  trainingId: string,
  partId: string,
  input: CreateSessionInput,
): Promise<BackendAddSessionResult> {
  return client.post<BackendAddSessionResult>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/parts/${encodeURIComponent(partId)}/sessions`,
    input,
  );
}

export async function updateSession(sessionId: string, input: UpdateSessionInput): Promise<BackendUpdateSessionResult> {
  return client.put<BackendUpdateSessionResult>(`/training/admin/sessions/${encodeURIComponent(sessionId)}`, input);
}

export async function cancelSession(sessionId: string, input: CancelSessionInput): Promise<void> {
  await client.post(`/training/admin/sessions/${encodeURIComponent(sessionId)}/cancel`, input);
}

export async function duplicateSession(
  sessionId: string,
  input: DuplicateSessionInput,
): Promise<BackendDuplicateSessionResult> {
  return client.post<BackendDuplicateSessionResult>(
    `/training/admin/sessions/${encodeURIComponent(sessionId)}/duplicate`,
    input,
  );
}

export async function detectRoomConflicts(params: {
  room: string;
  startUtc: string;
  endUtc: string;
  excludeSessionId?: string;
}): Promise<RoomConflict[]> {
  return client.get<RoomConflict[]>("/training/admin/sessions/conflicts", { params });
}
