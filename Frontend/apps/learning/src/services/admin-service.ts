import { ApiError, createPlatformApiClient } from "@repo/api";
import type {
  AdminTraining,
  AdminTrainingDetail,
  AdminChapter,
  AdminContentBlock,
  AdminAssignment,
  AdminCategory,
  AdminOnSiteCourse,
  AdminExamDetail,
  ArticleTemplate,
  AdminGrade,
  AdminServiceLine,
  AdminCurriculumMatrix,
  AdminCurriculumMapping,
  AdminEmployeeProfile,
  CreateTrainingInput,
  UpdateTrainingInput,
  CreateChapterInput,
  UpdateChapterInput,
  CreateContentBlockInput,
  UpdateContentBlockInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  AssignTrainingInput,
  CreateOnSiteCourseInput,
  CreateExamInput,
  UpdateExamInput,
  CreateExamQuestionInput,
  UpdateExamQuestionInput,
  CreateGradeInput,
  UpdateGradeInput,
  CreateServiceLineInput,
  UpdateServiceLineInput,
  AddCurriculumMappingInput,
  BulkAssignCurriculumInput,
  ReorderCurriculumCellInput,
  UpsertEmployeeProfileInput,
  IdentityUser,
  ProgrammeMatrix,
  CompletionByGrade,
  CompletionByServiceLine,
  CompletionTrend,
  CellEmployee,
} from "@/types/admin";
import type { ChapterLayout, TrainingType } from "@/types";

// --- Backend DTOs (mirror .NET API responses) ---

interface BackendAdminTrainingDto {
  id: string;
  title: string;
  description: string | null;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  duration: string | null;
  categoryId: string;
  categoryName: string;
  chapterCount: number;
  enrollmentCount: number;
  trainingType: string;
  scheduledDate: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

interface BackendAdminChapterDto {
  id: string;
  title: string;
  layout: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string | null;
  contentBlocks: BackendAdminContentBlockDto[];
}

interface BackendAdminContentBlockDto {
  id: string;
  type: string;
  orderIndex: number;
  title: string | null;
  textContent: string | null;
  contentUri: string | null;
  videoUrl: string | null;
  estimatedDurationMinutes: number | null;
  createdAt: string;
  updatedAt: string | null;
}

interface BackendExamDto {
  id: string;
  title: string;
  passingScore: number;
  questionCount: number;
}

interface BackendAdminExamDetailDto {
  id: string;
  trainingId: string;
  title: string;
  description: string | null;
  passingScore: number;
  durationMinutes: number | null;
  createdAt: string;
  updatedAt: string | null;
  questions: BackendAdminExamQuestionDto[];
}

interface BackendAdminExamQuestionDto {
  id: string;
  questionText: string;
  type: string;
  orderIndex: number;
  points: number;
  options: BackendAdminExamOptionDto[];
}

interface BackendAdminExamOptionDto {
  id: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

interface BackendAdminTrainingDetailDto extends BackendAdminTrainingDto {
  chapters: BackendAdminChapterDto[];
  exams: BackendExamDto[];
  onSiteCourses: BackendOnSiteCourseDto[];
}

interface BackendOnSiteCourseDto {
  id: string;
  title: string;
  contentUri: string;
  orderIndex: number;
  createdAt: string;
}

interface BackendAssignmentDto {
  id: string;
  trainingId: string;
  trainingTitle: string;
  employeeId: string;
  assignmentType: string;
  assignedAt: string;
  dueDate: string | null;
  status: string | null;
  progressPercentage: number;
}

interface BackendCategoryDto {
  id: string;
  name: string;
  description: string | null;
  trainingCount: number;
}

interface BackendPagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface BackendArticleTemplateDto {
  id: string;
  name: string;
  description: string | null;
  sections: { id: string; label: string; placeholder: string | null; orderIndex: number }[];
}

// --- Mapping helpers ---

function mapTraining(dto: BackendAdminTrainingDto): AdminTraining {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description ?? "",
    credits: dto.credits,
    isMandatory: dto.isMandatory,
    badgeLevel: dto.badgeLevel,
    duration: dto.duration ?? "",
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    chapterCount: dto.chapterCount,
    enrollmentCount: dto.enrollmentCount,
    trainingType: (dto.trainingType ?? "ELearning") as TrainingType,
    scheduledDate: dto.scheduledDate ?? undefined,
    isDeleted: dto.isDeleted,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
  };
}

function mapChapter(dto: BackendAdminChapterDto): AdminChapter {
  const contentBlocks = dto.contentBlocks ?? [];
  const primaryBlock = contentBlocks[0];

  return {
    id: dto.id,
    title: dto.title,
    layout: dto.layout as ChapterLayout,
    orderIndex: dto.orderIndex,
    contentType: primaryBlock?.type ?? "Article",
    contentUri: primaryBlock?.contentUri ?? undefined,
    textContent: primaryBlock?.textContent ?? undefined,
    videoUrl: primaryBlock?.videoUrl ?? undefined,
    estimatedDurationMinutes: primaryBlock?.estimatedDurationMinutes ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
    contentBlocks: contentBlocks.map(mapContentBlock),
  };
}

function normalizeChapterPayload(input: CreateChapterInput | UpdateChapterInput) {
  if ("contentBlocks" in input && input.contentBlocks?.length) {
    return input;
  }

  const contentType = input.contentType?.trim();
  if (!contentType) {
    return {
      ...input,
      layout: input.layout ?? "SingleContent",
    };
  }

  return {
    title: input.title,
    layout: input.layout ?? "SingleContent",
    ...("orderIndex" in input ? { orderIndex: input.orderIndex } : {}),
    contentBlocks: [
      {
        type: contentType,
        orderIndex: 0,
        title: input.title,
        textContent: input.textContent,
        contentUri: input.contentUri,
        videoUrl: input.videoUrl,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
      },
    ],
  };
}

function mapContentBlock(dto: BackendAdminContentBlockDto): AdminContentBlock {
  return {
    id: dto.id,
    type: dto.type,
    orderIndex: dto.orderIndex,
    title: dto.title ?? undefined,
    textContent: dto.textContent ?? undefined,
    contentUri: dto.contentUri ?? undefined,
    videoUrl: dto.videoUrl ?? undefined,
    estimatedDurationMinutes: dto.estimatedDurationMinutes ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
  };
}

function mapTrainingDetail(dto: BackendAdminTrainingDetailDto): AdminTrainingDetail {
  return {
    ...mapTraining(dto),
    chapters: dto.chapters.map(mapChapter),
    exams: dto.exams.map((e) => ({
      id: e.id,
      title: e.title,
      passingScore: e.passingScore,
      questionCount: e.questionCount,
    })),
    onSiteCourses: (dto.onSiteCourses ?? []).map(mapOnSiteCourse),
  };
}

function mapOnSiteCourse(dto: BackendOnSiteCourseDto): AdminOnSiteCourse {
  return {
    id: dto.id,
    title: dto.title,
    contentUri: dto.contentUri,
    orderIndex: dto.orderIndex,
    createdAt: dto.createdAt,
  };
}

function mapAssignment(dto: BackendAssignmentDto): AdminAssignment {
  return {
    id: dto.id,
    trainingId: dto.trainingId,
    trainingTitle: dto.trainingTitle,
    employeeId: dto.employeeId,
    assignmentType: dto.assignmentType,
    assignedAt: dto.assignedAt,
    dueDate: dto.dueDate ?? undefined,
    status: dto.status ?? "NotStarted",
    progressPercentage: dto.progressPercentage,
  };
}

function mapCategory(dto: BackendCategoryDto): AdminCategory {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    trainingCount: dto.trainingCount,
  };
}

// --- API client ---
const client = createPlatformApiClient();

// --- Training CRUD ---

export async function getAdminTrainings(params?: {
  categoryId?: string;
  search?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ trainings: AdminTraining[]; totalCount: number; page: number; pageSize: number }> {
  const data = await client.get<BackendPagedResponse<BackendAdminTrainingDto>>(
    "/training/admin/trainings",
    { params },
  );
  return {
    trainings: data.items.map(mapTraining),
    totalCount: data.totalCount,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function getAdminTrainingDetail(trainingId: string): Promise<AdminTrainingDetail> {
  const data = await client.get<BackendAdminTrainingDetailDto>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}`,
  );
  return mapTrainingDetail(data);
}

export async function createTraining(input: CreateTrainingInput): Promise<string> {
  return client.post<string>("/training/admin/trainings", input);
}

export async function updateTraining(trainingId: string, input: UpdateTrainingInput): Promise<void> {
  await client.put("/training/admin/trainings/" + encodeURIComponent(trainingId), input);
}

export async function deleteTraining(trainingId: string): Promise<void> {
  await client.delete("/training/admin/trainings/" + encodeURIComponent(trainingId));
}

// --- Chapter CRUD ---

export async function addChapter(trainingId: string, input: CreateChapterInput): Promise<string> {
  return client.post<string>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters`,
    normalizeChapterPayload(input),
  );
}

export async function updateChapter(
  trainingId: string,
  chapterId: string,
  input: UpdateChapterInput,
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}`,
    {
      title: input.title,
      layout: input.layout ?? "SingleContent",
    },
  );
}

export async function deleteChapter(trainingId: string, chapterId: string): Promise<void> {
  await client.delete(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}`,
  );
}

export async function reorderChapters(trainingId: string, chapterIds: string[]): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/reorder`,
    { chapterIds },
  );
}

// --- File upload ---

export async function uploadChapterFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  return client.post<string>("/training/admin/uploads", form);
}

// --- Assignment management ---

export async function getTrainingAssignments(trainingId: string): Promise<AdminAssignment[]> {
  return client
    .get<BackendAssignmentDto[]>(
      `/training/admin/trainings/${encodeURIComponent(trainingId)}/assignments`,
    )
    .then((data) => data.map(mapAssignment));
}

export async function assignTraining(
  trainingId: string,
  input: AssignTrainingInput,
): Promise<string> {
  return client.post<string>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/assignments`,
    { trainingId, ...input },
  );
}

// --- Category CRUD ---

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const data = await client.get<BackendCategoryDto[]>("/training/admin/categories");
  return data.map(mapCategory);
}

export async function createCategory(input: CreateCategoryInput): Promise<string> {
  return client.post<string>("/training/admin/categories", input);
}

export async function updateCategory(categoryId: string, input: UpdateCategoryInput): Promise<void> {
  await client.put("/training/admin/categories/" + encodeURIComponent(categoryId), input);
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await client.delete("/training/admin/categories/" + encodeURIComponent(categoryId));
}

// --- Content Block CRUD ---

export async function addContentBlock(
  trainingId: string,
  chapterId: string,
  input: CreateContentBlockInput,
): Promise<string> {
  return client.post<string>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks`,
    input,
  );
}

export async function updateContentBlock(
  trainingId: string,
  chapterId: string,
  contentBlockId: string,
  input: UpdateContentBlockInput,
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/${encodeURIComponent(contentBlockId)}`,
    input,
  );
}

export async function deleteContentBlock(
  trainingId: string,
  chapterId: string,
  contentBlockId: string,
): Promise<void> {
  await client.delete(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/${encodeURIComponent(contentBlockId)}`,
  );
}

export async function reorderContentBlocks(
  trainingId: string,
  chapterId: string,
  contentBlockIds: string[],
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/chapters/${encodeURIComponent(chapterId)}/content-blocks/reorder`,
    { contentBlockIds },
  );
}

// --- On-Site Course CRUD ---

export async function addOnSiteCourse(
  trainingId: string,
  input: CreateOnSiteCourseInput,
): Promise<string> {
  return client.post<string>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/onsite-courses`,
    input,
  );
}

export async function updateOnSiteCourse(
  trainingId: string,
  courseId: string,
  input: CreateOnSiteCourseInput,
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/onsite-courses/${encodeURIComponent(courseId)}`,
    input,
  );
}

export async function deleteOnSiteCourse(
  trainingId: string,
  courseId: string,
): Promise<void> {
  await client.delete(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/onsite-courses/${encodeURIComponent(courseId)}`,
  );
}

export async function reorderOnSiteCourses(
  trainingId: string,
  courseIds: string[],
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/onsite-courses/reorder`,
    { courseIds },
  );
}

// --- Article Templates ---

export async function getArticleTemplates(): Promise<ArticleTemplate[]> {
  const data = await client.get<BackendArticleTemplateDto[]>("/training/admin/article-templates");
  return data.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    sections: template.sections.map((section) => ({
      id: section.id,
      label: section.label,
      placeholder: section.placeholder ?? "",
      orderIndex: section.orderIndex,
    })),
  }));
}

// --- Exam CRUD ---

function mapExamDetail(dto: BackendAdminExamDetailDto): AdminExamDetail {
  return {
    id: dto.id,
    trainingId: dto.trainingId,
    title: dto.title,
    description: dto.description ?? undefined,
    passingScore: dto.passingScore,
    durationMinutes: dto.durationMinutes ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? undefined,
    questions: dto.questions
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((q) => ({
        id: q.id,
        questionText: q.questionText,
        type: q.type as AdminExamDetail["questions"][number]["type"],
        orderIndex: q.orderIndex,
        points: q.points,
        options: q.options
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((o) => ({
            id: o.id,
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            orderIndex: o.orderIndex,
          })),
      })),
  };
}

export async function getAdminExamDetail(trainingId: string): Promise<AdminExamDetail | null> {
  try {
    const data = await client.get<BackendAdminExamDetailDto>(
      `/training/admin/trainings/${encodeURIComponent(trainingId)}/exam`,
    );
    return mapExamDetail(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function createExam(trainingId: string, input: CreateExamInput): Promise<string> {
  return client.post<string>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/exam`,
    input,
  );
}

export async function updateExam(trainingId: string, examId: string, input: UpdateExamInput): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}`,
    input,
  );
}

export async function deleteExam(trainingId: string, examId: string): Promise<void> {
  await client.delete(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}`,
  );
}

export async function addExamQuestion(
  trainingId: string,
  examId: string,
  input: CreateExamQuestionInput,
): Promise<string> {
  return client.post<string>(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}/questions`,
    input,
  );
}

export async function updateExamQuestion(
  trainingId: string,
  examId: string,
  questionId: string,
  input: UpdateExamQuestionInput,
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}`,
    input,
  );
}

export async function deleteExamQuestion(
  trainingId: string,
  examId: string,
  questionId: string,
): Promise<void> {
  await client.delete(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}`,
  );
}

export async function reorderExamQuestions(
  trainingId: string,
  examId: string,
  questionIds: string[],
): Promise<void> {
  await client.put(
    `/training/admin/trainings/${encodeURIComponent(trainingId)}/exam/${encodeURIComponent(examId)}/questions/reorder`,
    { questionIds },
  );
}

// --- Grade CRUD ---

export async function getGrades(): Promise<AdminGrade[]> {
  return client.get<AdminGrade[]>("/training/admin/grades");
}

export async function createGrade(input: CreateGradeInput): Promise<string> {
  return client.post<string>("/training/admin/grades", input);
}

export async function updateGrade(gradeId: string, input: UpdateGradeInput): Promise<void> {
  await client.put("/training/admin/grades/" + encodeURIComponent(gradeId), input);
}

export async function deleteGrade(gradeId: string): Promise<void> {
  await client.delete("/training/admin/grades/" + encodeURIComponent(gradeId));
}

// --- Service Line CRUD ---

export async function getServiceLines(): Promise<AdminServiceLine[]> {
  return client.get<AdminServiceLine[]>("/training/admin/service-lines");
}

export async function createServiceLine(input: CreateServiceLineInput): Promise<string> {
  return client.post<string>("/training/admin/service-lines", input);
}

export async function updateServiceLine(serviceLineId: string, input: UpdateServiceLineInput): Promise<void> {
  await client.put("/training/admin/service-lines/" + encodeURIComponent(serviceLineId), input);
}

export async function deleteServiceLine(serviceLineId: string): Promise<void> {
  await client.delete("/training/admin/service-lines/" + encodeURIComponent(serviceLineId));
}

// --- Curriculum ---

export async function getCurriculumMatrix(): Promise<AdminCurriculumMatrix> {
  return client.get<AdminCurriculumMatrix>("/training/admin/curriculum/matrix");
}

export async function getCurriculumCell(gradeId: string, serviceLineId: string): Promise<AdminCurriculumMapping[]> {
  return client.get<AdminCurriculumMapping[]>(
    `/training/admin/curriculum?gradeId=${encodeURIComponent(gradeId)}&serviceLineId=${encodeURIComponent(serviceLineId)}`,
  );
}

export async function addCurriculumMapping(input: AddCurriculumMappingInput): Promise<string> {
  return client.post<string>("/training/admin/curriculum", input);
}

export async function updateCurriculumMapping(mappingId: string, isRequired: boolean): Promise<void> {
  await client.put("/training/admin/curriculum/" + encodeURIComponent(mappingId), { isRequired });
}

export async function removeCurriculumMapping(mappingId: string): Promise<void> {
  await client.delete("/training/admin/curriculum/" + encodeURIComponent(mappingId));
}

export async function reorderCurriculumCell(input: ReorderCurriculumCellInput): Promise<void> {
  await client.put("/training/admin/curriculum/cell/reorder", input);
}

export async function bulkAssignCurriculum(input: BulkAssignCurriculumInput): Promise<number> {
  return client.post<number>("/training/admin/curriculum/bulk", input);
}

// --- Employee Profiles ---

interface BackendPagedEmployeeProfiles {
  items: AdminEmployeeProfile[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function getEmployeeProfiles(
  page = 1,
  pageSize = 20,
): Promise<BackendPagedEmployeeProfiles> {
  return client.get<BackendPagedEmployeeProfiles>(
    `/training/admin/employee-profiles?page=${page}&pageSize=${pageSize}`,
  );
}

export async function upsertEmployeeProfile(
  employeeId: string,
  input: UpsertEmployeeProfileInput,
): Promise<void> {
  await client.put(
    "/training/admin/employee-profiles/" + encodeURIComponent(employeeId),
    input,
  );
}

// --- Identity Users (for display purposes) ---

export async function getIdentityUsers(): Promise<IdentityUser[]> {
  return client.get<IdentityUser[]>("/identity/users");
}

// --- Programme Dashboard ---

export async function getProgrammeMatrix(): Promise<ProgrammeMatrix> {
  return client.get<ProgrammeMatrix>("/training/admin/dashboard/programme-matrix");
}

export async function getCompletionByGrade(): Promise<CompletionByGrade[]> {
  return client.get<CompletionByGrade[]>("/training/admin/dashboard/completion-by-grade");
}

export async function getCompletionByServiceLine(): Promise<CompletionByServiceLine[]> {
  return client.get<CompletionByServiceLine[]>("/training/admin/dashboard/completion-by-service-line");
}

export async function getCompletionTrend(): Promise<CompletionTrend> {
  return client.get<CompletionTrend>("/training/admin/dashboard/completion-trend");
}

export async function getCellEmployees(
  gradeId: string,
  serviceLineId: string,
): Promise<CellEmployee[]> {
  return client.get<CellEmployee[]>(
    `/training/admin/dashboard/cell-employees?gradeId=${encodeURIComponent(gradeId)}&serviceLineId=${encodeURIComponent(serviceLineId)}`,
  );
}

