"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Eye, Minus, GripVertical, X, Inbox,
  CheckCircle2, BarChart2, Zap, Clock, ChevronLeft,
  ChevronRight, SlidersHorizontal, ArrowLeft, ArrowRight, ListChecks,
  Filter, Flag, Pencil, MoreHorizontal, AlertTriangle, Sparkles,
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
import { getQuestions, deleteQuestion } from "@/services/test-service";
import { QUESTION_TYPES, DIFFICULTIES, GRADING_METHODS, SORT_OPTIONS } from "@/config/constants";
import { AiBatchGenerateModal } from "@/components/create-test-page/ai-batch-generate-modal";
import { cn } from "@/lib/utils";
import type { Question, QuestionFilterState, SortOption, Difficulty } from "@/types";

const DIFF_STYLES: Record<Difficulty, string> = {
  Easy:   "bg-emerald-50 text-emerald-700 border-emerald-100",
  Medium: "bg-amber-50  text-amber-700  border-amber-100",
  Hard:   "bg-rose-50   text-rose-700   border-rose-100",
  Expert: "bg-purple-50 text-purple-700 border-purple-100",
};

// ─── Sortable selected-question row ──────────────────────────────────────────

function SortableRow({
  question, index, flagged, onPreview, onRemove,
}: {
  question: Question;
  index: number;
  flagged: boolean;
  onPreview: (question: Question) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: question.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2.5 shadow-sm transition-all duration-150 hover:border-zinc-200 hover:shadow-md"
    >
      {/* drag handle */}
      <button
        {...attributes} {...listeners}
        tabIndex={-1}
        aria-label={`Reorder question ${index + 1}`}
        className="mt-0.5 shrink-0 cursor-grab touch-none text-zinc-300 hover:text-zinc-400"
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {/* index badge */}
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">
        {index + 1}
      </span>

      {/* content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold leading-snug text-zinc-800">
          {question.title}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", DIFF_STYLES[question.difficulty])}>
            {question.difficulty}
          </span>
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">
            {question.points}pt
          </span>
          {flagged ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              <Flag className="h-2.5 w-2.5" /> Flagged
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-0.5 flex shrink-0 items-center gap-1">
        <button
          onClick={() => onPreview(question)}
          className="rounded-md p-0.5 text-zinc-300 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-500"
          title="Edit / Preview"
          aria-label="Edit or preview question"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          onClick={() => onRemove(question.id)}
          className="rounded-md p-0.5 text-zinc-300 transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
          title="Delete"
          aria-label="Delete question"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StepQuestions() {
  const router = useRouter();
  const {
    selectedQuestions, addQuestion, removeQuestion,
    reorderQuestions, isQuestionSelected, nextStep, prevStep,
    previewFlaggedQuestionIds,
    togglePreviewFlaggedQuestion,
  } = useWizardStore();

  const flaggedIdSet = new Set(previewFlaggedQuestionIds);

  const [filters,      setFilters]      = useState<QuestionFilterState>({ search: "", types: [], difficulties: [], gradingMethods: [] });
  const [sortBy,       setSortBy]       = useState<SortOption>("newest");
  const [libPage,      setLibPage]      = useState(1);
  const [previewQ,     setPreviewQ]     = useState<Question | null>(null);
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const [sortOpen,     setSortOpen]     = useState(false);
  const [filtersOpen,  setFiltersOpen]  = useState(true);
  const [questionLibrary, setQuestionLibrary] = useState<Question[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [aiBatchOpen, setAiBatchOpen] = useState(false);
  const PAGE_SIZE = 8;

  const frontendSelected = selectedQuestions.some((q) => q.type === "Frontend Project");

  // A test may contain only one Frontend Project question (single-WebContainer limit). Guard the
  // add with a message instead of silently no-op'ing in the store.
  function tryAddQuestion(q: Question) {
    if (q.type === "Frontend Project" && frontendSelected) {
      setDeleteError("A test can include only one Frontend Project question.");
      return;
    }
    setDeleteError(null);
    addQuestion(q);
  }

  function handleAiSaved(created: Question[]) {
    // Surface the new questions in the library and select them into the test.
    setQuestionLibrary((prev) => [...created, ...prev]);
    created.forEach((q) => addQuestion(q));
  }
  useEffect(() => {
    let isMounted = true;

    async function loadLibrary() {
      setIsLoadingLibrary(true);
      setLibraryError(null);
      try {
        const data = await getQuestions();
        if (isMounted) setQuestionLibrary(data);
      } catch (err) {
        if (isMounted) {
          setLibraryError(err instanceof Error ? err.message : "Failed to load question library.");
          setQuestionLibrary([]);
        }
      } finally {
        if (isMounted) setIsLoadingLibrary(false);
      }
    }

    void loadLibrary();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target?.closest("[data-question-card-menu]")) {
        setOpenCardMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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

  const filteredLib = questionLibrary
    .filter((q) => {
      if (filters.search             && !q.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.types.length       && !filters.types.includes(q.type))                              return false;
      if (filters.difficulties.length && !filters.difficulties.includes(q.difficulty))                return false;
      if (filters.gradingMethods.length && !filters.gradingMethods.includes(q.gradingMethod))         return false;
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

  const typeCounts = Object.fromEntries(QUESTION_TYPES.map((t)  => [t, questionLibrary.filter((q) => q.type === t).length]));
  const diffCounts = Object.fromEntries(DIFFICULTIES.map((d)    => [d, questionLibrary.filter((q) => q.difficulty === d).length]));
  const gradCounts = Object.fromEntries(GRADING_METHODS.map((g) => [g, questionLibrary.filter((q) => q.gradingMethod === g).length]));

  return (
    <div className="flex flex-col gap-6 pb-4">

      {/* ── Section header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
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

        {/* quick stats pill */}
        {selectedQuestions.length > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-2 shadow-sm">
            <div className="text-center">
              <p className="text-[18px] font-bold leading-none text-zinc-900">{selectedQuestions.length}</p>
              <p className="mt-0.5 text-[10px] font-medium text-zinc-400">questions</p>
            </div>
            <div className="h-6 w-px bg-zinc-100" />
            <div className="text-center">
              <p className="text-[18px] font-bold leading-none text-zinc-900">{totalPoints}</p>
              <p className="mt-0.5 text-[10px] font-medium text-zinc-400">points</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Toolbar row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* search — takes available space */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={filters.search}
            onChange={(e) => { setFilters((p) => ({ ...p, search: e.target.value })); setLibPage(1); }}
            placeholder="Search questions by title…"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-[13px] placeholder:text-zinc-400 shadow-sm focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
          />
        </div>

        {/* filter toggle */}
        <button
          onClick={() => setFiltersOpen((p) => !p)}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium shadow-sm transition-all duration-150",
            filtersOpen || activeFilterCount > 0
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
              filtersOpen ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"
            )}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* sort */}
        <div className="relative">
          <button
            onClick={() => setSortOpen((p) => !p)}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 transition-colors duration-150"
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
                  <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", sortBy === opt.value ? "bg-zinc-900" : "bg-transparent")} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* generate with AI */}
        <button
          onClick={() => setAiBatchOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-[13px] font-semibold text-violet-700 shadow-sm hover:bg-violet-100 active:scale-[0.98] transition-all duration-150"
        >
          <Sparkles className="h-4 w-4" />
          Generate with AI
        </button>

        {/* new question CTA */}
        <button
          onClick={() => router.push("/tests/create/questions/new")}
          className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-[0.98] transition-all duration-150"
        >
          <Plus className="h-4 w-4" />
          New Question
        </button>
      </div>

      {/* ── Inline filter strip (collapsible) ───────────────────── */}
      {filtersOpen && (
        <div className="flex flex-wrap items-start gap-6 rounded-2xl border border-zinc-200 bg-zinc-50/60 px-5 py-4">
          {[
            { label: "Type",       items: QUESTION_TYPES,           counts: typeCounts, key: "types"          as const, radio: false },
            { label: "Difficulty", items: ["All", ...DIFFICULTIES], counts: diffCounts, key: "difficulties"   as const, radio: true  },
            { label: "Grading",    items: GRADING_METHODS,          counts: gradCounts, key: "gradingMethods" as const, radio: false },
          ].map((sec, si) => (
            <div key={sec.label} className={cn("flex flex-col gap-2", si > 0 && "pl-6 border-l border-zinc-200")}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {sec.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sec.items.map((item) => {
                  const checked = item === "All"
                    ? (filters[sec.key] as string[]).length === 0
                    : (filters[sec.key] as string[]).includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => {
                        if (sec.radio) {
                          setFilters((p) => ({ ...p, [sec.key]: item === "All" ? [] : [item] }));
                          setLibPage(1);
                        } else {
                          toggleFilter(sec.key, item);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-all duration-150",
                        checked
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      {item}
                      {item !== "All" && (
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          checked ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                        )}>
                          {(sec.counts as Record<string, number>)[item] ?? 0}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* clear all */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters({ search: "", types: [], difficulties: [], gradingMethods: [] })}
              className="ml-auto self-center text-[12px] font-medium text-zinc-400 hover:text-zinc-700 transition-colors duration-150"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Two-column split: Library | Selected ────────────────── */}
      {/*
       * Layout contract:
       *   - Left  (library):  flex-1  — gets as much width as possible
       *   - Right (selected): w-[260px] — fixed, sticky panel
       *   - Both columns scroll independently via sticky + maxHeight
       */}
      <div className="flex items-start gap-5">

        {/* ══ Library ══════════════════════════════════════════════ */}
        <div className="min-w-0 flex-1 flex flex-col gap-4">

          {/* delete error banner */}
          {deleteError ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{deleteError}</span>
              <button
                type="button"
                onClick={() => setDeleteError(null)}
                className="shrink-0 rounded p-0.5 hover:bg-red-100 transition-colors duration-150"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {/* result count */}
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-zinc-700">
              {filteredLib.length === 0
                ? "No questions found"
                : `Showing ${(libPage - 1) * PAGE_SIZE + 1}–${Math.min(libPage * PAGE_SIZE, filteredLib.length)} of ${filteredLib.length} questions`
              }
            </p>
            {filteredLib.length > 0 && (
              <p className="text-[12px] text-zinc-400">Click a card to add</p>
            )}
          </div>

          {/* grid */}
          {isLoadingLibrary ? (
            <div className="rounded-2xl border border-zinc-200 bg-white py-10 text-center text-[13px] text-zinc-500">
              Loading question library...
            </div>
          ) : libraryError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              {libraryError}
            </div>
          ) : pagedLib.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-20">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100">
                <Inbox className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="text-[14px] font-semibold text-zinc-600">No questions match</p>
              <p className="mt-1 text-[12px] text-zinc-400">Try adjusting your filters or search term</p>
            </div>
          ) : (
            /*
             * 3-column grid — cards are wider and more readable now
             * that the filter sidebar is gone from the side.
             * Each card has overflow-hidden to prevent bleed.
             */
            <div className="grid grid-cols-3 gap-4">
              {pagedLib.map((q) => {
                const selected = isQuestionSelected(q.id);
                const flagged = flaggedIdSet.has(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      if (flagged) return;
                      setOpenCardMenuId(null);
                      selected ? removeQuestion(q.id) : tryAddQuestion(q);
                    }}
                    className={cn(
                      "group relative flex cursor-pointer flex-col gap-2 overflow-visible rounded-2xl border-2 p-4 transition-all duration-150",
                      selected
                        ? "border-zinc-900 bg-zinc-50 shadow-md"
                        : "border-zinc-100 bg-white hover:border-zinc-300 hover:shadow-lg",
                      flagged && "cursor-default",
                      openCardMenuId === q.id && "z-30"
                    )}
                  >
                    {/* selected tick */}
                    {selected && (
                      <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 fill-zinc-900 text-white" />
                    )}

                    {/* flagged marker from candidate preview */}
                    {flagged ? (
                      <div className="pointer-events-none absolute inset-0 z-[1] bg-white/35 backdrop-blur-[1.5px]" />
                    ) : null}

                    {/* type + difficulty + points */}
                    <div className="flex flex-wrap items-center gap-1.5 pr-6">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                        {q.type}
                      </span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", DIFF_STYLES[q.difficulty])}>
                        {q.difficulty}
                      </span>
                      <span className="ml-auto text-[14px] font-bold text-zinc-900">
                        {q.points}pts
                      </span>
                    </div>

                    {/* title — 2 lines max */}
                    <p className="line-clamp-2 text-[14px] font-bold leading-snug text-zinc-900">
                      {q.title}
                    </p>

                    {/* description — 3 lines, more readable at this width */}
                    <p className="line-clamp-3 flex-1 text-[12px] leading-relaxed text-zinc-500">
                      {q.description}
                    </p>

                    {/* meta row */}
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
                      {q.tags.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* action row */}
                    <div
                      className="flex items-center justify-between border-t border-zinc-100 pt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative z-30" data-question-card-menu>
                        <button
                          onClick={() => setOpenCardMenuId((prev) => (prev === q.id ? null : q.id))}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700"
                          aria-label="Open question actions"
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </button>

                        {openCardMenuId === q.id ? (
                          <div className="absolute left-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
                            <button
                              onClick={() => {
                                router.push(`/tests/create/questions/${q.id}/edit?from=/tests/create`);
                                setOpenCardMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-zinc-700 hover:bg-zinc-50"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                            </button>
                            <button
                              onClick={() => {
                                void (async () => {
                                  setOpenCardMenuId(null);
                                  setDeleteError(null);
                                  const wasSelected = isQuestionSelected(q.id);
                                  setQuestionLibrary((prev) => prev.filter((item) => item.id !== q.id));
                                  removeQuestion(q.id);
                                  try {
                                    await deleteQuestion(q.id);
                                  } catch (err) {
                                    setQuestionLibrary((prev) => [q, ...prev]);
                                    if (wasSelected) addQuestion(q);
                                    setDeleteError(err instanceof Error ? err.message : "Failed to delete question. Please try again.");
                                  }
                                })();
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-red-600 hover:bg-zinc-50"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                            </button>
                            <button
                              onClick={() => {
                                setPreviewQ(q);
                                setOpenCardMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-zinc-700 hover:bg-zinc-50"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Preview
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <button
                        onClick={() => {
                          setOpenCardMenuId(null);
                          selected ? removeQuestion(q.id) : tryAddQuestion(q);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1 text-[12px] font-semibold transition-all duration-150",
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

                    {flagged ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePreviewFlaggedQuestion(q.id);
                        }}
                        className="absolute inset-0 z-[2] flex items-center justify-center"
                        title="Click to clear flag"
                        aria-label="Clear flag"
                      >
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 shadow-sm transition-colors duration-150 hover:bg-amber-100">
                          <Flag className="h-4 w-4" />
                        </span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* pagination */}
          {filteredLib.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
              <span className="text-[12px] text-zinc-400">
                Page {libPage} of {totalPages}
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

                {/* page number pills */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - libPage) <= 1)
                    .reduce<(number | "…")[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-zinc-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setLibPage(p as number)}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-medium transition-all duration-150",
                            libPage === p
                              ? "bg-zinc-900 text-white"
                              : "text-zinc-500 hover:bg-zinc-100"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )
                  }
                </div>

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
          )}
        </div>

        {/* ══ Selected panel ═══════════════════════════════════════ */}
        <aside className="w-[260px] shrink-0">
          <div
            className="sticky top-4 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          >
            {/* header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-zinc-900">Selected</span>
                <span className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-200",
                  selectedQuestions.length > 0 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-400"
                )}>
                  {selectedQuestions.length}
                </span>
              </div>
              {totalPoints > 0 && (
                <div className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1">
                  <Zap className="h-3 w-3 text-zinc-500" />
                  <span className="text-[11px] font-bold text-zinc-700">{totalPoints} pts</span>
                </div>
              )}
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto p-3">
              {selectedQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50">
                    <Inbox className="h-6 w-6 text-zinc-300" />
                  </div>
                  <p className="text-[13px] font-semibold text-zinc-500">No questions yet</p>
                  <p className="text-[12px] leading-relaxed text-zinc-400">
                    Click <strong className="text-zinc-600">Add</strong> on any card in the library
                  </p>
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
                          flagged={flaggedIdSet.has(q.id)}
                          onPreview={(question) => setPreviewQ(question)}
                          onRemove={removeQuestion}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* footer */}
            {selectedQuestions.length > 0 && (
              <div className="shrink-0 border-t border-zinc-100 bg-zinc-50/80 px-4 py-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-zinc-700">
                    {selectedQuestions.length} question{selectedQuestions.length !== 1 ? "s" : ""}
                  </span>
                  <span className="font-bold text-zinc-900">{totalPoints} pts total</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Drag rows to reorder
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

      {/* ── AI batch generation modal ───────────────────────────── */}
      <AiBatchGenerateModal
        open={aiBatchOpen}
        onClose={() => setAiBatchOpen(false)}
        onSaved={handleAiSaved}
      />

      {/* ── Question preview modal ──────────────────────────────── */}
      {previewQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setPreviewQ(null)}
          />
          <div className="relative z-10 w-[560px] animate-in fade-in-0 zoom-in-95 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl duration-200">
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
                aria-label="Close question preview"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors duration-150"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <h3 className="text-[17px] font-bold text-zinc-900">{previewQ.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{previewQ.description}</p>

            <div className="mt-4 flex items-center gap-4 rounded-xl bg-zinc-50 p-3 text-[12px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />{previewQ.durationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />{previewQ.gradingMethod}
              </span>
              <span className="ml-auto text-[15px] font-bold text-zinc-900">
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