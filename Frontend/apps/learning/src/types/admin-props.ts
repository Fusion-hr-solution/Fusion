import type { AdminCategory, AdminChapter, AdminTraining, ArticleTemplate, ArticleTemplateSection, WizardChapter } from "./admin";
import type { Employee, Training, TrainingCategory, TrainingStatus } from "./index";

/* ── Wizard shared state (used by create + edit wizards) ── */

export interface WizardState {
  step: number;
  setStep: (step: number) => void;
  formError: string | null;
  setFormError: (error: string | null) => void;
  isSubmitting: boolean;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  badgeLevel: string;
  setBadgeLevel: (v: string) => void;
  categories: AdminCategory[];
  credits: number;
  setCredits: (v: number) => void;
  duration: string;
  setDuration: (v: string) => void;
  isMandatory: boolean;
  setIsMandatory: (v: boolean) => void;
  chapters: WizardChapter[];
  addChapter: (chapter: Omit<WizardChapter, "clientId">) => void;
  updateChapter: (clientId: string, updates: Partial<WizardChapter>) => void;
  removeChapter: (clientId: string) => void;
  reorderChapters: (reordered: WizardChapter[]) => void;
  handleNext: () => void;
  prevStep: () => void;
  handleSubmit: () => Promise<void>;
  canAdvanceStep1: boolean;
  isReady: boolean;
  categoryName: string;
}

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
  viewHref: string;
  editHref: string;
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

export interface AdminChapterListProps {
  chapters: AdminChapter[];
  isDeleted: boolean;
  onAddChapter: () => void;
  onEditChapter: (chapter: AdminChapter) => void;
  onDeleteChapter: (chapter: AdminChapter) => void;
  onReorder: (chapterIds: string[]) => Promise<void>;
}

export interface SortableChapterItemProps {
  chapter: AdminChapter;
  index: number;
  isDeleted: boolean;
  onEdit: () => void;
  onDelete: () => void;
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

/** Grouped content state for ChapterFormContentStep — replaces individual props */
export interface ChapterContentState {
  contentType: string;
  file: File | null;
  existingFileUrl: string;
  textContent: string;
  videoUrl: string;
  estimatedDuration: number | "";
  isUploading: boolean;
  selectedTemplate: ArticleTemplate | null;
  initialTemplateName?: string;
  sectionValues: Record<string, string>;
  fieldErrors?: Record<string, string>;
}

/** Grouped content callbacks for ChapterFormContentStep */
export interface ChapterContentHandlers {
  onFileChange: (file: File | null) => void;
  onTextContentChange: (v: string) => void;
  onVideoUrlChange: (v: string) => void;
  onEstimatedDurationChange: (v: number | "") => void;
  onTemplateChange: (template: ArticleTemplate | null) => void;
  onSectionChange: (sectionId: string, value: string) => void;
}

export interface ChapterFormContentStepProps {
  content: ChapterContentState;
  handlers: ChapterContentHandlers;
}
