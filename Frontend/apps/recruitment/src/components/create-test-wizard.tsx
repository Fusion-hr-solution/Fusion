"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { WizardFormData, SelectedQuestion, Question } from "@/types";
import { WizardStepper } from "./wizard-stepper";
import { Step1BasicInfo } from "./step1-basic-info";
import { Step2Questions } from "./step2-questions";
import { Step3Config } from "./step3-config";
import { Step4Review } from "./step4-review";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 4;

interface CreateTestWizardProps {
  onClose: () => void;
}

export function CreateTestWizard({ onClose }: CreateTestWizardProps) {
  const [step, setStep] = useState(1);
  const [publishing, setPublishing] = useState(false);

  const [formData, setFormData] = useState<WizardFormData>({
    title: "",
    description: "",
    role: "",
    discipline: "",
    internalNotes: "",
  });

  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);

  const canAdvance = step === 1 ? !!formData.title && !!formData.discipline : true;

  function handleAdd(q: Question) {
    setSelectedQuestions((prev) => [
      ...prev,
      { ...q, order: prev.length + 1 },
    ]);
  }

  function handleRemove(id: string) {
    setSelectedQuestions((prev) =>
      prev.filter((q) => q.id !== id).map((q, i) => ({ ...q, order: i + 1 }))
    );
  }
  function handleReorder(id: string, dir: "up" | "down") {
    setSelectedQuestions((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((q) => q.id === id);
      const target = dir === "up" ? idx - 1 : idx + 1;

      // Guard: idx not found, or target out of bounds
      if (idx === -1 || target < 0 || target >= sorted.length) return prev;

      const itemA = sorted[idx];
      const itemB = sorted[target];

      // Guard: both items must exist (satisfies TypeScript's strict checks)
      if (!itemA || !itemB) return prev;

      // Swap orders using explicit temporary variable instead of destructuring
      const tempOrder = itemA.order;
      itemA.order = itemB.order;
      itemB.order = tempOrder;

      return [...sorted];
    });
  }

  async function handlePublish() {
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setPublishing(false);
    onClose();
  }

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden
        animate-in fade-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="relative bg-gradient-to-r from-white to-zinc-50 border-b border-zinc-200 px-8 py-5 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Create New Test</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                Build and configure a technical assessment for candidates.
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Progress indicator */}
              <div className="text-right">
                <p className="text-xs font-semibold text-zinc-900">Step {step} of {TOTAL_STEPS}</p>
                <div className="w-32 h-1.5 bg-zinc-200 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <WizardStepper currentStep={step} />
        </div>

        {/* Body */}
        <div className={cn("flex-1 overflow-hidden", step === 2 ? "flex flex-col" : "overflow-y-auto")}>
          {step === 1 && <Step1BasicInfo data={formData} onChange={setFormData} />}
          {step === 2 && (
            <Step2Questions
              selectedQuestions={selectedQuestions}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onReorder={handleReorder}
            />
          )}
          {step === 3 && <Step3Config />}
          {step === 4 && <Step4Review formData={formData} selectedQuestions={selectedQuestions} />}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-zinc-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-8 py-4
          flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="h-12 px-5 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-xl
                hover:bg-zinc-50 transition-all duration-200"
            >
              Save as Draft
            </button>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="h-12 px-5 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-xl
                  hover:bg-zinc-50 transition-all duration-200"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="h-12 px-5 text-sm font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              Cancel
            </button>
            {step < TOTAL_STEPS ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance}
                className="h-12 px-7 text-sm font-semibold text-white bg-zinc-900 rounded-xl
                  hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-200 shadow-sm hover:shadow"
              >
                Next Step
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="h-12 px-7 text-sm font-semibold text-white bg-zinc-900 rounded-xl
                  hover:bg-black transition-all duration-200 shadow-sm hover:shadow
                  flex items-center gap-2 min-w-[140px] justify-center"
              >
                {publishing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</>
                ) : (
                  "Publish Test"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}