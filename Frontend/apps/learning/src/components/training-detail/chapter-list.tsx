import { BookOpen, Layers } from "lucide-react";
import type { ChapterListProps } from "@/types/component-props";

export function ChapterList({ chapters, chaptersCount }: ChapterListProps) {
  return (
    <section
      className="ey-animate-fade-up"
      style={{ animationDelay: "250ms" }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <BookOpen
          className="h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          Course Content
        </h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {chaptersCount} chapters
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-white">
        <div className="ey-stagger-list">
          {chapters.map((chapter, i) => (
            <div
              key={chapter.id}
              className={`group/ch flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 ${
                i !== chapters.length - 1
                  ? "border-b border-border/30"
                  : ""
              }`}
            >
              {/* Chapter number */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground transition-all group-hover/ch:bg-muted-foreground group-hover/ch:text-white">
                {i + 1}
              </div>

              {/* Title & block count */}
              <div className="flex flex-1 items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  {chapter.title}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {chapter.blockCount} {chapter.blockCount === 1 ? "block" : "blocks"}
                  </span>
                  <Layers
                    className="h-3.5 w-3.5 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
