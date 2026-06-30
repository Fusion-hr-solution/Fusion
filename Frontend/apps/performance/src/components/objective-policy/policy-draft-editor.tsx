"use client";

import { useMemo, useState, useCallback } from "react";
import { createPlatformApiClient } from "@repo/api";
import { useApiMutation } from "@repo/api/query";
import { performancePaths } from "@repo/api";
import type { PolicyVersionDto, UpdatePolicyDraftRequest, PublishPolicyRequest } from "@repo/api";
import { checkWeightFeasibility } from "@/lib/weight-feasibility";
import {
  parseWeightValues,
  labelCascadeMode,
  labelMeasurementTypes,
} from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { WeightPresetEditor } from "@/components/controls/weight-preset-editor";
import { MeasurementTypePicker } from "@/components/controls/measurement-type-picker";
import { StrategicAlignmentSelect } from "@/components/controls/strategic-alignment-select";
import { ConfirmDialog } from "@/components/controls/confirm-dialog";
import { toast } from "sonner";

interface PolicyDraftEditorProps {
  draft: PolicyVersionDto;
  activeVersion: PolicyVersionDto | null;
  onSaved: () => void;
  onDiscard: () => void;
  isDiscarding: boolean;
}

interface FormState {
  maxObjectivesPerPlan: number;
  allowedWeightValues: string;
  managerValidationSlaDays: number;
  cascadeMode: string;
  measurementTypes: string;
  attachmentsEnabled: boolean;
  changeSummary: string;
}

export function PolicyDraftEditor({
  draft,
  activeVersion,
  onSaved,
  onDiscard,
  isDiscarding,
}: PolicyDraftEditorProps) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [isDirty, setIsDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    maxObjectivesPerPlan: draft.maxObjectivesPerPlan,
    allowedWeightValues: draft.allowedWeightValues,
    managerValidationSlaDays: draft.managerValidationSlaDays,
    cascadeMode: draft.cascadeMode,
    measurementTypes: draft.measurementTypes,
    attachmentsEnabled: draft.attachmentsEnabled,
    changeSummary: "",
  });

  const update = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  }, []);

  const weightFeasibility = useMemo(
    () => checkWeightFeasibility(form.allowedWeightValues, form.maxObjectivesPerPlan),
    [form.allowedWeightValues, form.maxObjectivesPerPlan],
  );

  const updateDraft = useApiMutation<PolicyVersionDto, UpdatePolicyDraftRequest>(
    (data) =>
      apiClient.put<PolicyVersionDto>(performancePaths.policyDraft(), data, {
        headers: { "If-Match": `"${draft.version}"` },
      }),
    {
      onSuccess: () => {
        toast.success("Draft saved");
        setIsDirty(false);
        setPublishError(null);
        onSaved();
      },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const publishDraft = useApiMutation<PolicyVersionDto, PublishPolicyRequest>(
    (data) =>
      apiClient.post<PolicyVersionDto>(performancePaths.policyDraftPublish(), data, {
        headers: { "If-Match": `"${draft.version}"` },
      }),
    {
      onSuccess: () => {
        toast.success("Policy published — this is now the current policy for this tenant");
        setPublishError(null);
        onSaved();
      },
      onError: (err) => {
        setPublishError(err.message);
        toast.error(err.message);
      },
    },
  );

  const handleSave = () => {
    setPublishError(null);
    updateDraft.mutate({
      maxObjectivesPerPlan: form.maxObjectivesPerPlan,
      allowedWeightValues: form.allowedWeightValues,
      managerValidationSlaDays: form.managerValidationSlaDays,
      cascadeMode: form.cascadeMode,
      measurementTypes: form.measurementTypes,
      attachmentsEnabled: form.attachmentsEnabled,
      expectedVersion: draft.version,
    });
  };

  const handlePublish = () => {
    if (!weightFeasibility.feasible) {
      toast.error("Fix weight issues before publishing.");
      return;
    }
    publishDraft.mutate({
      expectedVersion: draft.version,
      changeSummary: form.changeSummary || null,
    });
  };

  // Build change summary for the "before publishing" panel
  const changes = activeVersion ? computeChanges(activeVersion, form) : null;

  return (
    <>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard unpublished changes?"
        description="This will permanently remove the draft. The current policy will remain unchanged."
        confirmLabel="Discard draft"
        destructive
        onConfirm={() => { setDiscardOpen(false); onDiscard(); }}
      />

      <div className="space-y-6 max-w-2xl">
        {publishError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive space-y-1">
            <p className="font-medium">The policy could not be published.</p>
            <p>{publishError}</p>
          </div>
        )}

        {/* Section: Objective plans */}
        <PolicySection
          title="Objective plans"
          description="How many objectives employees may create and which weights they can assign."
        >
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="maxObj">Maximum objectives per plan</Label>
              <Input
                id="maxObj"
                type="number"
                min={1}
                value={form.maxObjectivesPerPlan}
                onChange={(e) => update("maxObjectivesPerPlan", Number(e.target.value))}
                className="w-28"
              />
            </div>
            <div className="space-y-2">
              <Label>Allowed objective weights</Label>
              <WeightPresetEditor
                value={form.allowedWeightValues}
                maxObjectives={form.maxObjectivesPerPlan}
                onChange={(v) => update("allowedWeightValues", v)}
              />
            </div>
          </div>
        </PolicySection>

        <Separator />

        {/* Section: Measurement */}
        <PolicySection
          title="Measurement"
          description="Whether objectives are measured with numeric targets, qualitative outcomes, or both."
        >
          <MeasurementTypePicker
            value={form.measurementTypes}
            onChange={(v) => update("measurementTypes", v)}
          />
        </PolicySection>

        <Separator />

        {/* Section: Approval */}
        <PolicySection
          title="Approval"
          description="How much time managers receive to review and approve objective plans."
        >
          <div className="flex items-center gap-3">
            <Input
              id="sla"
              type="number"
              min={0}
              value={form.managerValidationSlaDays}
              onChange={(e) => update("managerValidationSlaDays", Number(e.target.value))}
              className="w-28"
            />
            <Label htmlFor="sla" className="text-sm text-muted-foreground">days</Label>
          </div>
        </PolicySection>

        <Separator />

        {/* Section: Strategic alignment */}
        <PolicySection
          title="Strategic alignment"
          description="Whether campaigns may or must align objectives to company priorities."
        >
          <StrategicAlignmentSelect
            value={form.cascadeMode}
            onChange={(v) => update("cascadeMode", v)}
          />
        </PolicySection>

        <Separator />

        {/* Section: Supporting files */}
        <PolicySection
          title="Supporting files"
          description="Whether users may attach evidence or supporting documents to their objectives."
        >
          <div className="flex items-center gap-3">
            <Switch
              id="attachments"
              checked={form.attachmentsEnabled}
              onCheckedChange={(v) => update("attachmentsEnabled", v)}
            />
            <Label htmlFor="attachments">
              {form.attachmentsEnabled ? "Allowed" : "Not allowed"}
            </Label>
          </div>
        </PolicySection>

        <Separator />

        {/* Before publishing */}
        {changes && changes.length > 0 && (
          <Card className="bg-muted/40">
            <CardContent className="pt-4 pb-3 text-sm space-y-2">
              <p className="font-medium text-foreground">Before publishing</p>
              <p className="text-muted-foreground text-xs">This will become the current policy for this tenant. Future campaigns will use these settings. Already-published campaigns are not affected.</p>
              <ul className="space-y-1 mt-2">
                {changes.map((c, i) => (
                  <li key={i} className="text-xs text-foreground/80">
                    <span className="text-muted-foreground">{c.label}:</span>{" "}
                    <span className="line-through text-muted-foreground">{c.from}</span>{" → "}<span className="font-medium">{c.to}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Change summary + actions */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="changeSummary">Change note (optional)</Label>
            <Input
              id="changeSummary"
              value={form.changeSummary}
              onChange={(e) => update("changeSummary", e.target.value)}
              placeholder="Brief description of what changed"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={updateDraft.isLoading || !isDirty}
            >
              {updateDraft.isLoading ? "Saving…" : "Save draft"}
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishDraft.isLoading || !weightFeasibility.feasible}
            >
              {publishDraft.isLoading ? "Publishing…" : "Publish policy"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => isDirty ? setDiscardOpen(true) : onDiscard()}
              disabled={isDiscarding}
              className="text-destructive hover:text-destructive ml-auto"
            >
              {isDiscarding ? "Discarding…" : "Discard draft"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function PolicySection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_1.5fr] gap-8 items-start">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

type ChangeItem = { label: string; from: string; to: string };

function computeChanges(active: PolicyVersionDto, form: FormState): ChangeItem[] {
  const items: ChangeItem[] = [];

  if (active.maxObjectivesPerPlan !== form.maxObjectivesPerPlan) {
    items.push({
      label: "Maximum objectives",
      from: String(active.maxObjectivesPerPlan),
      to: String(form.maxObjectivesPerPlan),
    });
  }

  const oldWeights = parseWeightValues(active.allowedWeightValues).map((w) => `${w}%`).join(", ");
  const newWeights = parseWeightValues(form.allowedWeightValues).map((w) => `${w}%`).join(", ");
  if (oldWeights !== newWeights) {
    items.push({ label: "Allowed weights", from: oldWeights, to: newWeights });
  }

  if (active.managerValidationSlaDays !== form.managerValidationSlaDays) {
    items.push({
      label: "Manager review time",
      from: `${active.managerValidationSlaDays} days`,
      to: `${form.managerValidationSlaDays} days`,
    });
  }

  if (active.measurementTypes !== form.measurementTypes) {
    items.push({
      label: "How objectives are measured",
      from: labelMeasurementTypes(active.measurementTypes),
      to: labelMeasurementTypes(form.measurementTypes),
    });
  }

  if (active.cascadeMode !== form.cascadeMode) {
    items.push({
      label: "Strategic alignment",
      from: labelCascadeMode(active.cascadeMode),
      to: labelCascadeMode(form.cascadeMode),
    });
  }

  if (active.attachmentsEnabled !== form.attachmentsEnabled) {
    items.push({
      label: "Supporting files",
      from: active.attachmentsEnabled ? "Allowed" : "Not allowed",
      to: form.attachmentsEnabled ? "Allowed" : "Not allowed",
    });
  }

  return items;
}
