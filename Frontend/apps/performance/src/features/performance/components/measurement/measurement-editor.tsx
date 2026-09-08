"use client";

import { useState } from "react";
import { Flag, Info, LineChart, Percent, TrendingDown, TrendingUp } from "lucide-react";
import type { ImprovementDirection, MeasurementMethod } from "@repo/api";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import {
  Autocomplete,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@repo/ds/components/ui/combobox";
import { cn } from "@repo/ds/lib/utils";
import { MilestoneEditor, type MilestoneRow } from "./milestone-editor";

/** The three direct ways an objective's progress can be measured — canonical type from `@repo/api`. */
export type { MeasurementMethod };

/** Common measurement units offered as suggestions — any custom unit can still be typed. */
const UNIT_OPTIONS = [
  "Percent (%)",
  "Count",
  "Days",
  "Hours",
  "Score",
  "NPS",
  "Ratio",
  "Currency",
];

/**
 * The one place a measurement is authored — the method choice (manual percentage, numeric target,
 * weighted milestones) and the editor for the chosen method. Shared verbatim by the organizational
 * objective composer and the employee plan composer so authoring a measure looks and behaves the same
 * wherever it happens. Presentation only: each composer owns its own readiness/validation and passes
 * the derived numeric-error flags in.
 */
export function MeasurementEditor({
  method,
  onMethodChange,
  baseline,
  target,
  unit,
  direction,
  numericInvalid,
  numericSameValue,
  onBaseline,
  onTarget,
  onUnit,
  onDirection,
  milestones,
  milestoneWeightSum,
  onMilestonesChange,
  milestoneReadyLabel,
}: {
  method: MeasurementMethod | null;
  onMethodChange: (method: MeasurementMethod) => void;
  baseline: string;
  target: string;
  unit: string;
  direction: ImprovementDirection;
  numericInvalid: boolean;
  numericSameValue: boolean;
  onBaseline: (v: string) => void;
  onTarget: (v: string) => void;
  onUnit: (v: string) => void;
  onDirection: (v: ImprovementDirection) => void;
  milestones: MilestoneRow[];
  milestoneWeightSum: number;
  onMilestonesChange: (
    next: MilestoneRow[] | ((rows: MilestoneRow[]) => MilestoneRow[])
  ) => void;
  /** Overrides the milestone editor's "ready" label — e.g. "Ready to publish" in the org composer. */
  milestoneReadyLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MethodTile
          active={method === "ManualPercentage"}
          icon={Percent}
          title="Manual percentage"
          detail="Update progress as a percentage throughout the cycle."
          onClick={() => onMethodChange("ManualPercentage")}
        />
        <MethodTile
          active={method === "NumericTarget"}
          icon={LineChart}
          title="Numeric target"
          detail="Define a target with a numeric start and end value."
          onClick={() => onMethodChange("NumericTarget")}
        />
        <MethodTile
          active={method === "WeightedMilestones"}
          icon={Flag}
          title="Weighted milestones"
          detail="Break the objective into milestones with assigned weights."
          onClick={() => onMethodChange("WeightedMilestones")}
        />
      </div>

      {method === "ManualPercentage" ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-info/25 bg-info-subtle px-4 py-3 text-sm text-info">
          <Info className="size-4 shrink-0" aria-hidden />
          You&rsquo;ll update progress as a percentage during the cycle.
        </div>
      ) : null}

      {method === "NumericTarget" ? (
        <NumericTargetEditor
          baseline={baseline}
          target={target}
          unit={unit}
          direction={direction}
          numericInvalid={numericInvalid}
          sameValue={numericSameValue}
          onBaseline={onBaseline}
          onTarget={onTarget}
          onUnit={onUnit}
          onDirection={onDirection}
        />
      ) : null}

      {method === "WeightedMilestones" ? (
        <MilestoneEditor
          milestones={milestones}
          weightSum={milestoneWeightSum}
          onChange={onMilestonesChange}
          readyLabel={milestoneReadyLabel}
        />
      ) : null}
    </div>
  );
}

// ── Method tile (icon + title + one-line detail) ──────────────────────────────────

function MethodTile({
  active,
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  icon: typeof Percent;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary/[0.05] ring-1 ring-primary/30"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          active ? "border-primary" : "border-muted-foreground/40"
        )}
        aria-hidden
      >
        {active ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {detail}
        </span>
      </span>
      <Icon
        className={cn(
          "size-5 shrink-0",
          active ? "text-primary" : "text-muted-foreground/50"
        )}
        aria-hidden
      />
    </button>
  );
}

// ── Numeric target editor (baseline → target, unit, direction) ────────────────────────

function NumericTargetEditor({
  baseline,
  target,
  unit,
  direction,
  numericInvalid,
  sameValue,
  onBaseline,
  onTarget,
  onUnit,
  onDirection,
}: {
  baseline: string;
  target: string;
  unit: string;
  direction: ImprovementDirection;
  numericInvalid: boolean;
  sameValue: boolean;
  onBaseline: (v: string) => void;
  onTarget: (v: string) => void;
  onUnit: (v: string) => void;
  onDirection: (v: ImprovementDirection) => void;
}) {
  const error = numericInvalid
    ? "Enter a number — put a label like M€ or % in the Unit field."
    : sameValue
      ? "Baseline and target must differ."
      : null;
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumericField
          id="me-baseline"
          label="Baseline"
          value={baseline}
          placeholder="42"
          invalid={numericInvalid || sameValue}
          onChange={onBaseline}
        />
        <NumericField
          id="me-target"
          label="Target"
          value={target}
          placeholder="70"
          invalid={numericInvalid || sameValue}
          onChange={onTarget}
        />
        <div className="space-y-1.5">
          <Label htmlFor="me-unit">
            Unit <span className="text-destructive">*</span>
          </Label>
          <UnitCombobox value={unit} onChange={onUnit} />
        </div>
        <div className="space-y-1.5">
          <Label>Direction</Label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5">
            <DirectionOption
              active={direction === "Increase"}
              icon={TrendingUp}
              label="Increase"
              onClick={() => onDirection("Increase")}
            />
            <DirectionOption
              active={direction === "Decrease"}
              icon={TrendingDown}
              label="Decrease"
              onClick={() => onDirection("Decrease")}
            />
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/** Unit picker: a live text field with common-unit suggestions that still accepts any custom unit. */
function UnitCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Autocomplete
      items={UNIT_OPTIONS}
      value={value}
      onValueChange={onChange}
      // Show every common unit on focus (empty query), then narrow as the user types — the default
      // filter hides the whole list until there's input, which leaves an empty popup on open.
      filter={(item, query) => {
        const q = query.trim().toLowerCase();
        return q === "" || String(item).toLowerCase().includes(q);
      }}
      open={open}
      onOpenChange={setOpen}
    >
      <ComboboxInput id="me-unit" placeholder="Percent (%)" className="w-full" />
      <ComboboxContent className="pointer-events-auto">
        <ComboboxEmpty>Uses “{value.trim()}” as a custom unit.</ComboboxEmpty>
        {/* Function child: Base UI filters `items` by the input and renders only the matches,
            which is also what registers each item for highlight and click/keyboard selection. */}
        <ComboboxList>
          {(u: string) => (
            <ComboboxItem key={u} value={u}>
              {u}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Autocomplete>
  );
}

function NumericField({
  id,
  label,
  value,
  placeholder,
  invalid,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
      />
    </div>
  );
}

function DirectionOption({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof TrendingUp;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
