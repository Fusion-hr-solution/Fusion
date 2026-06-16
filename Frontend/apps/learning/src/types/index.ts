import type { LucideIcon } from "lucide-react";

export type TrainingLevel = "beginner" | "intermediate" | "advanced";

export type TrainingCategory =
  | "leadership"
  | "technical"
  | "compliance"
  | "soft-skills"
  | "finance"
  | "data-analytics";

export type ContentType = "video" | "pdf" | "article" | "exercise";

export type ChapterLayout = "SingleContent" | "SplitLayout" | "MultiSection";

export type TrainingType = "ELearning" | "OnSite";

export type CostType = "Internal" | "External";

export interface OnSiteCourse {
  id: string;
  title: string;
  contentUri: string;
  orderIndex: number;
}

export interface TrainingChapter {
  id: string;
  title: string;
  layout: ChapterLayout;
  orderIndex: number;
  blockCount: number;
  duration?: string | null;
}

export interface ContentBlock {
  id: string;
  type: ContentType;
  orderIndex: number;
  title: string | null;
  textContent: string | null;
  contentUri: string | null;
  videoUrl: string | null;
  estimatedDurationMinutes: number | null;
  isCompleted: boolean;
}

export interface ChapterContent {
  id: string;
  title: string;
  layout: ChapterLayout;
  orderIndex: number;
  trainingId: string;
  trainingTitle: string;
  totalChapters: number;
  nextChapterId: string | null;
  previousChapterId: string | null;
  isCompleted: boolean;
  contentBlocks: ContentBlock[];
}

export interface ChapterListItem {
  id: string;
  title: string;
  layout: ChapterLayout;
  orderIndex: number;
  blockCount: number;
  completedBlockCount: number;
  isCompleted: boolean;
  completedAt: string | null;
  duration?: string | null;
}

export interface ChapterProgressEntry {
  chapterId: string;
  completed: boolean;
  completedAt: string | null;
}

export interface TrainingLearnData {
  training: Training;
  chapters: ChapterListItem[];
  chapterProgress: ChapterProgressEntry[];
  overallProgress: number;
  status: TrainingStatus;
}

export interface ExamInfo {
  questionsCount: number;
  passingScore: number;
  timeLimit?: string;
  maxAttempts?: number;
}

export type BadgeLevel = "bronze" | "silver" | "gold";

export interface Training {
  id: string;
  title: string;
  description: string;
  category: TrainingCategory;
  level: TrainingLevel;
  duration: string;
  chaptersCount: number;
  chapters: TrainingChapter[];
  instructor: string;
  instructorRole: string;
  enrolledCount: number;
  rating: number;
  imageUrl: string;
  tags: string[];
  updatedAt: string;
  exam?: ExamInfo;
  isMandatory: boolean;
  badgeLevel: BadgeLevel;
  credits: number;
  trainingType: TrainingType;
  costType?: CostType;
  scheduledDate?: string;
  onSiteCourses?: OnSiteCourse[];
}

/** @deprecated Use Training instead */
export interface Course {
  id: string;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  duration: string;
  progress: number;
}

export type TrainingStatus = "in-progress" | "completed" | "not-started";

export type SortOption = "rating" | "newest" | "enrolled" | "duration";

export interface StatusConfigEntry {
  icon: LucideIcon;
  label: string;
  className: string;
  buttonLabel: string;
  buttonClass: string;
}

export interface EnrolledTraining extends Training {
  status: TrainingStatus;
  progress: number;
  enrolledAt: string;
  completedAt?: string;
  currentChapter: number;
  deadline?: string;
}

/* ── Admin / Employee Progress types ── */

export interface EmployeeTrainingRecord {
  trainingId: string;
  trainingTitle: string;
  category: TrainingCategory;
  status: TrainingStatus;
  progress: number;
  enrolledAt: string;
  completedAt?: string;
  deadline?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  avatar?: string;
  trainings: EmployeeTrainingRecord[];
}

/* ── Learner Exam types ── */

export type LearnerQuestionType = "SingleChoice" | "MultipleChoice" | "TrueFalse";

export interface LearnerExam {
  id: string;
  trainingId: string;
  title: string;
  description?: string;
  passingScore: number;
  durationMinutes?: number;
  questionCount: number;
  questions: LearnerExamQuestion[];
}

export interface LearnerExamQuestion {
  id: string;
  questionText: string;
  type: LearnerQuestionType;
  orderIndex: number;
  points: number;
  options: LearnerExamOption[];
}

export interface LearnerExamOption {
  id: string;
  optionText: string;
  orderIndex: number;
}

export interface ExamSubmissionResult {
  attemptId: string;
  score: number;
  passingScore: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  attemptedAt: string;
  trainingCompleted: boolean;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean;
  attemptedAt: string;
}

/* ── Personal in-person training hours ── */

export interface AttendedSession {
  sessionId: string;
  trainingId: string;
  trainingTitle: string;
  partTitle: string;
  startUtc: string;
  endUtc: string;
  room: string;
  hours: number;
}

export interface MyInPersonHours {
  totalHoursYear: number;
  totalHoursQuarter: number;
  totalHoursMonth: number;
  totalHoursAllTime: number;
  inPersonHours: number;
  eLearningHours: number;
  attendedSessions: AttendedSession[];
}

/* ── Grade / ServiceLine / Curriculum types ── */

export interface Grade {
  id: string;
  name: string;
  level: number;
  description?: string;
  icon?: string;
}

export interface ServiceLine {
  id: string;
  name: string;
  code: string;
  color: string;
  description?: string;
  isSharedAcrossAllServiceLines: boolean;
}

export type CursusItemStatus = "not-started" | "in-progress" | "completed";

export interface MyCursusSummary {
  totalCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  requiredCreditsTotal: number;
  requiredCreditsEarned: number;
  estimatedRemainingMinutes: number;
}

export interface MyCursusItem {
  mappingId: string;
  trainingId: string;
  trainingTitle: string;
  trainingDescription: string;
  trainingType: TrainingType;
  credits: number;
  duration: number;
  badgeLevel: BadgeLevel;
  scheduledDate?: string;
  isRequired: boolean;
  orderIndex: number;
  status: CursusItemStatus;
  progressPercentage: number;
  lastActivityAt?: string;
  isFromSharedServiceLine: boolean;
}

export interface MyCursus {
  summary: MyCursusSummary;
  items: MyCursusItem[];
}

/* ── Session Enrollment types (US-5.2.2) ── */

export type EnrollmentStatus = "Enrolled" | "Waitlisted" | "Cancelled" | "Attended" | "NotEnrolled";

export interface AvailableSession {
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

export interface PartWithSessions {
  partId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  durationHours: number;
  sessions: AvailableSession[];
}

export interface AvailableSessionsForEnrollment {
  trainingId: string;
  trainingTitle: string;
  parts: PartWithSessions[];
}

export interface SessionSelection {
  partId: string;
  sessionId: string;
}

export interface EnrollmentResultItem {
  partId: string;
  sessionId: string;
  enrollmentId: string;
  status: EnrollmentStatus;
  waitlistPosition: number;
}

export interface EnrollInSessionsResult {
  trainingId: string;
  enrollments: EnrollmentResultItem[];
}

export interface MyPartEnrollment {
  partId: string;
  partTitle: string;
  orderIndex: number;
  sessionId: string | null;
  sessionStartUtc: string | null;
  sessionEndUtc: string | null;
  room: string | null;
  trainerName: string | null;
  enrollmentStatus: EnrollmentStatus;
  isAttended: boolean;
}

export interface MySessionEnrollments {
  trainingId: string;
  trainingTitle: string;
  totalParts: number;
  completedParts: number;
  isTrainingCompleted: boolean;
  parts: MyPartEnrollment[];
}

/* ── All My Enrollments (cross-training) ── */

export interface MyEnrollmentSession {
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
  status: EnrollmentStatus;
  waitlistPosition: number;
  maxCapacity: number;
  enrolledAt: string;
}

export interface MyEnrollmentSummary {
  trainingId: string;
  trainingTitle: string;
  totalEnrolledParts: number;
  nextSessionUtc: string | null;
  sessions: MyEnrollmentSession[];
}

// --- US-5.3.1 QR attendance ---

export interface SessionQrCode {
  sessionId: string;
  payload: string;
  rotationSeconds: number;
  issuedAt: string;
  refreshAt: string;
  expiresAt: string;
  isRevoked: boolean;
}

export interface ScanQrResult {
  sessionId: string;
  trainingTitle: string;
  partTitle: string;
  sessionStartUtc: string;
  attendedAt: string;
}
