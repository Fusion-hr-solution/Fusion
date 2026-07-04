import type { Training, SortOption } from "@/types";

export function sortTrainings(trainings: Training[], sort: SortOption): Training[] {
  const parseDuration = (d: string) => {
    const n = parseInt(d.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  };
  return [...trainings].sort((a, b) => {
    switch (sort) {
      case "rating": return (b.rating ?? 0) - (a.rating ?? 0);
      case "newest": return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case "enrolled": return b.enrolledCount - a.enrolledCount;
      case "duration": return parseDuration(a.duration) - parseDuration(b.duration);
    }
  });
}
