import { createPlatformApiClient } from "@repo/api";
import type { EnrolledTraining, Training, TrainingCategory, TrainingLevel, BadgeLevel, TrainingLearnData, ContentType, ChapterContent, ChapterLayout, TrainingType, OnSiteCourse } from "@/types";
import type {
  BackendTrainingCategoryDto,
  BackendTrainingDto,
  BackendTrainingDetailDto,
  BackendMyTrainingDto,
  BackendPagedResponse,
  BackendTrainingProgressDto,
  BackendChapterContentDto,
  BackendOnSiteCourseDto,
} from "@/types/backend-dtos";
import { CATEGORY_MAP, LEVEL_MAP, BADGE_LEVEL_MAP, CONTENT_TYPE_MAP } from "@/types/backend-dtos";

function mapBadgeLevel(badgeLevel: string): BadgeLevel {
  return BADGE_LEVEL_MAP[badgeLevel] ?? "bronze";
}

function mapCategory(categoryName: string): TrainingCategory {
  return CATEGORY_MAP[categoryName] ?? "technical";
}

function mapLevel(badgeLevel: string): TrainingLevel {
  return LEVEL_MAP[badgeLevel] ?? "intermediate";
}

function mapContentType(contentType: string): ContentType {
  return CONTENT_TYPE_MAP[contentType] ?? "article";
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
    isMandatory: dto.isMandatory,
    badgeLevel: mapBadgeLevel(dto.badgeLevel),
    credits: dto.credits,
    trainingType: (dto.trainingType as TrainingType) ?? "ELearning",
    scheduledDate: dto.scheduledDate ?? undefined,
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
    isMandatory: dto.isMandatory,
    badgeLevel: mapBadgeLevel(dto.badgeLevel),
    credits: dto.credits,
    trainingType: "ELearning",
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
  training.chapters = data.chapters
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((c) => ({
      id: c.id,
      title: c.title,
      layout: c.layout as ChapterLayout,
      orderIndex: c.orderIndex,
      blockCount: c.blockCount,
    }));
  training.chaptersCount = data.chapters.length;
  if (data.exams.length > 0) {
    const exam = data.exams[0]!;
    training.exam = {
      questionsCount: exam.questionCount,
      passingScore: exam.passingScore,
    };
  }
  training.onSiteCourses = (data.onSiteCourses ?? [])
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(mapOnSiteCourse);
  return training;
}

function mapOnSiteCourse(dto: BackendOnSiteCourseDto): OnSiteCourse {
  return {
    id: dto.id,
    title: dto.title,
    contentUri: dto.contentUri,
    orderIndex: dto.orderIndex,
  };
}

export async function getMyTrainings(statusFilter?: string): Promise<EnrolledTraining[]> {
  const data = await client.get<BackendMyTrainingDto[]>("/training/my-trainings", {
    params: statusFilter ? { status: statusFilter } : undefined,
  });
  return data.map(mapBackendToEnrolledTraining);
}

export async function getEnrollmentStatus(
  trainingId: string,
): Promise<EnrolledTraining | null> {
  try {
    const data = await client.get<BackendMyTrainingDto>(
      `/training/my-trainings/${encodeURIComponent(trainingId)}`,
    );
    return mapBackendToEnrolledTraining(data);
  } catch {
    // 404 = not enrolled, auth error = not signed in
    return null;
  }
}

export async function enrollInTraining(trainingId: string): Promise<string> {
  return client.post<string>("/training/my-trainings/enroll", { trainingId });
}

export async function updateChapterProgress(
  trainingId: string,
  chapterId: string,
  completed: boolean,
): Promise<void> {
  await client.put<null>(
    `/training/my-trainings/${encodeURIComponent(trainingId)}/chapters/progress`,
    { chapterId, completed },
  );
}

export async function updateContentBlockProgress(
  trainingId: string,
  chapterId: string,
  contentBlockId: string,
  completed: boolean,
): Promise<void> {
  await client.put<null>(
    `/training/my-trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/${encodeURIComponent(contentBlockId)}/progress`,
    { completed },
  );
}

export async function getChapterContent(
  trainingId: string,
  chapterId: string,
): Promise<ChapterContent> {
  const data = await client.get<{ data: BackendChapterContentDto }>(
    `/training/my-trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}`,
  );
  const dto = data.data;
  return {
    id: dto.id,
    title: dto.title,
    layout: dto.layout as ChapterLayout,
    orderIndex: dto.orderIndex,
    trainingId: dto.trainingId,
    trainingTitle: dto.trainingTitle,
    totalChapters: dto.totalChapters,
    nextChapterId: dto.nextChapterId,
    previousChapterId: dto.previousChapterId,
    isCompleted: dto.isCompleted,
    contentBlocks: dto.contentBlocks
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((b) => ({
        id: b.id,
        type: mapContentType(b.type),
        orderIndex: b.orderIndex,
        title: b.title,
        textContent: b.textContent,
        contentUri: b.contentUri,
        videoUrl: b.videoUrl,
        estimatedDurationMinutes: b.estimatedDurationMinutes,
        isCompleted: b.isCompleted,
      })),
  };
}

export async function getTrainingProgress(trainingId: string): Promise<TrainingLearnData> {
  const data = await client.get<BackendTrainingProgressDto>(
    `/training/my-trainings/${encodeURIComponent(trainingId)}/progress`,
  );

  const training = mapBackendToTraining({
    id: data.trainingId,
    title: data.title,
    description: data.description,
    credits: data.credits,
    isMandatory: data.isMandatory,
    badgeLevel: data.badgeLevel,
    duration: data.duration,
    categoryId: "",
    categoryName: data.categoryName,
    chapterCount: data.totalChapters,
    trainingType: "ELearning",
    scheduledDate: null,
    createdAt: new Date().toISOString(),
  });

  training.chapters = data.chapters
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((c) => ({
      id: c.id,
      title: c.title,
      layout: c.layout as ChapterLayout,
      orderIndex: c.orderIndex,
      blockCount: c.blockCount,
    }));
  training.chaptersCount = data.chapters.length;

  return {
    training,
    chapters: data.chapters
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((c) => ({
        id: c.id,
        title: c.title,
        layout: c.layout as ChapterLayout,
        orderIndex: c.orderIndex,
        blockCount: c.blockCount,
        completedBlockCount: c.completedBlockCount,
        isCompleted: c.completedBlockCount >= c.blockCount && c.blockCount > 0,
        completedAt: null,
      })),
    chapterProgress: data.chapterProgress.map((p) => ({
      chapterId: p.chapterId,
      completed: p.completed,
      completedAt: p.completedAt,
    })),
    overallProgress: data.progressPercentage,
    status: mapTrainingStatus(data.status),
  };
}
