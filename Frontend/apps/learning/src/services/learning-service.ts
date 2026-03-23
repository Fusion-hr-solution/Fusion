import { createPlatformApiClient } from "@repo/api";
import type { EnrolledTraining, Training, TrainingCategory, TrainingLevel } from "@/types";

// --- Backend DTOs (from .NET API) ---
interface BackendTrainingCategoryDto {
  id: string;
  name: string;
  description: string | null;
  trainingCount: number;
}

interface BackendChapterDto {
  id: string;
  title: string;
  contentType: string;
  contentUri: string | null;
  orderIndex: number;
}

interface BackendTrainingDto {
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
  createdAt: string;
}

interface BackendTrainingDetailDto extends BackendTrainingDto {
  chapters: BackendChapterDto[];
  exams: { id: string; title: string; passingScore: number; questionCount: number }[];
}

interface BackendMyTrainingDto {
  trainingId: string;
  title: string;
  description: string | null;
  categoryName: string;
  duration: string | null;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  status: string;
  progressPercentage: number;
  completedChapters: number;
  totalChapters: number;
  startedAt: string | null;
  completedAt: string | null;
  assignmentType: string;
  dueDate: string | null;
}

interface BackendPagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// --- Mapping helpers ---
const CATEGORY_MAP: Record<string, TrainingCategory> = {
  "Technical Skills": "technical",
  "Leadership & Management": "leadership",
  "Compliance & Regulatory": "compliance",
  "Soft Skills": "soft-skills",
  "Data & Analytics": "data-analytics",
};

const LEVEL_MAP: Record<string, TrainingLevel> = {
  Bronze: "beginner",
  Silver: "intermediate",
  Gold: "advanced",
};

function mapCategory(categoryName: string): TrainingCategory {
  return CATEGORY_MAP[categoryName] ?? "technical";
}

function mapLevel(badgeLevel: string): TrainingLevel {
  return LEVEL_MAP[badgeLevel] ?? "intermediate";
}

function mapTrainingStatus(status: string): "in-progress" | "completed" | "not-started" {
  switch (status) {
    case "InProgress":
      return "in-progress";
    case "Completed":
      return "completed";
    default:
      return "not-started";
  }
}

function mapBackendToTraining(dto: BackendTrainingDto): Training {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description ?? "",
    category: mapCategory(dto.categoryName),
    level: mapLevel(dto.badgeLevel),
    duration: dto.duration ?? "TBD",
    chaptersCount: dto.chapterCount,
    chapters: [],
    instructor: "EY Learning Team",
    instructorRole: "Training Department",
    enrolledCount: 0,
    rating: 4.5,
    imageUrl: `/images/training-${mapCategory(dto.categoryName)}.jpg`,
    tags: [dto.categoryName.toLowerCase()],
    updatedAt: dto.createdAt.split("T")[0] ?? dto.createdAt,
  };
}

function mapBackendToEnrolledTraining(dto: BackendMyTrainingDto): EnrolledTraining {
  return {
    id: dto.trainingId,
    title: dto.title,
    description: dto.description ?? "",
    category: mapCategory(dto.categoryName),
    level: mapLevel(dto.badgeLevel),
    duration: dto.duration ?? "TBD",
    chaptersCount: dto.totalChapters,
    chapters: [],
    instructor: "EY Learning Team",
    instructorRole: "Training Department",
    enrolledCount: 0,
    rating: 4.5,
    imageUrl: `/images/training-${mapCategory(dto.categoryName)}.jpg`,
    tags: [dto.categoryName.toLowerCase()],
    updatedAt: dto.startedAt?.split("T")[0] ?? new Date().toISOString().split("T")[0]!,
    status: mapTrainingStatus(dto.status),
    progress: dto.progressPercentage,
    enrolledAt: dto.startedAt ?? new Date().toISOString(),
    completedAt: dto.completedAt ?? undefined,
    currentChapter: dto.completedChapters + 1,
    deadline: dto.dueDate ?? undefined,
  };
}

// --- API client (uses shared @repo/api platform client) ---
const client = createPlatformApiClient();

// --- Exported service functions ---

export async function getCategories(): Promise<BackendTrainingCategoryDto[]> {
  return client.get<BackendTrainingCategoryDto[]>("/training/catalog/categories", {
    skipAuth: true,
  });
}

export async function getTrainings(params?: {
  categoryId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ trainings: Training[]; totalCount: number; page: number; pageSize: number }> {
  const data = await client.get<BackendPagedResponse<BackendTrainingDto>>("/training/catalog", {
    skipAuth: true,
    params: {
      categoryId: params?.categoryId,
      search: params?.search,
      page: params?.page,
      pageSize: params?.pageSize,
    },
  });
  return {
    trainings: data.items.map(mapBackendToTraining),
    totalCount: data.totalCount,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function getTrainingById(id: string): Promise<Training> {
  const data = await client.get<BackendTrainingDetailDto>(`/training/catalog/${encodeURIComponent(id)}`, {
    skipAuth: true,
  });
  const training = mapBackendToTraining(data);
  training.chapters = data.chapters.map((c) => ({
    id: c.id,
    title: c.title,
    duration: "~30 min",
  }));
  training.chaptersCount = data.chapters.length;
  if (data.exams.length > 0) {
    const exam = data.exams[0]!;
    training.exam = {
      questionsCount: exam.questionCount,
      passingScore: exam.passingScore,
      duration: "N/A",
      maxAttempts: 3,
    };
  }
  return training;
}

export async function getMyTrainings(statusFilter?: string): Promise<EnrolledTraining[]> {
  const data = await client.get<BackendMyTrainingDto[]>("/training/my-trainings", {
    params: statusFilter ? { status: statusFilter } : undefined,
  });
  return data.map(mapBackendToEnrolledTraining);
}

export async function enrollInTraining(trainingId: string): Promise<string> {
  return client.post<string>("/training/my-trainings/enroll", { trainingId });
}

export async function updateChapterProgress(
  trainingId: string,
  chapterId: string,
  completed: boolean
): Promise<void> {
  await client.put<null>(
    `/training/my-trainings/${encodeURIComponent(trainingId)}/chapters/progress`,
    { chapterId, completed },
  );
}
