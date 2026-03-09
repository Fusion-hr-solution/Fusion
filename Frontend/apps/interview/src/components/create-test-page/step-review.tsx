"use client";

import { CheckCircle2, XCircle, BookmarkPlus, Send, ArrowLeft, Pencil, ClipboardCheck } from "lucide-react";
import { useWizardStore } from "@/store/wizard-store";
import { cn } from "@/lib/utils";

function ReviewCard({ title, step, onEdit, children }: { title: string; step: number; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">{step}</span>
          <p className="text-[14px] font-bold text-zinc-900">{title}</p>
        </div>
        <button onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors duration-150">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Pair({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-zinc-900 break-words">
        {value || <span className="font-normal text-zinc-300">—</span>}
      </p>
    </div>
  );
}

export function StepReview() {
  const { basicInfo, selectedQuestions, config, setStep, markSaved } = useWizardStore();

  const totalPoints   = selectedQuestions.reduce((s, q) => s + q.points, 0);
  const totalDuration = selectedQuestions.reduce((s, q) => s + q.durationMinutes, 0);

  const checks = [
    { label: "Test title added",             pass: basicInfo.title.trim() !== "",  warn: false },
    { label: "At least 1 question selected", pass: selectedQuestions.length > 0,   warn: false },
    { label: "Discipline set",               pass: basicInfo.discipline !== "",     warn: false },
    { label: "Access type configured",       pass: true,                            warn: false },
    { label: "Time limit configured",        pass: config.enableTimeLimit,          warn: true  },
  ];

  const blockingChecks = checks.filter((c) => !c.warn);
  const isReady = blockingChecks.every((c) => c.pass);

  return (
    <div>
      {/* Section header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900">
            <ClipboardCheck className="h-3.5 w-3.5 text-white" />
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-zinc-900">Review & Publish</h2>
        </div>
        <p className="ml-9 text-[13px] text-zinc-500">Check everything before sending to candidates</p>
      </div>

      <div className="space-y-4">

        {/* Card 1 — Test Details */}
        <ReviewCard title="Test Details" step={1} onEdit={() => setStep(1)}>
          <div className="grid grid-cols-2 gap-x-10 gap-y-5">
            <Pair label="Title"      value={basicInfo.title} />
            <Pair label="Role"       value={basicInfo.role} />
            <Pair label="Discipline" value={basicInfo.discipline} />
            <Pair label="Duration"   value={basicInfo.estimatedDuration ? `${basicInfo.estimatedDuration} minutes` : null} />
            <Pair label="Difficulty" value={basicInfo.difficultyLevel} />
            {basicInfo.description && (
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Description</p>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-700">{basicInfo.description}</p>
              </div>
            )}
          </div>
        </ReviewCard>

        {/* Card 2 — Questions */}
        <ReviewCard title={`Questions — ${selectedQuestions.length} total, ${totalPoints} pts`} step={2} onEdit={() => setStep(2)}>
          {selectedQuestions.length === 0 ? (
            <p className="text-[13px] text-zinc-400">No questions selected yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                {selectedQuestions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">{i + 1}</span>
                    <span className="flex-1 text-[12px] font-medium text-zinc-800 truncate">{q.title}</span>
                    <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600">{q.type}</span>
                    <span className="shrink-0 text-[12px] font-bold text-zinc-700 w-12 text-right">{q.points}pts</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-zinc-900 px-4 py-3">
                <p className="text-[13px] font-semibold text-white">
                  {selectedQuestions.length} questions · {totalPoints} points · ~{totalDuration} min
                </p>
              </div>
            </>
          )}
        </ReviewCard>

        {/* Card 3 — Configuration */}
        <ReviewCard title="Configuration" step={3} onEdit={() => setStep(3)}>
          <div className="grid grid-cols-2 gap-x-10 gap-y-5">
            <Pair label="Time Limit"    value={config.enableTimeLimit ? `${config.timeLimitMinutes} min` : "None"} />
            <Pair label="Max Attempts"  value={config.maxAttempts === 0 ? "Unlimited" : String(config.maxAttempts)} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Access Type</p>
              <span className={cn("mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                config.accessType === "invitation" ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700"
              )}>
                {config.accessType === "invitation" ? "Invitation Only" : "Open Link"}
              </span>
            </div>
            <Pair label="Passing Score" value={`${config.passingThreshold}%`} />
            {config.startDate && <Pair label="Start Date" value={config.startDate} />}
            {config.endDate   && <Pair label="End Date"   value={config.endDate}   />}
            <Pair label="Reviewer" value={config.assignedReviewer || "Unassigned"} />
          </div>
        </ReviewCard>

        {/* Card 4 — Readiness */}
        <ReviewCard title="Readiness Check" step={4} onEdit={() => {}}>
          <div className="mb-4 flex items-center gap-3">
            <span className={cn(
              "rounded-xl px-4 py-1.5 text-[13px] font-bold",
              isReady ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
            )}>
              {isReady ? "✓ Ready to Publish" : "Needs Attention"}
            </span>
          </div>
          <div className="space-y-3">
            {checks.map((check) => (
              <div key={check.label} className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5",
                check.pass ? "bg-zinc-50" : check.warn ? "bg-amber-50" : "bg-red-50"
              )}>
                {check.pass
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-900" />
                  : <XCircle     className="h-4 w-4 shrink-0 text-zinc-300" />
                }
                <span className={cn("text-[13px] font-medium", check.pass ? "text-zinc-700" : "text-zinc-400")}>
                  {check.label}
                </span>
                {check.warn && !check.pass && (
                  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                    Optional
                  </span>
                )}
              </div>
            ))}
          </div>
        </ReviewCard>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6">
        <button onClick={() => setStep(3)}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 transition-all duration-150">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => markSaved()}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 transition-all duration-150">
            <BookmarkPlus className="h-4 w-4" /> Save Draft
          </button>
          <button disabled={!isReady}
            className={cn(
              "flex items-center gap-2 rounded-xl px-6 py-2.5 text-[14px] font-bold shadow-sm transition-all duration-150",
              isReady
                ? "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]"
                : "cursor-not-allowed bg-zinc-100 text-zinc-400 shadow-none"
            )}>
            <Send className="h-4 w-4" /> Publish Test
          </button>
        </div>
      </div>
    </div>
  );
}