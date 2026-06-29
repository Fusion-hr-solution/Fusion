import { createPlatformApiClient } from "@repo/api";
import type {
  Difficulty,
  Discipline,
  GradingMethod,
  NewQuestionForm,
  Question,
  QuestionType,
  Test,
  TestCase,
  TestStatus,
} from "@/types";

const client = createPlatformApiClient();

interface BackendPagedResult<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

interface BackendTestDto {
  id: string;
  title: string;
  description: string;
  discipline: string;
  status: string;
  questionTypes: string[];
  maxAttempts?: number | null;
  allowSkipping: boolean;
  allowBacktracking: boolean;
  showProgressBar: boolean;
  randomizeOrder: boolean;
  candidateCount: number;
  questionCount: number;
  createdAt: string;
}
interface UpsertTestRequest {
  title: string;
  description: string;
  discipline: Discipline;
  status: TestStatus;
  maxAttempts?: number | null;
  allowSkipping: boolean;
  allowBacktracking: boolean;
  showProgressBar: boolean;
  randomizeOrder: boolean;
}

interface BackendQuestionDto {
  id: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  gradingMethod: string;
  points: number;
  durationMinutes: number;
  tags: string[];
  usageCount: number;
  options?: Array<{ text: string; correct: boolean }>;
  language?: string;
  starterCode?: string;
  projectFiles?: string;
  evaluationCriteria?: string;
  testCases?: string;
}

interface CreateQuestionRequest {
  type: QuestionType;
  title: string;
  description: string;
  difficulty: Difficulty;
  points: number;
  durationMinutes: number;
  gradingMethod: GradingMethod;
  tags: string[];
  options: Array<{ text: string; correct: boolean }>;
  language: string;
  starterCode: string;
  projectFiles?: string;
  evaluationCriteria: string;
  testCases?: string;
}

const TEST_STATUSES: TestStatus[] = ["Active", "Draft", "Archived"];
const DISCIPLINES: Discipline[] = [
  "Engineering",
  "Design",
  "Product",
  "Data",
  "Marketing",
  "Sales",
  "Operations",
  "Finance",
  "HR",
  ];
const QUESTION_TYPES: QuestionType[] = [
  "Coding",
  "SQL",
  "Multiple Choice",
  "Essay",
  "Case Study",
  "Excel",
  "True/False",
  "Design",
];
const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard", "Expert"];
const GRADING_METHODS: GradingMethod[] = ["Auto-graded", "Hybrid", "Manual"];

function asDiscipline(value: string): Discipline {
  return DISCIPLINES.includes(value as Discipline)
    ? (value as Discipline)
    : "Engineering";
}

function asStatus(value: string): TestStatus {
  return TEST_STATUSES.includes(value as TestStatus)
    ? (value as TestStatus)
    : "Draft";
}

function asQuestionType(value: string): QuestionType {
  return QUESTION_TYPES.includes(value as QuestionType)
    ? (value as QuestionType)
    : "Essay";
}

function asDifficulty(value: string): Difficulty {
  return DIFFICULTIES.includes(value as Difficulty)
    ? (value as Difficulty)
    : "Medium";
}

function asGradingMethod(value: string): GradingMethod {
  return GRADING_METHODS.includes(value as GradingMethod)
    ? (value as GradingMethod)
    : "Manual";
}

function mapTest(dto: BackendTestDto): Test {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    discipline: asDiscipline(dto.discipline),
    status: asStatus(dto.status),
    questionTypes: dto.questionTypes.map(asQuestionType),
    maxAttempts: dto.maxAttempts ?? null,
    allowSkipping: dto.allowSkipping ?? false,
    allowBacktracking: dto.allowBacktracking ?? true,
    showProgressBar: dto.showProgressBar ?? true,
    randomizeOrder: dto.randomizeOrder ?? false,
    candidateCount: dto.candidateCount,
    questionCount: dto.questionCount,
    createdAt: dto.createdAt,
  };
}

function mapQuestion(dto: BackendQuestionDto): Question {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    type: asQuestionType(dto.type),
    difficulty: asDifficulty(dto.difficulty),
    gradingMethod: asGradingMethod(dto.gradingMethod),
    points: dto.points,
    durationMinutes: dto.durationMinutes,
    tags: dto.tags ?? [],
    usageCount: dto.usageCount,
    options: dto.options,
    language: dto.language,
    starterCode: dto.starterCode,
    projectFiles: dto.projectFiles,
    evaluationCriteria: dto.evaluationCriteria,
    testCases: dto.testCases ? tryParseJson(dto.testCases) : undefined,
  };
}

function tryParseJson<T>(value: string): T | undefined {
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function toCreateQuestionRequest(form: NewQuestionForm): CreateQuestionRequest {
  const trimmedOptions = form.options
    .map((option) => ({ text: option.text.trim(), correct: option.correct }))
    .filter((option) => option.text.length > 0);

  const options =
    form.type === "True/False"
      ? [
          {
            text: trimmedOptions[0]?.text || "True",
            correct: trimmedOptions.length > 0
              ? Boolean(trimmedOptions[0]?.correct)
              : true,
          },
          {
            text: trimmedOptions[1]?.text || "False",
            correct: trimmedOptions.length > 1
              ? Boolean(trimmedOptions[1]?.correct)
              : false,
          },
        ]
      : trimmedOptions;

  return {
    type: form.type as QuestionType,
    title: form.title.trim(),
    description: form.description.trim(),
    difficulty: form.difficulty as Difficulty,
    points: form.points,
    durationMinutes: form.durationMinutes,
    gradingMethod: form.gradingMethod as GradingMethod,
    tags: form.tags,
    options,
    language: form.language,
    starterCode: form.starterCode,
    projectFiles: form.projectFiles && form.projectFiles.trim().length > 0 ? form.projectFiles : undefined,
    evaluationCriteria: form.evaluationCriteria,
    testCases: form.testCases.length > 0 ? JSON.stringify(form.testCases) : undefined,
  };
}

export async function getTests(status?: TestStatus): Promise<Test[]> {
  const page = await client.get<BackendPagedResult<BackendTestDto>>("/interview/tests", {
    params: {
      page: 1,
      pageSize: 200,
      ...(status ? { status } : {}),
    },
  });
  return page.items.map(mapTest);
}

export async function getQuestions(): Promise<Question[]> {
  const page = await client.get<BackendPagedResult<BackendQuestionDto>>("/interview/questions", {
    params: { page: 1, pageSize: 500 },
  });
  return page.items.map(mapQuestion);
}

export async function createQuestion(form: NewQuestionForm): Promise<Question> {
  const created = await client.post<BackendQuestionDto>(
    "/interview/questions",
    toCreateQuestionRequest(form)
  );
  return mapQuestion(created);
}

export async function updateQuestion(questionId: string, form: NewQuestionForm): Promise<Question> {
  const updated = await client.put<BackendQuestionDto>(
    `/interview/questions/${questionId}`,
    toCreateQuestionRequest(form)
  );
  return mapQuestion(updated);
}

export interface GenerateQuestionsInput {
  topic: string;
  type?: QuestionType;
  difficulty?: Difficulty;
  gradingMethod?: GradingMethod;
  language?: string;
  points?: number;
  durationMinutes?: number;
  count?: number;
}

/**
 * The /generate endpoint returns unsaved CreateQuestionDto drafts — i.e. a question
 * without the persisted-only `id`/`usageCount`. Modelling that here keeps us from
 * accidentally relying on fields that are undefined at runtime.
 */
type BackendQuestionDraft = Omit<BackendQuestionDto, "id" | "usageCount">;

/**
 * Asks the AI to draft one or more questions. The drafts are returned as editable
 * NewQuestionForm objects — nothing is persisted until they're saved via
 * createQuestion. Throws on failure (e.g. 503 when AI isn't configured).
 */
export async function generateQuestions(input: GenerateQuestionsInput): Promise<NewQuestionForm[]> {
  const drafts = await client.post<BackendQuestionDraft[]>("/interview/questions/generate", {
    topic: input.topic,
    type: input.type,
    difficulty: input.difficulty,
    gradingMethod: input.gradingMethod,
    language: input.language,
    points: input.points,
    durationMinutes: input.durationMinutes,
    count: input.count ?? 1,
  });
  return (drafts ?? []).map(mapDraftToForm);
}

function mapDraftToForm(dto: BackendQuestionDraft): NewQuestionForm {
  const options =
    dto.options && dto.options.length > 0
      ? dto.options.map((o) => ({ text: o.text, correct: o.correct }))
      : [{ text: "", correct: false }, { text: "", correct: false }];

  return {
    type: asQuestionType(dto.type),
    title: dto.title ?? "",
    description: dto.description ?? "",
    difficulty: asDifficulty(dto.difficulty),
    points: dto.points || 10,
    durationMinutes: dto.durationMinutes || 10,
    gradingMethod: asGradingMethod(dto.gradingMethod),
    tags: dto.tags ?? [],
    options,
    language: dto.language || "Python",
    starterCode: dto.starterCode ?? "",
    evaluationCriteria: dto.evaluationCriteria ?? "",
    testCases: dto.testCases ? tryParseJson<TestCase[]>(dto.testCases) ?? [] : [],
  };
}

export async function getTestQuestions(testId: string): Promise<Question[]> {
  const questions = await client.get<BackendQuestionDto[]>(`/interview/tests/${testId}/questions`);
  return questions.map(mapQuestion);
}

export async function deleteTest(testId: string): Promise<void> {
  await client.delete(`/interview/tests/${testId}`);
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await client.delete(`/interview/questions/${questionId}`);
}

interface PersistTestInput {
  testId?: string;
  title: string;
  description: string;
  discipline: Discipline;
  status: TestStatus;
  questionIds: string[];
  maxAttempts?: number | null;
  allowSkipping: boolean;
  allowBacktracking: boolean;
  showProgressBar: boolean;
  randomizeOrder: boolean;
}

function toUpsertTestRequest(input: PersistTestInput): UpsertTestRequest {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    discipline: input.discipline,
    status: input.status,
    maxAttempts: input.maxAttempts ?? null,
    allowSkipping: input.allowSkipping,
    allowBacktracking: input.allowBacktracking,
    showProgressBar: input.showProgressBar,
    randomizeOrder: input.randomizeOrder,
  };
}

async function upsertTest(input: PersistTestInput): Promise<Test> {
  const body = toUpsertTestRequest(input);
  const dto = input.testId
    ? await client.put<BackendTestDto>(`/interview/tests/${input.testId}`, body)
    : await client.post<BackendTestDto>("/interview/tests", body);

  return mapTest(dto);
}

async function getMappedQuestionIds(testId: string): Promise<Set<string>> {
  const mappedQuestions = await client.get<Array<{ id: string }>>(
    `/interview/tests/${testId}/questions`
  );
  return new Set(mappedQuestions.map((question) => question.id));
}

async function syncTestQuestions(testId: string, questionIds: string[]): Promise<void> {
  const desired = new Set(questionIds);
  const current = await getMappedQuestionIds(testId);

  const questionsToAdd = Array.from(desired).filter(
    (questionId) => !current.has(questionId)
  );
  const questionsToRemove = Array.from(current).filter(
    (questionId) => !desired.has(questionId)
  );
  if (questionsToAdd.length > 0) {
    await Promise.all(
      questionsToAdd.map((questionId) =>
        client.post(`/interview/tests/${testId}/questions/${questionId}`)
      )
    );
  }
  if (questionsToRemove.length > 0) {
    await Promise.all(
      questionsToRemove.map((questionId) =>
        client.delete(`/interview/tests/${testId}/questions/${questionId}`)
      )
    );
  }
}

export async function persistTest(input: PersistTestInput): Promise<Test> {
  const saved = await upsertTest(input);
  await syncTestQuestions(saved.id, input.questionIds);
  return saved;
}

export async function setTestStatus(test: Test, status: TestStatus): Promise<Test> {
  return upsertTest({
    testId: test.id,
    title: test.title,
    description: test.description,
    discipline: test.discipline,
    status,
    questionIds: [],
    maxAttempts: test.maxAttempts ?? null,
    allowSkipping: test.allowSkipping,
    allowBacktracking: test.allowBacktracking,
    showProgressBar: test.showProgressBar,
    randomizeOrder: test.randomizeOrder,
  });
}

export async function archiveTest(test: Test): Promise<Test> {
  return setTestStatus(test, "Archived");
}

export async function duplicateTest(test: Test): Promise<Test> {
  const questionIds = (await getTestQuestions(test.id)).map((question) => question.id);
  const duplicateTitle = test.title.includes("(Copy)")
    ? test.title
    : `${test.title} (Copy)`;

  return persistTest({
    title: duplicateTitle,
    description: test.description,
    discipline: test.discipline,
    status: "Draft",
    questionIds,
    maxAttempts: test.maxAttempts ?? null,
    allowSkipping: test.allowSkipping,
    allowBacktracking: test.allowBacktracking,
    showProgressBar: test.showProgressBar,
    randomizeOrder: test.randomizeOrder,
  });
}