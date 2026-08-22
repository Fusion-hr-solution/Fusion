"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CycleSettingsDto, MeasurementMethod } from "@repo/api";
import { Input } from "@repo/ds/components/ui/input";
import { Switch } from "@repo/ds/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ds/components/ui/select";
import { AsyncButton } from "@repo/ds/shell";
import { MEASUREMENT_LABELS } from "../lib";
import { useUpdateSettings } from "../api/use-performance";

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

  useEffect(() => setDraft(settings), [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const rangeValid = draft.suggestedObjectiveCountMin >= 1 && draft.suggestedObjectiveCountMax >= draft.suggestedObjectiveCountMin;

  return (
    <div className="max-w-2xl">
      <div className="divide-y">
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
        <Row
          title="Allow standalone objectives"
          hint="When on, employees may add objectives that are not aligned to strategy, alongside at least one aligned objective."
          control={
            <div className="flex items-center gap-2 sm:justify-end">
              <Switch
                checked={draft.allowStandaloneObjectives}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, allowStandaloneObjectives: checked }))}
                aria-label="Allow standalone objectives"
              />
              <span className="text-sm text-muted-foreground">{draft.allowStandaloneObjectives ? "On" : "Off"}</span>
            </div>
          }
        />
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {dirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
        <AsyncButton
          pending={update.isLoading}
          pendingLabel="Saving…"
          disabled={!dirty || !rangeValid}
          onClick={async () => {
            try {
              await update.mutateAsync(draft);
              toast.success("Settings saved.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not save settings.");
            }
          }}
        >
          Save settings
        </AsyncButton>
      </div>
    </div>
  );
}
