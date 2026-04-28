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

export type TrainingType = "ELearning" | "OnSite";

export interface OnSiteCourse {
  id: string;
  title: string;
  contentUri: string;
  orderIndex: number;
}

export interface TrainingChapter {
  id: string;
  title: string;
  layout: ChapterLayout;
  orderIndex: number;
  blockCount: number;
  duration?: string | null;
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
  duration?: string | null;
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
  trainingType: TrainingType;
  scheduledDate?: string;
  onSiteCourses?: OnSiteCourse[];
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

/* ── Learner Exam types ── */

export type LearnerQuestionType = "SingleChoice" | "MultipleChoice" | "TrueFalse";

export interface LearnerExam {
  id: string;
  trainingId: string;
  title: string;
  description?: string;
  passingScore: number;
  durationMinutes?: number;
  questionCount: number;
  questions: LearnerExamQuestion[];
}

export interface LearnerExamQuestion {
  id: string;
  questionText: string;
  type: LearnerQuestionType;
  orderIndex: number;
  points: number;
  options: LearnerExamOption[];
}

export interface LearnerExamOption {
  id: string;
  optionText: string;
  orderIndex: number;
}

export interface ExamSubmissionResult {
  attemptId: string;
  score: number;
  passingScore: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  attemptedAt: string;
  trainingCompleted: boolean;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  attemptedAt: string;
}

/* ── Grade / ServiceLine / Curriculum types ── */

export interface Grade {
  id: string;
  name: string;
  level: number;
  description?: string;
  icon?: string;
}

export interface ServiceLine {
  id: string;
  name: string;
  code: string;
  color: string;
  description?: string;
  isSharedAcrossAllServiceLines: boolean;
}

export type CursusItemStatus = "not-started" | "in-progress" | "completed";

export interface MyCursusSummary {
  totalCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  requiredCreditsTotal: number;
  requiredCreditsEarned: number;
  estimatedRemainingMinutes: number;
}

export interface MyCursusItem {
  mappingId: string;
  trainingId: string;
  trainingTitle: string;
  trainingDescription: string;
  trainingType: TrainingType;
  credits: number;
  duration: number;
  badgeLevel: BadgeLevel;
  scheduledDate?: string;
  isRequired: boolean;
  orderIndex: number;
  status: CursusItemStatus;
  progressPercentage: number;
  lastActivityAt?: string;
  isFromSharedServiceLine: boolean;
}

export interface MyCursus {
  summary: MyCursusSummary;
  items: MyCursusItem[];
}
