/** Performance's sections in Fusion Settings, in order (the server decides which a person sees). */
export const PERFORMANCE_SETTINGS_SECTIONS = [
  { id: "rating-scale", label: "Rating scale" },
  { id: "competencies", label: "Competencies" },
  { id: "review-questions", label: "Review questions" },
  { id: "reviews", label: "Reviews" },
  { id: "planning", label: "Planning" },
  { id: "conversations", label: "Conversations" },
  { id: "ai-and-data", label: "AI and data" },
] as const;

/** The sections that share one settings record: saving one changes the version of all four (B-071 D7). */
export const CYCLE_SETTINGS_SECTIONS = ["reviews", "planning", "conversations", "ai-and-data"] as const;

export function performanceSettingsLabel(id: string): string {
  return PERFORMANCE_SETTINGS_SECTIONS.find((section) => section.id === id)?.label ?? "Settings";
}
