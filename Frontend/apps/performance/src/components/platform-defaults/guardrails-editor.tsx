"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createPlatformApiClient } from "@repo/api";
import { useApiMutation } from "@repo/api/query";
import { performancePaths } from "@repo/api";
import type { GuardrailsDto, CreateGuardrailsDraftRequest } from "@repo/api";
import { MeasurementTypePicker } from "@/components/controls/measurement-type-picker";
import { labelMeasurementTypes } from "@/lib/labels";
import { toast } from "sonner";

interface GuardrailsEditorProps {
  guardrails: GuardrailsDto | null;
  onSaved: () => void;
}

export function GuardrailsEditor({ guardrails, onSaved }: GuardrailsEditorProps) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [editing, setEditing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const createDraft = useApiMutation<GuardrailsDto, CreateGuardrailsDraftRequest>(
    (data) => apiClient.post<GuardrailsDto>(performancePaths.platformGuardrailsDraft(), data),
    {
      onSuccess: () => { toast.success("Guardrail draft created"); setPublishError(null); onSaved(); setEditing(false); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const updateDraft = useApiMutation<GuardrailsDto, CreateGuardrailsDraftRequest>(
    (data) =>
      apiClient.put<GuardrailsDto>(performancePaths.platformGuardrailsDraft(), data, {
        headers: { "If-Match": `"${guardrails?.version ?? 0}"` },
      }),
    {
      onSuccess: () => { toast.success("Guardrail draft updated"); setPublishError(null); onSaved(); setEditing(false); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const publish = useApiMutation<GuardrailsDto, { version: number }>(
    (data) =>
      apiClient.post<GuardrailsDto>(performancePaths.platformGuardrailsPublish(), undefined, {
        headers: { "If-Match": `"${data.version}"` },
      }),
    {
      onSuccess: () => { toast.success("Guardrails published"); setPublishError(null); onSaved(); },
      onError: (err) => { setPublishError(err.message); toast.error(err.message); },
    },
  );

  if (!guardrails) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">No guardrails configured. Create a draft to get started.</p>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={editing}>
            Create draft
          </Button>
          {editing && (
            <GuardrailsForm
              initial={null}
              onSubmit={(req) => createDraft.mutate(req)}
              onCancel={() => setEditing(false)}
              isLoading={createDraft.isLoading}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3 text-sm">
        <GuardrailsDetail guardrails={guardrails} />
        {publishError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive space-y-1">
            <p className="font-medium">Could not publish guardrails.</p>
            <p>{publishError}</p>
          </div>
        )}
        {editing && (
          <div className="pt-2">
            <GuardrailsForm
              initial={guardrails}
              onSubmit={(req) => (guardrails?.isDraft ? updateDraft.mutate(req) : createDraft.mutate(req))}
              onCancel={() => setEditing(false)}
              isLoading={createDraft.isLoading || updateDraft.isLoading}
            />
          </div>
        )}
      </CardContent>
      {guardrails.isDraft && (
        <CardFooter className="gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Close editor" : "Edit draft"}
          </Button>
          <Button
            size="sm"
            onClick={() => publish.mutate({ version: guardrails.version })}
            disabled={publish.isLoading}
          >
            {publish.isLoading ? "Publishing…" : "Publish guardrails"}
          </Button>
        </CardFooter>
      )}
      {!guardrails.isDraft && (
        <CardFooter>
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit guardrails"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function GuardrailsDetail({ guardrails }: { guardrails: GuardrailsDto }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Objectives per plan</dt>
      <dd>{guardrails.minObjectivesPerPlan}–{guardrails.maxObjectivesPerPlan}</dd>
      <dt className="text-muted-foreground">Manager review time</dt>
      <dd>{guardrails.minManagerValidationSlaDays}–{guardrails.maxManagerValidationSlaDays} days</dd>
      <dt className="text-muted-foreground">Weight decimal places</dt>
      <dd>{guardrails.permittedWeightDecimalPlaces}</dd>
      <dt className="text-muted-foreground">Max distinct weights</dt>
      <dd>{guardrails.maxAllowedWeightingValues}</dd>
      <dt className="text-muted-foreground">How objectives can be measured</dt>
      <dd>{labelMeasurementTypes(guardrails.supportedMeasurementTypes)}</dd>
      <dt className="text-muted-foreground">Template title max length</dt>
      <dd>{guardrails.maxTemplateTitleLength} characters</dd>
      <dt className="text-muted-foreground">Template description max length</dt>
      <dd>{guardrails.maxTemplateDescriptionLength} characters</dd>
      <dt className="text-muted-foreground">Max tags per template</dt>
      <dd>{guardrails.maxTemplateTags}</dd>
      <dt className="text-muted-foreground">Template library</dt>
      <dd>{guardrails.objectiveLibraryEnabled ? "Enabled" : "Disabled"}</dd>
    </dl>
  );
}

interface GuardrailsFormProps {
  initial: GuardrailsDto | null;
  onSubmit: (req: CreateGuardrailsDraftRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function GuardrailsForm({ initial, onSubmit, onCancel, isLoading }: GuardrailsFormProps) {
  const [form, setForm] = useState<CreateGuardrailsDraftRequest>({
    minObjectivesPerPlan: initial?.minObjectivesPerPlan ?? 1,
    maxObjectivesPerPlan: initial?.maxObjectivesPerPlan ?? 10,
    minManagerValidationSlaDays: initial?.minManagerValidationSlaDays ?? 1,
    maxManagerValidationSlaDays: initial?.maxManagerValidationSlaDays ?? 30,
    permittedWeightDecimalPlaces: initial?.permittedWeightDecimalPlaces ?? 0,
    maxAllowedWeightingValues: initial?.maxAllowedWeightingValues ?? 10,
    supportedMeasurementTypes: initial?.supportedMeasurementTypes ?? "Quantitative,Qualitative",
    maxTemplateTitleLength: initial?.maxTemplateTitleLength ?? 150,
    maxTemplateDescriptionLength: initial?.maxTemplateDescriptionLength ?? 500,
    maxTemplateTags: initial?.maxTemplateTags ?? 10,
    objectiveLibraryEnabled: initial?.objectiveLibraryEnabled ?? true,
  });

  const update = <K extends keyof CreateGuardrailsDraftRequest>(key: K) => (val: CreateGuardrailsDraftRequest[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <form
      className="space-y-5 border rounded-md p-4"
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
    >
      <div className="grid grid-cols-2 gap-4">
        <NumericField label="Min objectives" value={form.minObjectivesPerPlan} onChange={update("minObjectivesPerPlan")} />
        <NumericField label="Max objectives" value={form.maxObjectivesPerPlan} onChange={update("maxObjectivesPerPlan")} />
        <NumericField label="Min manager review (days)" value={form.minManagerValidationSlaDays} onChange={update("minManagerValidationSlaDays")} />
        <NumericField label="Max manager review (days)" value={form.maxManagerValidationSlaDays} onChange={update("maxManagerValidationSlaDays")} />
        <NumericField label="Weight decimal places" value={form.permittedWeightDecimalPlaces} onChange={update("permittedWeightDecimalPlaces")} />
        <NumericField label="Max distinct weights" value={form.maxAllowedWeightingValues} onChange={update("maxAllowedWeightingValues")} />
        <NumericField label="Max title length" value={form.maxTemplateTitleLength} onChange={update("maxTemplateTitleLength")} />
        <NumericField label="Max description length" value={form.maxTemplateDescriptionLength} onChange={update("maxTemplateDescriptionLength")} />
        <NumericField label="Max tags per template" value={form.maxTemplateTags} onChange={update("maxTemplateTags")} />
      </div>

      <div className="space-y-2">
        <Label>How objectives can be measured</Label>
        <MeasurementTypePicker
          value={form.supportedMeasurementTypes}
          onChange={update("supportedMeasurementTypes")}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="libEnabled"
          checked={form.objectiveLibraryEnabled}
          onCheckedChange={update("objectiveLibraryEnabled")}
        />
        <Label htmlFor="libEnabled">Template library enabled</Label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={isLoading}>{isLoading ? "Saving…" : "Save draft"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function NumericField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
