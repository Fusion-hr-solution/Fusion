import type {
  AdminCategory,
  AdminGrade,
  AdminServiceLine,
  AdminCurriculumMatrix,
  AdminCurriculumMapping,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateGradeInput,
  UpdateGradeInput,
  CreateServiceLineInput,
  UpdateServiceLineInput,
  AddCurriculumMappingInput,
  BulkAssignCurriculumInput,
  ReorderCurriculumCellInput,
} from "@/types/admin";
import type { BackendTrainingCategoryDto } from "@/types/backend-dtos";
import { client, mapCategory } from "./admin-service-mappers";

// --- Category CRUD ---

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const data = await client.get<BackendTrainingCategoryDto[]>("/training/admin/categories");
  return data.map(mapCategory);
}

export async function createCategory(input: CreateCategoryInput): Promise<string> {
  return client.post<string>("/training/admin/categories", input);
}

export async function updateCategory(categoryId: string, input: UpdateCategoryInput): Promise<void> {
  await client.put("/training/admin/categories/" + encodeURIComponent(categoryId), input);
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await client.delete("/training/admin/categories/" + encodeURIComponent(categoryId));
}

// --- Grade CRUD ---

export async function getGrades(): Promise<AdminGrade[]> {
  return client.get<AdminGrade[]>("/training/admin/grades");
}

export async function createGrade(input: CreateGradeInput): Promise<string> {
  return client.post<string>("/training/admin/grades", input);
}

export async function updateGrade(gradeId: string, input: UpdateGradeInput): Promise<void> {
  await client.put("/training/admin/grades/" + encodeURIComponent(gradeId), input);
}

export async function deleteGrade(gradeId: string): Promise<void> {
  await client.delete("/training/admin/grades/" + encodeURIComponent(gradeId));
}

// --- Service Line CRUD ---

export async function getServiceLines(): Promise<AdminServiceLine[]> {
  return client.get<AdminServiceLine[]>("/training/admin/service-lines");
}

export async function createServiceLine(input: CreateServiceLineInput): Promise<string> {
  return client.post<string>("/training/admin/service-lines", input);
}

export async function updateServiceLine(serviceLineId: string, input: UpdateServiceLineInput): Promise<void> {
  await client.put("/training/admin/service-lines/" + encodeURIComponent(serviceLineId), input);
}

export async function deleteServiceLine(serviceLineId: string): Promise<void> {
  await client.delete("/training/admin/service-lines/" + encodeURIComponent(serviceLineId));
}

// --- Curriculum ---

export async function getCurriculumMatrix(): Promise<AdminCurriculumMatrix> {
  return client.get<AdminCurriculumMatrix>("/training/admin/curriculum/matrix");
}

export async function getCurriculumCell(gradeId: string, serviceLineId: string): Promise<AdminCurriculumMapping[]> {
  return client.get<AdminCurriculumMapping[]>(`/training/admin/curriculum?gradeId=${encodeURIComponent(gradeId)}&serviceLineId=${encodeURIComponent(serviceLineId)}`);
}

export async function addCurriculumMapping(input: AddCurriculumMappingInput): Promise<string> {
  return client.post<string>("/training/admin/curriculum", input);
}

export async function updateCurriculumMapping(mappingId: string, isRequired: boolean): Promise<void> {
  await client.put("/training/admin/curriculum/" + encodeURIComponent(mappingId), { isRequired });
}

export async function removeCurriculumMapping(mappingId: string): Promise<void> {
  await client.delete("/training/admin/curriculum/" + encodeURIComponent(mappingId));
}

export async function reorderCurriculumCell(input: ReorderCurriculumCellInput): Promise<void> {
  await client.put("/training/admin/curriculum/cell/reorder", input);
}

export async function bulkAssignCurriculum(input: BulkAssignCurriculumInput): Promise<number> {
  return client.post<number>("/training/admin/curriculum/bulk", input);
}
