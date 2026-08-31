import {
  CODING_LANGUAGES,
  DIFFICULTIES,
  DISCIPLINES,
  FRONTEND_FRAMEWORKS,
  GRADING_METHODS,
  QUESTION_TYPES,
  TEST_STATUSES,
} from "@/config/constants";

/**
 * The admin-curatable dropdown lists.
 *
 * Six of these are **locked**: their values are pinned to C# enums and are parsed server-side by
 * `switch` expressions that reject anything unrecognised. Settings may relabel, reorder and hide
 * them — never add or remove. The other two are free-form.
 *
 * `DEFAULT_TAXONOMY` is built *from* `@/config/constants`, never hand-listed, so the offline
 * fallback cannot drift from the wire contract and the `Record<QuestionType, true>` exhaustiveness
 * guard in that file still transitively protects it.
 *
 * NOTE: `@/config/constants` remains the sole source for **response validation** in
 * `src/services/` — admin labels must never reach `asQuestionType()` and friends. An ESLint
 * `no-restricted-imports` rule enforces that; see `.eslintrc.js`.
 */
export type TaxonomyListKey =
  | "disciplines"
  | "questionTypes"
  | "difficulties"
  | "gradingMethods"
  | "testStatuses"
  | "frontendFrameworks"
  | "codingLanguages"
  | "questionTags";

export interface TaxonomyItem {
  /** The wire value. Never changes for a locked list. */
  value: string;
  label: string;
  /** Hidden from new-question dropdowns. Existing records keep working. */
  hidden: boolean;
  /** Still matching its canonical default (value known, label untouched). */
  isDefault: boolean;
  /** Coding languages only: false when the grader would silently run it as Python 3. */
  supportsAutoGrading?: boolean;
}

export interface TaxonomyList {
  key: TaxonomyListKey;
  locked: boolean;
  items: TaxonomyItem[];
}

export type Taxonomy = {
  version: number;
  lists: Record<TaxonomyListKey, TaxonomyList>;
};

export const LOCKED_LIST_KEYS: TaxonomyListKey[] = [
  "questionTypes",
  "difficulties",
  "gradingMethods",
  "disciplines",
  "testStatuses",
  "frontendFrameworks",
];

/** Human-facing names for the Settings UI. */
export const TAXONOMY_LIST_LABELS: Record<TaxonomyListKey, string> = {
  disciplines: "Disciplines",
  questionTypes: "Question types",
  difficulties: "Difficulties",
  gradingMethods: "Grading methods",
  testStatuses: "Test statuses",
  frontendFrameworks: "Frontend frameworks",
  codingLanguages: "Coding languages",
  questionTags: "Question tags",
};

function toItems(values: readonly string[]): TaxonomyItem[] {
  return values.map((value) => ({ value, label: value, hidden: false, isDefault: true }));
}

function list(key: TaxonomyListKey, items: TaxonomyItem[]): TaxonomyList {
  return { key, locked: LOCKED_LIST_KEYS.includes(key), items };
}

export const DEFAULT_TAXONOMY: Taxonomy = {
  version: 0,
  lists: {
    disciplines: list("disciplines", toItems(DISCIPLINES)),
    questionTypes: list("questionTypes", toItems(QUESTION_TYPES)),
    difficulties: list("difficulties", toItems(DIFFICULTIES)),
    gradingMethods: list("gradingMethods", toItems(GRADING_METHODS)),
    testStatuses: list("testStatuses", toItems(TEST_STATUSES)),
    frontendFrameworks: list(
      "frontendFrameworks",
      FRONTEND_FRAMEWORKS.map((f) => ({
        value: f.value,
        label: f.label,
        hidden: false,
        isDefault: true,
      }))
    ),
    codingLanguages: list("codingLanguages", toItems(CODING_LANGUAGES)),
    questionTags: list("questionTags", []),
  },
};
