"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollableTabs } from "@/components/candidate-management/scrollable-tabs";
import { TaxonomyListEditor } from "@/components/settings/taxonomy-list-editor";
import { DEFAULT_TAXONOMY, TAXONOMY_LIST_LABELS, type TaxonomyItem, type TaxonomyListKey } from "@/config/taxonomy";
import { TAXONOMY_QUERY_KEY, useTaxonomy } from "@/hooks/use-taxonomy";
import { saveTaxonomyLists } from "@/services/taxonomy-service";

/**
 * Settings sections. Grouped rather than one-per-list: nine near-identical nav entries would be
 * unusable. Every list here has its option sites AND its display sites reading through the
 * taxonomy, so a rename is consistent everywhere it appears.
 */
const SECTIONS: { key: string; label: string; lists: TaxonomyListKey[] }[] = [
  { key: "questions", label: "Questions", lists: ["questionTypes", "difficulties", "gradingMethods"] },
  { key: "tests", label: "Tests", lists: ["disciplines", "testStatuses"] },
  { key: "technology", label: "Technology", lists: ["frontendFrameworks", "codingLanguages"] },
];

const DEFAULT_SECTION = SECTIONS[0]!.key;

const LIST_DESCRIPTIONS: Partial<Record<TaxonomyListKey, string>> = {
  questionTypes:
    "Offered when authoring a question, and shown on question cards and filters. Each type has bespoke authoring and grading behaviour, so the set itself is fixed.",
  difficulties: "Shown on question cards and used as a filter facet. Add your own — a custom one gets a neutral badge colour.",
  gradingMethods: "How a question is scored. The behaviour of each is fixed; only the wording is yours.",
  disciplines: "Categorises tests on the dashboard and in the create wizard. Add your own freely.",
  testStatuses: "Lifecycle states a test moves through.",
  frontendFrameworks:
    "Frameworks a Frontend Project question can be built in. Each needs a matching grading image, so the set is fixed.",
  codingLanguages:
    "Offered when authoring a Coding question. Adding a language the grader has no mapping for means submissions run as Python 3.",
};

export function InterviewSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const requestedSection = searchParams.get("tab");
  const activeSection = SECTIONS.some((s) => s.key === requestedSection)
    ? requestedSection!
    : DEFAULT_SECTION;

  const { taxonomy, isLoading, isError } = useTaxonomy();

  const [draft, setDraft] = useState<Partial<Record<TaxonomyListKey, TaxonomyItem[]>>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Re-seed the draft only when the server version actually moves, so a background refetch can't
  // clobber an edit in progress.
  const versionRef = useRef<number | null>(null);
  useEffect(() => {
    if (versionRef.current === taxonomy.version) return;
    versionRef.current = taxonomy.version;
    setDraft({});
  }, [taxonomy.version]);

  const section = SECTIONS.find((s) => s.key === activeSection)!;

  function itemsFor(key: TaxonomyListKey): TaxonomyItem[] {
    return draft[key] ?? taxonomy.lists[key]?.items ?? [];
  }

  const hasChanges = useMemo(
    () =>
      section.lists.some(
        (key) =>
          draft[key] !== undefined &&
          JSON.stringify(draft[key]) !== JSON.stringify(taxonomy.lists[key]?.items ?? [])
      ),
    [draft, section, taxonomy]
  );

  const save = useMutation({
    mutationFn: () => {
      const changed: Partial<Record<TaxonomyListKey, TaxonomyItem[]>> = {};
      for (const key of section.lists) {
        if (draft[key] !== undefined) changed[key] = draft[key];
      }
      return saveTaxonomyLists(changed);
    },
    onSuccess: (updated) => {
      setError(null);
      setSuccess("Settings saved.");
      versionRef.current = updated.version;
      setDraft({});
      queryClient.setQueryData(TAXONOMY_QUERY_KEY, updated);
    },
    onError: (err: unknown) => {
      setSuccess(null);
      setError(err instanceof Error ? err.message : "Could not save these settings.");
    },
  });

  function switchSection(key: string) {
    setError(null);
    setSuccess(null);
    router.push(`/settings?tab=${key}`);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
          <SlidersHorizontal className="h-4 w-4 text-zinc-600" />
        </div>
        <div>
          <h1 className="text-[17px] font-bold tracking-tight text-zinc-900">Settings</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Curate the options authors pick from when building tests and questions.
          </p>
        </div>
      </div>

      {isError ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Could not load saved settings, so the built-in defaults are shown. Authoring is unaffected;
          saving from here would overwrite whatever is stored.
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 bg-zinc-50/50 px-3 pt-2.5 pb-0">
          <ScrollableTabs activeKey={activeSection}>
            {SECTIONS.map((item) => {
              const isActive = item.key === activeSection;
              return (
                <button
                  key={item.key}
                  data-active={isActive}
                  onClick={() => switchSection(item.key)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border border-transparent px-3 py-2 text-[12px] font-medium transition-all duration-150",
                    isActive
                      ? "-mb-px border-zinc-200 border-b-white bg-white pb-[9px] text-zinc-900 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]"
                      : "text-zinc-500 hover:bg-white/60 hover:text-zinc-700"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </ScrollableTabs>
        </div>

        <div className="px-6 py-6">
          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-[13px] text-zinc-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Loading settings…
            </div>
          ) : (
            <div className="space-y-5">
              {section.lists.map((key) => (
                <TaxonomyListEditor
                  key={key}
                  title={TAXONOMY_LIST_LABELS[key]}
                  description={LIST_DESCRIPTIONS[key] ?? ""}
                  locked={taxonomy.lists[key]?.locked ?? false}
                  items={itemsFor(key)}
                  onChange={(items) => {
                    setSuccess(null);
                    setDraft((prev) => ({ ...prev, [key]: items }));
                  }}
                  onReset={() => {
                    setSuccess(null);
                    setDraft((prev) => ({ ...prev, [key]: DEFAULT_TAXONOMY.lists[key].items }));
                  }}
                />
              ))}
            </div>
          )}

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {success}
            </div>
          ) : null}
        </div>

        {/* Save bar appears only when there is something to save. */}
        {hasChanges ? (
          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-zinc-200 bg-white/95 px-6 py-3">
            <span className="text-[12px] text-zinc-500">You have unsaved changes.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft({});
                  setError(null);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[12px] font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150",
                  save.isPending
                    ? "cursor-not-allowed bg-zinc-300"
                    : "bg-zinc-900 hover:bg-zinc-700 active:scale-[0.98]"
                )}
              >
                {save.isPending ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
