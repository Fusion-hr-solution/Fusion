"use client";

import { useMemo, useState } from "react";
import { Button, NativeSelect, NativeSelectOption, Spinner, cn } from "@repo/ds";
import { ArrowRight, Check, ChevronDown, Columns3, Sparkle } from "lucide-react";
import type {
  WorkforceColumnMappingDto,
  WorkforceInterpretationSummaryDto,
  WorkforceSemanticSuggestionDto,
} from "@repo/api";

const FIELD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Ignored", label: "Ignore this column" },
  { value: "EmployeeNumber", label: "Employee number" },
  { value: "FirstName", label: "First name" },
  { value: "LastName", label: "Last name" },
  { value: "FullName", label: "Full name" },
  { value: "PreferredName", label: "Preferred name" },
  { value: "WorkEmail", label: "Work email" },
  { value: "EmploymentStart", label: "Employment start" },
  { value: "Organization", label: "Organization" },
  { value: "DisplayTitle", label: "Display title" },
  { value: "Location", label: "Location" },
  { value: "Manager", label: "Manager" },
];

/** Field token → human label; falls back to the raw token so nothing renders blank. */
const FIELD_LABEL = new Map(FIELD_OPTIONS.map((f) => [f.value, f.label]));
const fieldLabel = (field: string) => FIELD_LABEL.get(field) ?? field;

/** Every decision the user stages on this step, sent to the server in one batch on Continue. */
export interface StagedDecisions {
  columnMappings: Record<number, string>;
  dateFormat?: string;
  nameFormat?: string;
}

/**
 * Understand columns. Fusion has already read the file; this surface answers the user's
 * real question — "did it read my columns right?" — by showing the whole understanding
 * and elevating only the few reads that need a human call. Decisions are staged locally
 * and committed together on Continue, so accepting a read is instant (no per-click wait).
 */
export function WorkforceInterpretation({
  interpretation,
  suggesting,
  committing,
  onSuggest,
  suggestions,
  suggestionsUnavailableReason,
  onCommit,
}: {
  interpretation: WorkforceInterpretationSummaryDto;
  suggesting: boolean;
  committing: boolean;
  onSuggest: () => void;
  suggestions: WorkforceSemanticSuggestionDto[] | null;
  suggestionsUnavailableReason: string | null;
  onCommit: (staged: StagedDecisions) => void;
}) {
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [dateChoice, setDateChoice] = useState<string | undefined>();
  const [nameChoice, setNameChoice] = useState<string | undefined>();

  const unresolvedSet = useMemo(
    () => new Set(interpretation.unresolvedColumnIndexes),
    [interpretation.unresolvedColumnIndexes]
  );
  const unresolved = interpretation.mappings.filter((m) => unresolvedSet.has(m.columnIndex));
  const mapped = interpretation.mappings.filter((m) => !unresolvedSet.has(m.columnIndex) && m.field !== "Ignored");
  const ignored = interpretation.mappings.filter((m) => !unresolvedSet.has(m.columnIndex) && m.field === "Ignored");

  const suggestionByColumn = useMemo(() => {
    const map = new Map<number, WorkforceSemanticSuggestionDto>();
    for (const s of suggestions ?? []) map.set(s.columnIndex, s);
    return map;
  }, [suggestions]);

  const openColumns = unresolved.filter((m) => !choices[m.columnIndex]);
  const dateOpen = interpretation.dateFormatDecisionNeeded && !dateChoice;
  const nameOpen = interpretation.nameFormatDecisionNeeded && !nameChoice;
  const openCount = openColumns.length + (dateOpen ? 1 : 0) + (nameOpen ? 1 : 0);
  const settled = openCount === 0;

  const stagedMappedCount = mapped.length + Object.keys(choices).length;
  const hasUnaccepted = openColumns.some((m) => suggestionByColumn.get(m.columnIndex));
  const canSuggest = openColumns.length > 0 && suggestions === null && !suggestionsUnavailableReason;

  const stage = (index: number, field: string) => setChoices((c) => ({ ...c, [index]: field }));
  const unstage = (index: number) =>
    setChoices((c) => {
      const next = { ...c };
      delete next[index];
      return next;
    });
  const acceptAll = () =>
    setChoices((c) => {
      const next = { ...c };
      for (const m of openColumns) {
        const s = suggestionByColumn.get(m.columnIndex);
        if (s) next[m.columnIndex] = s.targetField;
      }
      return next;
    });

  return (
    <div className="w-full">
      <Ledger mapped={stagedMappedCount} ignored={ignored.length} openCount={openCount} mappedColumns={mapped} choices={choices} interpretation={interpretation} />

      {settled ? (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-subtle)] px-4 py-3">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--color-success)] text-white">
            <Check className="size-3" aria-hidden />
          </span>
          <p className="type-label font-medium text-foreground">Every column is accounted for.</p>
        </div>
      ) : (
        <div className="mt-7 space-y-3">
          {interpretation.dateFormatDecisionNeeded ? (
            dateChoice ? (
              <ResolvedDecision
                label="Dates"
                value={dateChoice === "DayMonthYear" ? "Day / Month / Year" : "Month / Day / Year"}
                onChange={() => setDateChoice(undefined)}
              />
            ) : (
              <DecisionCard title="How are dates written?" hint="e.g. 01/02/2021 in your file">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <SegmentedChoice onClick={() => setDateChoice("DayMonthYear")} primary="1 February 2021" secondary="Day / Month / Year" />
                  <SegmentedChoice onClick={() => setDateChoice("MonthDayYear")} primary="January 2, 2021" secondary="Month / Day / Year" />
                </div>
              </DecisionCard>
            )
          ) : null}

          {interpretation.nameFormatDecisionNeeded ? (
            nameChoice ? (
              <ResolvedDecision
                label="Name column"
                value={nameChoice === "LastCommaFirst" ? "Last, First" : "First Last"}
                onChange={() => setNameChoice(undefined)}
              />
            ) : (
              <DecisionCard title="How is the name column written?">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <SegmentedChoice onClick={() => setNameChoice("LastCommaFirst")} primary="Doe, John" secondary="Last, First" />
                  <SegmentedChoice onClick={() => setNameChoice("FirstLast")} primary="John Doe" secondary="First Last" />
                </div>
              </DecisionCard>
            )
          ) : null}

          {unresolved.map((m) =>
            choices[m.columnIndex] ? (
              <ResolvedColumn
                key={m.columnIndex}
                source={m.sourceLabel ?? `Column ${m.columnIndex + 1}`}
                field={fieldLabel(choices[m.columnIndex]!)}
                onChange={() => unstage(m.columnIndex)}
              />
            ) : (
              <ColumnDecision
                key={m.columnIndex}
                mapping={m}
                suggestion={suggestionByColumn.get(m.columnIndex)}
                suggesting={suggesting}
                onChoose={(field) => stage(m.columnIndex, field)}
              />
            )
          )}

          {openColumns.length > 0 ? (
            <SuggestBar
              suggesting={suggesting}
              canSuggest={canSuggest}
              hasSuggestions={(suggestions?.length ?? 0) > 0}
              hasUnaccepted={hasUnaccepted}
              unavailableReason={suggestionsUnavailableReason}
              onSuggest={onSuggest}
              onAcceptAll={acceptAll}
            />
          ) : null}
        </div>
      )}

      <div className="mt-8 flex items-center gap-4 border-t border-border pt-5">
        <Button
          onClick={() => onCommit({ columnMappings: choices, dateFormat: dateChoice, nameFormat: nameChoice })}
          disabled={committing}
          size={settled ? "default" : "sm"}
          variant={settled ? "default" : "outline"}
        >
          {committing ? <Spinner className="size-4" aria-hidden /> : null}
          {committing ? "Applying…" : "Continue to review"}
          {!committing ? <ArrowRight className="size-4" aria-hidden /> : null}
        </Button>
        {!settled && !committing ? (
          <span className="type-meta text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{openCount}</span>{" "}
            {openCount === 1 ? "column still open" : "columns still open"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The sense of the whole: how many columns Fusion mapped, with the mapped set on demand. */
function Ledger({
  mapped,
  ignored,
  openCount,
  mappedColumns,
  choices,
  interpretation,
}: {
  mapped: number;
  ignored: number;
  openCount: number;
  mappedColumns: WorkforceColumnMappingDto[];
  choices: Record<number, string>;
  interpretation: WorkforceInterpretationSummaryDto;
}) {
  const [open, setOpen] = useState(false);
  const total = mapped + ignored + openCount;

  // Mapped chips = confidently-mapped columns plus anything the user has staged this step.
  const stagedColumns = interpretation.mappings.filter((m) => choices[m.columnIndex]);
  const chips = [
    ...mappedColumns.map((m) => ({ index: m.columnIndex, source: m.sourceLabel, field: m.field })),
    ...stagedColumns.map((m) => ({ index: m.columnIndex, source: m.sourceLabel, field: choices[m.columnIndex]! })),
  ];

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className="type-title font-semibold tabular-nums text-foreground">{mapped}</span>
          <span className="type-meta text-muted-foreground">
            of {total} {total === 1 ? "column" : "columns"} mapped
          </span>
        </div>
        {openCount > 0 ? (
          <span className="flex items-center gap-1.5 type-meta font-medium text-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {openCount} to confirm
          </span>
        ) : null}
        {ignored > 0 ? <span className="type-meta text-muted-foreground">{ignored} ignored</span> : null}
        {chips.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto flex items-center gap-1 type-meta font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? "Hide" : "Show"} mapped
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        ) : null}
      </div>
      {open && chips.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 border-t border-border px-4 py-3">
          {chips.map((c) => (
            <li key={c.index} className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 type-meta">
              <Check className="size-3 shrink-0 text-[var(--color-success)]" aria-hidden />
              <span className="truncate font-medium text-foreground">{c.source ?? `Column ${c.index + 1}`}</span>
              <span className="text-muted-foreground/60" aria-hidden>→</span>
              <span className="text-muted-foreground">{fieldLabel(c.field)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A single unresolved column: its source name, a meaning select, and — when offered — an AI read to accept. */
function ColumnDecision({
  mapping,
  suggestion,
  suggesting,
  onChoose,
}: {
  mapping: WorkforceColumnMappingDto;
  suggestion: WorkforceSemanticSuggestionDto | undefined;
  suggesting: boolean;
  onChoose: (field: string) => void;
}) {
  const source = mapping.sourceLabel ?? `Column ${mapping.columnIndex + 1}`;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Columns3 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="truncate type-label font-semibold text-foreground">{source}</p>
        </div>
        <NativeSelect
          className="h-9 w-full max-w-[16rem] type-meta sm:w-auto"
          value={suggestion?.targetField ?? ""}
          onChange={(e) => e.target.value && onChoose(e.target.value)}
          disabled={suggesting}
          aria-label={`Meaning for ${source}`}
        >
          <NativeSelectOption value="">Choose meaning…</NativeSelectOption>
          {FIELD_OPTIONS.map((f) => (
            <NativeSelectOption key={f.value} value={f.value}>
              {f.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {suggesting ? (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-primary/[0.06] px-3 py-2" aria-hidden>
          <Sparkle className="size-3.5 shrink-0 animate-pulse text-primary" />
          <span className="h-2 flex-1 max-w-[70%] animate-pulse rounded-full bg-primary/20" />
        </div>
      ) : suggestion ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-primary/[0.06] px-3 py-2">
          <Sparkle className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 type-meta text-muted-foreground">
            Looks like <span className="font-medium text-foreground">{suggestion.targetDisplayName}</span>
            {suggestion.rationale ? <span className="text-muted-foreground/80"> · {suggestion.rationale}</span> : null}
          </span>
          <button
            type="button"
            onClick={() => onChoose(suggestion.targetField)}
            className="shrink-0 rounded-md border border-primary/40 px-2.5 py-1 type-meta font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Use {suggestion.targetDisplayName}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** A column the user has staged — shown resolved in place (not vanished), reversible. */
function ResolvedColumn({ source, field, onChange }: { source: string; field: string; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-success)]/25 bg-[var(--color-success-subtle)] px-4 py-2.5">
      <Check className="size-4 shrink-0 text-[var(--color-success)]" aria-hidden />
      <span className="truncate type-label font-medium text-foreground">{source}</span>
      <span className="text-muted-foreground/60" aria-hidden>→</span>
      <span className="truncate type-meta text-muted-foreground">{field}</span>
      <button
        type="button"
        onClick={onChange}
        className="ml-auto shrink-0 type-meta font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Change
      </button>
    </div>
  );
}

function ResolvedDecision({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-success)]/25 bg-[var(--color-success-subtle)] px-4 py-2.5">
      <Check className="size-4 shrink-0 text-[var(--color-success)]" aria-hidden />
      <span className="type-label font-medium text-foreground">{label}</span>
      <span className="type-meta text-muted-foreground">{value}</span>
      <button
        type="button"
        onClick={onChange}
        className="ml-auto shrink-0 type-meta font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Change
      </button>
    </div>
  );
}

/** The AI action + its clear working state, and — once read — an accept-all shortcut. */
function SuggestBar({
  suggesting,
  canSuggest,
  hasSuggestions,
  hasUnaccepted,
  unavailableReason,
  onSuggest,
  onAcceptAll,
}: {
  suggesting: boolean;
  canSuggest: boolean;
  hasSuggestions: boolean;
  hasUnaccepted: boolean;
  unavailableReason: string | null;
  onSuggest: () => void;
  onAcceptAll: () => void;
}) {
  if (suggesting) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/[0.06] px-4 py-3"
      >
        <span className="relative grid size-6 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" aria-hidden />
          <Sparkle className="size-4 text-primary" aria-hidden />
        </span>
        <span className="type-label font-medium text-foreground">Reading your columns…</span>
        <Spinner className="ml-auto size-4 text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (canSuggest) {
    return (
      <div className="pt-1">
        <Button variant="outline" size="sm" onClick={onSuggest}>
          <Sparkle className="size-3.5" aria-hidden /> Suggest meanings
        </Button>
      </div>
    );
  }
  if (unavailableReason) {
    return <p className="pt-1 type-meta text-muted-foreground">{unavailableReason}</p>;
  }
  if (hasSuggestions && hasUnaccepted) {
    return (
      <div className="pt-1">
        <Button variant="outline" size="sm" onClick={onAcceptAll}>
          <Check className="size-3.5" aria-hidden /> Use all suggestions
        </Button>
      </div>
    );
  }
  return null;
}

function DecisionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="type-label font-semibold text-foreground">{title}</p>
        {hint ? <span className="type-code text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SegmentedChoice({ onClick, primary, secondary }: { onClick: () => void; primary: string; secondary: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start rounded-md border border-border bg-background px-3 py-2 text-left transition-colors",
        "hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <span className="type-label font-medium text-foreground group-hover:text-primary">{primary}</span>
      <span className="type-meta text-muted-foreground">{secondary}</span>
    </button>
  );
}
