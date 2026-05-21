import { createPlatformApiClient, ApiError } from "@repo/api";
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
import type { SessionQrCode } from "@/types";
import type { BackendSessionQrCodeDto } from "@/types/backend-dtos";

const client = createPlatformApiClient();

function mapSessionQrCode(dto: BackendSessionQrCodeDto): SessionQrCode {
  return {
    sessionId: dto.sessionId,
    payload: dto.payload,
    rotationSeconds: dto.rotationSeconds,
    issuedAt: dto.issuedAt,
    refreshAt: dto.refreshAt,
    expiresAt: dto.expiresAt,
    isRevoked: dto.isRevoked,
  };
}

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

export async function togglePartLock(trainingId: string, partId: string, lock: boolean): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/parts/${encodeURIComponent(partId)}/lock`, { lock });
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

// --- Participant exports ---

export async function exportSessionParticipantsExcel(sessionId: string): Promise<Blob> {
  return client.get<Blob>(
    `/training/admin/sessions/${encodeURIComponent(sessionId)}/export/excel`,
    { responseType: "blob" },
  );
}

export async function exportSessionParticipantsPdf(sessionId: string): Promise<Blob> {
  return client.get<Blob>(
    `/training/admin/sessions/${encodeURIComponent(sessionId)}/export/pdf`,
    { responseType: "blob" },
  );
}

// --- Attendance ---

export async function markAttendance(sessionId: string, employeeId: string): Promise<void> {
  await client.post("/training/session-enrollments/mark-attendance", {
    sessionId,
    employeeId,
  });
}

// --- QR code attendance (US-5.3.1) ---

export async function generateSessionQrCode(
  sessionId: string,
  regenerate = false,
): Promise<SessionQrCode> {
  const dto = await client.post<BackendSessionQrCodeDto>(
    `/training/admin/sessions/${encodeURIComponent(sessionId)}/qr-code`,
    { regenerate },
  );
  return mapSessionQrCode(dto);
}

export async function getSessionQrCode(sessionId: string): Promise<SessionQrCode | null> {
  try {
    const dto = await client.get<BackendSessionQrCodeDto>(
      `/training/admin/sessions/${encodeURIComponent(sessionId)}/qr-code`,
    );
    return mapSessionQrCode(dto);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function revokeSessionQrCode(sessionId: string): Promise<void> {
  await client.delete(`/training/admin/sessions/${encodeURIComponent(sessionId)}/qr-code`);
}
