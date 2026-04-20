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
  options?: { text: string; correct: boolean }[];
  language?: string;
  starterCode?: string;
  evaluationCriteria?: string;
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
    allowBacktracking: boolean;
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

export interface Interview {
  id: string;
  candidate: string;
  role: string;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  date: string;
}

export interface CandidateManagementOverview {
  pendingInvitations: number;
  deliveryFailed: number;
  expiringLinks: number;
  inProgressCandidates: number;
  retakeRequests: number;
  pendingDeletion: number;
  generatedAtUtc: string;
}

export interface CandidateInvitation {
  id: string;
  testId: string;
  testTitle: string;
  email: string;
  candidateName?: string;
  status: "Invited" | "DeliveryFailed" | "InProgress" | "Submitted" | "Expired";
  deadlineUtc?: string;
  inviteMethod?: "email" | "bulk" | "link";
  linkExpiryHours?: number;
  tokenCreatedAtUtc?: string;
  tokenExpiresAtUtc?: string;
  timeLimitMinutes?: number;
  customMessage?: string;
  inviteLink: string;
  createdAtUtc: string;
  lastSentAtUtc: string;
  resendCount: number;
  opensCount: number;
}

export type LinkValidityUnit = "days" | "hours" | "minutes";
export type GracePeriodUnit = "minutes" | "hours";

export interface CandidateLinkSecuritySettings {
  singleUseLinkEnabled: boolean;
  emailVerificationEnabled: boolean;
  ipLockEnabled: boolean;
  browserFingerprintEnabled: boolean;
  linkValidForValue: number;
  linkValidForUnit: LinkValidityUnit;
  gracePeriodValue: number;
  gracePeriodUnit: GracePeriodUnit;
}

export interface CandidateLinkPreview {
  hasInvitation: boolean;
  invitationId?: string;
  inviteLink?: string;
  opensCount: number;
  allowedUses?: number;
  tokenExpiresAtUtc?: string;
  securityLevel: "Low" | "Medium" | "High";
}

export interface CandidateLinkSecurityState {
  testId: string;
  testTitle: string;
  settings: CandidateLinkSecuritySettings;
  preview: CandidateLinkPreview;
}