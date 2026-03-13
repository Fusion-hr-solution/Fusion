import type { TrainingStatus } from "@/types";

export const TABS: { value: TrainingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "not-started", label: "Not Started" },
];
