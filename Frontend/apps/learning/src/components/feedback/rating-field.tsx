"use client";

import { StarRating } from "./star-rating";
import type { RatingFieldProps } from "@/types/component-props";

export function RatingField({ label, prompt, value, onChange }: RatingFieldProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {prompt ? <p className="text-xs text-muted-foreground">{prompt}</p> : null}
      <StarRating label={label} value={value} onChange={onChange} />
    </div>
  );
}
