"use client";

import type { WizardFormData } from "@/types";
import { DISCIPLINES } from "@/config/constants";
import { cn } from "@/lib/utils";

interface Step1Props {
  data: WizardFormData;
  onChange: (data: WizardFormData) => void;
}

export function Step1BasicInfo({ data, onChange }: Step1Props) {
  const set = (key: keyof WizardFormData, value: string) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-zinc-900">Basic Information</h2>
        <p className="text-sm text-zinc-500 mt-1">Set up the core details for your test.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Title */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-zinc-800 mb-1.5">
            Test Title <span className="text-zinc-400">*</span>
          </label>
          <input
            value={data.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Senior Frontend Engineer Assessment"
            className={cn(
              "w-full h-10 px-3 text-sm border rounded-lg transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400",
              data.title ? "border-zinc-300" : "border-zinc-200 bg-zinc-50"
            )}
          />
        </div>

        {/* Discipline */}
        <div>
          <label className="block text-sm font-medium text-zinc-800 mb-1.5">
            Discipline <span className="text-zinc-400">*</span>
          </label>
          <select
            value={data.discipline}
            onChange={(e) => set("discipline", e.target.value)}
            className={cn(
              "w-full h-10 px-3 text-sm border rounded-lg transition-all duration-200 bg-white",
              "focus:outline-none focus:ring-2 focus:ring-zinc-900",
              data.discipline ? "border-zinc-300 text-zinc-900" : "border-zinc-200 text-zinc-400"
            )}
          >
            <option value="">Select discipline...</option>
            {DISCIPLINES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-zinc-800 mb-1.5">Role</label>
          <input
            value={data.role}
            onChange={(e) => set("role", e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
            className="w-full h-10 px-3 text-sm border border-zinc-200 bg-zinc-50 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400
              transition-all duration-200"
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-medium text-zinc-800">Description</label>
            <span className="text-xs text-zinc-400">{data.description.length}/300</span>
          </div>
          <textarea
            value={data.description}
            onChange={(e) => set("description", e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Briefly describe what this test evaluates..."
            className="w-full px-3 py-2.5 text-sm border border-zinc-200 bg-zinc-50 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400
              transition-all duration-200 resize-none"
          />
        </div>

        {/* Internal Notes */}
        <div className="md:col-span-2">
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-medium text-zinc-800">
              Internal Notes
              <span className="text-xs font-normal text-zinc-400 ml-2">(not shown to candidates)</span>
            </label>
            <span className="text-xs text-zinc-400">{data.internalNotes.length}/500</span>
          </div>
          <textarea
            value={data.internalNotes}
            onChange={(e) => set("internalNotes", e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Add any internal context, instructions for reviewers..."
            className="w-full px-3 py-2.5 text-sm border border-zinc-200 bg-zinc-50 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400
              transition-all duration-200 resize-none"
          />
        </div>
      </div>
    </div>
  );
}