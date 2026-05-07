import type { Training, SortOption, TrainingType } from "@/types";

export function sortTrainings(trainings: Training[], sort: SortOption): Training[] {
  const parseDuration = (d: string) => {
    const n = parseInt(d.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  };
  return [...trainings].sort((a, b) => {
    switch (sort) {
      case "rating": return b.rating - a.rating;
      case "newest": return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case "enrolled": return b.enrolledCount - a.enrolledCount;
      case "duration": return parseDuration(a.duration) - parseDuration(b.duration);
    }
  });
}

export function TrainingTypeFilter({ value, onChange }: { value: TrainingType | null; onChange: (t: TrainingType | null) => void }) {
  return (
    <div className="flex gap-2">
      {(["all", "ELearning", "OnSite"] as const).map((t) => {
        const isActive = t === "all" ? value === null : value === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t === "all" ? null : t)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${isActive ? "ey-bg-dark text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {t === "all" ? "All Types" : t === "ELearning" ? "E-Learning" : "On-Site"}
          </button>
        );
      })}
    </div>
  );
}
