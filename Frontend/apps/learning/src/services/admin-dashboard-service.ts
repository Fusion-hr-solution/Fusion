import type {
  AdminEmployeeProfile,
  UpsertEmployeeProfileInput,
  IdentityUser,
  ProgrammeMatrix,
  CompletionByGrade,
  CompletionByServiceLine,
  CompletionTrend,
  CellEmployee,
} from "@/types/admin";
import { client } from "./admin-service-mappers";

// --- Employee Profiles ---

interface BackendPagedEmployeeProfiles {
  items: AdminEmployeeProfile[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function getEmployeeProfiles(page = 1, pageSize = 20): Promise<BackendPagedEmployeeProfiles> {
  return client.get<BackendPagedEmployeeProfiles>(`/training/admin/employee-profiles?page=${page}&pageSize=${pageSize}`);
}

export async function upsertEmployeeProfile(employeeId: string, input: UpsertEmployeeProfileInput): Promise<void> {
  await client.put("/training/admin/employee-profiles/" + encodeURIComponent(employeeId), input);
}

// --- Identity Users ---

export async function getIdentityUsers(): Promise<IdentityUser[]> {
  return client.get<IdentityUser[]>("/identity/users");
}

// --- Programme Dashboard ---

export async function getProgrammeMatrix(): Promise<ProgrammeMatrix> {
  return client.get<ProgrammeMatrix>("/training/admin/dashboard/programme-matrix");
}

export async function getCompletionByGrade(): Promise<CompletionByGrade[]> {
  return client.get<CompletionByGrade[]>("/training/admin/dashboard/completion-by-grade");
}

export async function getCompletionByServiceLine(): Promise<CompletionByServiceLine[]> {
  return client.get<CompletionByServiceLine[]>("/training/admin/dashboard/completion-by-service-line");
}

export async function getCompletionTrend(): Promise<CompletionTrend> {
  return client.get<CompletionTrend>("/training/admin/dashboard/completion-trend");
}

export async function getCellEmployees(gradeId: string, serviceLineId: string): Promise<CellEmployee[]> {
  return client.get<CellEmployee[]>(`/training/admin/dashboard/cell-employees?gradeId=${encodeURIComponent(gradeId)}&serviceLineId=${encodeURIComponent(serviceLineId)}`);
}
