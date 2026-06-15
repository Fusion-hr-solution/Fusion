"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, CheckCircle2, Circle, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import { QUESTION_TYPES, DIFFICULTIES, CODING_LANGUAGES } from "@/config/constants";
import { generateQuestions, createQuestion } from "@/services/test-service";
import type { NewQuestionForm, Question, QuestionType, Difficulty } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the questions that were generated, accepted, and saved to the library. */
  onSaved: (created: Question[]) => void;
}

type Phase = "input" | "review";

export function AiBatchGenerateModal({ open, onClose, onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>("input");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<QuestionType | "">("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [language, setLanguage] = useState("");
  const [count, setCount] = useState(3);

  const [drafts, setDrafts] = useState<NewQuestionForm[]>([]);
  const [accepted, setAccepted] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const topicRef = useRef<HTMLTextAreaElement | null>(null);
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  useEffect(() => setMounted(true), []);

  // Keep a ref to the latest keyboard handler so the document listener (bound once
  // per open) always sees current state/closures without re-binding.
  useEffect(() => {
    keyHandlerRef.current = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy) {
        e.preventDefault();
        if (phase === "input") void handleGenerate();
        else void handleSave();
      }
    };
  });

  // Lock body scroll + wire global keyboard shortcuts while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Autofocus the topic field when the input step is shown.
  useEffect(() => {
    if (open && mounted && phase === "input" && !busy) {
      const t = setTimeout(() => topicRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open, mounted, phase, busy]);

  if (!open || !mounted) return null;

  const showLanguage = type === "Coding" || type === "SQL";
  const acceptedCount = accepted.filter(Boolean).length;
  const allSelected = drafts.length > 0 && acceptedCount === drafts.length;
  const canGenerate = !busy && topic.trim().length > 0;

  function reset() {
    setPhase("input");
    setTopic("");
    setType("");
    setDifficulty("");
    setLanguage("");
    setCount(3);
    setDrafts([]);
    setAccepted([]);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function toggleSelectAll() {
    setAccepted(drafts.map(() => !allSelected));
  }

  async function handleGenerate() {
    const trimmed = topic.trim();
    if (!trimmed) {
      setError("Describe a topic for the questions.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await generateQuestions({
        topic: trimmed,
        type: type || undefined,
        difficulty: difficulty || undefined,
        language: showLanguage ? language || undefined : undefined,
        count: Math.min(10, Math.max(1, count)),
      });
      if (result.length === 0) {
        setError("The AI didn't return any usable questions. Try refining the topic.");
        return;
      }
      setDrafts(result);
      setAccepted(result.map(() => true));
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const toSave = drafts.filter((_, i) => accepted[i]);
    if (toSave.length === 0) {
      setError("Select at least one question to add.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created: Question[] = [];
      for (const draft of toSave) {
        created.push(await createQuestion(draft));
      }
      onSaved(created);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the generated questions.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-modal-title"
        className="relative z-10 flex max-h-[88vh] w-[680px] max-w-[95vw] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-7 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
              <Sparkles className="h-4.5 w-4.5 text-violet-600" />
            </div>
            <div>
              <h2 id="ai-modal-title" className="text-[18px] font-bold text-zinc-900">Generate Questions with AI</h2>
              <p className="text-[12px] text-zinc-500">
                {phase === "input"
                  ? "Describe a topic — review the drafts before anything is saved."
                  : `Review ${drafts.length} draft${drafts.length !== 1 ? "s" : ""} and choose which to add.`}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {phase === "input" && busy ? (
            <GeneratingState count={count} topic={topic} />
          ) : phase === "input" ? (
            <div className="flex flex-col gap-5">
              <div>
                <FieldLabel required>Topic</FieldLabel>
                <textarea
                  ref={topicRef}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  placeholder="e.g. SQL joins, indexing, and query optimization for a senior data role"
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Type</FieldLabel>
                  <DropdownSelect
                    id="ai-type"
                    ariaLabel="Question type"
                    value={type}
                    placeholder="Any type"
                    options={[{ value: "", label: "Any type" }, ...QUESTION_TYPES.map((v) => ({ value: v, label: v }))]}
                    onChange={(v) => setType(v as QuestionType | "")}
                  />
                </div>
                <div>
                  <FieldLabel>Difficulty</FieldLabel>
                  <DropdownSelect
                    id="ai-difficulty"
                    ariaLabel="Difficulty"
                    value={difficulty}
                    placeholder="Any difficulty"
                    options={[{ value: "", label: "Any difficulty" }, ...DIFFICULTIES.map((v) => ({ value: v, label: v }))]}
                    onChange={(v) => setDifficulty(v as Difficulty | "")}
                  />
                </div>
                {showLanguage && (
                  <div>
                    <FieldLabel>Language</FieldLabel>
                    <DropdownSelect
                      id="ai-language"
                      ariaLabel="Language"
                      value={language}
                      placeholder="Select language"
                      options={CODING_LANGUAGES.map((v) => ({ value: v, label: v }))}
                      onChange={setLanguage}
                    />
                  </div>
                )}
                <div>
                  <FieldLabel>How many</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={count}
                    onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                  <p className="mt-1 text-[11px] text-zinc-400">Between 1 and 10.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Select-all toolbar */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-zinc-600">
                  {acceptedCount} of {drafts.length} selected
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-[12px] font-semibold text-violet-600 transition-colors hover:text-violet-700"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                {drafts.map((d, i) => {
                  const isChoice = d.type === "Multiple Choice" || d.type === "True/False";
                  const options = d.options.filter((o) => o.text.trim());
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAccepted((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                        accepted[i]
                          ? "border-violet-300 bg-violet-50/60"
                          : "border-zinc-200 bg-white opacity-70 hover:opacity-100"
                      )}
                    >
                      {accepted[i] ? (
                        <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-violet-600" />
                      ) : (
                        <Circle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-zinc-300" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">{d.type}</span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{d.difficulty}</span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">{d.points}pt</span>
                          {showLanguageTag(d) && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">{d.language}</span>
                          )}
                        </div>
                        <p className="truncate text-[13px] font-semibold text-zinc-900">{d.title}</p>
                        <p className="line-clamp-2 text-[12px] text-zinc-500">{d.description}</p>

                        {/* Inline option preview so the reviewer can verify the correct answer */}
                        {isChoice && options.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {options.map((o, oi) => (
                              <div
                                key={oi}
                                className={cn(
                                  "flex items-center gap-1.5 text-[11px]",
                                  o.correct ? "font-medium text-emerald-700" : "text-zinc-500"
                                )}
                              >
                                {o.correct ? (
                                  <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                                ) : (
                                  <span className="h-3 w-3 shrink-0 rounded-full border border-zinc-300" />
                                )}
                                <span className="truncate">{o.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-100 px-7 py-4">
          {phase === "input" ? (
            <>
              <button
                onClick={close}
                disabled={busy}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                <span className="hidden text-[11px] text-zinc-400 sm:inline">⌘/Ctrl + Enter</span>
                <button
                  onClick={() => void handleGenerate()}
                  disabled={!canGenerate}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {busy ? "Generating…" : "Generate"}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setPhase("input"); setError(null); }}
                disabled={busy}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={busy || acceptedCount === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {busy ? "Adding…" : `Add ${acceptedCount} to library`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function showLanguageTag(d: NewQuestionForm): boolean {
  return (d.type === "Coding" || d.type === "SQL") && d.language.trim().length > 0;
}

function GeneratingState({ count, topic }: { count: number; topic: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100">
        <Sparkles className="h-6 w-6 animate-pulse text-violet-600" />
      </div>
      <p className="text-[14px] font-semibold text-zinc-800">
        Drafting {count} question{count !== 1 ? "s" : ""}…
      </p>
      <p className="max-w-sm text-[12px] text-zinc-500">
        {topic.trim() ? <>Working on “{topic.trim()}”. </> : null}This usually takes a few seconds.
      </p>
      <div className="mt-2 w-full max-w-sm space-y-2">
        {[90, 75, 60].map((w, i) => (
          <div key={i} className="h-3 animate-pulse rounded-full bg-zinc-100" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-zinc-500">
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}
