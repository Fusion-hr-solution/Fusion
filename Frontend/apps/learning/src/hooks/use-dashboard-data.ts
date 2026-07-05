import { useMemo } from "react";
import type { TrainingCategory, EnrolledTraining } from "@/types";

export function useDashboardData(enrolledTrainings: EnrolledTraining[]) {
  const stats = useMemo(() => {
    const inProgress = enrolledTrainings.filter((t) => t.status === "in-progress");
    const completed = enrolledTrainings.filter((t) => t.status === "completed");
    const totalHours = enrolledTrainings.reduce(
      (sum, t) => sum + parseInt(t.duration.replace(/\D/g, "")),
      0
    );
    const completedHours = completed.reduce(
      (sum, t) => sum + parseInt(t.duration.replace(/\D/g, "")),
      0
    );
    const completionRate =
      enrolledTrainings.length > 0
        ? Math.round((completed.length / enrolledTrainings.length) * 100)
        : 0;
    const avgProgress =
      inProgress.length > 0
        ? Math.round(inProgress.reduce((sum, t) => sum + t.progress, 0) / inProgress.length)
        : 0;

    return { inProgress, completed, totalHours, completedHours, completionRate, avgProgress };
  }, [enrolledTrainings]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<TrainingCategory, number>();
    for (const t of enrolledTrainings) {
      map.set(t.category, (map.get(t.category) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / enrolledTrainings.length) * 100),
      }));
  }, [enrolledTrainings]);

  const continueTrainings = stats.inProgress
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  // Recommendations are no longer derived client-side from a catalog pool — they come
  // from the AI service (AI-L-6), passed into the dashboard as a prop.
  return { stats, categoryBreakdown, continueTrainings };
}
