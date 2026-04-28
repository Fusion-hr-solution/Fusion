"use client";

import { FileUp, Upload, Layers, ArrowRight, Sparkles } from "lucide-react";
import { useWizardStore } from "@/store/wizard-store";
import { DISCIPLINES, DIFFICULTY_LEVELS } from "@/config/constants";
import { cn } from "@/lib/utils";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import type { Discipline, DifficultyLevel } from "@/types";

function Label({ children, required, hint }: { children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <label className="text-[13px] font-semibold text-zinc-800">
        {children}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
    </div>
  );
}

function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}>{children}</div>;
}

function Helper({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{children}</p>;
}

function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 shadow-sm",
        "placeholder:text-zinc-400 transition-all duration-150",
        "hover:border-zinc-300",
        "focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
        props.className
      )}
    />
  );
}

export function StepBasicInfo() {
  const { basicInfo, updateBasicInfo, nextStep } = useWizardStore();
  const canContinue = basicInfo.title.trim() !== "" && basicInfo.discipline !== "";

  return (
    // w-full — fills the entire available column width (no max-w centering)
    <div className="w-full">

      {/* ── Section header ── */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-zinc-900">Test Details</h2>
        </div>
        <p className="ml-9 text-[13px] text-zinc-500">
          Fill in the basic information about this assessment
        </p>
      </div>

      {/* ── Import banner ── */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
            <FileUp className="h-4 w-4 text-zinc-500" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-zinc-700">Already have a test?</p>
            <p className="text-[12px] text-zinc-400">Import or bulk-add questions to skip manual setup</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 shadow-sm transition-colors duration-150 hover:bg-zinc-50">
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 shadow-sm transition-colors duration-150 hover:bg-zinc-50">
            <Layers className="h-3.5 w-3.5" /> Bulk Add
          </button>
        </div>
      </div>

      {/* ── Form — two-column layout to use the full width ── */}
      <div className="grid grid-cols-3 gap-6">

        {/* Left column — primary fields (spans 2 of 3) */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Form card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5">

              {/* Test Title — full width */}
              <FieldGroup>
                <Label required hint="Visible to candidates">Test Title</Label>
                <InputField
                  value={basicInfo.title}
                  onChange={(e) => updateBasicInfo({ title: e.target.value })}
                  placeholder="e.g. Senior Frontend Engineer Assessment"
                />
              </FieldGroup>

              {/* Role + Discipline */}
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup>
                  <Label>Role</Label>
                  <InputField
                    value={basicInfo.role}
                    onChange={(e) => updateBasicInfo({ role: e.target.value })}
                    placeholder="e.g. Frontend Engineer"
                  />
                </FieldGroup>
                <FieldGroup>
                  <Label required>Discipline</Label>
                  <DropdownSelect
                    id="basic-discipline"
                    ariaLabel="Select discipline"
                    value={basicInfo.discipline}
                    placeholder="Select discipline…"
                    options={DISCIPLINES.map((value) => ({ value, label: value }))}
                    onChange={(value) => updateBasicInfo({ discipline: value as Discipline | "" })}
                  />
                </FieldGroup>
              </div>

              {/* Description */}
              <FieldGroup>
                <Label hint={`${basicInfo.description.length}/800`}>Description</Label>
                <textarea
                  rows={6}
                  value={basicInfo.description}
                  onChange={(e) => updateBasicInfo({ description: e.target.value.slice(0, 800) })}
                  placeholder="Describe what this test covers, its purpose, and what you're evaluating…"
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[13px] text-zinc-900 shadow-sm placeholder:text-zinc-400 transition-all duration-150 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <Helper>Give candidates a clear sense of what to expect. 2–4 sentences works well.</Helper>
              </FieldGroup>

            </div>
          </div>
        </div>

        {/* Right column — secondary / meta fields (spans 1 of 3) */}
        <div className="col-span-1 flex flex-col gap-5">

          {/* Duration & Difficulty card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Assessment Settings
            </p>
            <div className="flex flex-col gap-4">
              <FieldGroup>
                <Label>Estimated Duration</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={basicInfo.estimatedDuration}
                    onChange={(e) => {
                      const { value } = e.target;
                      if (value === "") {
                        // Default to 0 when input is cleared to avoid persisting NaN
                        updateBasicInfo({ estimatedDuration: 0 });
                        return;
                      }
                      const parsed = Number(value);
                      if (!Number.isNaN(parsed)) {
                        updateBasicInfo({ estimatedDuration: parsed });
                      }
                    }}
                    className="w-24 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 shadow-sm transition-all duration-150 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                  <span className="text-[13px] text-zinc-500">min</span>
                </div>
              </FieldGroup>

              <FieldGroup>
                <Label>Difficulty Level</Label>
                <DropdownSelect
                  id="basic-difficulty"
                  ariaLabel="Select difficulty level"
                  value={basicInfo.difficultyLevel}
                  placeholder="Select level…"
                  options={DIFFICULTY_LEVELS.map((value) => ({ value, label: value }))}
                  onChange={(value) => updateBasicInfo({ difficultyLevel: value as DifficultyLevel | "" })}
                />
              </FieldGroup>
            </div>
          </div>

          {/* Internal Notes card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Internal Notes
            </p>
            <FieldGroup>
              <Label hint={`${basicInfo.internalNotes.length}/400`}>Notes</Label>
              <textarea
                rows={5}
                value={basicInfo.internalNotes}
                onChange={(e) => updateBasicInfo({ internalNotes: e.target.value.slice(0, 400) })}
                placeholder="Private notes for your team — not visible to candidates"
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[13px] text-zinc-900 shadow-sm placeholder:text-zinc-400 transition-all duration-150 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <Helper>Only visible to your team — never shown to candidates.</Helper>
            </FieldGroup>
          </div>

        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-6 flex justify-end border-t border-zinc-100 pt-6">
        <button
          onClick={nextStep}
          disabled={!canContinue}
          className={cn(
            "flex items-center gap-2 rounded-xl px-6 py-2.5 text-[14px] font-semibold shadow-sm transition-all duration-150",
            canContinue
              ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:shadow-none active:scale-[0.98]"
              : "cursor-not-allowed bg-zinc-100 text-zinc-400 shadow-none"
          )}
        >
          Continue to Questions
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}