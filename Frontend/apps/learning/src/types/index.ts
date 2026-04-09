import type { LucideIcon } from "lucide-react";

export type TrainingLevel = "beginner" | "intermediate" | "advanced";

export type TrainingCategory =
  | "leadership"
  | "technical"
  | "compliance"
  | "soft-skills"
  | "finance"
  | "data-analytics";

export type ContentType = "video" | "pdf" | "article" | "exercise";

export type ChapterLayout = "SingleContent" | "SplitLayout" | "MultiSection";

export interface TrainingChapter {
  id: string;
  title: string;
  layout: ChapterLayout;
  orderIndex: number;
  blockCount: number;
}

export interface ContentBlock {
  id: string;
  type: ContentType;
  orderIndex: number;
  title: string | null;
  textContent: string | null;
  contentUri: string | null;
  videoUrl: string | null;
  estimatedDurationMinutes: number | null;
  isCompleted: boolean;
}

export interface ChapterContent {
  id: string;
  title: string;
  layout: ChapterLayout;
  orderIndex: number;
  trainingId: string;
  trainingTitle: string;
  totalChapters: number;
  nextChapterId: string | null;
  previousChapterId: string | null;
  isCompleted: boolean;
  contentBlocks: ContentBlock[];
}

export interface ChapterListItem {
  id: string;
  title: string;
  layout: ChapterLayout;
  orderIndex: number;
  blockCount: number;
  completedBlockCount: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface ChapterProgressEntry {
  chapterId: string;
  completed: boolean;
  completedAt: string | null;
}

export interface TrainingLearnData {
  training: Training;
  chapters: ChapterListItem[];
  chapterProgress: ChapterProgressEntry[];
  overallProgress: number;
  status: TrainingStatus;
}

export interface ExamInfo {
  questionsCount: number;
  passingScore: number;
  timeLimit?: string;
  maxAttempts?: number;
}

export type BadgeLevel = "bronze" | "silver" | "gold";

export interface Training {
  id: string;
  title: string;
  description: string;
  category: TrainingCategory;
  level: TrainingLevel;
  duration: string;
  chaptersCount: number;
  chapters: TrainingChapter[];
  instructor: string;
  instructorRole: string;
  enrolledCount: number;
  rating: number;
  imageUrl: string;
  tags: string[];
  updatedAt: string;
  exam?: ExamInfo;
  isMandatory: boolean;
  badgeLevel: BadgeLevel;
  credits: number;
}

/** @deprecated Use Training instead */
export interface Course {
  id: string;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  duration: string;
  progress: number;
}

export type TrainingStatus = "in-progress" | "completed" | "not-started";

export type SortOption = "rating" | "newest" | "enrolled" | "duration";

export interface StatusConfigEntry {
  icon: LucideIcon;
  label: string;
  className: string;
  buttonLabel: string;
  buttonClass: string;
}

export interface EnrolledTraining extends Training {
  status: TrainingStatus;
  progress: number;
  enrolledAt: string;
  completedAt?: string;
  currentChapter: number;
  deadline?: string;
}

/* ── Admin / Employee Progress types ── */

export interface EmployeeTrainingRecord {
  trainingId: string;
  trainingTitle: string;
  category: TrainingCategory;
  status: TrainingStatus;
  progress: number;
  enrolledAt: string;
  completedAt?: string;
  deadline?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  avatar?: string;
  trainings: EmployeeTrainingRecord[];
}
