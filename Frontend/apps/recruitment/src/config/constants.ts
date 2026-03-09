import type { Discipline, QuestionType, Difficulty, GradingMethod } from "@/types";

export const APP_NAME = "Test Management";
export const APP_DESCRIPTION =
  "Create, manage, and track technical assessments across all disciplines.";

export const DISCIPLINES: Discipline[] = [
  "Engineering",
  "Design",
  "Data",
  "Product",
  "Marketing",
  "Finance",
  "Operations",
];

export const QUESTION_TYPES: QuestionType[] = [
  "Coding",
  "SQL",
  "Multiple Choice",
  "Essay",
  "Case Study",
  "Excel",
  "True/False",
  "Design",
];

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard", "Expert"];

export const GRADING_METHODS: GradingMethod[] = [
  "Auto-graded",
  "Hybrid",
  "Manual review",
];

export const WIZARD_STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Questions" },
  { id: 3, label: "Configuration" },
  { id: 4, label: "Review" },
];

export const ITEMS_PER_PAGE = 9;
export const QUESTIONS_PER_PAGE = 6;