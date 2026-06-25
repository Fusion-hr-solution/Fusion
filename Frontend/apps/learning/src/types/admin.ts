import type { ChapterLayout, TrainingType, FeedbackQuestionType } from "./index";

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
  trainingType: TrainingType;
  scheduledDate?: string;
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
  contentType: string;
  contentUri?: string;
  textContent?: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
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

/** Admin Exam (list / summary view) */
export interface AdminExam {
  id: string;
  title: string;
  passingScore: number;
  questionCount: number;
}

/** Question type enum matching backend QuestionType */
export type QuestionType = "SingleChoice" | "MultipleChoice" | "TrueFalse";

/** Admin Exam full detail (with questions & options) */
export interface AdminExamDetail {
  id: string;
  trainingId: string;
  title: string;
  description?: string;
  passingScore: number;
  durationMinutes?: number;
  createdAt: string;
  updatedAt?: string;
  questions: AdminExamQuestion[];
}

/** Exam question */
export interface AdminExamQuestion {
  id: string;
  questionText: string;
  type: QuestionType;
  orderIndex: number;
  points: number;
  options: AdminExamOption[];
}

/** Exam option */
export interface AdminExamOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

// --- Exam input types ---

export interface CreateExamInput {
  title: string;
  description?: string;
  passingScore: number;
  durationMinutes?: number;
}

export interface UpdateExamInput {
  title: string;
  description?: string;
  passingScore: number;
  durationMinutes?: number;
}

export interface CreateExamQuestionInput {
  questionText: string;
  type: QuestionType;
  points: number;
  options: { optionText: string; isCorrect: boolean }[];
}

export interface UpdateExamQuestionInput {
  questionText: string;
  type: QuestionType;
  points: number;
  options: { optionText: string; isCorrect: boolean }[];
}

/** Admin On-Site Course */
export interface AdminOnSiteCourse {
  id: string;
  title: string;
  contentUri: string;
  orderIndex: number;
  createdAt: string;
}

/** Admin Training full detail (with chapters & exams) */
export interface AdminTrainingDetail extends AdminTraining {
  chapters: AdminChapter[];
  exams: AdminExam[];
  onSiteCourses: AdminOnSiteCourse[];
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
  layout?: ChapterLayout;
  orderIndex: number;
  contentType?: string;
  contentUri?: string;
  textContent?: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
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
  trainingType?: string;
  scheduledDate?: string;
  chapters?: CreateChapterInput[];
  onSiteCourses?: CreateOnSiteCourseInput[];
}

export interface CreateOnSiteCourseInput {
  title: string;
  contentUri: string;
  orderIndex: number;
}

export interface UpdateTrainingInput {
  title: string;
  description?: string;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  duration?: string;
  categoryId: string;
  trainingType?: string;
  scheduledDate?: string;
}

export interface UpdateChapterInput {
  title: string;
  layout?: ChapterLayout;
  contentType?: string;
  contentUri?: string;
  textContent?: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
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

/* ── Admin Grade / ServiceLine / Curriculum / EmployeeProfile types ── */

export interface AdminGrade {
  id: string;
  name: string;
  level: number;
  description?: string;
  icon?: string;
}

export interface AdminServiceLine {
  id: string;
  name: string;
  code: string;
  color: string;
  description?: string;
  isSharedAcrossAllServiceLines: boolean;
}

export interface AdminCurriculumMapping {
  id: string;
  gradeId: string;
  serviceLineId: string;
  trainingId: string;
  trainingTitle: string;
  trainingDescription: string;
  trainingCredits: number;
  trainingType: string;
  trainingDuration: number;
  isRequired: boolean;
  orderIndex: number;
}

export interface AdminCurriculumCell {
  gradeId: string;
  serviceLineId: string;
  formationCount: number;
  isRequiredCount: number;
}

export interface AdminCurriculumMatrix {
  grades: AdminGrade[];
  serviceLines: AdminServiceLine[];
  cells: AdminCurriculumCell[];
}

export interface AdminEmployeeProfile {
  id: string;
  employeeId: string;
  gradeId: string | null;
  gradeName: string | null;
  serviceLineId: string | null;
  serviceLineName: string | null;
  serviceLineColor: string | null;
}

// --- Admin Grade/SL/Curriculum input types ---

export interface CreateGradeInput {
  name: string;
  level: number;
  description?: string;
  icon?: string;
}

export interface UpdateGradeInput {
  name: string;
  level: number;
  description?: string;
  icon?: string;
}

export interface CreateServiceLineInput {
  name: string;
  code: string;
  color: string;
  description?: string;
  isSharedAcrossAllServiceLines?: boolean;
}

export interface UpdateServiceLineInput {
  name: string;
  code: string;
  color: string;
  description?: string;
  isSharedAcrossAllServiceLines?: boolean;
}

export interface AddCurriculumMappingInput {
  gradeId: string;
  serviceLineId: string;
  trainingId: string;
  isRequired?: boolean;
  orderIndex?: number;
}

export interface BulkAssignCurriculumInput {
  trainingId: string;
  isRequired?: boolean;
  gradeIds?: string[];
  serviceLineIds?: string[];
}

export interface ReorderCurriculumCellInput {
  gradeId: string;
  serviceLineId: string;
  mappingIds: string[];
}

export interface UpsertEmployeeProfileInput {
  gradeId?: string | null;
  serviceLineId?: string | null;
}

/* ── Training Parts & Sessions (in-person) ── */

export type SessionStatus = "Planned" | "InProgress" | "Completed" | "Cancelled";

export interface AdminTrainingSession {
  id: string;
  partId: string;
  startUtc: string;
  endUtc: string;
  room: string;
  maxCapacity: number;
  enrolledCount: number;
  notes?: string | null;
  trainerEmployeeId?: string | null;
  trainerName?: string | null;
  trainerEmail?: string | null;
  status: SessionStatus;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface AdminTrainingPart {
  id: string;
  trainingId: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  durationHours: number;
  isLocked: boolean;
  sessionCount: number;
  createdAt: string;
  updatedAt?: string | null;
  sessions: AdminTrainingSession[];
}

export interface AdminSessionListItem {
  id: string;
  partId: string;
  partTitle: string;
  trainingId: string;
  trainingTitle: string;
  startUtc: string;
  endUtc: string;
  room: string;
  maxCapacity: number;
  enrolledCount: number;
  trainerName?: string | null;
  trainerEmployeeId?: string | null;
  status: SessionStatus;
}

export interface AdminSessionAttendee {
  employeeId: string;
  fullName?: string | null;
  email?: string | null;
  status: string;
}

export interface AdminSessionDetail extends AdminSessionListItem {
  notes?: string | null;
  trainerEmail?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  capacityRatio: number;
  capacityWarning: boolean;
  createdAt: string;
  updatedAt?: string | null;
  attendees: AdminSessionAttendee[];
}

export interface RoomConflict {
  sessionId: string;
  partId: string;
  trainingId: string;
  trainingTitle: string;
  partTitle: string;
  room: string;
  startUtc: string;
  endUtc: string;
}

export interface CreatePartInput {
  title: string;
  description?: string;
  durationHours: number;
}

export interface UpdatePartInput extends CreatePartInput {}

export interface CreateSessionInput {
  startUtc: string;
  endUtc: string;
  room: string;
  maxCapacity: number;
  notes?: string;
  trainerEmployeeId?: string;
  trainerName?: string;
  trainerEmail?: string;
}

export interface UpdateSessionInput extends CreateSessionInput {}

export interface CancelSessionInput {
  reason: string;
}

export interface DuplicateSessionInput {
  newStartUtc: string;
  occurrences: number;
  intervalDays: number;
}

export interface SessionsListFilters {
  trainingId?: string;
  fromUtc?: string;
  toUtc?: string;
  status?: SessionStatus;
  trainerEmployeeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Identity user — returned by GET /api/identity/users */
export interface IdentityUser {
  id: string;
  email: string;
  fullName: string;
  department?: string | null;
  jobTitle?: string | null;
  hireDate?: string | null;
  tenantId: string;
}

/* ── Programme Dashboard types ── */

export interface ProgrammeMatrixCell {
  gradeId: string;
  serviceLineId: string;
  employeeCount: number;
  avgCompletionRate: number;
  totalFormations: number;
  completedFormations: number;
}

export interface ProgrammeMatrix {
  grades: AdminGrade[];
  serviceLines: AdminServiceLine[];
  cells: ProgrammeMatrixCell[];
}

export interface CompletionByGrade {
  gradeId: string;
  gradeName: string;
  level: number;
  employeeCount: number;
  avgCompletionRate: number;
}

export interface CompletionByServiceLine {
  serviceLineId: string;
  serviceLineName: string;
  color: string;
  employeeCount: number;
  avgCompletionRate: number;
}

export interface CompletionTrendPoint {
  year: number;
  month: number;
  label: string;
  completionRate: number;
  completedCount: number;
  totalCount: number;
}

export interface CompletionTrend {
  points: CompletionTrendPoint[];
}

export interface CellEmployeeTrainingProgress {
  trainingId: string;
  trainingTitle: string;
  trainingType: string;
  credits: number;
  isRequired: boolean;
  orderIndex: number;
  /** "not-started" | "in-progress" | "completed" | "failed" */
  status: string;
  progressPercentage: number;
  lastActivityAt?: string;
}

export interface CellEmployee {
  employeeId: string;
  gradeName: string;
  serviceLineName: string;
  completedFormations: number;
  totalFormations: number;
  completionPercentage: number;
  lastActivityAt?: string;
  trainingBreakdown: CellEmployeeTrainingProgress[];
}

/* ── Attendance Dashboards (US-5.3.2) ── */

/** "present" | "absent" | "pending" — absence is derived, never stored. */
export type AttendanceStatus = "present" | "absent" | "pending";

export interface SessionAttendanceAttendee {
  employeeId: string;
  employeeName?: string | null;
  employeeEmail?: string | null;
  status: AttendanceStatus;
}

export interface SessionAttendance {
  sessionId: string;
  trainingTitle: string;
  partTitle: string;
  startUtc: string;
  endUtc: string;
  isClosed: boolean;
  presentCount: number;
  absentCount: number;
  pendingCount: number;
  /** Present + Absent (denominator for the rate). */
  countedTotal: number;
  attendanceRate: number;
  attendees: SessionAttendanceAttendee[];
}

export interface EmployeeAttendanceRecord {
  sessionId: string;
  trainingTitle: string;
  partTitle: string;
  sessionDate: string;
  status: AttendanceStatus;
  hours: number;
}

export interface EmployeeAttendanceHistory {
  employeeId: string;
  employeeName?: string | null;
  overallAttendanceRate: number;
  totalInPersonHours: number;
  presentCount: number;
  absentCount: number;
  records: EmployeeAttendanceRecord[];
}

export interface AttendanceByGrade {
  gradeId: string | null;
  gradeName: string;
  level: number;
  attendanceRate: number;
  presentCount: number;
  countedTotal: number;
}

export interface AttendanceTrendPoint {
  year: number;
  month: number;
  label: string;
  attendanceRate: number;
  presentCount: number;
  countedTotal: number;
}

export interface AttendanceTrend {
  points: AttendanceTrendPoint[];
}

export interface AttendanceHeatmapMonth {
  year: number;
  month: number;
  label: string;
}

export interface AttendanceHeatmapCell {
  gradeId: string | null;
  year: number;
  month: number;
  attendanceRate: number;
  presentCount: number;
  countedTotal: number;
}

export interface AttendanceHeatmap {
  grades: AdminGrade[];
  months: AttendanceHeatmapMonth[];
  cells: AttendanceHeatmapCell[];
}

export interface AttendanceSummary {
  overallAttendanceRate: number;
  totalSessions: number;
  totalHoursDelivered: number;
  totalPresent: number;
  totalAbsent: number;
}

/** Optional dimensional filters shared across the aggregated attendance views. */
export interface AttendanceFilters {
  gradeId?: string;
  serviceLineId?: string;
  trainingId?: string;
  from?: string;
  to?: string;
}

/* ── Feedback dashboards (US-8.1.2) ── */

export interface FeedbackTrendPoint {
  year: number;
  month: number;
  label: string;
  avgOverallRating: number;
  responseCount: number;
}

export interface FeedbackComment {
  author: string;
  comment: string;
  overallRating: number;
  submittedAt: string;
  /** Set only in the per-trainer view. */
  trainingTitle?: string;
}

export interface TrainingFeedbackSummary {
  trainingId: string;
  trainingTitle: string;
  totalResponses: number;
  avgOverallRating: number;
  avgContentRating: number;
  avgRelevanceRating: number;
  avgTrainerRating?: number;
  recommendationRate: number;
  /** Overall-rating counts, index 0 = 1★ … 4 = 5★. */
  ratingDistribution: number[];
  monthlyTrend: FeedbackTrendPoint[];
  commentsSuppressed: boolean;
  comments: FeedbackComment[];
}

export interface TrainerFeedbackListItem {
  trainerKey: string;
  trainerName: string;
  sessionsCount: number;
  feedbackCount: number;
  avgTrainerRating: number;
  recommendationRate: number;
}

export interface TrainerTrainingBreakdown {
  trainingId: string;
  trainingTitle: string;
  feedbackCount: number;
  avgTrainerRating: number;
}

export interface TrainerFeedbackDetail {
  trainerKey: string;
  trainerName: string;
  sessionsCount: number;
  feedbackCount: number;
  avgTrainerRating: number;
  recommendationRate: number;
  trainings: TrainerTrainingBreakdown[];
  commentsSuppressed: boolean;
  comments: FeedbackComment[];
}

export interface FeedbackTrainingRating {
  trainingId: string;
  trainingTitle: string;
  avgOverallRating: number;
  responseCount: number;
}

export interface FeedbackOverview {
  totalFeedbacks: number;
  avgOverallRating: number;
  recommendationRate: number;
  responseRate: number;
  ratingDistribution: number[];
  monthlyTrend: FeedbackTrendPoint[];
  topTrainings: FeedbackTrainingRating[];
  bottomTrainings: FeedbackTrainingRating[];
}

export interface FeedbackOverviewFilters {
  categoryId?: string;
  /** "ELearning" | "OnSite" */
  format?: string;
  from?: string;
  to?: string;
}

/* ── Custom feedback form builder (US-8.1.3) ── */

export interface CreateFeedbackQuestionInput {
  categoryId?: string;
  type: FeedbackQuestionType;
  label: string;
  options?: string;
}

export interface UpdateFeedbackQuestionInput {
  label: string;
  options?: string;
}
