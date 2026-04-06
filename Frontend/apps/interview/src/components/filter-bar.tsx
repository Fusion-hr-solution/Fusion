"use client";

import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISCIPLINES, QUESTION_TYPES, TEST_STATUSES } from "@/config/constants";
import type { FilterState } from "@/types";
import { useState, useRef, useEffect } from "react";

interface FilterBarProps {
  filters: FilterState;
  activeFilterCount: number;
  resultCount: number;
  showStatusFilter?: boolean;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearAll: () => void;
}

function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = Boolean(value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
          isActive
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
        )}
      >
        {value || label}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white shadow-lg z-30 overflow-hidden">
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className="flex w-full items-center px-3 py-2 text-[13px] text-zinc-500 hover:bg-zinc-50 transition-colors duration-150"
          >
            All
          </button>
          <div className="border-t border-zinc-100" />
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors duration-150 hover:bg-zinc-50",
                value === opt ? "font-medium text-zinc-900" : "text-zinc-700"
              )}
            >
              {value === opt && <div className="h-1.5 w-1.5 rounded-full bg-zinc-900" />}
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  filters,
  activeFilterCount,
  resultCount,
  showStatusFilter = true,
  onFilterChange,
  onClearAll,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 px-8 py-4">
      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search tests…"
          value={filters.search}
          onChange={(e) => onFilterChange("search", e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 py-1.5 text-[13px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 transition-shadow duration-150"
        />
      </div>

      {/* Filter Dropdowns */}
      <FilterDropdown
        label="Discipline"
        options={DISCIPLINES}
        value={filters.discipline}
        onChange={(v) => onFilterChange("discipline", v as FilterState["discipline"])}
      />
      <FilterDropdown
        label="Question Type"
        options={QUESTION_TYPES}
        value={filters.questionType}
        onChange={(v) => onFilterChange("questionType", v as FilterState["questionType"])}
      />
      {showStatusFilter ? (
        <FilterDropdown
          label="Status"
          options={TEST_STATUSES}
          value={filters.status}
          onChange={(v) => onFilterChange("status", v as FilterState["status"])}
        />
      ) : null}

      {/* Active filter badge + clear */}
      {activeFilterCount > 0 && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-700 hover:bg-zinc-200 transition-colors duration-150"
        >
          {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Result count */}
      <span className="ml-auto text-[12px] text-zinc-500">
        Showing {resultCount} test{resultCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}