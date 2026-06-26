import { createPlatformApiClient } from "@repo/api";
import type {
  AdminTraining,
  AdminChapter,
  AdminContentBlock,
  AdminTrainingDetail,
  AdminAssignment,
  AdminCategory,
  AdminOnSiteCourse,
  AdminExamDetail,
  QuizDraft,
  QuestionType,
} from "@/types/admin";
import type { ChapterLayout, TrainingType } from "@/types";
import type {
  BackendAdminTrainingDto,
  BackendAdminChapterDto,
  BackendAdminContentBlockDto,
  BackendAdminExamDetailDto,
  BackendAdminTrainingDetailDto,
  BackendOnSiteCourseDto,
  BackendAssignmentDto,
  BackendTrainingCategoryDto,
  BackendQuizDraftDto,
} from "@/types/backend-dtos";
import type { CreateChapterInput, UpdateChapterInput } from "@/types/admin";

export const client = createPlatformApiClient();

export function mapTraining(dto: BackendAdminTrainingDto): AdminTraining {
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
    trainingType: (dto.trainingType ?? "ELearning") as TrainingType,
    scheduledDate: dto.scheduledDate ?? undefined,
    isDeleted: dto.isDeleted,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
  };
}

export function mapContentBlock(dto: BackendAdminContentBlockDto): AdminContentBlock {
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

export function mapChapter(dto: BackendAdminChapterDto): AdminChapter {
  const contentBlocks = dto.contentBlocks ?? [];
  const primaryBlock = contentBlocks[0];

  return {
    id: dto.id,
    title: dto.title,
    layout: dto.layout as ChapterLayout,
    orderIndex: dto.orderIndex,
    contentType: primaryBlock?.type ?? "Article",
    contentUri: primaryBlock?.contentUri ?? undefined,
    textContent: primaryBlock?.textContent ?? undefined,
    videoUrl: primaryBlock?.videoUrl ?? undefined,
    estimatedDurationMinutes: primaryBlock?.estimatedDurationMinutes ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
    contentBlocks: contentBlocks.map(mapContentBlock),
  };
}

export function mapTrainingDetail(dto: BackendAdminTrainingDetailDto): AdminTrainingDetail {
  return {
    ...mapTraining(dto),
    chapters: dto.chapters.map(mapChapter),
    exams: dto.exams.map((e) => ({
      id: e.id,
      title: e.title,
      passingScore: e.passingScore,
      questionCount: e.questionCount,
    })),
    onSiteCourses: (dto.onSiteCourses ?? []).map(mapOnSiteCourse),
  };
}

export function mapOnSiteCourse(dto: BackendOnSiteCourseDto): AdminOnSiteCourse {
  return {
    id: dto.id,
    title: dto.title,
    contentUri: dto.contentUri,
    orderIndex: dto.orderIndex,
    createdAt: dto.createdAt,
  };
}

export function mapAssignment(dto: BackendAssignmentDto): AdminAssignment {
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

export function mapCategory(dto: BackendTrainingCategoryDto): AdminCategory {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    trainingCount: dto.trainingCount,
  };
}

export function mapExamDetail(dto: BackendAdminExamDetailDto): AdminExamDetail {
  return {
    id: dto.id,
    trainingId: dto.trainingId,
    title: dto.title,
    description: dto.description ?? undefined,
    passingScore: dto.passingScore,
    durationMinutes: dto.durationMinutes ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
    questions: dto.questions
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((q) => ({
        id: q.id,
        questionText: q.questionText,
        type: q.type as AdminExamDetail["questions"][number]["type"],
        orderIndex: q.orderIndex,
        points: q.points,
        explanation: q.explanation ?? undefined,
        options: q.options
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((o) => ({
            id: o.id,
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            orderIndex: o.orderIndex,
          })),
      })),
  };
}

export function mapQuizDraft(dto: BackendQuizDraftDto): QuizDraft {
  return {
    trainingId: dto.trainingId,
    aiAvailable: dto.aiAvailable,
    questions: (dto.questions ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((q) => ({
        text: q.text,
        type: q.type as QuestionType,
        points: q.points,
        explanation: q.explanation ?? undefined,
        order: q.order,
        source: q.source ?? "ai",
        options: (q.options ?? []).map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      })),
  };
}

export function normalizeChapterPayload(input: CreateChapterInput | UpdateChapterInput) {
  if ("contentBlocks" in input && input.contentBlocks?.length) {
    return input;
  }

  const contentType = input.contentType?.trim();
  if (!contentType) {
    return { ...input, layout: input.layout ?? "SingleContent" };
  }

  return {
    title: input.title,
    layout: input.layout ?? "SingleContent",
    ...("orderIndex" in input ? { orderIndex: input.orderIndex } : {}),
    contentBlocks: [
      {
        type: contentType,
        orderIndex: 0,
        title: input.title,
        textContent: input.textContent,
        contentUri: input.contentUri,
        videoUrl: input.videoUrl,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
      },
    ],
  };
}
