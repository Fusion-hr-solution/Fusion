import type { TrainingCategory, TrainingLevel, BadgeLevel } from "./index";

// --- Backend DTOs (from .NET API) ---

export interface BackendTrainingCategoryDto {
  id: string;
  name: string;
  description: string | null;
  trainingCount: number;
}

export interface BackendChapterDto {
  id: string;
  title: string;
  contentType: string;
  contentUri: string | null;
  orderIndex: number;
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
  createdAt: string;
}

export interface BackendTrainingDetailDto extends BackendTrainingDto {
  chapters: BackendChapterDto[];
  exams: { id: string; title: string; passingScore: number; questionCount: number }[];
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
