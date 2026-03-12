import type { SortOption } from "@/types";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest First" },
  { value: "enrolled", label: "Most Enrolled" },
  { value: "duration", label: "Shortest First" },
];
