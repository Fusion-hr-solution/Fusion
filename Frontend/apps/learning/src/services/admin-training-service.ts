import type {
  AdminTraining,
  AdminTrainingDetail,
  AdminAssignment,
  ArticleTemplate,
  CreateTrainingInput,
  UpdateTrainingInput,
  CreateChapterInput,
  UpdateChapterInput,
  CreateContentBlockInput,
  UpdateContentBlockInput,
  AssignTrainingInput,
  CreateOnSiteCourseInput,
} from "@/types/admin";
import type {
  BackendAdminTrainingDto,
  BackendAdminTrainingDetailDto,
  BackendAssignmentDto,
  BackendPagedResponse,
  BackendArticleTemplateDto,
} from "@/types/backend-dtos";
import { client, mapTraining, mapTrainingDetail, mapAssignment, normalizeChapterPayload } from "./admin-service-mappers";

// --- Training CRUD ---

export async function getAdminTrainings(params?: {
  categoryId?: string;
  search?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ trainings: AdminTraining[]; totalCount: number; page: number; pageSize: number }> {
  const data = await client.get<BackendPagedResponse<BackendAdminTrainingDto>>("/training/admin/trainings", { params });
  return { trainings: data.items.map(mapTraining), totalCount: data.totalCount, page: data.page, pageSize: data.pageSize };
}

export async function getAdminTrainingDetail(trainingId: string): Promise<AdminTrainingDetail> {
  const data = await client.get<BackendAdminTrainingDetailDto>(`/training/admin/trainings/${encodeURIComponent(trainingId)}`);
  return mapTrainingDetail(data);
}

export async function createTraining(input: CreateTrainingInput): Promise<string> {
  return client.post<string>("/training/admin/trainings", input);
}

export async function updateTraining(trainingId: string, input: UpdateTrainingInput): Promise<void> {
  await client.put("/training/admin/trainings/" + encodeURIComponent(trainingId), input);
}

export async function deleteTraining(trainingId: string): Promise<void> {
  await client.delete("/training/admin/trainings/" + encodeURIComponent(trainingId));
}

// --- Chapter CRUD ---

export async function addChapter(trainingId: string, input: CreateChapterInput): Promise<string> {
  return client.post<string>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters`, normalizeChapterPayload(input));
}

export async function updateChapter(trainingId: string, chapterId: string, input: UpdateChapterInput): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}`, { title: input.title, layout: input.layout ?? "SingleContent" });
}

export async function deleteChapter(trainingId: string, chapterId: string): Promise<void> {
  await client.delete(`/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}`);
}

export async function reorderChapters(trainingId: string, chapterIds: string[]): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/reorder`, { chapterIds });
}

// --- Content Block CRUD ---

export async function addContentBlock(trainingId: string, chapterId: string, input: CreateContentBlockInput): Promise<string> {
  return client.post<string>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks`, input);
}

export async function updateContentBlock(trainingId: string, chapterId: string, contentBlockId: string, input: UpdateContentBlockInput): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/${encodeURIComponent(contentBlockId)}`, input);
}

export async function deleteContentBlock(trainingId: string, chapterId: string, contentBlockId: string): Promise<void> {
  await client.delete(`/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/${encodeURIComponent(contentBlockId)}`);
}

export async function reorderContentBlocks(trainingId: string, chapterId: string, contentBlockIds: string[]): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/reorder`, { contentBlockIds });
}

// --- File upload ---

export async function uploadChapterFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  return client.post<string>("/training/admin/uploads", form);
}

// --- On-Site Course CRUD ---

export async function addOnSiteCourse(trainingId: string, input: CreateOnSiteCourseInput): Promise<string> {
  return client.post<string>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/onsite-courses`, input);
}

export async function updateOnSiteCourse(trainingId: string, courseId: string, input: CreateOnSiteCourseInput): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/onsite-courses/${encodeURIComponent(courseId)}`, input);
}

export async function deleteOnSiteCourse(trainingId: string, courseId: string): Promise<void> {
  await client.delete(`/training/admin/trainings/${encodeURIComponent(trainingId)}/onsite-courses/${encodeURIComponent(courseId)}`);
}

export async function reorderOnSiteCourses(trainingId: string, courseIds: string[]): Promise<void> {
  await client.put(`/training/admin/trainings/${encodeURIComponent(trainingId)}/onsite-courses/reorder`, { courseIds });
}

// --- Assignment management ---

export async function getTrainingAssignments(trainingId: string): Promise<AdminAssignment[]> {
  return client.get<BackendAssignmentDto[]>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/assignments`).then((data) => data.map(mapAssignment));
}

export async function assignTraining(trainingId: string, input: AssignTrainingInput): Promise<string> {
  return client.post<string>(`/training/admin/trainings/${encodeURIComponent(trainingId)}/assignments`, { trainingId, ...input });
}

// --- Article Templates ---

export async function getArticleTemplates(): Promise<ArticleTemplate[]> {
  const data = await client.get<BackendArticleTemplateDto[]>("/training/admin/article-templates");
  return data.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    sections: template.sections.map((section) => ({
      id: section.id,
      label: section.label,
      placeholder: section.placeholder ?? "",
      orderIndex: section.orderIndex,
    })),
  }));
}
