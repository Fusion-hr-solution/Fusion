import type { Course } from "@/types";

export const LEVEL_VARIANT: Record<
  Course["level"],
  "default" | "secondary" | "outline"
> = {
  beginner: "secondary",
  intermediate: "default",
  advanced: "outline",
};

export const LEVEL_LABEL: Record<Course["level"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
