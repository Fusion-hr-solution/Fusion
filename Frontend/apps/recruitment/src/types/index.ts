export type QuestionType =
  | "Coding"
  | "SQL"
  | "Multiple Choice"
  | "Essay"
  | "Case Study"
  | "Excel"
  | "True/False"
  | "Design";

export type Difficulty = "Easy" | "Medium" | "Hard" | "Expert";

export type GradingMethod = "Auto-graded" | "Hybrid" | "Manual review";

export type TestStatus = "Draft" | "Active" | "Archived";

export type Discipline =
  | "Engineering"
  | "Design"
  | "Data"
  | "Product"
  | "Marketing"
  | "Finance"
  | "Operations";

export interface Question {
  id: string;
  title: string;
  description: string;
  type: QuestionType;
  difficulty: Difficulty;
  gradingMethod: GradingMethod;
  duration: number; // minutes
  points: number;
  tags: string[];
  usageCount: number;
}

export interface SelectedQuestion extends Question {
  order: number;
}

export interface Test {
  id: string;
  title: string;
  description: string;
  discipline: Discipline;
  role: string;
  questionTypes: QuestionType[];
  questionCount: number;
  candidateCount: number;
  status: TestStatus;
  createdAt: string;
  internalNotes?: string;
}

export interface DashboardFilterState {
  search: string;
  disciplines: Discipline[];
  questionTypes: QuestionType[];
  status: TestStatus | "All";
}

export interface WizardFormData {
  title: string;
  description: string;
  role: string;
  discipline: Discipline | "";
  internalNotes: string;
}

declare module "*.css" {}