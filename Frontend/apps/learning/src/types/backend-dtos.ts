import type { TrainingCategory, TrainingLevel, BadgeLevel, ContentType } from "./index";

// --- Backend DTOs (from .NET API) ---

export interface BackendTrainingCategoryDto {
  id: string;
  name: string;
  description: string | null;
  trainingCount: number;
}

/** Catalog chapter (no content, just metadata) */
export interface BackendChapterDto {
  id: string;
  title: string;
  layout: string;
  orderIndex: number;
  blockCount: number;
}

/** Chapter detail for progress view (sidebar) */
export interface BackendChapterDetailDto {
  id: string;
  title: string;
  layout: string;
  orderIndex: number;
  blockCount: number;
  completedBlockCount: number;
}

/** Full chapter content with blocks (loaded on demand) */
export interface BackendChapterContentDto {
  id: string;
  title: string;
  layout: string;
  orderIndex: number;
  trainingId: string;
  trainingTitle: string;
  totalChapters: number;
  nextChapterId: string | null;
  previousChapterId: string | null;
  isCompleted: boolean;
  contentBlocks: BackendContentBlockDto[];
}

export interface BackendContentBlockDto {
  id: string;
  type: string;
  orderIndex: number;
  title: string | null;
  textContent: string | null;
  contentUri: string | null;
  videoUrl: string | null;
  estimatedDurationMinutes: number | null;
  isCompleted: boolean;
}

export interface BackendChapterProgressDto {
  chapterId: string;
  completed: boolean;
  completedAt: string | null;
}

export interface BackendTrainingProgressDto {
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
  chapters: BackendChapterDetailDto[];
  chapterProgress: BackendChapterProgressDto[];
}

export interface BackendOnSiteCourseDto {
  id: string;
  title: string;
  contentUri: string;
  orderIndex: number;
  createdAt: string;
}

export interface BackendTrainingDto {
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
  trainingType: string;
  scheduledDate: string | null;
  createdAt: string;
}

export interface BackendTrainingDetailDto extends BackendTrainingDto {
  chapters: BackendChapterDto[];
  exams: { id: string; title: string; passingScore: number; questionCount: number }[];
  onSiteCourses: BackendOnSiteCourseDto[];
}

export interface BackendMyTrainingDto {
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

export interface BackendPagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// --- Mapping records ---

export const CATEGORY_MAP: Record<string, TrainingCategory> = {
  "Technical Skills": "technical",
  "Leadership & Management": "leadership",
  "Compliance & Regulatory": "compliance",
  "Soft Skills": "soft-skills",
  "Data & Analytics": "data-analytics",
};

export const LEVEL_MAP: Record<string, TrainingLevel> = {
  Bronze: "beginner",
  Silver: "intermediate",
  Gold: "advanced",
};

export const BADGE_LEVEL_MAP: Record<string, BadgeLevel> = {
  Bronze: "bronze",
  Silver: "silver",
  Gold: "gold",
};

export const CONTENT_TYPE_MAP: Record<string, ContentType> = {
  Video: "video",
  Pdf: "pdf",
  Article: "article",
  Exercise: "exercise",
};

/* ── Learner Exam DTOs ── */

export interface BackendExamForLearnerDto {
  id: string;
  trainingId: string;
  title: string;
  description: string | null;
  passingScore: number;
  durationMinutes: number | null;
  questionCount: number;
  questions: BackendExamQuestionForLearnerDto[];
}

export interface BackendExamQuestionForLearnerDto {
  id: string;
  questionText: string;
  type: string;
  orderIndex: number;
  points: number;
  options: BackendExamOptionForLearnerDto[];
}

export interface BackendExamOptionForLearnerDto {
  id: string;
  optionText: string;
  orderIndex: number;
}

export interface BackendExamSubmissionResultDto {
  attemptId: string;
  score: number;
  passingScore: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  attemptedAt: string;
  trainingCompleted: boolean;
}

export interface BackendExamAttemptDto {
  id: string;
  examId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  attemptedAt: string;
}
