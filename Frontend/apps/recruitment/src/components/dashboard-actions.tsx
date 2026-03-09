"use client";

import { Plus, Upload, ChevronDown } from "lucide-react";

interface DashboardActionsProps {
  onCreateNew: () => void;
}

export function DashboardActions({ onCreateNew }: DashboardActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        className="flex items-center gap-2 h-10 px-4 text-sm font-medium text-zinc-700
          border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-all duration-200"
      >
        <Upload className="w-4 h-4" />
        Import Test
      </button>
      <button
        className="flex items-center gap-2 h-10 px-4 text-sm font-medium text-zinc-700
          border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-all duration-200"
      >
        Bulk Actions
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onCreateNew}
        className="flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white
          bg-zinc-900 rounded-lg hover:bg-black transition-all duration-200 shadow-sm hover:shadow"
      >
        <Plus className="w-4 h-4" />
        Create New Test
      </button>
    </div>
  );
}