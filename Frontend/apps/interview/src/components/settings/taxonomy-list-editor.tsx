"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaxonomyItem } from "@/config/taxonomy";

interface TaxonomyListEditorProps {
  title: string;
  description: string;
  /** Locked lists are pinned to a backend enum: relabel, reorder and hide only. */
  locked: boolean;
  items: TaxonomyItem[];
  onChange: (items: TaxonomyItem[]) => void;
  onReset: () => void;
}

export function TaxonomyListEditor({
  title,
  description,
  locked,
  items,
  onChange,
  onReset,
}: TaxonomyListEditorProps) {
  const [draftValue, setDraftValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const visibleCount = items.filter((item) => !item.hidden).length;

  function update(index: number, patch: Partial<TaxonomyItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  function toggleHidden(index: number) {
    const item = items[index]!;
    // Leaving nothing visible would strand an author with an empty dropdown; the API rejects it too.
    if (!item.hidden && visibleCount <= 1) return;
    update(index, { hidden: !item.hidden });
  }

  function addItem() {
    const value = draftValue.trim();
    if (!value) return;
    if (items.some((item) => item.value.toLowerCase() === value.toLowerCase())) {
      setAddError(`"${value}" is already in the list.`);
      return;
    }
    setAddError(null);
    setDraftValue("");
    onChange([...items, { value, label: value, hidden: false, isDefault: false }]);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-bold text-zinc-900">{title}</p>
            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                <Lock className="h-2.5 w-2.5" /> Rename &amp; hide only
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[12px] text-zinc-500">{description}</p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium text-zinc-600 transition-colors duration-150 hover:bg-zinc-50"
        >
          <RotateCcw className="h-3 w-3" /> Reset to defaults
        </button>
      </div>

      {locked ? (
        <p className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-2.5 text-[11px] text-zinc-500">
          Options here <strong className="font-semibold">cannot be added or removed</strong> — each one
          is wired to specific behaviour in the API and the grader. You can rename, reorder and hide
          them; existing records are unaffected.
        </p>
      ) : null}

      <div className="divide-y divide-zinc-100">
        {items.length === 0 ? (
          <p className="px-6 py-8 text-center text-[13px] text-zinc-400">
            No options yet. Add the first one below.
          </p>
        ) : (
          items.map((item, index) => (
            <div key={item.value} className="flex flex-wrap items-center gap-2 px-6 py-2.5">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${item.label} up`}
                  className="rounded p-0.5 text-zinc-300 transition-colors hover:text-zinc-600 disabled:opacity-30 disabled:hover:text-zinc-300"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={`Move ${item.label} down`}
                  className="rounded p-0.5 text-zinc-300 transition-colors hover:text-zinc-600 disabled:opacity-30 disabled:hover:text-zinc-300"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <input
                value={item.label}
                onChange={(e) => update(index, { label: e.target.value })}
                aria-label={`Label for ${item.value}`}
                className={cn(
                  "min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] text-zinc-900 transition-all duration-150 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
                  item.hidden && "text-zinc-400"
                )}
              />

              {/* Showing the canonical value makes it obvious that renaming is cosmetic. */}
              {locked || item.label !== item.value ? (
                <code className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 font-mono text-[11px] text-zinc-500">
                  {item.value}
                </code>
              ) : null}

              {item.supportsAutoGrading === false ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                  title="The grader has no mapping for this language, so submissions are executed as Python 3 and score 0."
                >
                  <AlertTriangle className="h-2.5 w-2.5" /> No auto-grading
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => toggleHidden(index)}
                disabled={!item.hidden && visibleCount <= 1}
                title={
                  item.hidden
                    ? "Hidden from new questions. Existing questions using it keep working."
                    : "Hide from new questions"
                }
                aria-label={item.hidden ? `Show ${item.label}` : `Hide ${item.label}`}
                className="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                {item.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>

              {!locked ? (
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  aria-label={`Remove ${item.label}`}
                  className="shrink-0 rounded-md p-1.5 text-zinc-300 transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      {locked ? (
        <p className="border-t border-zinc-100 bg-zinc-50/60 px-6 py-3 text-[11px] text-zinc-400">
          Need a new option here? That requires a code change — the value has to exist in the API
          before it can be offered.
        </p>
      ) : null}

      {!locked ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={draftValue}
              onChange={(e) => {
                setDraftValue(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder={`Add to ${title.toLowerCase()}…`}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <button
              type="button"
              onClick={addItem}
              disabled={draftValue.trim().length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors duration-150 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {addError ? <p className="mt-2 text-[11px] text-red-600">{addError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
