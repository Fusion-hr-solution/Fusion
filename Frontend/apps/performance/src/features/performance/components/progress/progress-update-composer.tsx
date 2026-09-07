"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { EvidenceInput, ObjectiveProgressDto, SubmitProgressRequest } from "@repo/api";
import { Label } from "@repo/ds/components/ui/label";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { cn } from "@repo/ds/lib/utils";
import { EvidenceUploader } from "./evidence-uploader";
import { markerFraction, num, numericProgress, pct } from "./progress-lib";

type UploadFn = (file: File) => Promise<{ storageKey: string; fileName: string; contentType: string; sizeBytes: number }>;

const NOTE_MAX = 500;

/**
 * The record-progress form — the measurement-aware body of the objective drawer's record mode. Manual
 * percentage records a direct completion figure with a fill preview; numeric target records the current
 * actual and previews the derived objective progress live against the baseline→target rail; weighted
 * milestones select completion and derive progress from the agreed weights. A note and evidence subordinate
 * every update, and the drawer footer (Cancel / Record progress) commits it. Corrections — a value that
 * moves backward or a reopened milestone — require a note and are recorded as append-only correction events.
 */
export function ProgressUpdateComposer({
  progress,
  submitting,
  formId,
  onSubmit,
  upload,
  onValidityChange,
  onRecorded,
}: {
  progress: ObjectiveProgressDto;
  submitting: boolean;
  /** The <form> id the drawer's pinned footer submits — the button lives outside this component. */
  formId: string;
  /** Commits one progress event. Milestone batches call this once per changed milestone. */
  onSubmit: (request: SubmitProgressRequest) => Promise<void>;
  upload: UploadFn;
  /** Reports whether the update is submittable, so the external footer can enable its action. */
  onValidityChange: (valid: boolean) => void;
  /** Called once an update commits — the drawer returns to the updated details view. */
  onRecorded: () => void;
}) {
  if (progress.method === "WeightedMilestones") {
    return (
      <MilestoneForm progress={progress} submitting={submitting} formId={formId} onSubmit={onSubmit} upload={upload} onValidityChange={onValidityChange} onRecorded={onRecorded} />
    );
  }
  return <ValueForm progress={progress} submitting={submitting} formId={formId} onSubmit={onSubmit} upload={upload} onValidityChange={onValidityChange} onRecorded={onRecorded} />;
}

// ── Manual percentage & numeric target ───────────────────────────────────────

function ValueForm({
  progress,
  submitting,
  formId,
  onSubmit,
  upload,
  onValidityChange,
  onRecorded,
}: {
  progress: ObjectiveProgressDto;
  submitting: boolean;
  formId: string;
  onSubmit: (request: SubmitProgressRequest) => Promise<void>;
  upload: UploadFn;
  onValidityChange: (valid: boolean) => void;
  onRecorded: () => void;
}) {
  const isNumeric = progress.method === "NumericTarget";
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<EvidenceInput[]>([]);

  const entered = value === "" ? null : Number(value);
  const validNumber = entered != null && Number.isFinite(entered);

  // A value that moves backward from the last reported figure is a correction — note required.
  const decreased =
    !isNumeric && validNumber && progress.currentPercentage != null && (entered as number) < progress.currentPercentage;
  const noteRequired = decreased;
  const canSubmit = validNumber && (!noteRequired || note.trim() !== "");
  useEffect(() => onValidityChange(canSubmit), [canSubmit, onValidityChange]);

  async function save() {
    try {
      await onSubmit({
        percentage: isNumeric ? null : entered,
        numericActual: isNumeric ? entered : null,
        milestoneId: null,
        milestoneCompleted: null,
        contextNote: note.trim() || null,
        isCorrection: decreased,
        evidence: evidence.length > 0 ? evidence : null,
      });
      onRecorded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record progress.");
    }
  }

  const unit = isNumeric ? progress.unit ?? "" : "%";

  // The preview is always visible: before a value is entered it reflects the current reported state, and
  // updates live as the value changes.
  const effectiveActual = validNumber
    ? (entered as number)
    : isNumeric
      ? progress.currentActual ?? progress.baseline ?? 0
      : progress.currentPercentage ?? 0;
  const previewDerived =
    isNumeric && progress.baseline != null && progress.target != null
      ? numericProgress(progress.baseline, progress.target, effectiveActual)
      : Math.max(0, Math.min(100, effectiveActual));
  const frac =
    isNumeric && progress.baseline != null && progress.target != null
      ? markerFraction(progress.baseline, progress.target, effectiveActual)
      : Math.min(1, previewDerived / 100);

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !submitting) void save();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="pv-value">{isNumeric ? `Current value${unit ? ` (${unit})` : ""}` : "Current progress (%)"}</Label>
        <NumberField
          id="pv-value"
          value={value}
          onChange={setValue}
          suffix={unit}
          placeholder={isNumeric && progress.currentActual != null ? num(progress.currentActual) : isNumeric ? "" : "0–100"}
          min={0}
          max={isNumeric ? (progress.unit === "%" ? 100 : undefined) : 100}
          base={isNumeric ? progress.currentActual ?? progress.baseline ?? 0 : progress.currentPercentage ?? 0}
          integer={!isNumeric}
        />
      </div>

      {/* Live preview — always visible, reflecting the current state until a new value is entered. Manual
          fills a simple bar; numeric plots the actual on the baseline→target rail and states the derived
          objective progress it produces. */}
      {isNumeric && progress.baseline != null && progress.target != null ? (
        <div className="space-y-4">
          <TargetRail
            baseline={progress.baseline}
            target={progress.target}
            current={effectiveActual}
            unit={progress.unit}
            frac={frac}
          />
          <DerivedCard
            label="Progress toward target"
            derived={previewDerived}
            from={validNumber && progress.hasProgress ? progress.derivedProgress : null}
          />
        </div>
      ) : (
        <DerivedCard
          label="Current progress"
          derived={previewDerived}
          from={validNumber && progress.hasProgress ? progress.derivedProgress : null}
        />
      )}

      <NoteField value={note} onChange={setNote} required={noteRequired} hint={decreased ? "This lowers the last reported value — add a short note." : undefined} />
      <EvidenceField items={evidence} onChange={setEvidence} upload={upload} />
    </form>
  );
}

// ── Weighted milestones ──────────────────────────────────────────────────────

function MilestoneForm({
  progress,
  submitting,
  formId,
  onSubmit,
  upload,
  onValidityChange,
  onRecorded,
}: {
  progress: ObjectiveProgressDto;
  submitting: boolean;
  formId: string;
  onSubmit: (request: SubmitProgressRequest) => Promise<void>;
  upload: UploadFn;
  onValidityChange: (valid: boolean) => void;
  onRecorded: () => void;
}) {
  // Pending selection begins from the agreed truth; Record progress commits only what changed.
  const initial = useMemo(
    () => Object.fromEntries(progress.milestones.map((m) => [m.id, m.isCompleted])),
    [progress.milestones]
  );
  const [pending, setPending] = useState<Record<string, boolean>>(initial);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<EvidenceInput[]>([]);

  const total = progress.milestones.length;
  const completedCount = progress.milestones.filter((m) => pending[m.id]).length;
  const completedWeight = progress.milestones.filter((m) => pending[m.id]).reduce((sum, m) => sum + m.weight, 0);

  const changes = progress.milestones.filter((m) => pending[m.id] !== m.isCompleted);
  const reopening = changes.some((m) => !pending[m.id]);
  const noteRequired = reopening;
  const canSubmit = changes.length > 0 && (!noteRequired || note.trim() !== "");
  useEffect(() => onValidityChange(canSubmit), [canSubmit, onValidityChange]);

  async function save() {
    try {
      // Append-only: each changed milestone is its own event; the note anchors the batch, evidence attaches once.
      for (let i = 0; i < changes.length; i++) {
        const m = changes[i]!;
        await onSubmit({
          percentage: null,
          numericActual: null,
          milestoneId: m.id,
          milestoneCompleted: pending[m.id]!,
          contextNote: note.trim() || null,
          isCorrection: !pending[m.id],
          evidence: i === 0 && evidence.length > 0 ? evidence : null,
        });
      }
      onRecorded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the milestones.");
    }
  }

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !submitting) void save();
      }}
    >
      <div>
        <p className="text-sm font-medium text-foreground">Update milestones</p>
        <ul className="mt-2.5 divide-y divide-border rounded-xl border border-border">
          {progress.milestones.map((m) => {
            const on = pending[m.id] ?? false;
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={submitting}
                  onClick={() => setPending((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary"
                  )}
                >
                  {on ? <Check className="size-3.5" aria-hidden /> : null}
                </button>
                <span className="min-w-0 flex-1 text-sm text-foreground">{m.title}</span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{pct(m.weight)}%</span>
              </li>
            );
          })}
        </ul>
      </div>

      <DerivedCard
        label="Objective progress"
        derived={completedWeight}
        subtitle={`${completedCount} of ${total} milestone${total === 1 ? "" : "s"} completed · ${pct(completedWeight)}% of total weight`}
      />

      <NoteField value={note} onChange={setNote} required={noteRequired} hint={reopening ? "Reopening a completed milestone — add a short note." : undefined} />
      <EvidenceField items={evidence} onChange={setEvidence} upload={upload} />
    </form>
  );
}

// ── Shared field pieces ──────────────────────────────────────────────────────

/**
 * A number input with a unit suffix and its own up/down stepper. `min`/`max` are hard guardrails: typing,
 * pasting, or stepping past a bound snaps back to it, so the control can never express an impossible value.
 */
function NumberField({
  id,
  value,
  onChange,
  suffix,
  placeholder,
  min,
  max,
  base,
  integer,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  /** Where stepping/scrolling starts while the field is still empty — the current committed value, so the
   *  first tick nudges the real value instead of snapping to 0. */
  base?: number;
  /** Constrain to whole numbers — a manual completion percent has no MVP need for decimals, so 65.4 snaps
   *  to 65 as it is typed. Raw numeric values keep their precision (integer stays off). */
  integer?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // Snap a numeric string into [min, max] (and to a whole number when integer); empty and partial entries
  // ("-", ".") pass through untouched.
  const clamp = (raw: string): string => {
    if (raw === "") return "";
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw;
    let c = integer ? Math.round(n) : n;
    if (min != null && c < min) c = min;
    if (max != null && c > max) c = max;
    return c === n ? raw : String(c);
  };
  const step = (delta: number) => {
    const start = value === "" ? base ?? min ?? 0 : Number(value);
    let next = (Number.isFinite(start) ? start : min ?? 0) + delta;
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;
    onChange(String(next));
  };

  // Own the wheel so a scroll over the focused field nudges from the current value rather than the browser's
  // empty-is-zero default. Non-passive so the page does not scroll while adjusting.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (document.activeElement !== el || e.deltaY === 0) return;
      e.preventDefault();
      step(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  return (
    <div className="flex h-11 w-full items-stretch overflow-hidden rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
      <input
        ref={ref}
        id={id}
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        step={integer ? 1 : "any"}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(e.target.value))}
        placeholder={placeholder}
        autoFocus
        className="min-w-0 flex-1 bg-transparent px-3.5 text-base tabular-nums text-foreground outline-none placeholder:text-muted-foreground/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix ? (
        <span className="flex items-center pr-1 text-sm font-medium text-muted-foreground">{suffix}</span>
      ) : null}
      <div className="flex w-9 shrink-0 flex-col border-l border-input">
        <button
          type="button"
          aria-label="Increase"
          onClick={() => step(1)}
          className="flex flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronUp className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => step(-1)}
          className="flex flex-1 items-center justify-center border-t border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Numeric target rail — the entered actual plotted between baseline and target, all three labelled. */
function TargetRail({
  baseline,
  target,
  current,
  unit,
  frac,
}: {
  baseline: number;
  target: number;
  current: number;
  unit: string | null;
  frac: number;
}) {
  const u = unit ? ` ${unit}` : "";
  const left = `${Math.max(0, Math.min(100, frac * 100))}%`;
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-muted">
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: left }} />
        <span className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-muted-foreground/40" style={{ left: 0 }} />
        <span className="absolute top-1/2 right-0 size-2 -translate-y-1/2 rounded-full bg-muted-foreground/40" />
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
          style={{ left }}
        />
      </div>
      <div className="relative mt-2 h-9 text-xs tabular-nums">
        <div className="absolute left-0 top-0">
          <p className="font-medium text-foreground">{num(baseline)}{u}</p>
          <p className="text-muted-foreground">Baseline</p>
        </div>
        <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left }}>
          <p className="font-semibold text-primary">{num(current)}{u}</p>
          <p className="text-muted-foreground">Current</p>
        </div>
        <div className="absolute right-0 top-0 text-right">
          <p className="font-medium text-foreground">{num(target)}{u}</p>
          <p className="text-muted-foreground">Target</p>
        </div>
      </div>
    </div>
  );
}

/** The derived progress card — the headline figure over its own bar, shared by the recorder's live preview
 *  and the details drawer's committed current-progress read. Progress is a whole-percent readout (the raw
 *  value lives on the rail above where present); decimals would be false precision. Pass no `label` to let a
 *  surrounding section title carry the heading. */
export function DerivedCard({
  derived,
  from,
  subtitle,
  label,
}: {
  derived: number;
  from?: number | null;
  subtitle?: string;
  label?: string;
}) {
  const complete = derived >= 100;
  const clamped = Math.max(0, Math.min(100, derived));
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4">
      {label ? <p className="type-eyebrow text-muted-foreground">{label}</p> : null}
      <div className={cn("flex items-center gap-3", label && "mt-2")}>
        <span className={cn("text-2xl font-semibold tabular-nums leading-none", complete ? "text-success" : "text-foreground")}>
          {Math.round(derived)}%
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <span className={cn("block h-full rounded-full", complete ? "bg-success" : "bg-primary")} style={{ width: `${clamped}%` }} />
        </div>
        {from != null ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">from {Math.round(from)}%</span> : null}
      </div>
      {subtitle ? <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

/** The optional (dynamically required) note, always present, with a live character count. */
function NoteField({
  value,
  onChange,
  required,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="pv-note">Add a note {required ? <span className="text-destructive">(required)</span> : <span className="text-muted-foreground">(optional)</span>}</Label>
      <div className="relative">
        <Textarea
          id="pv-note"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, NOTE_MAX))}
          rows={3}
          maxLength={NOTE_MAX}
          placeholder="e.g. Key activities completed, outcomes, or context…"
          className="resize-none pb-6"
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-[0.6875rem] tabular-nums text-muted-foreground/70">
          {value.length}/{NOTE_MAX}
        </span>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Evidence — the optional attachments that support this one update. */
function EvidenceField({
  items,
  onChange,
  upload,
}: {
  items: EvidenceInput[];
  onChange: (items: EvidenceInput[]) => void;
  upload: UploadFn;
}) {
  return (
    <div className="space-y-2">
      <Label>Add evidence <span className="text-muted-foreground">(optional)</span></Label>
      <EvidenceUploader items={items} onChange={onChange} upload={upload} />
    </div>
  );
}
