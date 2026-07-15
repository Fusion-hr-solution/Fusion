"use client";

import { useRef } from "react";
import { Star } from "lucide-react";
import { cn } from "@repo/ui";
import type { StarRatingProps } from "@/types/component-props";

/**
 * Accessible star rating modelled as an ARIA radiogroup: arrow keys move the selection,
 * roving tabindex keeps a single tab stop, and reduced-motion disables the hover scale.
 */
export function StarRating({ label, value, onChange, max = 5, disabled = false }: StarRatingProps) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  function select(next: number) {
    const clamped = Math.min(Math.max(next, 1), max);
    onChange(clamped);
    buttonsRef.current[clamped - 1]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const current = value || 1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        select(current + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        select(current - 1);
        break;
      case "Home":
        e.preventDefault();
        select(1);
        break;
      case "End":
        e.preventDefault();
        select(max);
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-1.5"
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
        const filled = star <= value;
        // Roving tabindex: the selected star is the tab stop; if none selected, the first is.
        const tabbable = value === star || (value === 0 && star === 1);
        return (
          <button
            key={star}
            ref={(el) => {
              buttonsRef.current[star - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} / ${max}`}
            tabIndex={tabbable ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(star)}
            className={cn(
              "rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:scale-100",
              filled ? "text-[hsl(var(--ey-yellow))]" : "text-muted-foreground/40",
            )}
          >
            <Star className="h-6 w-6" fill={filled ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
