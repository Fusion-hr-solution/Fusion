"use client";

import type { LevelFilterProps } from "@/types/component-props";
import { LEVEL_CONFIG } from "@/data/categories";
import type { TrainingLevel } from "@/types";

const ALL_LEVELS = Object.keys(LEVEL_CONFIG) as TrainingLevel[];

export function LevelFilter({ selected, onChange }: LevelFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
          selected === null
            ? "ey-bg-dark border-transparent text-white"
            : "border-border bg-white text-muted-foreground hover:border-[hsl(var(--ey-grey-500))]/30 hover:text-foreground"
        }`}
      >
        All Levels
      </button>
      {ALL_LEVELS.map((lvl) => {
        const config = LEVEL_CONFIG[lvl];
        const isActive = selected === lvl;
        return (
          <button
            key={lvl}
            onClick={() => onChange(isActive ? null : lvl)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              isActive
                ? "ey-bg-dark border-transparent text-white"
                : "border-border bg-white text-muted-foreground hover:border-[hsl(var(--ey-grey-500))]/30 hover:text-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : config.dotClass}`}
            />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
