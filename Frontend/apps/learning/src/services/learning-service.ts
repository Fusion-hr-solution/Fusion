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

interface BackendApiResponse<T> {
  data: T;
  errors: string[];
  isSuccess: boolean;
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
  // Fallback to the original name as-is if not found, or default
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
    chapters: [], // Will be populated by detail endpoint if needed
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

// --- API client ---
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`Network error: ${message}`);
  }

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as BackendApiResponse<T>;
  if (!json.isSuccess) {
    throw new Error(json.errors.join(", ") || "Unknown API error");
  }

  return json.data;
}

// --- Exported service functions ---

/**
 * Get all categories from the backend.
 */
export async function getCategories(): Promise<BackendTrainingCategoryDto[]> {
  return fetchApi<BackendTrainingCategoryDto[]>("/training/catalog/categories");
}

/**
 * Get all trainings from the catalog, optionally filtered.
 */
export async function getTrainings(params?: {
  categoryId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ trainings: Training[]; totalCount: number; page: number; pageSize: number }> {
  const searchParams = new URLSearchParams();
  if (params?.categoryId) searchParams.set("categoryId", params.categoryId);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.pageSize) searchParams.set("pageSize", params.pageSize.toString());

  const queryString = searchParams.toString();
  const path = `/training/catalog${queryString ? `?${queryString}` : ""}`;

  const data = await fetchApi<BackendPagedResponse<BackendTrainingDto>>(path);
  return {
    trainings: data.items.map(mapBackendToTraining),
    totalCount: data.totalCount,
    page: data.page,
    pageSize: data.pageSize,
  };
}

/**
 * Get a single training by ID with full details.
 */
export async function getTrainingById(id: string): Promise<Training> {
  const data = await fetchApi<BackendTrainingDetailDto>(`/training/catalog/${id}`);
  const training = mapBackendToTraining(data);
  training.chapters = data.chapters.map((c) => ({
    id: c.id,
    title: c.title,
    duration: "~30 min", // Backend doesn't have chapter duration
  }));
  return training;
}

/**
 * Get all enrolled trainings for the current user.
 */
export async function getMyTrainings(statusFilter?: string): Promise<EnrolledTraining[]> {
  const path = statusFilter
    ? `/training/my-trainings?status=${statusFilter}`
    : "/training/my-trainings";
  
  const data = await fetchApi<BackendMyTrainingDto[]>(path);
  return data.map(mapBackendToEnrolledTraining);
}

/**
 * Enroll the current user in a training.
 */
export async function enrollInTraining(trainingId: string): Promise<string> {
  return fetchApi<string>("/training/my-trainings/enroll", {
    method: "POST",
    body: JSON.stringify({ trainingId }),
  });
}

/**
 * Update chapter progress.
 */
export async function updateChapterProgress(
  trainingId: string,
  chapterId: string,
  completed: boolean
): Promise<void> {
  await fetchApi<null>(`/training/my-trainings/${trainingId}/chapters/progress`, {
    method: "PUT",
    body: JSON.stringify({ chapterId, completed }),
  });
}

// --- Legacy mock function (for backwards compatibility during migration) ---
/** @deprecated Use getTrainings() instead */
export async function getCourses() {
  // Fallback to mock data if API fails
  try {
    const result = await  getTrainings();
    return result.trainings;
  } catch {
    console.warn("[learning-service] API failed, using mock data");
    return [];
  }
}
