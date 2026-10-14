"use client";

import { reportPerformanceFailure } from "@/features/performance/api/performance-failure";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { CycleSettingsDto, MeasurementMethod, PlanAlignmentPolicy } from "@repo/api";
import { Input } from "@repo/ds/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ds/components/ui/select";
import { AsyncButton } from "@repo/ds/shell";
import { MEASUREMENT_LABELS } from "../lib";
import { useRatingScale, useUpdateRatingScale, useUpdateSettings } from "../api/use-performance";
import { Switch } from "@repo/ds/components/ui/switch";
import type { RatingScaleLevelDto } from "@repo/api";
import { moveRatingLevel, validateRatingLevels } from "./rating-scale-model";
import { ContentUnavailable } from "./content-unavailable";
import { CompetencyCatalog } from "./competency-catalog";

const EMPTY_LEVELS: RatingScaleLevelDto[] = [];

function Row({ title, hint, control }: { title: string; hint: string; control: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0 sm:w-64">{control}</div>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: CycleSettingsDto }) {
  const update = useUpdateSettings();
  const [draft, setDraft] = useState(settings);
  const scale = useRatingScale();
  const saveScale = useUpdateRatingScale();
  const [levelDraft, setLevelDraft] = useState<RatingScaleLevelDto[] | null>(null);

  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => {
    if (scale.data) setLevelDraft(scale.data.levels.map((level) => ({ ...level })));
  }, [scale.data]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const rangeValid = draft.suggestedObjectiveCountMin >= 1 && draft.suggestedObjectiveCountMax >= draft.suggestedObjectiveCountMin;
  const retentionValid = Number.isInteger(draft.evidenceRetentionMonths) && draft.evidenceRetentionMonths > 0;
  const levels = levelDraft ?? scale.data?.levels ?? EMPTY_LEVELS;
  const levelError = useMemo(() => validateRatingLevels(levels), [levels]);
  const scaleDirty = Boolean(scale.data && JSON.stringify(levels) !== JSON.stringify(scale.data.levels));

  return (
    <div className="max-w-2xl">
      <p className="type-eyebrow mb-1 text-muted-foreground">Planning and objectives</p>
      <div className="divide-y divide-border border-t border-border">
        <Row
          title="Default measurement method"
          hint="Offered first when a new objective is created. Authors can still choose another."
          control={
            <Select value={draft.defaultMeasurementMethod} onValueChange={(value) => setDraft((d) => ({ ...d, defaultMeasurementMethod: value as MeasurementMethod }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MEASUREMENT_LABELS) as MeasurementMethod[]).map((key) => (
                  <SelectItem key={key} value={key}>{MEASUREMENT_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <Row
          title="Suggested objectives per plan"
          hint="Guidance for employees while planning — never a hard limit."
          control={
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={draft.suggestedObjectiveCountMin}
                onChange={(event) => setDraft((d) => ({ ...d, suggestedObjectiveCountMin: Number(event.target.value) }))}
                className="w-20"
                aria-label="Minimum objectives"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="number"
                min={1}
                value={draft.suggestedObjectiveCountMax}
                onChange={(event) => setDraft((d) => ({ ...d, suggestedObjectiveCountMax: Number(event.target.value) }))}
                className="w-20"
                aria-label="Maximum objectives"
              />
            </div>
          }
        />
        <Row
          title="Planning deadline offset"
          hint="Days after a Cycle starts that planning should complete by, used as the default."
          control={
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                value={draft.planningDeadlineOffsetDays}
                onChange={(event) => setDraft((d) => ({ ...d, planningDeadlineOffsetDays: Number(event.target.value) }))}
                className="w-24"
                aria-label="Planning deadline offset in days"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          }
        />
        <fieldset className="py-4">
          <legend className="type-label pt-4">Alignment to strategic direction</legend>
          <div className="mt-3 grid gap-1 rounded-control bg-section p-1 sm:grid-cols-3">
            {([
              ["EveryObjectiveConnected", "Every objective"],
              ["AtLeastOneConnected", "At least one"],
              ["Optional", "Optional"],
            ] as [PlanAlignmentPolicy, string][]).map(([value, label]) => (
              <label key={value} className="relative cursor-pointer">
                <input type="radio" name="plan-alignment-policy" value={value}
                  checked={draft.planAlignmentPolicy === value}
                  onChange={() => setDraft((d) => ({ ...d, planAlignmentPolicy: value }))}
                  className="peer sr-only" />
                <span className="type-label flex justify-center rounded-control px-3 py-2 text-muted-foreground peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <section className="mt-10" aria-labelledby="evidence-retention-title">
        <div className="border-b border-border pb-3">
          <h2 id="evidence-retention-title" className="type-section-title">Uploaded evidence</h2>
        </div>
        <div className="divide-y divide-border border-b border-border">
          <Row
            title="Keep files after Cycle close"
            hint="Changes also apply to Cycles already closed."
            control={
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.evidenceRetentionMonths}
                  onChange={(event) => setDraft((current) => ({ ...current, evidenceRetentionMonths: Number(event.target.value) }))}
                  className="w-24"
                  aria-label="Evidence retention in months"
                />
                <span className="text-sm text-muted-foreground">months</span>
              </div>
            }
          />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="reviews-settings-title">
        <div className="border-b border-border pb-3">
          <h2 id="reviews-settings-title" className="type-section-title">Reviews</h2>
        </div>

        <fieldset className="border-b border-border py-5">
          <legend className="type-label">Review defaults for new review rounds</legend>
          <div className="mt-3 divide-y divide-border">
            {([
              ["defaultSelfAssessmentEnabled", "Self-assessment"],
              ["defaultObjectiveRatingsEnabled", "Objective ratings"],
              ["defaultCalibrationEnabled", "Calibration"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
                <span>{label}</span>
                <Switch checked={draft[key]} onCheckedChange={(checked) => setDraft((current) => ({ ...current, [key]: checked }))} aria-label={label} />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="type-label">Rating scale</h3>
              <p className="mt-1 text-sm text-muted-foreground">Version {scale.data?.scaleVersion ?? "—"}</p>
            </div>
            <button type="button" className="rounded-control border border-border px-3 py-2 text-sm hover:bg-section disabled:opacity-50" disabled={levels.length >= 7} onClick={() => setLevelDraft((current) => [...(current ?? levels), { value: levels.length + 1, label: "", description: null }])}>Add level</button>
          </div>
          {scale.isLoading ? <p className="py-6 text-sm text-muted-foreground">Loading rating scale…</p> : scale.error ? <ContentUnavailable error={scale.error} onRetry={scale.refetch} subject="Rating scale" /> : (
            <ol className="mt-3 divide-y divide-border border-y border-border">
              {levels.map((level, index) => (
                <li key={`${level.value}-${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
                  <span className="type-label tabular-nums text-muted-foreground">{index + 1}</span>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <Input value={level.label} aria-label={`Level ${index + 1} label`} onChange={(event) => setLevelDraft(levels.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
                    <Input value={level.description ?? ""} aria-label={`Level ${index + 1} description`} placeholder="Description" onChange={(event) => setLevelDraft(levels.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value || null } : item))} />
                  </div>
                  <div className="col-start-2 mt-2 flex items-center justify-end gap-1 sm:col-start-auto sm:mt-0">
                    <button type="button" aria-label={`Move level ${index + 1} up`} disabled={index === 0} className="rounded-control px-2 py-2 text-sm hover:bg-section disabled:opacity-40" onClick={() => setLevelDraft(moveRatingLevel(levels, index, -1))}>↑</button>
                    <button type="button" aria-label={`Move level ${index + 1} down`} disabled={index === levels.length - 1} className="rounded-control px-2 py-2 text-sm hover:bg-section disabled:opacity-40" onClick={() => setLevelDraft(moveRatingLevel(levels, index, 1))}>↓</button>
                    <button type="button" aria-label={`Remove level ${index + 1}`} disabled={levels.length <= 3} className="rounded-control px-2 py-2 text-sm text-muted-foreground hover:bg-section disabled:opacity-40" onClick={() => setLevelDraft(levels.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, value: itemIndex + 1 })))}>Remove</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-muted-foreground">{levelError ?? (scaleDirty ? "Unsaved changes" : "")}</p>
            <AsyncButton pending={saveScale.isLoading} pendingLabel="Saving…" disabled={!scaleDirty || Boolean(levelError)} onClick={async () => {
              try {
                await saveScale.mutateAsync({ levels, expectedVersion: scale.data!.version });
                toast.success("Rating scale saved as a new version.");
              } catch (error) {
                reportPerformanceFailure(error, "Could not save rating scale.");
              }
            }}>Save rating scale</AsyncButton>
          </div>
        </div>
      </section>

      <CompetencyCatalog />

      <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-4">
        {dirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
        <AsyncButton
          pending={update.isLoading}
          pendingLabel="Saving…"
          disabled={!dirty || !rangeValid || !retentionValid}
          onClick={async () => {
            try {
              await update.mutateAsync({ ...draft, expectedVersion: draft.version });
              toast.success("Settings saved.");
            } catch (error) {
              reportPerformanceFailure(error, "Could not save settings.");
            }
          }}
        >
          Save settings
        </AsyncButton>
      </div>
    </div>
  );
}
