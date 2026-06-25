import type {
  AttendanceByEmployeeRow,
  TrainingHoursRow,
  FormatComparison,
  AttendanceFilters,
  ReportFilterLabels,
} from "@/types/admin";
import { client } from "./admin-service-mappers";

const BASE = "/training/admin/reports";

/** Serialize the optional report filters (and, for exports, their display labels) into a query string. */
function buildQuery(filters: AttendanceFilters = {}, labels?: ReportFilterLabels): string {
  const params = new URLSearchParams();
  if (filters.gradeId) params.set("gradeId", filters.gradeId);
  if (filters.serviceLineId) params.set("serviceLineId", filters.serviceLineId);
  if (filters.trainingId) params.set("trainingId", filters.trainingId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (labels?.gradeLabel) params.set("gradeLabel", labels.gradeLabel);
  if (labels?.serviceLineLabel) params.set("serviceLineLabel", labels.serviceLineLabel);
  if (labels?.trainingLabel) params.set("trainingLabel", labels.trainingLabel);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ── US-8.2.1 Attendance report ───────────────────────────────────────────────

export async function getAttendanceByEmployee(
  filters: AttendanceFilters = {},
): Promise<AttendanceByEmployeeRow[]> {
  return client.get<AttendanceByEmployeeRow[]>(`${BASE}/attendance/by-employee${buildQuery(filters)}`);
}

export async function exportAttendanceByEmployeeExcel(
  filters: AttendanceFilters = {},
  labels?: ReportFilterLabels,
): Promise<Blob> {
  return client.get<Blob>(`${BASE}/attendance/by-employee/excel${buildQuery(filters, labels)}`, {
    responseType: "blob",
  });
}

// ── US-8.2.1 Training-hours report ───────────────────────────────────────────

export async function getTrainingHoursByEmployee(
  filters: AttendanceFilters = {},
): Promise<TrainingHoursRow[]> {
  return client.get<TrainingHoursRow[]>(`${BASE}/hours/by-employee${buildQuery(filters)}`);
}

export async function exportTrainingHoursByEmployeeExcel(
  filters: AttendanceFilters = {},
  labels?: ReportFilterLabels,
): Promise<Blob> {
  return client.get<Blob>(`${BASE}/hours/by-employee/excel${buildQuery(filters, labels)}`, {
    responseType: "blob",
  });
}

// ── US-8.2.2 In-person vs e-learning comparison ──────────────────────────────

export async function getCompletionByFormat(
  filters: AttendanceFilters = {},
): Promise<FormatComparison> {
  return client.get<FormatComparison>(`${BASE}/completion/by-format${buildQuery(filters)}`);
}

export async function exportCompletionByFormatExcel(
  filters: AttendanceFilters = {},
  labels?: ReportFilterLabels,
): Promise<Blob> {
  return client.get<Blob>(`${BASE}/completion/by-format/excel${buildQuery(filters, labels)}`, {
    responseType: "blob",
  });
}
