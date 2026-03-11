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

export type GradingMethod = "Auto-graded" | "Hybrid" | "Manual";

export type TestStatus = "Active" | "Draft" | "Archived";

export type DifficultyLevel = "Entry" | "Mid" | "Senior" | "Lead" | "Executive";

export type Discipline =
  | "Engineering"
  | "Design"
  | "Product"
  | "Data"
  | "Marketing"
  | "Sales"
  | "Operations"
  | "Finance"
  | "HR";

export type SortOption = "newest" | "oldest" | "most_used" | "points";

export interface Test {
  id: string;
  title: string;
  description: string;
  discipline: Discipline;
  status: TestStatus;
  questionTypes: QuestionType[];
  candidateCount: number;
  questionCount: number;
  createdAt: string;
}

export interface Question {
  id: string;
  title: string;
  description: string;
  type: QuestionType;
  difficulty: Difficulty;
  gradingMethod: GradingMethod;
  points: number;
  durationMinutes: number;
  tags: string[];
  usageCount: number;
}

export interface NewQuestionForm {
  type: QuestionType | "";
  title: string;
  description: string;
  difficulty: Difficulty | "";
  points: number;
  durationMinutes: number;
  gradingMethod: GradingMethod | "";
  tags: string[];
  options: { text: string; correct: boolean }[];
  language: string;
  starterCode: string;
  evaluationCriteria: string;
}

export interface WizardFormState {
  step: number;
  basicInfo: {
    title: string;
    role: string;
    discipline: Discipline | "";
    description: string;
    internalNotes: string;
    estimatedDuration: number;
    difficultyLevel: DifficultyLevel | "";
  };
  selectedQuestions: Question[];
  config: {
    allowSkipping: boolean;
    showProgressBar: boolean;
    restrictCopyPaste: boolean;
    enableProctoring: boolean;
    enableTimeLimit: boolean;
    timeLimitMinutes: number;
    maxAttempts: number;
    randomizeOrder: boolean;
    accessType: "invitation" | "open";
    startDate: string;
    endDate: string;
    linkExpiry: number;
    passingThreshold: number;
    allowPartialCredit: boolean;
    assignedReviewer: string;
  };
}

export interface FilterState {
  search: string;
  discipline: Discipline | "";
  questionType: QuestionType | "";
  status: TestStatus | "";
}

export interface QuestionFilterState {
  search: string;
  types: QuestionType[];
  difficulties: Difficulty[];
  gradingMethods: GradingMethod[];
}