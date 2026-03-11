import type { Training, TrainingCategory } from "./index";

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
