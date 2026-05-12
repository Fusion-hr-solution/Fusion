import { createPlatformApiClient } from "@repo/api";
import type {
  AvailableSessionsForEnrollment,
  EnrollInSessionsResult,
  MySessionEnrollments,
  SessionSelection,
  EnrollmentStatus,
  MyEnrollmentSummary,
} from "@/types";
import type {
  BackendAvailableSessionsForEnrollmentDto,
  BackendEnrollInSessionsResultDto,
  BackendMySessionEnrollmentsDto,
  BackendMyEnrollmentSummaryDto,
} from "@/types/backend-dtos";

const client = createPlatformApiClient();

function mapEnrollmentStatus(status: string): EnrollmentStatus {
  switch (status) {
    case "Enrolled":
      return "Enrolled";
    case "Waitlisted":
      return "Waitlisted";
    case "Cancelled":
      return "Cancelled";
    case "Attended":
      return "Attended";
    default:
      return "NotEnrolled";
  }
}

function mapAvailableSessions(dto: BackendAvailableSessionsForEnrollmentDto): AvailableSessionsForEnrollment {
  return {
    trainingId: dto.trainingId,
    trainingTitle: dto.trainingTitle,
    parts: dto.parts
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((p) => ({
        partId: p.partId,
        title: p.title,
        description: p.description,
        orderIndex: p.orderIndex,
        durationHours: p.durationHours,
        sessions: p.sessions.map((s) => ({
          sessionId: s.sessionId,
          startUtc: s.startUtc,
          endUtc: s.endUtc,
          room: s.room,
          trainerName: s.trainerName,
          trainerEmail: s.trainerEmail,
          maxCapacity: s.maxCapacity,
          enrolledCount: s.enrolledCount,
          availableSpots: s.availableSpots,
          isFull: s.isFull,
          status: s.status,
        })),
      })),
  };
}

function mapMyEnrollments(dto: BackendMySessionEnrollmentsDto): MySessionEnrollments {
  return {
    trainingId: dto.trainingId,
    trainingTitle: dto.trainingTitle,
    totalParts: dto.totalParts,
    completedParts: dto.completedParts,
    isTrainingCompleted: dto.isTrainingCompleted,
    parts: dto.parts
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((p) => ({
        partId: p.partId,
        partTitle: p.partTitle,
        orderIndex: p.orderIndex,
        sessionId: p.sessionId,
        sessionStartUtc: p.sessionStartUtc,
        sessionEndUtc: p.sessionEndUtc,
        room: p.room,
        trainerName: p.trainerName,
        enrollmentStatus: mapEnrollmentStatus(p.enrollmentStatus),
        isAttended: p.isAttended,
      })),
  };
}

function mapEnrollResult(dto: BackendEnrollInSessionsResultDto): EnrollInSessionsResult {
  return {
    trainingId: dto.trainingId,
    enrollments: dto.enrollments.map((e) => ({
      partId: e.partId,
      sessionId: e.sessionId,
      enrollmentId: e.enrollmentId,
      status: mapEnrollmentStatus(e.status),
      waitlistPosition: e.waitlistPosition,
    })),
  };
}

export async function getAvailableSessionsForEnrollment(
  trainingId: string,
): Promise<AvailableSessionsForEnrollment> {
  const dto = await client.get<BackendAvailableSessionsForEnrollmentDto>(
    `/training/session-enrollments/available/${encodeURIComponent(trainingId)}`,
  );
  return mapAvailableSessions(dto);
}

export async function enrollInSessions(
  trainingId: string,
  selections: SessionSelection[],
): Promise<EnrollInSessionsResult> {
  const dto = await client.post<BackendEnrollInSessionsResultDto>(
    "/training/session-enrollments",
    { trainingId, selections },
  );
  return mapEnrollResult(dto);
}

export async function getMySessionEnrollments(
  trainingId: string,
): Promise<MySessionEnrollments> {
  const dto = await client.get<BackendMySessionEnrollmentsDto>(
    `/training/session-enrollments/my/${encodeURIComponent(trainingId)}`,
  );
  return mapMyEnrollments(dto);
}

export async function cancelSessionEnrollment(sessionId: string): Promise<void> {
  await client.post("/training/session-enrollments/cancel", { sessionId });
}

export async function getAllMyEnrollments(): Promise<MyEnrollmentSummary[]> {
  const dtos = await client.get<BackendMyEnrollmentSummaryDto[]>(
    "/training/session-enrollments/my",
  );
  return dtos.map((dto) => ({
    trainingId: dto.trainingId,
    trainingTitle: dto.trainingTitle,
    totalEnrolledParts: dto.totalEnrolledParts,
    nextSessionUtc: dto.nextSessionUtc,
    sessions: dto.sessions.map((s) => ({
      enrollmentId: s.enrollmentId,
      sessionId: s.sessionId,
      partId: s.partId,
      partTitle: s.partTitle,
      partOrderIndex: s.partOrderIndex,
      startUtc: s.startUtc,
      endUtc: s.endUtc,
      room: s.room,
      trainerName: s.trainerName,
      trainerEmail: s.trainerEmail,
      status: mapEnrollmentStatus(s.status),
      waitlistPosition: s.waitlistPosition,
      maxCapacity: s.maxCapacity,
      enrolledAt: s.enrolledAt,
    })),
  }));
}
