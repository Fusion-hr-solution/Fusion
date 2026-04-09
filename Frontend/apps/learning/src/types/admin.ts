import type { ChapterLayout } from "./index";

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

/** Admin Exam (read-only) */
export interface AdminExam {
  id: string;
  title: string;
  passingScore: number;
  questionCount: number;
}

/** Admin Training full detail (with chapters & exams) */
export interface AdminTrainingDetail extends AdminTraining {
  chapters: AdminChapter[];
  exams: AdminExam[];
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
  layout: ChapterLayout;
  orderIndex: number;
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
  chapters?: CreateChapterInput[];
}

export interface UpdateTrainingInput {
  title: string;
  description?: string;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  duration?: string;
  categoryId: string;
}

export interface UpdateChapterInput {
  title: string;
  layout: ChapterLayout;
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
