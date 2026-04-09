import { createPlatformApiClient } from "@repo/api";
import type {
  AdminTraining,
  AdminTrainingDetail,
  AdminChapter,
  AdminContentBlock,
  AdminAssignment,
  AdminCategory,
  CreateTrainingInput,
  UpdateTrainingInput,
  CreateChapterInput,
  UpdateChapterInput,
  CreateContentBlockInput,
  UpdateContentBlockInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  AssignTrainingInput,
} from "@/types/admin";
import type { ChapterLayout } from "@/types";

// --- Backend DTOs (mirror .NET API responses) ---

interface BackendAdminTrainingDto {
  id: string;
  title: string;
  description: string | null;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  duration: string | null;
  categoryId: string;
  categoryName: string;
  chapterCount: number;
  enrollmentCount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

interface BackendAdminChapterDto {
  id: string;
  title: string;
  layout: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string | null;
  contentBlocks: BackendAdminContentBlockDto[];
}

interface BackendAdminContentBlockDto {
  id: string;
  type: string;
  orderIndex: number;
  title: string | null;
  textContent: string | null;
  contentUri: string | null;
  videoUrl: string | null;
  estimatedDurationMinutes: number | null;
  createdAt: string;
  updatedAt: string | null;
}

interface BackendExamDto {
  id: string;
  title: string;
  passingScore: number;
  questionCount: number;
}

interface BackendAdminTrainingDetailDto extends BackendAdminTrainingDto {
  chapters: BackendAdminChapterDto[];
  exams: BackendExamDto[];
}

interface BackendAssignmentDto {
  id: string;
  trainingId: string;
  trainingTitle: string;
  employeeId: string;
  assignmentType: string;
  assignedAt: string;
  dueDate: string | null;
  status: string | null;
  progressPercentage: number;
}

interface BackendCategoryDto {
  id: string;
  name: string;
  description: string | null;
  trainingCount: number;
}

interface BackendPagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// --- Mapping helpers ---

function mapTraining(dto: BackendAdminTrainingDto): AdminTraining {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description ?? "",
    credits: dto.credits,
    isMandatory: dto.isMandatory,
    badgeLevel: dto.badgeLevel,
    duration: dto.duration ?? "",
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    chapterCount: dto.chapterCount,
    enrollmentCount: dto.enrollmentCount,
    isDeleted: dto.isDeleted,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
  };
}

function mapChapter(dto: BackendAdminChapterDto): AdminChapter {
  return {
    id: dto.id,
    title: dto.title,
    layout: dto.layout as ChapterLayout,
    orderIndex: dto.orderIndex,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
    contentBlocks: dto.contentBlocks.map(mapContentBlock),
  };
}

function mapContentBlock(dto: BackendAdminContentBlockDto): AdminContentBlock {
  return {
    id: dto.id,
    type: dto.type,
    orderIndex: dto.orderIndex,
    title: dto.title ?? undefined,
    textContent: dto.textContent ?? undefined,
    contentUri: dto.contentUri ?? undefined,
    videoUrl: dto.videoUrl ?? undefined,
    estimatedDurationMinutes: dto.estimatedDurationMinutes ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
  };
}

function mapTrainingDetail(dto: BackendAdminTrainingDetailDto): AdminTrainingDetail {
  return {
    ...mapTraining(dto),
    chapters: dto.chapters.map(mapChapter),
    exams: dto.exams.map((e) => ({
      id: e.id,
      title: e.title,
      passingScore: e.passingScore,
      questionCount: e.questionCount,
    })),
  };
}

function mapAssignment(dto: BackendAssignmentDto): AdminAssignment {
  return {
    id: dto.id,
    trainingId: dto.trainingId,
    trainingTitle: dto.trainingTitle,
    employeeId: dto.employeeId,
    assignmentType: dto.assignmentType,
    assignedAt: dto.assignedAt,
    dueDate: dto.dueDate ?? undefined,
    status: dto.status ?? "NotStarted",
    progressPercentage: dto.progressPercentage,
  };
}

function mapCategory(dto: BackendCategoryDto): AdminCategory {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    trainingCount: dto.trainingCount,
  };
}

// --- API client ---
const client = createPlatformApiClient();

// --- Training CRUD ---

export async function getAdminTrainings(params?: {
  categoryId?: string;
  search?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ trainings: AdminTraining[]; totalCount: number; page: number; pageSize: number }> {
  const data = await client.get<BackendPagedResponse<BackendAdminTrainingDto>>(
    "/training/admin/trainings",
    { params },
  );
  return {
    trainings: data.items.map(mapTraining),
    totalCount: data.totalCount,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function getAdminTrainingDetail(trainingId: string): Promise<AdminTrainingDetail> {
  const data = await client.get<BackendAdminTrainingDetailDto>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}`,
  );
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
  return client.post<string>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters`,
    input,
  );
}

export async function updateChapter(
  trainingId: string,
  chapterId: string,
  input: UpdateChapterInput,
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}`,
    input,
  );
}

export async function deleteChapter(trainingId: string, chapterId: string): Promise<void> {
  await client.delete(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}`,
  );
}

export async function reorderChapters(trainingId: string, chapterIds: string[]): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/reorder`,
    { chapterIds },
  );
}

// --- File upload ---

export async function uploadChapterFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  return client.post<string>("/training/admin/uploads", form);
}

// --- Assignment management ---

export async function getTrainingAssignments(trainingId: string): Promise<AdminAssignment[]> {
  return client
    .get<BackendAssignmentDto[]>(
      `/training/admin/trainings/${encodeURIComponent(trainingId)}/assignments`,
    )
    .then((data) => data.map(mapAssignment));
}

export async function assignTraining(
  trainingId: string,
  input: AssignTrainingInput,
): Promise<string> {
  return client.post<string>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/assignments`,
    { trainingId, ...input },
  );
}

// --- Category CRUD ---

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const data = await client.get<BackendCategoryDto[]>("/training/admin/categories");
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

// --- Content Block CRUD ---

export async function addContentBlock(
  trainingId: string,
  chapterId: string,
  input: CreateContentBlockInput,
): Promise<string> {
  return client.post<string>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks`,
    input,
  );
}

export async function updateContentBlock(
  trainingId: string,
  chapterId: string,
  contentBlockId: string,
  input: UpdateContentBlockInput,
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/${encodeURIComponent(contentBlockId)}`,
    input,
  );
}

export async function deleteContentBlock(
  trainingId: string,
  chapterId: string,
  contentBlockId: string,
): Promise<void> {
  await client.delete(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/${encodeURIComponent(contentBlockId)}`,
  );
}

export async function reorderContentBlocks(
  trainingId: string,
  chapterId: string,
  contentBlockIds: string[],
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/reorder`,
    { contentBlockIds },
  );
}
