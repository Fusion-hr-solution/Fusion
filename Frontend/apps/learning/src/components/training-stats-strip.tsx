import { Clock, BookOpen, Users, Star } from "lucide-react";
import type { TrainingStatsStripProps } from "@/types/component-props";

export function TrainingStatsStrip({
  duration,
  chaptersCount,
  enrolledCount,
  rating,
}: TrainingStatsStripProps) {
  return (
    <div className="mx-6 mt-5 grid grid-cols-4 gap-3 rounded-lg bg-[hsl(var(--ey-grey-100))] p-4">
      <div className="flex flex-col items-center gap-1">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">
          {duration}
        </span>
        <span className="text-[11px] text-muted-foreground">Duration</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">
          {chaptersCount}
        </span>
        <span className="text-[11px] text-muted-foreground">Chapters</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">
          {enrolledCount.toLocaleString()}
        </span>
        <span className="text-[11px] text-muted-foreground">Enrolled</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Star className="h-4 w-4 ey-star" />
        <span className="text-sm font-semibold text-foreground">{rating}</span>
        <span className="text-[11px] text-muted-foreground">Rating</span>
      </div>
    </div>
  );
}
