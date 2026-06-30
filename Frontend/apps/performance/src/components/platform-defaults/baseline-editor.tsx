"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@repo/ds/shell";
import { createPlatformApiClient } from "@repo/api";
import { useApiMutation } from "@repo/api/query";
import { performancePaths } from "@repo/api";
import type { BaselineVersionDto, CreateBaselineDraftRequest } from "@repo/api";
import { WeightPresetEditor } from "@/components/controls/weight-preset-editor";
import { MeasurementTypePicker } from "@/components/controls/measurement-type-picker";
import { StrategicAlignmentSelect } from "@/components/controls/strategic-alignment-select";
import {
  parseWeightValues,
  labelMeasurementTypes,
  labelCascadeMode,
  formatDate,
} from "@/lib/labels";
import { toast } from "sonner";

interface BaselineEditorProps {
  versions: BaselineVersionDto[];
  onSaved: () => void;
}

export function BaselineEditor({ versions, onSaved }: BaselineEditorProps) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [creating, setCreating] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const published = versions.find((v) => v.status === "Published");
  const draft = versions.find((v) => v.status === "Draft");

  const createDraft = useApiMutation<BaselineVersionDto, CreateBaselineDraftRequest>(
    (data) => apiClient.post<BaselineVersionDto>(performancePaths.platformBaselineDraft(), data),
    {
      onSuccess: () => { toast.success("Baseline draft created"); setPublishError(null); onSaved(); setCreating(false); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const updateDraft = useApiMutation<BaselineVersionDto, CreateBaselineDraftRequest>(
    (data) => apiClient.put<BaselineVersionDto>(performancePaths.platformBaselineDraft(), data),
    {
      onSuccess: () => { toast.success("Baseline draft updated"); setPublishError(null); onSaved(); setCreating(false); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const publishDraft = useApiMutation<BaselineVersionDto, void>(
    () => apiClient.post<BaselineVersionDto>(performancePaths.platformBaselinePublish(), undefined),
    {
      onSuccess: () => { toast.success("Baseline published"); setPublishError(null); onSaved(); },
      onError: (err) => { setPublishError(err.message); toast.error(err.message); },
    },
  );

  if (versions.length === 0 && !creating) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            No default policy configured. Create a draft to define what newly provisioned tenants start with.
          </p>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            Create draft
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {draft && (
        <Card className="border-dashed border-primary/40">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium">Unpublished changes</span>
              <StatusBadge tone="warning" dot>Draft v{draft.versionNumber}</StatusBadge>
            </div>
            <BaselineVersionDetail version={draft} />
          </CardContent>
          <CardFooter className="gap-2 flex-col items-start">
            {publishError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive w-full space-y-1">
                <p className="font-medium">Could not publish baseline.</p>
                <p>{publishError}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCreating((v) => !v)}>
                {creating ? "Close editor" : "Edit draft"}
              </Button>
              <Button
                size="sm"
                onClick={() => publishDraft.mutate()}
                disabled={publishDraft.isLoading}
              >
                {publishDraft.isLoading ? "Publishing…" : "Publish baseline"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {creating && (
        <Card>
          <CardContent className="pt-5">
            <BaselineDraftForm
              initial={draft ?? published ?? null}
              onSubmit={(req) => (draft ? updateDraft.mutate(req) : createDraft.mutate(req))}
              onCancel={() => setCreating(false)}
              isLoading={createDraft.isLoading || updateDraft.isLoading}
            />
          </CardContent>
        </Card>
      )}

      {published && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium">Current baseline</span>
              <StatusBadge tone="success" dot>Published v{published.versionNumber}</StatusBadge>
              {published.publishedAt && (
                <span className="text-xs text-muted-foreground ml-auto">{formatDate(published.publishedAt)}</span>
              )}
            </div>
            <BaselineVersionDetail version={published} />
          </CardContent>
        </Card>
      )}

      {!draft && !creating && (
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          Create new draft
        </Button>
      )}
    </div>
  );
}

function BaselineVersionDetail({ version }: { version: BaselineVersionDto }) {
  const weights = parseWeightValues(version.allowedWeightValues);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
      <dt className="text-muted-foreground">Maximum objectives per plan</dt>
      <dd>{version.maxObjectivesPerPlan}</dd>
      <dt className="text-muted-foreground">Allowed objective weights</dt>
      <dd>
        <span className="flex flex-wrap gap-1">
          {weights.map((w) => (
            <span key={w} className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{w}%</span>
          ))}
        </span>
      </dd>
      <dt className="text-muted-foreground">Manager review time</dt>
      <dd>{version.managerValidationSlaDays} days</dd>
      <dt className="text-muted-foreground">How objectives are measured</dt>
      <dd>{labelMeasurementTypes(version.measurementTypes)}</dd>
      <dt className="text-muted-foreground">Strategic alignment</dt>
      <dd>{labelCascadeMode(version.cascadeMode)}</dd>
      <dt className="text-muted-foreground">Supporting files</dt>
      <dd>{version.attachmentsEnabled ? "Allowed" : "Not allowed"}</dd>
    </dl>
  );
}

interface BaselineDraftFormProps {
  initial: BaselineVersionDto | null;
  onSubmit: (req: CreateBaselineDraftRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function BaselineDraftForm({ initial, onSubmit, onCancel, isLoading }: BaselineDraftFormProps) {
  const [form, setForm] = useState<CreateBaselineDraftRequest>({
    maxObjectivesPerPlan: initial?.maxObjectivesPerPlan ?? 7,
    allowedWeightValues: initial?.allowedWeightValues ?? "5,10,15,20,25,30,40,50",
    managerValidationSlaDays: initial?.managerValidationSlaDays ?? 10,
    cascadeMode: initial?.cascadeMode ?? "Optional",
    measurementTypes: initial?.measurementTypes ?? "Quantitative,Qualitative",
    attachmentsEnabled: initial?.attachmentsEnabled ?? true,
  });

  const update = <K extends keyof CreateBaselineDraftRequest>(key: K) => (val: CreateBaselineDraftRequest[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="maxObj">Maximum objectives per plan</Label>
        <Input
          id="maxObj"
          type="number"
          min={1}
          value={form.maxObjectivesPerPlan}
          onChange={(e) => update("maxObjectivesPerPlan")(Number(e.target.value))}
          className="w-28"
        />
      </div>

      <div className="space-y-2">
        <Label>Allowed objective weights</Label>
        <WeightPresetEditor
          value={form.allowedWeightValues}
          maxObjectives={form.maxObjectivesPerPlan}
          onChange={update("allowedWeightValues")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sla">Manager review time (days)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="sla"
            type="number"
            min={0}
            value={form.managerValidationSlaDays}
            onChange={(e) => update("managerValidationSlaDays")(Number(e.target.value))}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>How objectives are measured</Label>
        <MeasurementTypePicker
          value={form.measurementTypes}
          onChange={update("measurementTypes")}
        />
      </div>

      <div className="space-y-2">
        <Label>Strategic alignment</Label>
        <StrategicAlignmentSelect
          value={form.cascadeMode}
          onChange={update("cascadeMode")}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="attachments"
          checked={form.attachmentsEnabled}
          onCheckedChange={update("attachmentsEnabled")}
        />
        <Label htmlFor="attachments">Allow supporting files</Label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isLoading}>{isLoading ? "Saving…" : "Save draft"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
