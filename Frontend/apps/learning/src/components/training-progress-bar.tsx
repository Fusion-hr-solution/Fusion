import { Progress } from "@repo/ui";
import type { TrainingProgressBarProps } from "@/types/component-props";

export function TrainingProgressBar({
  progress,
  currentChapter,
  totalChapters,
  size = "md",
  showLabel = true,
}: TrainingProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const isCompleted = clampedProgress === 100;
  const barHeight = size === "sm" ? "h-2" : "h-3";

  const indicatorColor = isCompleted
    ? "bg-[hsl(var(--ey-green-500))]"
    : "bg-[hsl(var(--ey-blue-400))]";

  const labelColor = isCompleted
    ? "text-[hsl(var(--ey-green-500))]"
    : "text-[hsl(var(--ey-blue-600))]";

  const showChapters =
    currentChapter !== undefined && totalChapters !== undefined;
  const showSegments = showChapters && size === "md" && totalChapters! <= 12;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Progress bar with percentage */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Progress
            value={clampedProgress}
            className={`${barHeight} rounded-full bg-[hsl(var(--ey-grey-200))]`}
            indicatorClassName={`${indicatorColor} transition-all duration-500 ease-out`}
          />

          {/* Segmented chapter markers */}
          {showSegments && totalChapters! > 1 && (
            <div className="pointer-events-none absolute inset-0 flex">
              {Array.from({ length: totalChapters! - 1 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 border-r-2 border-white/60"
                  aria-hidden="true"
                />
              ))}
              <div className="flex-1" />
            </div>
          )}
        </div>

        {showLabel && (
          <span
            className={`min-w-[3ch] text-right text-sm font-bold tabular-nums ${labelColor}`}
          >
            {clampedProgress}%
          </span>
        )}
      </div>

      {/* Chapter progress text */}
      {showChapters && (
        <p className="text-xs text-muted-foreground">
          <span className={`font-bold ${labelColor}`}>
            {currentChapter}
          </span>
          <span className="mx-0.5 text-muted-foreground/50">/</span>
          <span>{totalChapters} chapters completed</span>
        </p>
      )}
    </div>
  );
}
