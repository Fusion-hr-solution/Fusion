import type {
  Training,
  TrainingCategory,
  TrainingLevel,
  SortOption,
  TrainingStatus,
  EnrolledTraining,
  ExamInfo,
  Course,
  TrainingChapter,
  ChapterContent,
  ChapterListItem,
  TrainingLearnData,
  LearnerExam,
  LearnerExamQuestion,
  ExamSubmissionResult,
  ExamAttempt,
  PartWithSessions,
  AvailableSession,
  MySessionEnrollments,
  MyPartEnrollment,
} from "./index";
import type { NavSection } from "@repo/ui";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
}

export interface CategoryFilterProps {
  selected: TrainingCategory | null;
  onChange: (category: TrainingCategory | null) => void;
}

export interface TrainingCardProps {
  training: Training;
  onSelect: (training: Training) => void;
}

export interface TrainingDetailDialogProps {
  training: Training | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface TrainingCatalogProps {
  trainings: Training[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface StatRowProps {
  label: string;
  value: string;
}

export interface TrainingStatsStripProps {
  duration: string;
  chaptersCount: number;
  enrolledCount: number;
  rating: number;
}

export interface CourseOutlineProps {
  chapters: TrainingChapter[];
}

export interface LevelFilterProps {
  selected: TrainingLevel | null;
  onChange: (level: TrainingLevel | null) => void;
}

export interface SortSelectProps {
  value: SortOption;
  onChange: (sort: SortOption) => void;
}

export interface ActiveFiltersProps {
  category: TrainingCategory | null;
  level: TrainingLevel | null;
  search: string;
  onClearCategory: () => void;
  onClearLevel: () => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

export interface EnrolledTrainingCardProps {
  training: EnrolledTraining;
  onContinue: (training: EnrolledTraining) => void;
}

export interface TrainingProgressBarProps {
  progress: number;
  currentChapter?: number;
  totalChapters?: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export interface TrainingDetailPageProps {
  training: Training;
}

export interface ExamCardProps {
  exam: ExamInfo;
  chaptersCount: number;
  isEnrolled?: boolean;
}

export interface TrainingStatusTabsProps {
  activeTab: TrainingStatus | "all";
  counts: Record<TrainingStatus | "all", number>;
  onChange: (tab: TrainingStatus | "all") => void;
}

/* ── Dashboard components ── */

export interface DashboardProps {
  trainings: Training[];
  enrolledTrainings: EnrolledTraining[];
}

export interface ContinueCardProps {
  training: EnrolledTraining;
}

export interface RecommendedCardProps {
  training: Training;
}

export interface ProgressRingProps {
  completionRate: number;
  avgProgress: number;
  total: number;
  completed: number;
  inProgress: number;
}

export interface CategoryBreakdownProps {
  items: {
    category: TrainingCategory;
    count: number;
    percentage: number;
  }[];
}

export interface AchievementsCardProps {
  completedCount: number;
}

/* ── Training detail sub-components ── */

export interface ChapterListProps {
  chapters: TrainingChapter[];
  chaptersCount: number;
}

export interface ExamSectionProps {
  exam?: ExamInfo;
  chaptersCount: number;
}

export interface InstructorCardProps {
  name: string;
  role: string;
}

export interface MyTrainingsListProps {
  trainings: EnrolledTraining[];
}

export interface CourseCardProps {
  course: Course;
}

export interface SidebarSectionProps {
  section: NavSection;
  activePath: string;
  collapsed: boolean;
}

/* ── Course Player / Learn components ── */

export interface CoursePlayerProps {
  learnData: TrainingLearnData;
}

export interface ChapterSidebarProps {
  chapters: ChapterListItem[];
  activeChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  trainingTitle: string;
  overallProgress: number;
  examAvailable: boolean;
  onOpenExam: () => void;
  isExamActive?: boolean;
}

export interface ChapterContentViewProps {
  chapter: ChapterContent;
  completedBlockIds: Set<string>;
  isLast: boolean;
  onMarkBlockComplete: (blockId: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  hasPrevious: boolean;
  isLoading: boolean;
  examAvailable?: boolean;
  onStartExam?: () => void;
}

export interface ChapterNavigationProps {
  allBlocksCompleted: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrevious: () => void;
  hasPrevious: boolean;
  isLoading: boolean;
  examAvailable?: boolean;
  onStartExam?: () => void;
}

export interface ExamLockedBannerProps {
  completedCount: number;
  totalCount: number;
  examAvailable: boolean;
  onStartExam: () => void;
}

/* ── Learner Exam components ── */

export type ExamPhase = "idle" | "loading" | "intro" | "taking" | "submitting" | "result";

export interface ExamTakingViewProps {
  exam: LearnerExam;
  attempts: ExamAttempt[];
  phase: ExamPhase;
  result: ExamSubmissionResult | null;
  answers: Record<string, string[]>;
  onSetAnswer: (questionId: string, optionIds: string[]) => void;
  onStart: () => void;
  onSubmit: () => void;
  onRetry: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export interface ExamQuestionItemProps {
  question: LearnerExamQuestion;
  index: number;
  selectedOptionIds: string[];
  onSetAnswer: (questionId: string, optionIds: string[]) => void;
}

export interface ExamResultViewProps {
  result: ExamSubmissionResult;
  attempts: ExamAttempt[];
  onRetry: () => void;
  onBack: () => void;
}

/* ── Session Enrollment components (US-5.2.2) ── */

export interface SessionEnrollmentPanelProps {
  trainingId: string;
}

export interface SessionPickerPartProps {
  part: PartWithSessions;
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}

export interface SessionPickerCardProps {
  session: AvailableSession;
  isSelected: boolean;
  onSelect: () => void;
}

export interface EnrollmentStatusPanelProps {
  enrollments: MySessionEnrollments;
  onCancelSession: (sessionId: string) => void;
  isCancelling: boolean;
  availableParts?: PartWithSessions[];
  selections?: Record<string, string>;
  onSelectSession?: (partId: string, sessionId: string) => void;
}

export interface EnrollmentPartRowProps {
  part: MyPartEnrollment;
  onCancel: (sessionId: string) => void;
  isCancelling: boolean;
  availableSessions?: AvailableSession[];
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
}
