import { BookOpen } from "lucide-react";
import type { CourseOutlineProps } from "@/types/component-props";

export function CourseOutline({ chapters }: CourseOutlineProps) {
  return (
    <div className="mx-6 mt-5">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-foreground">
          Course Outline
        </h4>
        <span className="text-xs text-muted-foreground">
          ({chapters.length} chapters)
        </span>
      </div>
      <div className="space-y-0.5 rounded-xl border border-border/40 overflow-hidden">
        {chapters.map((chapter, i) => (
          <div
            key={chapter.id}
            className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50 group/chapter"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground transition-colors group-hover/chapter:bg-muted">
                {i + 1}
              </span>
              <span className="text-foreground font-medium">{chapter.title}</span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {chapter.blockCount} {chapter.blockCount === 1 ? "block" : "blocks"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
