"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUESTION_TYPES, CODING_LANGUAGES, GRADING_METHODS } from "@/config/constants";
import type { Question, NewQuestionForm, QuestionType, Difficulty, GradingMethod } from "@/types";

const EMPTY_FORM: NewQuestionForm = {
  type: "", title: "", description: "", difficulty: "",
  points: 10, durationMinutes: 10, gradingMethod: "",
  tags: [], options: [{ text: "", correct: false }, { text: "", correct: false }],
  language: "Python", starterCode: "", evaluationCriteria: "",
};

function genId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const DIFF_STYLES: Record<string, string> = {
  Easy:   "bg-emerald-50 text-emerald-700 border-emerald-100",
  Medium: "bg-amber-50 text-amber-700 border-amber-100",
  Hard:   "bg-rose-50 text-rose-700 border-rose-100",
  Expert: "bg-purple-50 text-purple-700 border-purple-100",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaveAndAdd: (q: Question) => void;
}

export function CreateQuestionSheet({ open, onClose, onSaveAndAdd }: Props) {
  const [form, setForm]       = useState<NewQuestionForm>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");

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
      form.type === "True/False" ? { text: o.text, correct: j === i } : j === i ? { text: o.text, correct: !o.correct } : o
    ));
  }

  const showOptions = form.type === "Multiple Choice" || form.type === "True/False";
  const showCoding  = form.type === "Coding" || form.type === "SQL";
  const showEval    = form.type === "Essay" || form.type === "Case Study";
  const isValid     = Boolean(form.type && form.title.trim() && form.difficulty && form.gradingMethod);

  function handleSaveAndAdd() {
    if (!isValid) return;
    onSaveAndAdd({
      id: genId(), title: form.title, description: form.description,
      type: form.type as QuestionType, difficulty: form.difficulty as Difficulty,
      gradingMethod: form.gradingMethod as GradingMethod,
      points: form.points, durationMinutes: form.durationMinutes,
      tags: form.tags, usageCount: 0,
    });
    setForm(EMPTY_FORM);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative z-10 flex h-full w-[500px] flex-col bg-white shadow-2xl animate-in slide-in-from-right-full duration-300">

        {/* Header */}
        <div className="shrink-0 border-b border-zinc-100 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[18px] font-bold text-zinc-900">Create New Question</h2>
              <p className="mt-0.5 text-[13px] text-zinc-500">Saved to your library and added to this test</p>
            </div>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors duration-150">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {["Type", "Title", "Difficulty", "Grading"].map((l, i) => {
              const filled = [form.type, form.title, form.difficulty, form.gradingMethod][i];
              return (
                <div key={l} className="flex items-center gap-1.5">
                  <div className={cn("h-1.5 w-1.5 rounded-full transition-colors duration-200", filled ? "bg-zinc-900" : "bg-zinc-200")} />
                  <span className="text-[10px] text-zinc-400">{l}</span>
                  {i < 3 && <div className="h-px w-4 bg-zinc-200" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Type */}
          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-zinc-500">
              Question Type <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select value={form.type}
                onChange={(e) => update("type", e.target.value as QuestionType | "")}
                className={cn("w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition-all duration-150",
                  !form.type ? "text-zinc-400" : "text-zinc-900"
                )}>
                <option value="">Select type…</option>
                {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-zinc-500">
              Title <span className="text-red-400">*</span>
            </label>
            <input value={form.title} onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Reverse a linked list in Python"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 shadow-sm placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
            />
          </div>

          {/* Description */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[12px] font-bold uppercase tracking-widest text-zinc-500">Description</label>
              <span className="text-[11px] text-zinc-400">{form.description.length}/1000</span>
            </div>
            <textarea rows={4} value={form.description}
              onChange={(e) => update("description", e.target.value.slice(0, 1000))}
              placeholder="Write the full question prompt here…"
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[13px] text-zinc-900 shadow-sm placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="mb-2.5 block text-[12px] font-bold uppercase tracking-widest text-zinc-500">
              Difficulty <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {(["Easy", "Medium", "Hard", "Expert"] as Difficulty[]).map((d) => (
                <button key={d} type="button" onClick={() => update("difficulty", d)}
                  className={cn(
                    "rounded-xl border px-4 py-1.5 text-[12px] font-semibold transition-all duration-150",
                    DIFF_STYLES[d],
                    form.difficulty === d ? "ring-2 ring-offset-1 ring-zinc-400 shadow-sm scale-105" : "opacity-60 hover:opacity-100"
                  )}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Points + Duration */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Points",   key: "points"          as const, suffix: "pts", min: 1  },
              { label: "Duration", key: "durationMinutes" as const, suffix: "min", min: 1  },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-zinc-500">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={f.min} value={form[f.key] as number}
                    onChange={(e) => update(f.key, Number(e.target.value))}
                    className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-medium text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                  <span className="text-[12px] text-zinc-500">{f.suffix}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Grading */}
          <div>
            <label className="mb-2.5 block text-[12px] font-bold uppercase tracking-widest text-zinc-500">
              Grading Method <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {(["Auto-graded", "Hybrid", "Manual"] as GradingMethod[]).map((g) => (
                <button key={g} type="button" onClick={() => update("gradingMethod", g)}
                  className={cn(
                    "rounded-xl border px-4 py-1.5 text-[12px] font-semibold transition-all duration-150",
                    form.gradingMethod === g
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-sm scale-105"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white"
                  )}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-zinc-500">Tags</label>
            <div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm focus-within:ring-2 focus-within:ring-zinc-900/10 focus-within:border-zinc-300 transition-all duration-150">
              {form.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-lg bg-zinc-100 py-0.5 pl-2.5 pr-1.5 text-[12px] font-medium text-zinc-700">
                  {tag}
                  <button type="button" onClick={() => update("tags", form.tags.filter((t) => t !== tag))}
                    className="text-zinc-400 hover:text-zinc-700 transition-colors duration-150">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input value={tagInput}
                onChange={(e) => { if (e.target.value.endsWith(",")) addTag(e.target.value); else setTagInput(e.target.value); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
                  if (e.key === "Backspace" && !tagInput && form.tags.length > 0) update("tags", form.tags.slice(0, -1));
                }}
                placeholder={form.tags.length === 0 ? "Add tags…" : ""}
                className="min-w-[80px] flex-1 bg-transparent text-[12px] placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-400">Press Enter or comma to add a tag</p>
          </div>

          {/* Multiple Choice / True-False */}
          {showOptions && (
            <div className="space-y-3 border-t border-zinc-100 pt-5">
              <p className="text-[12px] font-bold uppercase tracking-widest text-zinc-500">Answer Options</p>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <input type={form.type === "True/False" ? "radio" : "checkbox"}
                    name="correct-option" checked={opt.correct}
                    onChange={() => updateOptionCorrect(i)}
                    className="h-4 w-4 shrink-0 accent-zinc-900" />
                  <input value={opt.text} onChange={(e) => updateOptionText(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                  />
                  {form.options.length > 2 && (
                    <button type="button" onClick={() => update("options", form.options.filter((_, j) => j !== i))}
                      className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors duration-150">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {form.type === "Multiple Choice" && (
                <button type="button" onClick={() => update("options", [...form.options, { text: "", correct: false }])}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors duration-150">
                  <Plus className="h-3.5 w-3.5" /> Add Option
                </button>
              )}
            </div>
          )}

          {/* Coding / SQL */}
          {showCoding && (
            <div className="space-y-4 border-t border-zinc-100 pt-5">
              <div>
                <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-zinc-500">Language</label>
                <div className="relative">
                  <select value={form.language} onChange={(e) => update("language", e.target.value)}
                    className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10">
                    {CODING_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-zinc-500">Starter Code</label>
                <textarea rows={5} value={form.starterCode}
                  onChange={(e) => update("starterCode", e.target.value)}
                  placeholder="// Starter code provided to candidates"
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-950 px-4 py-3 font-mono text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                />
              </div>
            </div>
          )}

          {/* Essay / Case Study */}
          {showEval && (
            <div className="space-y-4 border-t border-zinc-100 pt-5">
              <div>
                <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-zinc-500">Evaluation Criteria</label>
                <textarea rows={3} value={form.evaluationCriteria}
                  onChange={(e) => update("evaluationCriteria", e.target.value)}
                  placeholder="What should reviewers look for?"
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[13px] text-zinc-900 shadow-sm placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-zinc-100 bg-zinc-50/80 px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50 transition-colors duration-150">
            Save to Library Only
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="rounded-xl px-4 py-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 transition-colors duration-150">
              Cancel
            </button>
            <button type="button" onClick={handleSaveAndAdd} disabled={!isValid}
              className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 transition-all duration-150 active:scale-[0.98]">
              <Plus className="h-4 w-4" /> Save &amp; Add to Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}