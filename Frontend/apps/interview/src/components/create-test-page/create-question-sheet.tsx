"use client";

import { useEffect, useState } from "react";
import { X, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUESTION_TYPES, CODING_LANGUAGES, GRADING_METHODS } from "@/config/constants";
import type { NewQuestionForm, QuestionType, Difficulty, GradingMethod } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: NewQuestionForm = {
  type: "", title: "", description: "", difficulty: "",
  points: 10, durationMinutes: 10, gradingMethod: "",
  tags: [], options: [{ text: "", correct: false }, { text: "", correct: false }],
  language: "Python", starterCode: "", evaluationCriteria: "",
};

function defaultOptionsForType(type: NewQuestionForm["type"]) {
  if (type === "True/False") {
    return [
      { text: "True", correct: true },
      { text: "False", correct: false },
    ];
  }

  return [{ text: "", correct: false }, { text: "", correct: false }];
}

function getValidationError(form: NewQuestionForm): string | null {
  if (!form.type) return "Question type is required.";
  if (!form.title.trim()) return "Title is required.";
  if (!form.difficulty) return "Difficulty is required.";
  if (!form.gradingMethod) return "Grading method is required.";
  if (form.points <= 0) return "Points must be greater than 0.";
  if (form.durationMinutes <= 0) return "Duration must be greater than 0 minutes.";

  if ((form.type === "Coding" || form.type === "SQL") && !form.language.trim()) {
    return "Language is required for Coding and SQL questions.";
  }

  if (form.type === "Multiple Choice" || form.type === "True/False") {
    const nonEmptyOptions = form.options.filter((option) => option.text.trim().length > 0);
    if (nonEmptyOptions.length === 0 || !nonEmptyOptions.some((option) => option.correct)) {
      return "Multiple Choice and True/False questions require options and at least one correct option.";
    }
  }

  return null;
}


const DIFF_STYLES: Record<string, string> = {
  Easy:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50  text-amber-700  border-amber-200",
  Hard:   "bg-rose-50   text-rose-700   border-rose-200",
  Expert: "bg-purple-50 text-purple-700 border-purple-200",
};

// ─── Reusable field primitives ────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-zinc-500">
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}

function SelectChevron() {
  return (
    <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open?: boolean;
  onClose: () => void;
  onSaveToLibrary: (form: NewQuestionForm) => Promise<void>;
  onSaveAndAdd: (form: NewQuestionForm) => Promise<void>;
  fullPage?: boolean;
  initialForm?: NewQuestionForm | null;
  mode?: "create" | "edit";
  saveLibraryLabel?: string;
  saveAndAddLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateQuestionSheet({
  open = true,
  onClose,
  onSaveToLibrary,
  onSaveAndAdd,
  fullPage = false,
  initialForm = null,
  mode = "create",
  saveLibraryLabel,
  saveAndAddLabel,
}: Props) {
  const [form,     setForm]     = useState<NewQuestionForm>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialForm) {
      setForm(initialForm);
    } else {
      setForm(EMPTY_FORM);
    }
    setTagInput("");
    setSubmitError(null);
  }, [open, initialForm]);

  function update<K extends keyof NewQuestionForm>(key: K, val: NewQuestionForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,$/, "");
    if (tag && !form.tags.includes(tag)) update("tags", [...form.tags, tag]);
    setTagInput("");
  }

  function updateOptionText(i: number, text: string) {
    update("options", form.options.map((o, j) => j === i ? { text, correct: o.correct } : o));
  }

  function updateOptionCorrect(i: number) {
    update("options", form.options.map((o, j) =>
      form.type === "True/False"
        ? { text: o.text, correct: j === i }
        : j === i ? { text: o.text, correct: !o.correct } : o
    ));
  }

  const showOptions = form.type === "Multiple Choice" || form.type === "True/False";
  const showCoding  = form.type === "Coding" || form.type === "SQL";
  const showEval    = form.type === "Essay" || form.type === "Case Study";
  const validationError = getValidationError(form);
  const isValid = validationError === null;

  // completion steps for the progress bar
  const progressSteps = [
    { label: "Type",       done: Boolean(form.type)        },
    { label: "Title",      done: Boolean(form.title.trim()) },
    { label: "Difficulty", done: Boolean(form.difficulty)  },
    { label: "Grading",    done: Boolean(form.gradingMethod) },
  ];
  const completedCount = progressSteps.filter((s) => s.done).length;

   async function submit(saveToTest: boolean) {
    if (!isValid) {
      setSubmitError(validationError ?? "Please complete required fields.");
      return;
    }
    setIsSaving(true);
    setSubmitError(null);
    try {
      if (saveToTest) {
        await onSaveAndAdd(form);
      } else {
        await onSaveToLibrary(form);
      }
      setForm(EMPTY_FORM);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save question.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!fullPage && !open) return null;

  return (
    <div className={fullPage ? "w-full" : "fixed inset-0 z-[55] flex items-center justify-center p-6"}>
      {!fullPage && (
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
          onClick={onClose}
        />
      )}

      {/*
       * Modal panel
       *  - w-[780px]   wide enough to show two columns comfortably
       *  - max-h-[90vh] never taller than 90% of the viewport
       *  - flex flex-col so header/footer stay fixed and body scrolls
       */}
      <div
        className={cn(
          "relative z-10 flex flex-col overflow-hidden border border-zinc-200 bg-white",
          fullPage
            ? "w-full rounded-2xl shadow-sm"
            : "w-[780px] max-w-[95vw] rounded-3xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-zinc-100 bg-white px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-bold text-zinc-900">Create New Question</h2>
              <p className="mt-0.5 text-[13px] text-zinc-500">
                {mode === "edit"
                  ? "Update this question and keep your test set in sync"
                  : "Save to your library, then optionally add it to this test"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500">
                {completedCount} of {progressSteps.length} required fields
              </span>
              {isValid && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready to save
                </span>
              )}
            </div>
            {/* track */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-900 transition-all duration-500"
                style={{ width: `${(completedCount / progressSteps.length) * 100}%` }}
              />
            </div>
            {/* step labels */}
            <div className="mt-2 flex items-center justify-between">
              {progressSteps.map((s) => (
                <div key={s.label} className="flex items-center gap-1">
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                    s.done ? "bg-zinc-900" : "bg-zinc-200"
                  )} />
                  <span className={cn(
                    "text-[10px] font-medium transition-colors duration-200",
                    s.done ? "text-zinc-700" : "text-zinc-400"
                  )}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Body — two columns ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className={cn(
            "grid divide-zinc-100",
            fullPage ? "grid-cols-1 xl:grid-cols-2 xl:divide-x" : "grid-cols-2 divide-x"
          )}>

            {/* Left column — core fields */}
            <div className={cn("flex flex-col gap-6 px-8 py-6", fullPage && "xl:px-10 xl:py-8")}>

              {/* Question Type */}
              <div>
                <FieldLabel required>Question Type</FieldLabel>
                <div className="relative">
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const nextType = e.target.value as QuestionType | "";
                      setForm((prev) => ({
                        ...prev,
                        type: nextType,
                        options:
                          nextType === "Multiple Choice" || nextType === "True/False"
                            ? defaultOptionsForType(nextType)
                            : prev.options,
                      }));
                    }}
                    className={cn(
                      "w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] shadow-sm transition-all duration-150",
                      "focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
                      !form.type ? "text-zinc-400" : "text-zinc-900"
                    )}
                  >
                    <option value="">Select type…</option>
                    {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <SelectChevron />
                </div>
              </div>

              {/* Title */}
              <div>
                <FieldLabel required>Title</FieldLabel>
                <input
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="e.g. Reverse a linked list in Python"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 shadow-sm placeholder:text-zinc-400 transition-all duration-150 hover:border-zinc-300 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>

              {/* Description */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <FieldLabel>Description</FieldLabel>
                  <span className="text-[11px] text-zinc-400">{form.description.length}/1000</span>
                </div>
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value.slice(0, 1000))}
                  placeholder="Write the full question prompt here…"
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[13px] text-zinc-900 shadow-sm placeholder:text-zinc-400 transition-all duration-150 hover:border-zinc-300 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>

              {/* Tags */}
              <div>
                <FieldLabel>Tags</FieldLabel>
                <div className="flex min-h-[44px] flex-wrap gap-1.5 rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm transition-all duration-150 focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/10">
                  {form.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 rounded-lg bg-zinc-100 py-0.5 pl-2.5 pr-1.5 text-[12px] font-medium text-zinc-700">
                      {tag}
                      <button
                        type="button"
                        onClick={() => update("tags", form.tags.filter((t) => t !== tag))}
                        className="text-zinc-400 transition-colors duration-150 hover:text-zinc-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => {
                      if (e.target.value.endsWith(",")) addTag(e.target.value);
                      else setTagInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
                      if (e.key === "Backspace" && !tagInput && form.tags.length > 0)
                        update("tags", form.tags.slice(0, -1));
                    }}
                    placeholder={form.tags.length === 0 ? "Add tags…" : ""}
                    className="min-w-[80px] flex-1 bg-transparent text-[12px] placeholder:text-zinc-400 focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-400">Press Enter or comma to add</p>
              </div>
            </div>

            {/* Right column — settings + conditional */}
            <div className={cn("flex flex-col gap-6 px-8 py-6", fullPage && "xl:px-10 xl:py-8")}>

              {/* Difficulty */}
              <div>
                <FieldLabel required>Difficulty</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {(["Easy", "Medium", "Hard", "Expert"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => update("difficulty", d)}
                      className={cn(
                        "rounded-xl border-2 px-4 py-2 text-[13px] font-semibold transition-all duration-150",
                        DIFF_STYLES[d],
                        form.difficulty === d
                          ? "scale-[1.03] shadow-sm ring-2 ring-offset-1 ring-zinc-300"
                          : "opacity-50 hover:opacity-90"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Points + Duration */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Points",   key: "points"          as const, suffix: "pts", min: 1 },
                  { label: "Duration", key: "durationMinutes" as const, suffix: "min", min: 1 },
                ].map((f) => (
                  <div key={f.key}>
                    <FieldLabel>{f.label}</FieldLabel>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={f.min}
                        value={form[f.key] as number}
                        onChange={(e) => update(f.key, Number(e.target.value))}
                        className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-medium text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
                      />
                      <span className="text-[12px] text-zinc-500">{f.suffix}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grading Method */}
              <div>
                <FieldLabel required>Grading Method</FieldLabel>
                <div className="flex flex-col gap-2">
                  {(["Auto-graded", "Hybrid", "Manual"] as GradingMethod[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => update("gradingMethod", g)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150",
                        form.gradingMethod === g
                          ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                      )}
                    >
                      <div className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
                        form.gradingMethod === g
                          ? "border-white bg-white"
                          : "border-zinc-300 bg-transparent"
                      )}>
                        {form.gradingMethod === g && (
                          <div className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
                        )}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold">{g}</p>
                        <p className={cn(
                          "text-[11px]",
                          form.gradingMethod === g ? "text-zinc-300" : "text-zinc-400"
                        )}>
                          {g === "Auto-graded" && "Scored automatically on submission"}
                          {g === "Hybrid"      && "Auto-scored with manual review option"}
                          {g === "Manual"      && "Requires reviewer to score"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Conditional sections ───────────────────────── */}

              {/* Multiple Choice / True-False */}
              {showOptions && (
                <div className="flex flex-col gap-3 border-t border-zinc-100 pt-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                    Answer Options
                  </p>
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <input
                        type={form.type === "True/False" ? "radio" : "checkbox"}
                        name="correct-option"
                        checked={opt.correct}
                        onChange={() => updateOptionCorrect(i)}
                        className="h-4 w-4 shrink-0 accent-zinc-900"
                      />
                      <input
                        value={opt.text}
                        onChange={(e) => updateOptionText(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
                      />
                      {form.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => update("options", form.options.filter((_, j) => j !== i))}
                          className="shrink-0 rounded-lg p-1 text-zinc-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {form.type === "Multiple Choice" && (
                    <button
                      type="button"
                      onClick={() => update("options", [...form.options, { text: "", correct: false }])}
                      className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-[12px] font-medium text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Option
                    </button>
                  )}
                </div>
              )}

              {/* Coding / SQL */}
              {showCoding && (
                <div className="flex flex-col gap-4 border-t border-zinc-100 pt-5">
                  <div>
                    <FieldLabel>Language</FieldLabel>
                    <div className="relative">
                      <select
                        value={form.language}
                        onChange={(e) => update("language", e.target.value)}
                        className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
                      >
                        {CODING_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <SelectChevron />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Starter Code</FieldLabel>
                    <textarea
                      rows={6}
                      value={form.starterCode}
                      onChange={(e) => update("starterCode", e.target.value)}
                      placeholder="// Starter code provided to candidates"
                      className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-950 px-4 py-3 font-mono text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all duration-150"
                    />
                  </div>
                </div>
              )}

              {/* Essay / Case Study */}
              {showEval && (
                <div className="border-t border-zinc-100 pt-5">
                  <FieldLabel>Evaluation Criteria</FieldLabel>
                  <textarea
                    rows={4}
                    value={form.evaluationCriteria}
                    onChange={(e) => update("evaluationCriteria", e.target.value)}
                    placeholder="What should reviewers look for?"
                    className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[13px] text-zinc-900 shadow-sm placeholder:text-zinc-400 transition-all duration-150 hover:border-zinc-300 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-t border-zinc-100 bg-zinc-50/80 px-8 py-4">
          {submitError && (
            <p className="mr-4 max-w-[320px] text-[12px] text-red-600">{submitError}</p>
          )}
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={!isValid || isSaving}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-600 shadow-sm transition-colors duration-150 hover:bg-zinc-50"
            >
              {saveLibraryLabel ?? (mode === "edit" ? "Save Changes" : "Save to Library Only")}
            </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl px-4 py-2 text-[13px] font-medium text-zinc-500 transition-colors duration-150 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
               onClick={() => void submit(true)}
              disabled={!isValid || isSaving}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold shadow-sm transition-all duration-150 active:scale-[0.98]",
                isValid && !isSaving
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "cursor-not-allowed bg-zinc-100 text-zinc-400 shadow-none"
              )}
            >
              <Plus className="h-4 w-4" />
              {isSaving
                ? "Saving..."
                : (saveAndAddLabel ?? (mode === "edit" ? "Save & Keep in Test" : "Save & Add to Test"))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}