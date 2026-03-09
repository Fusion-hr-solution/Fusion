"use client";

import { useState } from "react";
import {
  Search, SlidersHorizontal, X, Plus, Check, Eye,
  GripVertical, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  BookOpen
} from "lucide-react";
import type { Question, SelectedQuestion } from "@/types";
import { QUESTION_TYPES, DIFFICULTIES, GRADING_METHODS } from "@/config/constants";
import { useQuestionFilters } from "@/hooks/use-question-filters";
import { cn } from "@/lib/utils";

interface Step2Props {
  selectedQuestions: SelectedQuestion[];
  onAdd: (q: Question) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, dir: "up" | "down") => void;
}

const DIFF_STYLES: Record<string, string> = {
  Easy: "bg-zinc-100 text-zinc-600",
  Medium: "bg-zinc-200 text-zinc-700",
  Hard: "bg-zinc-800 text-white",
  Expert: "bg-zinc-900 text-white",
};

export function Step2Questions({ selectedQuestions, onAdd, onRemove, onReorder }: Step2Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const {
    filters, paginated, currentPage, totalPages, activeFilterCount,
    typeCounts, difficultyCounts, gradingCounts,
    setSearch, toggleType, toggleDifficulty, toggleGrading, clearFilters, setCurrentPage,
  } = useQuestionFilters();

  const selectedIds = new Set(selectedQuestions.map((q) => q.id));
  const totalPoints = selectedQuestions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left filter sidebar */}
      <aside className={cn(
        "border-r border-zinc-200 bg-zinc-50 flex-shrink-0 transition-all duration-300 overflow-y-auto",
        sidebarOpen ? "w-64" : "w-12"
      )}>
        {sidebarOpen ? (
          <div className="p-4 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-zinc-600" />
                <span className="text-sm font-semibold text-zinc-900">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 bg-zinc-900 text-white text-[10px] rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button onClick={() => setSidebarOpen(false)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-200 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                value={filters.search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions..."
                className="w-full pl-8 pr-3 h-8 text-xs bg-white border border-zinc-200 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400"
              />
            </div>

            {/* Question Type */}
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Question Type</p>
              <div className="space-y-1.5">
                {QUESTION_TYPES.map((t) => (
                  <label key={t} className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={filters.types.includes(t)} onChange={() => toggleType(t)}
                        className="w-3 h-3 accent-black cursor-pointer" />
                      <span className="text-xs text-zinc-700 group-hover:text-zinc-900">{t}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400">{typeCounts[t] || 0}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Difficulty</p>
              <div className="space-y-1.5">
                {DIFFICULTIES.map((d) => (
                  <label key={d} className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <input type="radio" name="diff" checked={filters.difficulties.includes(d)} onChange={() => toggleDifficulty(d)}
                        className="w-3 h-3 accent-black cursor-pointer" />
                      <span className="text-xs text-zinc-700 group-hover:text-zinc-900">{d}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400">{difficultyCounts[d] || 0}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Grading */}
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Grading</p>
              <div className="space-y-1.5">
                {GRADING_METHODS.map((g) => (
                  <label key={g} className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={filters.gradingMethods.includes(g)} onChange={() => toggleGrading(g)}
                        className="w-3 h-3 accent-black cursor-pointer" />
                      <span className="text-xs text-zinc-700 group-hover:text-zinc-900">{g}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400">{gradingCounts[g] || 0}</span>
                  </label>
                ))}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button onClick={clearFilters}
                className="w-full h-8 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg
                  hover:bg-white transition-colors flex items-center justify-center gap-1.5">
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center pt-4 gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-200 transition-colors">
              <SlidersHorizontal className="w-4 h-4 text-zinc-600" />
            </button>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 bg-zinc-900 text-white text-[10px] rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </div>
        )}
      </aside>

      {/* Right main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Selected questions panel */}
        <div className="border-b border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900">Selected Questions</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-900 text-white rounded-full">
                {selectedQuestions.length}
              </span>
            </div>
            {selectedQuestions.length > 0 && (
              <span className="text-xs text-zinc-500">
                Total: <span className="font-semibold text-zinc-900">{totalPoints} pts</span>
              </span>
            )}
          </div>

          <div className="px-6 py-3 max-h-44 overflow-y-auto">
            {selectedQuestions.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 text-zinc-400">
                <BookOpen className="w-4 h-4" />
                <span className="text-xs">No questions selected yet. Browse the library below.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedQuestions
                  .sort((a, b) => a.order - b.order)
                  .map((q, idx) => (
                    <div key={q.id} className="flex items-center gap-2 p-2 bg-zinc-50 rounded-lg border border-zinc-100 group">
                      <GripVertical className="w-3.5 h-3.5 text-zinc-300" />
                      <span className="text-xs font-semibold text-zinc-400 w-4 text-center">{idx + 1}</span>
                      <span className="flex-1 text-xs font-medium text-zinc-800 truncate">{q.title}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-zinc-200 text-zinc-600 rounded">{q.type}</span>
                      <span className="text-xs font-semibold text-zinc-700">{q.points}pt</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onReorder(q.id, "up")} disabled={idx === 0}
                          className="w-5 h-5 flex items-center justify-center hover:bg-zinc-200 rounded disabled:opacity-30">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => onReorder(q.id, "down")} disabled={idx === selectedQuestions.length - 1}
                          className="w-5 h-5 flex items-center justify-center hover:bg-zinc-200 rounded disabled:opacity-30">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <button onClick={() => onRemove(q.id)}
                          className="w-5 h-5 flex items-center justify-center hover:bg-red-100 text-zinc-400 hover:text-red-600 rounded transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Question library */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Question Library
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paginated.map((q) => {
              const isSelected = selectedIds.has(q.id);
              return (
                <div key={q.id} className={cn(
                  "relative bg-white border rounded-xl p-4 flex flex-col gap-3 transition-all duration-200",
                  isSelected ? "border-zinc-900 shadow-md" : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
                )}>
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-zinc-900 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap pr-6">
                    <span className="text-xs px-2 py-0.5 border border-zinc-200 rounded text-zinc-600">{q.type}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", DIFF_STYLES[q.difficulty])}>{q.difficulty}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 leading-snug">{q.title}</p>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{q.description}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span>{q.duration} min</span>
                    <span>·</span>
                    <span>{q.gradingMethod}</span>
                    <span>·</span>
                    <span>{q.usageCount} uses</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {q.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded">{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <span className="text-xs font-semibold text-zinc-700">{q.points} pts</span>
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1 h-7 px-2.5 text-xs text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
                        <Eye className="w-3 h-3" /> Preview
                      </button>
                      <button
                        onClick={() => isSelected ? onRemove(q.id) : onAdd(q)}
                        className={cn(
                          "flex items-center gap-1 h-7 px-2.5 text-xs font-medium rounded-lg transition-all duration-200",
                          isSelected
                            ? "bg-zinc-100 text-zinc-600 hover:bg-red-50 hover:text-red-600 border border-zinc-200"
                            : "bg-zinc-900 text-white hover:bg-black"
                        )}
                      >
                        {isSelected ? (<><X className="w-3 h-3" /> Remove</>) : (<><Plus className="w-3 h-3" /> Add</>)}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6">
              <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}
                className="w-7 h-7 rounded flex items-center justify-center border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={cn("w-7 h-7 rounded text-xs font-medium transition-colors",
                    p === currentPage ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  )}>
                  {p}
                </button>
              ))}
              <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}
                className="w-7 h-7 rounded flex items-center justify-center border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}