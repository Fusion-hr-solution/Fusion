"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RatingLevel {
  ordinal: number;
  label: string;
  description?: string | null;
}

export interface RatingMarker {
  ordinal: number;
  label: string;
  tone?: "self" | "manager" | "expected";
}

const MARKER_DOT: Record<NonNullable<RatingMarker["tone"]>, string> = {
  self: "bg-sky-600 dark:bg-sky-400",
  manager: "bg-emerald-600 dark:bg-emerald-400",
  expected: "bg-amber-600 dark:bg-amber-400",
};

/**
 * The one rating input across evaluation surfaces: an ordered intensity spine
 * (opacity ramp, ordinal-led labels, full labels that wrap) derived from the
 * configuration ScaleArtifact, made selectable. Optional markers show another
 * rater's value on the same spine so comparison and input share one shape.
 */
export function RatingControl({
  levels,
  value,
  onChange,
  markers = [],
  disabled = false,
  ariaLabel,
  className,
}: {
  levels: RatingLevel[];
  value: number | null;
  onChange?: (ordinal: number) => void;
  markers?: RatingMarker[];
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const n = levels.length;
  const selected = levels.find((level) => level.ordinal === value);
  const interactive = !disabled && !!onChange;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
        {levels.map((level, i) => {
          const isSelected = level.ordinal === value;
          const ownMarkers = markers.filter((m) => m.ordinal === level.ordinal);
          return (
            <button
              key={level.ordinal}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!interactive}
              onClick={() => onChange?.(level.ordinal)}
              className={cn(
                "group min-w-[7.5rem] flex-1 basis-32 rounded-xl border p-2.5 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-transparent",
                interactive && !isSelected && "hover:border-primary/50",
                !interactive && "cursor-default"
              )}
            >
              <div
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full",
                  isSelected ? "bg-primary" : "bg-primary/80"
                )}
                style={
                  isSelected
                    ? undefined
                    : { opacity: n > 1 ? 0.3 + (0.5 * i) / (n - 1) : 0.8 }
                }
              />
              <div className="mt-2 flex items-start gap-1.5">
                <span className="text-lg font-semibold tabular-nums leading-tight">
                  {level.ordinal}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium leading-tight">
                  {level.label}
                </span>
                {isSelected ? (
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : null}
              </div>
              {ownMarkers.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                  {ownMarkers.map((marker) => (
                    <span
                      key={marker.label}
                      className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          MARKER_DOT[marker.tone ?? "self"]
                        )}
                      />
                      {marker.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      {selected?.description ? (
        <p className="text-xs text-muted-foreground">{selected.description}</p>
      ) : null}
    </div>
  );
}
