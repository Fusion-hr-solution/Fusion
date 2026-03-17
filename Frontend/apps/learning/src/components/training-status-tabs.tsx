"use client";

import type { TrainingStatusTabsProps } from "@/types/component-props";
import { TABS } from "@/data/training-tabs";

export function TrainingStatusTabs({
  activeTab,
  counts,
  onChange,
}: TrainingStatusTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg border border-border/60 bg-white p-1">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`relative flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-medium transition-all ${
              isActive
                ? "ey-bg-dark text-white shadow-sm"
                : "text-muted-foreground hover:bg-[hsl(var(--ey-grey-100))] hover:text-foreground"
            }`}
          >
            {tab.label}
            <span
              className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                isActive
                  ? "ey-bg-accent text-[hsl(var(--ey-grey-500))]"
                  : "bg-[hsl(var(--ey-grey-200))] text-muted-foreground"
              }`}
            >
              {counts[tab.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
