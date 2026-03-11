import type {
  Training,
  TrainingCategory,
  TrainingLevel,
  SortOption,
  TrainingStatus,
  EnrolledTraining,
} from "./index";

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
  chapters: { id: string; title: string; duration: string }[];
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
  size?: "sm" | "md";
}

export interface TrainingStatusTabsProps {
  activeTab: TrainingStatus | "all";
  counts: Record<TrainingStatus | "all", number>;
  onChange: (tab: TrainingStatus | "all") => void;
}

export interface MyTrainingsListProps {
  trainings: EnrolledTraining[];
}
