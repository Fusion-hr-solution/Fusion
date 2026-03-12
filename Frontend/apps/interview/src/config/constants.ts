import type {
  Discipline, QuestionType, Difficulty,
  GradingMethod, TestStatus, SortOption, DifficultyLevel,
} from "@/types";

export const APP_NAME = "Test Management";

export const DISCIPLINES: Discipline[] = [
  "Engineering", "Design", "Product", "Data",
  "Marketing", "Sales", "Operations", "Finance", "HR",
];

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  "Entry", "Mid", "Senior", "Lead", "Executive",
];

export const QUESTION_TYPES: QuestionType[] = [
  "Coding", "SQL", "Multiple Choice", "Essay",
  "Case Study", "Excel", "True/False", "Design",
];

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard", "Expert"];

export const GRADING_METHODS: GradingMethod[] = ["Auto-graded", "Hybrid", "Manual"];

export const TEST_STATUSES: TestStatus[] = ["Active", "Draft", "Archived"];

export const CODING_LANGUAGES: string[] = [
  "Python", "JavaScript", "TypeScript", "Java",
  "C++", "Go", "Rust", "SQL", "Bash",
];

export const TEAM_MEMBERS: string[] = [
  "Alice Johnson", "Bob Smith", "Carol Williams",
  "David Brown", "Eva Martinez",
];

export const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Newest",          value: "newest"    },
  { label: "Oldest",          value: "oldest"    },
  { label: "Most Used",       value: "most_used" },
  { label: "Highest Points",  value: "points"    },
];