import type { ChapterLayout, TrainingType } from "./index";

/** Chapter being built in the training creation wizard (client-side only) */
export interface WizardChapter {
  clientId: string;
  title: string;
  layout: ChapterLayout;
}

/** Admin Training (list view) */
export interface AdminTraining {
  id: string;
  title: string;
  description: string;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  duration: string;
  categoryId: string;
  categoryName: string;
  chapterCount: number;
  enrollmentCount: number;
  trainingType: TrainingType;
  scheduledDate?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

/** Admin Chapter (detail view) */
export interface AdminChapter {
  id: string;
  title: string;
  layout: ChapterLayout;
  orderIndex: number;
  contentType: string;
  contentUri?: string;
  textContent?: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
  createdAt: string;
  updatedAt?: string;
  contentBlocks: AdminContentBlock[];
}

/** Admin Content Block */
export interface AdminContentBlock {
  id: string;
  type: string;
  orderIndex: number;
  title?: string;
  textContent?: string;
  contentUri?: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
  createdAt: string;
  updatedAt?: string;
}

/** Admin Exam (list / summary view) */
export interface AdminExam {
  id: string;
  title: string;
  passingScore: number;
  questionCount: number;
}

/** Question type enum matching backend QuestionType */
export type QuestionType = "SingleChoice" | "MultipleChoice" | "TrueFalse";

/** Admin Exam full detail (with questions & options) */
export interface AdminExamDetail {
  id: string;
  trainingId: string;
  title: string;
  description?: string;
  passingScore: number;
  durationMinutes?: number;
  createdAt: string;
  updatedAt?: string;
  questions: AdminExamQuestion[];
}

/** Exam question */
export interface AdminExamQuestion {
  id: string;
  questionText: string;
  type: QuestionType;
  orderIndex: number;
  points: number;
  options: AdminExamOption[];
}

/** Exam option */
export interface AdminExamOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

// --- Exam input types ---

export interface CreateExamInput {
  title: string;
  description?: string;
  passingScore: number;
  durationMinutes?: number;
}

export interface UpdateExamInput {
  title: string;
  description?: string;
  passingScore: number;
  durationMinutes?: number;
}

export interface CreateExamQuestionInput {
  questionText: string;
  type: QuestionType;
  points: number;
  options: { optionText: string; isCorrect: boolean }[];
}

export interface UpdateExamQuestionInput {
  questionText: string;
  type: QuestionType;
  points: number;
  options: { optionText: string; isCorrect: boolean }[];
}

/** Admin On-Site Course */
export interface AdminOnSiteCourse {
  id: string;
  title: string;
  contentUri: string;
  orderIndex: number;
  createdAt: string;
}

/** Admin Training full detail (with chapters & exams) */
export interface AdminTrainingDetail extends AdminTraining {
  chapters: AdminChapter[];
  exams: AdminExam[];
  onSiteCourses: AdminOnSiteCourse[];
}

/** Assignment record */
export interface AdminAssignment {
  id: string;
  trainingId: string;
  trainingTitle: string;
  employeeId: string;
  assignmentType: string;
  assignedAt: string;
  dueDate?: string;
  status: string;
  progressPercentage: number;
}

/** Admin Category */
export interface AdminCategory {
  id: string;
  name: string;
  description: string;
  trainingCount: number;
}

// --- Input types (for create/update requests) ---

export interface CreateChapterInput {
  title: string;
  layout?: ChapterLayout;
  orderIndex: number;
  contentType?: string;
  contentUri?: string;
  textContent?: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
  contentBlocks?: CreateContentBlockInput[];
}

export interface CreateContentBlockInput {
  type: string;
  orderIndex: number;
  title?: string;
  textContent?: string;
  contentUri?: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
}

export interface CreateTrainingInput {
  title: string;
  description?: string;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  duration?: string;
  categoryId: string;
  trainingType?: string;
  scheduledDate?: string;
  chapters?: CreateChapterInput[];
  onSiteCourses?: CreateOnSiteCourseInput[];
}

export interface CreateOnSiteCourseInput {
  title: string;
  contentUri: string;
  orderIndex: number;
}

export interface UpdateTrainingInput {
  title: string;
  description?: string;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  duration?: string;
  categoryId: string;
  trainingType?: string;
  scheduledDate?: string;
}

export interface UpdateChapterInput {
  title: string;
  layout?: ChapterLayout;
  contentType?: string;
  contentUri?: string;
  textContent?: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
}

export interface UpdateContentBlockInput {
  type: string;
  title?: string;
  textContent?: string;
  contentUri?: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export interface UpdateCategoryInput {
  name: string;
  description?: string;
}

export interface AssignTrainingInput {
  employeeId: string;
  dueDate?: string;
}

/** Article template (read-only from backend) */
export interface ArticleTemplate {
  id: string;
  name: string;
  description: string;
  sections: ArticleTemplateSection[];
}

export interface ArticleTemplateSection {
  id: string;
  label: string;
  placeholder: string;
  orderIndex: number;
}
