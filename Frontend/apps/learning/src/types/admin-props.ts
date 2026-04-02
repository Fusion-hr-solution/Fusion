import type { AdminCategory, AdminChapter, AdminTraining } from "./admin";
import type { Employee, Training, TrainingCategory, TrainingStatus } from "./index";

/* ── Admin page-level components ── */

export interface AdminDashboardProps {
  employees: Employee[];
  trainings: Training[];
}

export interface TrainingFormProps {
  trainingId?: string;
}

export interface TrainingDetailViewProps {
  trainingId: string;
}

export interface TrainingFormDialogProps {
  trainingId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export interface ChapterFormDialogProps {
  trainingId: string;
  chapter: AdminChapter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/* ── Admin sub-components ── */

export interface EmployeeRowProps {
  employee: Employee;
  expanded: boolean;
  onToggle: () => void;
  statusFilter: TrainingStatus | "all";
}

export interface CompletionFunnelProps {
  completed: number;
  inProgress: number;
  notStarted: number;
  total: number;
}

export interface CategoryPerformanceProps {
  items: { category: TrainingCategory; total: number; completed: number; rate: number }[];
}

export interface TopTrainingsProps {
  items: {
    title: string;
    enrolled: number;
    completed: number;
    avgProgress: number;
    completionRate: number;
  }[];
}

export interface MetaCardProps {
  label: string;
  value: string;
}

export interface TrainingRowProps {
  training: AdminTraining;
  isDeleting: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

export interface CategoryFormProps {
  category?: AdminCategory;
  onSaved: () => void;
  onCancel: () => void;
}

/* ── Multi-step wizard ── */

export interface StepIndicatorProps {
  steps: { label: string; icon: React.ReactNode }[];
  currentStep: number;
}

export interface TrainingFormBasicStepProps {
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  categoryId: string;
  onCategoryChange: (v: string) => void;
  categories: AdminCategory[];
  badgeLevel: string;
  onBadgeLevelChange: (v: string) => void;
  fieldErrors?: Record<string, string>;
}

export interface TrainingFormDetailsStepProps {
  credits: number;
  onCreditsChange: (v: number) => void;
  duration: string;
  onDurationChange: (v: string) => void;
  isMandatory: boolean;
  onMandatoryChange: (v: boolean) => void;
  fieldErrors?: Record<string, string>;
}

export interface TrainingFormReviewStepProps {
  title: string;
  description: string;
  categoryName: string;
  badgeLevel: string;
  credits: number;
  duration: string;
  isMandatory: boolean;
}

export interface ChapterFormInfoStepProps {
  title: string;
  onTitleChange: (v: string) => void;
  contentType: string;
  onContentTypeChange: (v: string) => void;
  orderIndex: number;
  onOrderIndexChange: (v: number) => void;
  fieldErrors?: Record<string, string>;
}

export interface ChapterFormContentStepProps {
  contentType: string;
  contentUri: string;
  onContentUriChange: (v: string) => void;
  textContent: string;
  onTextContentChange: (v: string) => void;
  videoUrl: string;
  onVideoUrlChange: (v: string) => void;
  estimatedDuration: number | "";
  onEstimatedDurationChange: (v: number | "") => void;
  fieldErrors?: Record<string, string>;
}
