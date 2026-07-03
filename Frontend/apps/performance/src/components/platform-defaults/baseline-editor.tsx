"use client";

import { useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { ApiError, createPlatformApiClient, performancePaths } from "@repo/api";
import { useApiMutation } from "@repo/api/query";
import type {
  BaselineApplyResultDto,
  BaselineVersionDto,
  ApplyBaselineRequest,
  GuardrailsDto,
} from "@repo/api";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StatusBadge } from "@repo/ds/shell";
import { MeasurementTypePicker } from "@/components/controls/measurement-type-picker";
import { StrategicAlignmentSelect } from "@/components/controls/strategic-alignment-select";
import { WeightPresetEditor } from "@/components/controls/weight-preset-editor";
import {
  parseMeasurementTypes,
  parseWeightValues,
} from "@/lib/labels";
import { checkWeightFeasibility } from "@/lib/weight-feasibility";
import { toast } from "sonner";

const DEFAULT_POLICY: ApplyBaselineRequest = {
  maxObjectivesPerPlan: 7,
  allowedWeightValues: "5,10,15,20,25,30,40,50",
  managerValidationSlaDays: 10,
  cascadeMode: "Optional",
  measurementTypes: "Quantitative,Qualitative",
  attachmentsEnabled: true,
};

const REVIEW_DAY_OPTIONS = ["3", "5", "7", "10", "15", "20", "30"] as const;

interface BaselineEditorProps {
  appliedPolicy: BaselineVersionDto | null;
  guardrails: GuardrailsDto | null;
  onSaved: () => void;
}

export function BaselineEditor({
  appliedPolicy,
  guardrails,
  onSaved,
}: BaselineEditorProps) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const source = useMemo(() => toBaselineRequest(appliedPolicy), [appliedPolicy]);
  const sourceKey = JSON.stringify(source);
  const [form, setForm] = useState<ApplyBaselineRequest>(source);
  const [applyErrors, setApplyErrors] = useState<string[] | null>(null);

  useEffect(() => {
    setForm(source);
    setApplyErrors(null);
  }, [source, sourceKey]);

  const dirty = JSON.stringify(form) !== sourceKey;
  const issues = useMemo(
    () => validateBaseline(form, guardrails),
    [form, guardrails],
  );
  const canApply = (dirty || !appliedPolicy) && issues.length === 0;

  // One atomic step: validate server-side and apply. No Draft is created or surfaced.
  const applyChanges = useApiMutation<BaselineApplyResultDto, ApplyBaselineRequest>(
    (request) =>
      apiClient.post<BaselineApplyResultDto>(performancePaths.platformBaselineApply(), request),
    {
      onSuccess: (result) => {
        if (result.applied) {
          toast.success("Standard setup updated");
          setApplyErrors(null);
          onSaved();
        } else {
          setApplyErrors(
            result.errors.length ? result.errors : ["Could not apply the standard setup."],
          );
        }
      },
      onError: (error) => {
        const reasons =
          error instanceof ApiError && error.errors.length > 0 ? error.errors : [error.message];
        setApplyErrors(reasons);
        toast.error(reasons[0] ?? error.message);
      },
    },
  );

  const setField =
    <K extends keyof ApplyBaselineRequest>(key: K) =>
    (value: ApplyBaselineRequest[K]) => {
      setApplyErrors(null);
      setForm((current) => ({ ...current, [key]: value }));
    };

  return (
    <Card>
      <CardHeader density="compact">
        <CardTitle>Standard setup</CardTitle>
        <CardAction>
          <StatusBadge tone={dirty ? "warning" : appliedPolicy ? "success" : "neutral"} dot>
            {dirty ? "Editing" : appliedPolicy ? "Live" : "Empty"}
          </StatusBadge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <FieldGroup>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-5">
              <SliderField
                label="Objectives per plan"
                value={form.maxObjectivesPerPlan}
                min={guardrails?.minObjectivesPerPlan ?? 1}
                max={guardrails?.maxObjectivesPerPlan ?? 12}
                onChange={setField("maxObjectivesPerPlan")}
              />

              <Field>
                <FieldLabel>Allowed weights</FieldLabel>
                <WeightPresetEditor
                  value={form.allowedWeightValues}
                  maxObjectives={form.maxObjectivesPerPlan}
                  onChange={setField("allowedWeightValues")}
                  compact
                />
              </Field>

              <Field>
                <FieldLabel>Measurement</FieldLabel>
                <MeasurementTypePicker
                  value={form.measurementTypes}
                  onChange={setField("measurementTypes")}
                />
              </Field>
            </div>

            <div className="space-y-5">
              <ChoiceField
                label="Manager review days"
                value={String(form.managerValidationSlaDays)}
                options={REVIEW_DAY_OPTIONS}
                onChange={(value) => setField("managerValidationSlaDays")(Number(value))}
              />

              <Field>
                <FieldLabel>Alignment</FieldLabel>
                <StrategicAlignmentSelect value={form.cascadeMode} onChange={setField("cascadeMode")} />
              </Field>

              <Field>
                <FieldLabel>Supporting files</FieldLabel>
                <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <span>Allow attachments</span>
                  <Switch
                    checked={form.attachmentsEnabled}
                    onCheckedChange={setField("attachmentsEnabled")}
                  />
                </label>
              </Field>
            </div>
          </div>
        </FieldGroup>

        {issues.length > 0 ? <IssueList issues={issues} /> : null}

        {applyErrors?.length ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Standard setup not applied</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-5">
                {applyErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={applyChanges.isLoading || (!dirty && Boolean(appliedPolicy))}
            onClick={() => {
              setForm(source);
              setApplyErrors(null);
            }}
          >
            Discard
          </Button>
          <Button
            type="button"
            disabled={!canApply || applyChanges.isLoading}
            onClick={() => applyChanges.mutate(form)}
          >
            {applyChanges.isLoading ? "Applying..." : "Apply"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function SliderField({
  label,
  value,
  min,
  max = 100,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="rounded-md border border-border/70 px-2 py-1 text-sm font-medium text-foreground">
          {value}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([next]) => onChange(next ?? min)}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </Field>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={2}
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
        className="flex w-full flex-wrap"
      >
        {options.map((option) => (
          <ToggleGroupItem key={option} value={option} className="min-h-9 rounded-full px-3">
            {option}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

function IssueList({ issues }: { issues: string[] }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>Fix before applying</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-5">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function toBaselineRequest(
  version: BaselineVersionDto | null | undefined,
): ApplyBaselineRequest {
  if (!version) {
    return { ...DEFAULT_POLICY };
  }

  return {
    maxObjectivesPerPlan: version.maxObjectivesPerPlan,
    allowedWeightValues: version.allowedWeightValues,
    managerValidationSlaDays: version.managerValidationSlaDays,
    cascadeMode: version.cascadeMode,
    measurementTypes: version.measurementTypes,
    attachmentsEnabled: version.attachmentsEnabled,
  };
}

function validateBaseline(
  form: ApplyBaselineRequest,
  guardrails: GuardrailsDto | null,
) {
  const issues: string[] = [];
  const feasibility = checkWeightFeasibility(form.allowedWeightValues, form.maxObjectivesPerPlan);
  const weights = parseWeightValues(form.allowedWeightValues);
  const selectedTypes = parseMeasurementTypes(form.measurementTypes);
  const supportedTypes = guardrails ? parseMeasurementTypes(guardrails.supportedMeasurementTypes) : null;

  if (!feasibility.feasible) {
    issues.push("Weights cannot produce a 100% plan.");
  }

  if (guardrails) {
    if (
      form.maxObjectivesPerPlan < guardrails.minObjectivesPerPlan ||
      form.maxObjectivesPerPlan > guardrails.maxObjectivesPerPlan
    ) {
      issues.push(`Objectives must be ${guardrails.minObjectivesPerPlan}-${guardrails.maxObjectivesPerPlan}.`);
    }

    if (
      form.managerValidationSlaDays < guardrails.minManagerValidationSlaDays ||
      form.managerValidationSlaDays > guardrails.maxManagerValidationSlaDays
    ) {
      issues.push(`Review days must be ${guardrails.minManagerValidationSlaDays}-${guardrails.maxManagerValidationSlaDays}.`);
    }

    if (weights.length > guardrails.maxAllowedWeightingValues) {
      issues.push(`Use ${guardrails.maxAllowedWeightingValues} weight choices or fewer.`);
    }
  }

  if (
    supportedTypes &&
    ((selectedTypes.numeric && !supportedTypes.numeric) ||
      (selectedTypes.qualitative && !supportedTypes.qualitative))
  ) {
    issues.push("Measurement exceeds platform limits.");
  }

  return issues;
}
