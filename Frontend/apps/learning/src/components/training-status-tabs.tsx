"use client";

import { useTranslations } from "next-intl";
import type { TrainingStatusTabsProps } from "@/types/component-props";
import { TABS } from "@/data/training-tabs";

export function TrainingStatusTabs({
  activeTab,
  counts,
  onChange,
}: TrainingStatusTabsProps) {
  const t = useTranslations("common.tabs");
  return (
    <div className="inline-flex gap-1 rounded-xl border border-border/60 bg-white p-1 shadow-sm">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-all duration-200 ${
              isActive
                ? "ey-bg-dark text-white shadow-md"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t(tab.value)}
            <span
              className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold transition-all ${
                isActive
                  ? "ey-bg-accent text-muted-foreground"
                  : "bg-muted text-muted-foreground"
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
