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
  contentType: string;
  contentUri?: string;
  orderIndex: number;
  textContent?: string;
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
  contentType: string;
  contentUri?: string;
  orderIndex: number;
  textContent?: string;
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
  contentType: string;
  contentUri?: string;
  orderIndex: number;
  textContent?: string;
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
