import type { TrainingCategory, TrainingLevel, BadgeLevel, ContentType } from "./index";

// --- Backend DTOs (from .NET API) ---

export interface BackendTrainingCategoryDto {
  id: string;
  name: string;
  description: string | null;
  trainingCount: number;
}

/** Catalog chapter (no content, just metadata) */
export interface BackendChapterDto {
  id: string;
  title: string;
  layout: string;
  orderIndex: number;
  blockCount: number;
}

/** Chapter detail for progress view (sidebar) */
export interface BackendChapterDetailDto {
  id: string;
  title: string;
  layout: string;
  orderIndex: number;
  blockCount: number;
  completedBlockCount: number;
}

/** Full chapter content with blocks (loaded on demand) */
export interface BackendChapterContentDto {
  id: string;
  title: string;
  layout: string;
  orderIndex: number;
  trainingId: string;
  trainingTitle: string;
  totalChapters: number;
  nextChapterId: string | null;
  previousChapterId: string | null;
  isCompleted: boolean;
  contentBlocks: BackendContentBlockDto[];
}

export interface BackendContentBlockDto {
  id: string;
  type: string;
  orderIndex: number;
  title: string | null;
  textContent: string | null;
  contentUri: string | null;
  videoUrl: string | null;
  estimatedDurationMinutes: number | null;
  isCompleted: boolean;
}

export interface BackendChapterProgressDto {
  chapterId: string;
  completed: boolean;
  completedAt: string | null;
}

export interface BackendTrainingProgressDto {
  trainingId: string;
  title: string;
  description: string | null;
  categoryName: string;
  duration: string | null;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  status: string;
  progressPercentage: number;
  completedChapters: number;
  totalChapters: number;
  chapters: BackendChapterDetailDto[];
  chapterProgress: BackendChapterProgressDto[];
}

export interface BackendOnSiteCourseDto {
  id: string;
  title: string;
  contentUri: string;
  orderIndex: number;
  createdAt: string;
}

export interface BackendTrainingDto {
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
  trainingType: string;
  scheduledDate: string | null;
  createdAt: string;
}

export interface BackendTrainingDetailDto extends BackendTrainingDto {
  chapters: BackendChapterDto[];
  exams: { id: string; title: string; passingScore: number; questionCount: number }[];
  onSiteCourses: BackendOnSiteCourseDto[];
}

export interface BackendMyTrainingDto {
  trainingId: string;
  title: string;
  description: string | null;
  categoryName: string;
  duration: string | null;
  credits: number;
  isMandatory: boolean;
  badgeLevel: string;
  status: string;
  progressPercentage: number;
  completedChapters: number;
  totalChapters: number;
  startedAt: string | null;
  completedAt: string | null;
  assignmentType: string;
  dueDate: string | null;
}

export interface BackendPagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// --- Mapping records ---

export const CATEGORY_MAP: Record<string, TrainingCategory> = {
  "Technical Skills": "technical",
  "Leadership & Management": "leadership",
  "Compliance & Regulatory": "compliance",
  "Soft Skills": "soft-skills",
  "Data & Analytics": "data-analytics",
};

export const LEVEL_MAP: Record<string, TrainingLevel> = {
  Bronze: "beginner",
  Silver: "intermediate",
  Gold: "advanced",
};

export const BADGE_LEVEL_MAP: Record<string, BadgeLevel> = {
  Bronze: "bronze",
  Silver: "silver",
  Gold: "gold",
};

export const CONTENT_TYPE_MAP: Record<string, ContentType> = {
  Video: "video",
  Pdf: "pdf",
  Article: "article",
  Exercise: "exercise",
};

/* ── Learner Exam DTOs ── */

export interface BackendExamForLearnerDto {
  id: string;
  trainingId: string;
  title: string;
  description: string | null;
  passingScore: number;
  durationMinutes: number | null;
  questionCount: number;
  questions: BackendExamQuestionForLearnerDto[];
}

export interface BackendExamQuestionForLearnerDto {
  id: string;
  questionText: string;
  type: string;
  orderIndex: number;
  points: number;
  options: BackendExamOptionForLearnerDto[];
}

export interface BackendExamOptionForLearnerDto {
  id: string;
  optionText: string;
  orderIndex: number;
}

export interface BackendExamSubmissionResultDto {
  attemptId: string;
  score: number;
  passingScore: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  attemptedAt: string;
  trainingCompleted: boolean;
}

export interface BackendExamAttemptDto {
  id: string;
  examId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  attemptedAt: string;
}

/* ── Admin Backend DTOs ── */

export interface BackendAdminTrainingDto {
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

export interface BackendAdminChapterDto {
  id: string;
  title: string;
  layout: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string | null;
  contentBlocks: BackendAdminContentBlockDto[];
}

export interface BackendAdminContentBlockDto {
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

export interface BackendAdminExamDto {
  id: string;
  title: string;
  passingScore: number;
  questionCount: number;
}

export interface BackendAdminExamDetailDto {
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

export interface BackendAdminExamQuestionDto {
  id: string;
  questionText: string;
  type: string;
  orderIndex: number;
  points: number;
  explanation: string | null;
  options: BackendAdminExamOptionDto[];
}

export interface BackendAdminExamOptionDto {
  id: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

/* ── AI quiz generation (US-8.2.5) ── */

export interface BackendQuizDraftOptionDto {
  text: string;
  isCorrect: boolean;
}

export interface BackendQuizDraftQuestionDto {
  text: string;
  type: string;
  points: number;
  explanation: string | null;
  order: number;
  source: string;
  options: BackendQuizDraftOptionDto[];
}

export interface BackendQuizDraftDto {
  trainingId: string;
  aiAvailable: boolean;
  questions: BackendQuizDraftQuestionDto[];
}

export interface BackendQuizPublishResultDto {
  examId: string;
  publishedCount: number;
}

export interface BackendAdminTrainingDetailDto extends BackendAdminTrainingDto {
  chapters: BackendAdminChapterDto[];
  exams: BackendAdminExamDto[];
  onSiteCourses: BackendOnSiteCourseDto[];
}

export interface BackendAssignmentDto {
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

export interface BackendArticleTemplateDto {
  id: string;
  name: string;
  description: string | null;
  sections: {
    id: string;
    label: string;
    placeholder: string | null;
    orderIndex: number;
  }[];
}

/* ── Session Enrollment DTOs (US-5.2.2) ── */

export interface BackendAvailableSessionDto {
  sessionId: string;
  startUtc: string;
  endUtc: string;
  room: string;
  trainerName: string | null;
  trainerEmail: string | null;
  maxCapacity: number;
  enrolledCount: number;
  availableSpots: number;
  isFull: boolean;
  status: string;
}

export interface BackendPartWithSessionsDto {
  partId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  durationHours: number;
  sessions: BackendAvailableSessionDto[];
}

export interface BackendAvailableSessionsForEnrollmentDto {
  trainingId: string;
  trainingTitle: string;
  parts: BackendPartWithSessionsDto[];
}

export interface BackendEnrollmentResultItemDto {
  partId: string;
  sessionId: string;
  enrollmentId: string;
  status: string;
  waitlistPosition: number;
}

export interface BackendEnrollInSessionsResultDto {
  trainingId: string;
  enrollments: BackendEnrollmentResultItemDto[];
}

export interface BackendMyPartEnrollmentDto {
  partId: string;
  partTitle: string;
  orderIndex: number;
  sessionId: string | null;
  sessionStartUtc: string | null;
  sessionEndUtc: string | null;
  room: string | null;
  trainerName: string | null;
  enrollmentStatus: string;
  isAttended: boolean;
}

export interface BackendMySessionEnrollmentsDto {
  trainingId: string;
  trainingTitle: string;
  totalParts: number;
  completedParts: number;
  isTrainingCompleted: boolean;
  parts: BackendMyPartEnrollmentDto[];
}

/* ── All My Enrollments (cross-training) ── */

export interface BackendMyEnrollmentSessionDto {
  enrollmentId: string;
  sessionId: string;
  partId: string;
  partTitle: string;
  partOrderIndex: number;
  startUtc: string;
  endUtc: string;
  room: string;
  trainerName: string | null;
  trainerEmail: string | null;
  status: string;
  waitlistPosition: number;
  maxCapacity: number;
  enrolledAt: string;
}

export interface BackendMyEnrollmentSummaryDto {
  trainingId: string;
  trainingTitle: string;
  totalEnrolledParts: number;
  nextSessionUtc: string | null;
  sessions: BackendMyEnrollmentSessionDto[];
}

// --- US-5.3.1 QR attendance ---

export interface BackendSessionQrCodeDto {
  sessionId: string;
  payload: string;
  rotationSeconds: number;
  issuedAt: string;
  refreshAt: string;
  expiresAt: string;
  isRevoked: boolean;
}

export interface BackendScanQrResultDto {
  sessionId: string;
  trainingTitle: string;
  partTitle: string;
  sessionStartUtc: string;
  attendedAt: string;
}

// --- US-8.1.1 Feedback ---

export interface BackendPendingFeedbackDto {
  trainingId: string;
  trainingTitle: string;
  trainingType: string;
  completedAt: string;
}

export interface BackendSubmitFeedbackRequest {
  trainingId: string;
  overallRating: number;
  contentRating: number;
  relevanceRating: number;
  trainerRating?: number;
  wouldRecommend: boolean;
  comment?: string;
  suggestions?: string;
  isAnonymous: boolean;
  answers: { questionId: string; value: string }[];
}

export interface BackendFeedbackQuestionDto {
  id: string;
  categoryId?: string | null;
  type: string;
  label: string;
  order: number;
  options?: string | null;
}

// --- US-8.1.3 Trainer-to-group feedback ---

export interface BackendTrainerSessionDto {
  sessionId: string;
  trainingTitle: string;
  partTitle: string;
  startUtc: string;
  endUtc: string;
  room: string;
  status: string;
  hasGroupFeedback: boolean;
}

export interface BackendTrainerGroupFeedbackDto {
  sessionId: string;
  trainerEmployeeId: string;
  trainerName: string;
  groupEngagement: number;
  knowledgeLevel: number;
  comments?: string | null;
  prerequisiteSuggestions?: string | null;
  submittedAt: string;
}

// --- US-8.1.2 Admin feedback dashboards ---

export interface BackendFeedbackTrendPointDto {
  year: number;
  month: number;
  label: string;
  avgOverallRating: number;
  responseCount: number;
}

export interface BackendFeedbackCommentDto {
  author: string;
  comment: string;
  overallRating: number;
  submittedAt: string;
  trainingTitle?: string | null;
}

export interface BackendTrainingFeedbackSummaryDto {
  trainingId: string;
  trainingTitle: string;
  totalResponses: number;
  avgOverallRating: number;
  avgContentRating: number;
  avgRelevanceRating: number;
  avgTrainerRating?: number | null;
  recommendationRate: number;
  ratingDistribution: number[];
  monthlyTrend: BackendFeedbackTrendPointDto[];
  commentsSuppressed: boolean;
  comments: BackendFeedbackCommentDto[];
}

export interface BackendTrainerFeedbackListItemDto {
  trainerKey: string;
  trainerName: string;
  sessionsCount: number;
  feedbackCount: number;
  avgTrainerRating: number;
  recommendationRate: number;
}

export interface BackendTrainerTrainingBreakdownDto {
  trainingId: string;
  trainingTitle: string;
  feedbackCount: number;
  avgTrainerRating: number;
}

export interface BackendTrainerFeedbackDetailDto {
  trainerKey: string;
  trainerName: string;
  sessionsCount: number;
  feedbackCount: number;
  avgTrainerRating: number;
  recommendationRate: number;
  trainings: BackendTrainerTrainingBreakdownDto[];
  commentsSuppressed: boolean;
  comments: BackendFeedbackCommentDto[];
}

export interface BackendFeedbackTrainingRatingDto {
  trainingId: string;
  trainingTitle: string;
  avgOverallRating: number;
  responseCount: number;
}

export interface BackendFeedbackOverviewDto {
  totalFeedbacks: number;
  avgOverallRating: number;
  recommendationRate: number;
  responseRate: number;
  ratingDistribution: number[];
  monthlyTrend: BackendFeedbackTrendPointDto[];
  topTrainings: BackendFeedbackTrainingRatingDto[];
  bottomTrainings: BackendFeedbackTrainingRatingDto[];
}
