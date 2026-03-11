import type { CourseOutlineProps } from "@/types/component-props";

export function CourseOutline({ chapters }: CourseOutlineProps) {
  return (
    <div className="mx-6 mt-5">
      <h4 className="mb-3 text-sm font-semibold text-foreground">
        Course Outline
      </h4>
      <div className="space-y-1">
        {chapters.map((chapter, i) => (
          <div
            key={chapter.id}
            className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-[hsl(var(--ey-grey-100))]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-200))] text-[11px] font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-foreground">{chapter.title}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {chapter.duration}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
