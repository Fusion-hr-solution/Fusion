"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, ChevronLeft, X } from "lucide-react";
import type { DashboardFilterState, Discipline, QuestionType, TestStatus } from "@/types";
import { DISCIPLINES, QUESTION_TYPES } from "@/config/constants";

interface FilterSidebarProps {
  filters: DashboardFilterState;
  activeFilterCount: number;
  disciplineCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  onSearch: (s: string) => void;
  onToggleDiscipline: (d: Discipline) => void;
  onToggleType: (t: QuestionType) => void;
  onSetStatus: (s: TestStatus | "All") => void;
  onClear: () => void;
}

export function FilterSidebar({
  filters,
  activeFilterCount,
  disciplineCounts,
  typeCounts,
  onSearch,
  onToggleDiscipline,
  onToggleType,
  onSetStatus,
  onClear,
}: FilterSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="w-12 min-h-full border-r border-zinc-200 bg-white flex flex-col items-center pt-6 gap-4 transition-all duration-300">
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 transition-colors"
          title="Expand filters"
        >
          <SlidersHorizontal className="w-4 h-4 text-zinc-600" />
        </button>
        {activeFilterCount > 0 && (
          <span className="w-5 h-5 bg-black text-white text-xs rounded-full flex items-center justify-center font-medium">
            {activeFilterCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <aside className="w-72 min-h-full border-r border-zinc-200 bg-white flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-zinc-600" />
          <span className="text-sm font-semibold text-zinc-900">Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 bg-black text-white text-xs rounded-full flex items-center justify-center font-medium">
              {activeFilterCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-zinc-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            value={filters.search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search tests..."
            className="w-full pl-8 pr-3 h-9 text-sm bg-zinc-50 border border-zinc-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white
              placeholder:text-zinc-400 transition-all duration-200"
          />
          {filters.search && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" />
            </button>
          )}
        </div>

        {/* Status */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Status</p>
          <div className="space-y-2">
            {(["All", "Active", "Draft", "Archived"] as const).map((s) => (
              <label key={s} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="status"
                  checked={filters.status === s}
                  onChange={() => onSetStatus(s)}
                  className="w-3.5 h-3.5 accent-black cursor-pointer"
                />
                <span className="text-sm text-zinc-700 group-hover:text-zinc-900 transition-colors">
                  {s}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Discipline */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Discipline</p>
          <div className="space-y-2">
            {DISCIPLINES.map((d) => (
              <label key={d} className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={filters.disciplines.includes(d)}
                    onChange={() => onToggleDiscipline(d)}
                    className="w-3.5 h-3.5 accent-black cursor-pointer rounded"
                  />
                  <span className="text-sm text-zinc-700 group-hover:text-zinc-900 transition-colors">
                    {d}
                  </span>
                </div>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {disciplineCounts[d] || 0}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Question Type */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Question Type</p>
          <div className="space-y-2">
            {QUESTION_TYPES.map((t) => (
              <label key={t} className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={filters.questionTypes.includes(t)}
                    onChange={() => onToggleType(t)}
                    className="w-3.5 h-3.5 accent-black cursor-pointer rounded"
                  />
                  <span className="text-sm text-zinc-700 group-hover:text-zinc-900 transition-colors">
                    {t}
                  </span>
                </div>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {typeCounts[t] || 0}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Clear */}
      {activeFilterCount > 0 && (
        <div className="px-5 py-4 border-t border-zinc-100">
          <button
            onClick={onClear}
            className="w-full h-9 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-lg
              hover:bg-zinc-50 hover:text-zinc-900 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <X className="w-3.5 h-3.5" />
            Clear all filters
          </button>
        </div>
      )}
    </aside>
  );
}