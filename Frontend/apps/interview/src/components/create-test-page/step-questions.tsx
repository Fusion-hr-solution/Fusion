"use client";

import { useState } from "react";
import {
  Search, Plus, Eye, Minus, GripVertical, X, Inbox,
  CheckCircle2, BarChart2, Zap, Clock, ChevronLeft,
  ChevronRight, SlidersHorizontal, ArrowLeft, ArrowRight, ListChecks,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useWizardStore } from "@/store/wizard-store";
import { MOCK_QUESTIONS } from "@/services/test-service";
import { QUESTION_TYPES, DIFFICULTIES, GRADING_METHODS, SORT_OPTIONS } from "@/config/constants";
import { CreateQuestionSheet } from "./create-question-sheet";
import { cn } from "@/lib/utils";
import type { Question, QuestionFilterState, SortOption, Difficulty } from "@/types";

// ─── Diff badge colours ───────────────────────────────────────────────────────

const DIFF_STYLES: Record<Difficulty, string> = {
  Easy:   "bg-emerald-50 text-emerald-700 border-emerald-100",
  Medium: "bg-amber-50  text-amber-700  border-amber-100",
  Hard:   "bg-rose-50   text-rose-700   border-rose-100",
  Expert: "bg-purple-50 text-purple-700 border-purple-100",
};

// ─── Sortable selected-question row ──────────────────────────────────────────

function SortableRow({
  question, index, onRemove,
}: {
  question: Question; index: number; onRemove: (id: string) => void;
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: question.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2 shadow-sm transition-all duration-150 hover:border-zinc-200"
    >
      {/* drag handle */}
      <button
        {...attributes} {...listeners}
        tabIndex={-1}
        className="shrink-0 cursor-grab touch-none text-zinc-300 hover:text-zinc-400"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* index badge */}
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">
        {index + 1}
      </span>

      {/* title */}
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-800">
        {question.title}
      </span>

      {/* pts */}
      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
        {question.points}pt
      </span>

      {/* remove */}
      <button
        onClick={() => onRemove(question.id)}
        className="shrink-0 rounded-md p-0.5 text-zinc-300 transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StepQuestions() {
  const {
    selectedQuestions, addQuestion, removeQuestion,
    reorderQuestions, isQuestionSelected, nextStep, prevStep,
  } = useWizardStore();

  const [filters,   setFilters]   = useState<QuestionFilterState>({ search: "", types: [], difficulties: [], gradingMethods: [] });
  const [sortBy,    setSortBy]    = useState<SortOption>("newest");
  const [libPage,   setLibPage]   = useState(1);
  const [previewQ,  setPreviewQ]  = useState<Question | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortOpen,  setSortOpen]  = useState(false);
  const PAGE_SIZE = 6;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oi = selectedQuestions.findIndex((q) => q.id === active.id);
      const ni = selectedQuestions.findIndex((q) => q.id === over.id);
      reorderQuestions(arrayMove(selectedQuestions, oi, ni));
    }
  }

  function toggleFilter<K extends "types" | "difficulties" | "gradingMethods">(key: K, val: string) {
    setFilters((p) => {
      const arr = p[key] as string[];
      return { ...p, [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] };
    });
    setLibPage(1);
  }

  const activeFilterCount =
    filters.types.length + filters.difficulties.length + filters.gradingMethods.length;

  const filteredLib = MOCK_QUESTIONS
    .filter((q) => {
      if (filters.search          && !q.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.types.length    && !filters.types.includes(q.type))                              return false;
      if (filters.difficulties.length && !filters.difficulties.includes(q.difficulty))             return false;
      if (filters.gradingMethods.length && !filters.gradingMethods.includes(q.gradingMethod))      return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest")    return b.id.localeCompare(a.id);
      if (sortBy === "oldest")    return a.id.localeCompare(b.id);
      if (sortBy === "most_used") return b.usageCount - a.usageCount;
      if (sortBy === "points")    return b.points - a.points;
      return 0;
    });

  const totalPages  = Math.max(1, Math.ceil(filteredLib.length / PAGE_SIZE));
  const pagedLib    = filteredLib.slice((libPage - 1) * PAGE_SIZE, libPage * PAGE_SIZE);
  const totalPoints = selectedQuestions.reduce((s, q) => s + q.points, 0);

  const typeCounts = Object.fromEntries(QUESTION_TYPES.map((t)  => [t, MOCK_QUESTIONS.filter((q) => q.type === t).length]));
  const diffCounts = Object.fromEntries(DIFFICULTIES.map((d)    => [d, MOCK_QUESTIONS.filter((q) => q.difficulty === d).length]));
  const gradCounts = Object.fromEntries(GRADING_METHODS.map((g) => [g, MOCK_QUESTIONS.filter((q) => q.gradingMethod === g).length]));

  // ─────────────────────────────────────────────────────────────────────────
  // LAYOUT CONTRACT
  //
  //  • The outer <div> is a plain flex-col — NO fixed height, NO overflow-hidden.
  //    It grows naturally and lets the parent page scroll.
  //
  //  • The three-column row uses `items-start` so each column is only as tall
  //    as its own content.
  //
  //  • Zone A (Filters) and Zone C (Selected) are `sticky top-[value]` with
  //    an explicit `max-h` + `overflow-y-auto` on their inner scroll area.
  //    This makes them "stick" to the viewport while the library scrolls.
  //
  //  • Zone B (Library) is a plain flex-col — no overflow. The grid and
  //    pagination grow naturally; the parent page scroll handles it.
  //
  //  Proportions at max-w-4xl (896 px) minus 296 px preview panel = 600 px:
  //    A  w-[176px]  ≈ 20 %
  //    B  flex-1     ≈ 50 %
  //    C  w-[192px]  ≈ 30 %
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 pb-2">

      {/* ── Section header ──────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
            <ListChecks className="h-3.5 w-3.5 text-white" />
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-zinc-900">
            Build Your Question Set
          </h2>
        </div>
        <p className="pl-9 text-[13px] text-zinc-500">
          Add from the library or create new questions
        </p>
      </div>

      {/* ── Three-column layout ─────────────────────────────────── */}
      <div className="flex items-start gap-4">

        {/* ══ Zone A — Filters (≈ 20 %) ═══════════════════════════ */}
        <aside className="w-[176px] shrink-0">
          {/*
           * sticky: stays visible while the page scrolls.
           * max-h + overflow-y-auto: the filter list scrolls
           * independently if there are many options.
           */}
          <div
            className="sticky top-4 flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          >
            {/* panel header */}
            <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Filters
              </span>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({ search: "", types: [], difficulties: [], gradingMethods: [] })}
                  className="text-[11px] font-medium text-zinc-400 hover:text-zinc-700 transition-colors duration-150"
                >
                  Clear
                </button>
              )}
            </div>

            {/* search input */}
            <div className="shrink-0 px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  value={filters.search}
                  onChange={(e) => { setFilters((p) => ({ ...p, search: e.target.value })); setLibPage(1); }}
                  placeholder="Search…"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-8 pr-3 text-[12px] placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
                />
              </div>
            </div>

            <div className="mx-4 shrink-0 border-t border-zinc-100" />

            {/* scrollable filter groups */}
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 space-y-4">
              {[
                { label: "Type",       items: QUESTION_TYPES,           counts: typeCounts, key: "types"          as const, radio: false },
                { label: "Difficulty", items: ["All", ...DIFFICULTIES], counts: diffCounts, key: "difficulties"   as const, radio: true  },
                { label: "Grading",    items: GRADING_METHODS,          counts: gradCounts, key: "gradingMethods" as const, radio: false },
              ].map((sec, si) => (
                <div key={sec.label} className={cn("flex flex-col gap-1.5", si > 0 && "pt-4 border-t border-zinc-100")}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    {sec.label}
                  </p>
                  {sec.items.map((item) => {
                    const checked = item === "All"
                      ? (filters[sec.key] as string[]).length === 0
                      : (filters[sec.key] as string[]).includes(item);
                    return (
                      <label
                        key={item}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-zinc-50 transition-colors duration-100"
                      >
                        <input
                          type={sec.radio ? "radio" : "checkbox"}
                          name={sec.label}
                          checked={checked}
                          className="h-3.5 w-3.5 shrink-0 accent-zinc-900"
                          onChange={() => {
                            if (sec.radio) {
                              setFilters((p) => ({ ...p, [sec.key]: item === "All" ? [] : [item] }));
                              setLibPage(1);
                            } else {
                              toggleFilter(sec.key, item);
                            }
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-700">
                          {item}
                        </span>
                        {item !== "All" && (
                          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                            {(sec.counts as Record<string, number>)[item] ?? 0}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ══ Zone B — Question Library (≈ 50 %, flex-1) ══════════ */}
        <div className="min-w-0 flex-1 flex flex-col gap-4">

          {/* toolbar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-zinc-900">Question Library</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[12px] font-medium text-zinc-500">
                {filteredLib.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setSortOpen((p) => !p)}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 transition-colors duration-150"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
                  {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Sort"}
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:bg-zinc-50 transition-colors duration-150",
                          sortBy === opt.value ? "font-semibold text-zinc-900" : "text-zinc-600"
                        )}
                      >
                        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", sortBy === opt.value ? "bg-zinc-900" : "bg-transparent")} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setSheetOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-[0.98] transition-all duration-150"
              >
                <Plus className="h-4 w-4" />
                New Question
              </button>
            </div>
          </div>

          {/* question grid — 2 columns, natural height, scrolls with page */}
          {pagedLib.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-20">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100">
                <Inbox className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="text-[14px] font-semibold text-zinc-600">No questions match</p>
              <p className="mt-1 text-[12px] text-zinc-400">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {pagedLib.map((q) => {
                const selected = isQuestionSelected(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => selected ? removeQuestion(q.id) : addQuestion(q)}
                    className={cn(
                      "group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-2xl border-2 p-4 transition-all duration-150",
                      selected
                        ? "border-zinc-900 bg-zinc-50 shadow-sm"
                        : "border-zinc-100 bg-white hover:border-zinc-300 hover:shadow-md"
                    )}
                  >
                    {/* selected tick */}
                    {selected && (
                      <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 fill-zinc-900 text-white" />
                    )}

                    {/* badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pr-6">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                        {q.type}
                      </span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", DIFF_STYLES[q.difficulty])}>
                        {q.difficulty}
                      </span>
                      <span className="ml-auto text-[13px] font-bold text-zinc-900">
                        {q.points}pts
                      </span>
                    </div>

                    {/* title */}
                    <p className="line-clamp-2 text-[13px] font-bold leading-snug text-zinc-900">
                      {q.title}
                    </p>

                    {/* description */}
                    <p className="line-clamp-2 flex-1 text-[11px] leading-relaxed text-zinc-500">
                      {q.description}
                    </p>

                    {/* meta */}
                    <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{q.durationMinutes}m
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />{q.gradingMethod}
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart2 className="h-3 w-3" />{q.usageCount}×
                      </span>
                    </div>

                    {/* tags */}
                    <div className="flex flex-wrap gap-1">
                      {q.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* action row */}
                    <div
                      className="flex items-center justify-between border-t border-zinc-100 pt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setPreviewQ(q)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors duration-150"
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                      <button
                        onClick={() => selected ? removeQuestion(q.id) : addQuestion(q)}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-all duration-150",
                          selected
                            ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                            : "bg-zinc-900 text-white hover:bg-zinc-800"
                        )}
                      >
                        {selected
                          ? <><Minus className="h-3.5 w-3.5" />Remove</>
                          : <><Plus  className="h-3.5 w-3.5" />Add</>
                        }
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* pagination */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[12px] text-zinc-400">
              {filteredLib.length === 0
                ? "0 results"
                : `${(libPage - 1) * PAGE_SIZE + 1}–${Math.min(libPage * PAGE_SIZE, filteredLib.length)} of ${filteredLib.length}`
              }
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLibPage((p) => p - 1)}
                disabled={libPage <= 1}
                className={cn(
                  "flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
                  libPage <= 1 ? "cursor-not-allowed opacity-40 text-zinc-400" : "bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                )}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="min-w-[48px] text-center text-[12px] font-medium text-zinc-500">
                {libPage} / {totalPages}
              </span>
              <button
                onClick={() => setLibPage((p) => p + 1)}
                disabled={libPage >= totalPages}
                className={cn(
                  "flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
                  libPage >= totalPages ? "cursor-not-allowed opacity-40 text-zinc-400" : "bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
                )}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ══ Zone C — Selected (≈ 30 %) ══════════════════════════ */}
        <aside className="w-[192px] shrink-0">
          {/*
           * sticky + max-h mirrors Zone A — the list scrolls
           * independently while the library column scrolls with the page.
           * The border + shadow gives clear visual separation from Zone B.
           */}
          <div
            className="sticky top-4 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          >
            {/* header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-zinc-900">Selected</span>
                <span className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-150",
                  selectedQuestions.length > 0 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
                )}>
                  {selectedQuestions.length}
                </span>
              </div>
              {totalPoints > 0 && (
                <span className="text-[11px] font-semibold text-zinc-500">
                  {totalPoints}pt
                </span>
              )}
            </div>

            {/* scrollable list */}
            <div className="flex-1 overflow-y-auto p-3">
              {selectedQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-50">
                    <Inbox className="h-5 w-5 text-zinc-300" />
                  </div>
                  <p className="text-[12px] font-semibold text-zinc-500">No questions yet</p>
                  <p className="text-[11px] text-zinc-400">Click Add on any card</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedQuestions.map((q) => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2">
                      {selectedQuestions.map((q, i) => (
                        <SortableRow
                          key={q.id}
                          question={q}
                          index={i}
                          onRemove={removeQuestion}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* summary footer */}
            {selectedQuestions.length > 0 && (
              <div className="shrink-0 border-t border-zinc-100 bg-zinc-50/80 px-4 py-3">
                <p className="text-[12px] font-semibold text-zinc-700">
                  {selectedQuestions.length} q · {totalPoints} pts
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Step footer ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-6">
        <button
          onClick={prevStep}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 transition-all duration-150"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={nextStep}
          className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-[0.98] transition-all duration-150"
        >
          Continue to Configuration <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Create question sheet ───────────────────────────────── */}
      <CreateQuestionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaveAndAdd={addQuestion}
      />

      {/* ── Question preview modal ──────────────────────────────── */}
      {previewQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setPreviewQ(null)}
          />
          <div className="relative z-10 w-[540px] animate-in fade-in-0 zoom-in-95 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl duration-200">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-semibold text-zinc-700">
                  {previewQ.type}
                </span>
                <span className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium", DIFF_STYLES[previewQ.difficulty])}>
                  {previewQ.difficulty}
                </span>
              </div>
              <button
                onClick={() => setPreviewQ(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors duration-150"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="text-[16px] font-bold text-zinc-900">{previewQ.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{previewQ.description}</p>

            <div className="mt-4 flex items-center gap-4 rounded-xl bg-zinc-50 p-3 text-[12px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />{previewQ.durationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />{previewQ.gradingMethod}
              </span>
              <span className="ml-auto text-[14px] font-bold text-zinc-900">
                {previewQ.points} pts
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {previewQ.tags.map((t) => (
                <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}