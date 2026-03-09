"use client";

import { useState } from "react";
import { HelpCircle, Clock, Zap, Eye, EyeOff } from "lucide-react";
import { useWizardStore } from "@/store/wizard-store";
import { cn } from "@/lib/utils";

export function LivePreview() {
  const { basicInfo, selectedQuestions } = useWizardStore();
  const [visible, setVisible] = useState(true);

  const totalPoints   = selectedQuestions.reduce((s, q) => s + q.points, 0);
  const totalDuration = selectedQuestions.reduce((s, q) => s + q.durationMinutes, 0);
  const firstQ        = selectedQuestions[0];
  const questionTypes = [...new Set(selectedQuestions.map((q) => q.type))];

  const DIFF_COLORS: Record<string, string> = {
    Entry:     "bg-zinc-100 text-zinc-600",
    Mid:       "bg-zinc-200 text-zinc-700",
    Senior:    "bg-zinc-800 text-white",
    Lead:      "bg-zinc-900 text-white",
    Executive: "bg-black text-white",
  };

  return (
    // absolute fills the right side of the flex row in index.tsx
    <aside className="absolute right-0 top-0 flex h-full w-[296px] shrink-0 flex-col border-l border-zinc-100 bg-white">

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900">
            <Eye className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-900">Preview</span>
          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
            Live
          </span>
        </div>
        <button
          onClick={() => setVisible((p) => !p)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700"
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>

      {visible && (
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">

          {/* Test card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              {basicInfo.discipline && (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
                  {basicInfo.discipline}
                </span>
              )}
              {basicInfo.difficultyLevel && (
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", DIFF_COLORS[basicInfo.difficultyLevel] ?? "bg-zinc-100 text-zinc-600")}>
                  {basicInfo.difficultyLevel}
                </span>
              )}
            </div>

            <h3 className={cn(
              "mt-2.5 text-[15px] font-bold leading-snug transition-colors duration-200",
              basicInfo.title ? "text-zinc-900" : "text-zinc-300"
            )}>
              {basicInfo.title || "Untitled Test"}
            </h3>

            {basicInfo.role && (
              <p className="mt-0.5 text-[12px] text-zinc-500">{basicInfo.role}</p>
            )}

            {basicInfo.description && (
              <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-zinc-500">
                {basicInfo.description}
              </p>
            )}

            <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                {selectedQuestions.length} question{selectedQuestions.length !== 1 ? "s" : ""}
              </span>
              {basicInfo.estimatedDuration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {basicInfo.estimatedDuration}m
                </span>
              )}
              {totalPoints > 0 && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {totalPoints} pts
                </span>
              )}
            </div>

            {questionTypes.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {questionTypes.map((t) => (
                  <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Candidate view */}
          {(basicInfo.title || firstQ) && (
            <>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-100" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  Candidate View
                </span>
                <div className="h-px flex-1 bg-zinc-100" />
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-[13px] font-bold leading-snug text-zinc-900">
                    {basicInfo.title || "Untitled Test"}
                  </h4>
                  <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                    Draft
                  </span>
                </div>

                {basicInfo.description && (
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                    {basicInfo.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-400">
                  <span>{selectedQuestions.length} questions</span>
                  {totalPoints   > 0 && <span>· {totalPoints} pts</span>}
                  {totalDuration > 0 && <span>· ~{totalDuration}m</span>}
                </div>

                {firstQ && (
                  <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3">
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                      Question 1 of {selectedQuestions.length}
                    </p>
                    <p className="text-[12px] font-semibold leading-snug text-zinc-800 line-clamp-2">
                      {firstQ.title}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600">
                        {firstQ.type}
                      </span>
                      <span className="text-[9px] text-zinc-400">{firstQ.points} pts</span>
                    </div>
                  </div>
                )}

                <button
                  disabled
                  className="mt-4 w-full cursor-not-allowed rounded-lg bg-zinc-900 py-2 text-[12px] font-semibold text-white opacity-50"
                >
                  Start Test
                </button>
              </div>
            </>
          )}

          {/* Empty state */}
          {!basicInfo.title && selectedQuestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                <HelpCircle className="h-6 w-6 text-zinc-300" />
              </div>
              <p className="text-[12px] font-semibold text-zinc-500">Nothing to preview yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Start filling in the form and your test will appear here
              </p>
            </div>
          )}
        </div>
      )}

      <div className="shrink-0 border-t border-zinc-100 px-5 py-3">
        <p className="text-center text-[11px] italic text-zinc-400">Updates as you build</p>
      </div>
    </aside>
  );
}