import type {
  SessionAttendance,
  EmployeeAttendanceHistory,
  AttendanceByGrade,
  AttendanceTrend,
  AttendanceHeatmap,
  AttendanceSummary,
  AttendanceFilters,
} from "@/types/admin";
import { client } from "./admin-service-mappers";

const BASE = "/training/admin/attendance";

/** Serialize the optional dimensional filters into a query string. */
function buildFilterQuery(filters: AttendanceFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.gradeId) params.set("gradeId", filters.gradeId);
  if (filters.serviceLineId) params.set("serviceLineId", filters.serviceLineId);
  if (filters.trainingId) params.set("trainingId", filters.trainingId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// --- AC#1 Per-session ---

export async function getSessionAttendance(sessionId: string): Promise<SessionAttendance> {
  return client.get<SessionAttendance>(`${BASE}/sessions/${encodeURIComponent(sessionId)}`);
}

// --- AC#2 Per-employee ---

export async function getEmployeeAttendanceHistory(
  employeeId: string,
  range: { from?: string; to?: string } = {},
): Promise<EmployeeAttendanceHistory> {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const qs = params.toString();
  return client.get<EmployeeAttendanceHistory>(
    `${BASE}/employees/${encodeURIComponent(employeeId)}${qs ? `?${qs}` : ""}`,
  );
}

// --- AC#3 Aggregations ---

export async function getAttendanceByGrade(filters: AttendanceFilters = {}): Promise<AttendanceByGrade[]> {
  return client.get<AttendanceByGrade[]>(`${BASE}/by-grade${buildFilterQuery(filters)}`);
}

export async function getAttendanceTrend(filters: AttendanceFilters = {}): Promise<AttendanceTrend> {
  return client.get<AttendanceTrend>(`${BASE}/trend${buildFilterQuery(filters)}`);
}

export async function getAttendanceHeatmap(filters: AttendanceFilters = {}): Promise<AttendanceHeatmap> {
  return client.get<AttendanceHeatmap>(`${BASE}/heatmap${buildFilterQuery(filters)}`);
}

export async function getAttendanceSummary(filters: AttendanceFilters = {}): Promise<AttendanceSummary> {
  return client.get<AttendanceSummary>(`${BASE}/summary${buildFilterQuery(filters)}`);
}
