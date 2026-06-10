"use client";

import { Plus, Trash2 } from "lucide-react";
import type { TestCase } from "@/types";

interface TestCasesEditorProps {
  testCases: TestCase[];
  onChange: (testCases: TestCase[]) => void;
}

export function TestCasesEditor({ testCases, onChange }: TestCasesEditorProps) {
  function addCase() {
    onChange([...testCases, { input: "", expectedOutput: "" }]);
  }

  function removeCase(index: number) {
    onChange(testCases.filter((_, i) => i !== index));
  }

  function updateCase(index: number, field: keyof TestCase, value: string) {
    onChange(testCases.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-zinc-700">Test Cases</span>
        <button
          type="button"
          onClick={addCase}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50"
        >
          <Plus className="h-3 w-3" />
          Add case
        </button>
      </div>

      {testCases.length === 0 ? (
        <p className="text-[12px] text-zinc-400">No test cases yet. Add at least one to enable auto-grading.</p>
      ) : (
        <div className="space-y-2">
          {testCases.map((tc, index) => (
            <div
              key={index}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500">Case {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeCase(index)}
                  className="rounded-md p-0.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  aria-label={`Remove test case ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500">Input</label>
                  <textarea
                    rows={3}
                    value={tc.input}
                    onChange={(e) => updateCase(index, "input", e.target.value)}
                    placeholder="stdin for this case"
                    className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500">Expected Output</label>
                  <textarea
                    rows={3}
                    value={tc.expectedOutput}
                    onChange={(e) => updateCase(index, "expectedOutput", e.target.value)}
                    placeholder="expected stdout"
                    className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
