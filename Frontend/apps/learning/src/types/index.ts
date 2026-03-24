import type { LucideIcon } from "lucide-react";

export type TrainingLevel = "beginner" | "intermediate" | "advanced";

export type TrainingCategory =
  | "leadership"
  | "technical"
  | "compliance"
  | "soft-skills"
  | "finance"
  | "data-analytics";

export interface TrainingChapter {
  id: string;
  title: string;
  duration: string;
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
