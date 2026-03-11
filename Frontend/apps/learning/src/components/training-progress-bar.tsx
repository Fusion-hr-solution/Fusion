import type { TrainingProgressBarProps } from "@/types/component-props";

export function TrainingProgressBar({
  progress,
  size = "md",
}: TrainingProgressBarProps) {
  const height = size === "sm" ? "h-1" : "h-1.5";

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-[hsl(var(--ey-grey-200))] ${height}`}
    >
      <div
        className={`${height} rounded-full transition-all duration-500 ease-out ${
          progress === 100
            ? "bg-[hsl(var(--ey-green-500))]"
            : "bg-[hsl(var(--ey-blue-400))]"
        }`}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
