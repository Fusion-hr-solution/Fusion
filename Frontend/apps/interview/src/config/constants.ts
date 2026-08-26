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

// Exhaustive by construction: a Record over the union fails to compile when a member is missing,
// so adding a QuestionType forces it into this list. A plain `QuestionType[]` literal accepts a
// subset without complaint — which is exactly how "Frontend Project" went missing from a duplicate
// of this list and silently degraded those questions to "Essay" on read-back.
const QUESTION_TYPE_ORDER: Record<QuestionType, true> = {
  "Coding": true,
  "SQL": true,
  "Multiple Choice": true,
  "Essay": true,
  "Case Study": true,
  "Excel": true,
  "True/False": true,
  "Design": true,
  "Frontend Project": true,
};

export const QUESTION_TYPES = Object.keys(QUESTION_TYPE_ORDER) as QuestionType[];

// Frameworks a "Frontend Project" question can be built/assessed in.
export const FRONTEND_FRAMEWORKS: { label: string; value: string }[] = [
  { label: "React",   value: "react"   },
  { label: "Angular", value: "angular" },
  { label: "Next.js", value: "next"    },
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