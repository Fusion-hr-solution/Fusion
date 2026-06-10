import type { TrainingType } from "@/types";
import { TRAINING_TYPE_CONFIG } from "@/data";

interface FormatBadgeProps {
  type: TrainingType;
  size?: "sm" | "md";
  variant?: "default" | "outline";
}

/**
 * Visual badge advertising a training's delivery format.
 * Blue laptop = E-Learning · Green building = In-Person.
 */
export function FormatBadge({ type, size = "sm", variant = "default" }: FormatBadgeProps) {
  const cfg = TRAINING_TYPE_CONFIG[type];
  const Icon = cfg.icon;
  const sizeClass = size === "sm"
    ? "px-2 py-0.5 text-xs"
    : "px-2.5 py-1 text-sm";
  const variantClass = variant === "outline"
    ? "bg-transparent"
    : cfg.badgeClass;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap ${sizeClass} ${variantClass}`}
      aria-label={`Format: ${cfg.label}`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
