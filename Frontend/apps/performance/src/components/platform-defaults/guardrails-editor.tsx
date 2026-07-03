"use client";

import { useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { ApiError, createPlatformApiClient, performancePaths } from "@repo/api";
import { useApiMutation } from "@repo/api/query";
import type {
  ApplyGuardrailsRequest,
  GuardrailsApplyResultDto,
  GuardrailImpactPreviewDto,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StatusBadge } from "@repo/ds/shell";
import { MeasurementTypePicker } from "@/components/controls/measurement-type-picker";
import { normalizePlatformDefaultsCopy } from "@/lib/labels";
import { toast } from "sonner";

const DEFAULT_LIMITS: ApplyGuardrailsRequest = {
  minObjectivesPerPlan: 1,
  maxObjectivesPerPlan: 10,
  minManagerValidationSlaDays: 1,
  maxManagerValidationSlaDays: 30,
  permittedWeightDecimalPlaces: 0,
  maxAllowedWeightingValues: 10,
  supportedMeasurementTypes: "Quantitative,Qualitative",
  maxTemplateTitleLength: 150,
  maxTemplateDescriptionLength: 500,
  maxTemplateTags: 10,
};

const TITLE_LENGTH_OPTIONS = ["80", "120", "150", "200", "250", "300"] as const;
const DESCRIPTION_LENGTH_OPTIONS = ["200", "350", "500", "750", "1000"] as const;
const TAG_LIMIT_OPTIONS = ["0", "5", "10", "15", "20", "30", "50"] as const;

interface GuardrailsEditorProps {
  appliedGuardrails: GuardrailsDto | null;
  onSaved: () => void;
}

export function GuardrailsEditor({
  appliedGuardrails,
  onSaved,
}: GuardrailsEditorProps) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const source = useMemo(
    () => toGuardrailsRequest(appliedGuardrails),
    [appliedGuardrails],
  );
  const sourceKey = JSON.stringify(source);
  const [form, setForm] = useState<ApplyGuardrailsRequest>(source);
  const [conflicts, setConflicts] = useState<GuardrailImpactPreviewDto | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);

  useEffect(() => {
    setForm(source);
    setConflicts(null);
    setErrors(null);
  }, [source, sourceKey]);

  const formKey = JSON.stringify(form);
  const dirty = formKey !== sourceKey;
  const issues = validateGuardrails(form);

  // One atomic step: evaluate tenant/standard-setup impact and either apply (no conflicts)
  // or block with the reasons. Nothing is persisted on a block — no Draft lifecycle.
  const applyChanges = useApiMutation<GuardrailsApplyResultDto, ApplyGuardrailsRequest>(
    (request) =>
      apiClient.post<GuardrailsApplyResultDto>(performancePaths.platformGuardrailsApply(), request),
    {
      onSuccess: (result) => {
        setErrors(null);
        if (result.applied) {
          setConflicts(null);
          toast.success("Limits updated");
          onSaved();
        } else {
          setConflicts(result.impact);
        }
      },
      onError: (error) => {
        const reasons =
          error instanceof ApiError && error.errors.length > 0 ? error.errors : [error.message];
        setErrors(reasons);
        toast.error(reasons[0] ?? error.message);
      },
    },
  );

  const setField =
    <K extends keyof ApplyGuardrailsRequest>(key: K) =>
    (value: ApplyGuardrailsRequest[K]) => {
      setConflicts(null);
      setErrors(null);
      setForm((current) => ({ ...current, [key]: value }));
    };

  const canApply = (dirty || !appliedGuardrails) && issues.length === 0;

  return (
    <Card>
      <CardHeader density="compact">
        <CardTitle>Platform limits</CardTitle>
        <CardAction>
          <StatusBadge tone={dirty ? "warning" : appliedGuardrails ? "success" : "neutral"} dot>
            {dirty ? "Editing" : appliedGuardrails ? "Live" : "Empty"}
          </StatusBadge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-2">
            <RangeSliderField
              label="Objectives"
              min={1}
              max={20}
              values={[form.minObjectivesPerPlan, form.maxObjectivesPerPlan]}
              onChange={([minValue, maxValue]) => {
                setField("minObjectivesPerPlan")(minValue);
                setField("maxObjectivesPerPlan")(maxValue);
              }}
            />
            <RangeSliderField
              label="Review days"
              min={0}
              max={60}
              values={[form.minManagerValidationSlaDays, form.maxManagerValidationSlaDays]}
              onChange={([minValue, maxValue]) => {
                setField("minManagerValidationSlaDays")(minValue);
                setField("maxManagerValidationSlaDays")(maxValue);
              }}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <Field>
                <FieldLabel>Measurement</FieldLabel>
                <MeasurementTypePicker
                  value={form.supportedMeasurementTypes}
                  onChange={setField("supportedMeasurementTypes")}
                />
              </Field>

              <ToggleField
                label="Weight precision"
                value={String(form.permittedWeightDecimalPlaces)}
                options={["0", "1", "2", "3", "4"]}
                onChange={(value) => setField("permittedWeightDecimalPlaces")(Number(value))}
              />
            </div>

            <div className="space-y-5">
              <ToggleField
                label="Weight choices"
                value={String(form.maxAllowedWeightingValues)}
                options={["4", "6", "8", "10", "12", "16", "20"]}
                onChange={(value) => setField("maxAllowedWeightingValues")(Number(value))}
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <SelectField
              label="Title length"
              value={String(form.maxTemplateTitleLength)}
              options={TITLE_LENGTH_OPTIONS}
              onChange={(value) => setField("maxTemplateTitleLength")(Number(value))}
            />
            <SelectField
              label="Description length"
              value={String(form.maxTemplateDescriptionLength)}
              options={DESCRIPTION_LENGTH_OPTIONS}
              onChange={(value) => setField("maxTemplateDescriptionLength")(Number(value))}
            />
            <SelectField
              label="Tags"
              value={String(form.maxTemplateTags)}
              options={TAG_LIMIT_OPTIONS}
              onChange={(value) => setField("maxTemplateTags")(Number(value))}
            />
          </div>
        </FieldGroup>

        {issues.length > 0 ? <IssueList issues={issues} /> : null}
        {conflicts ? <ImpactReview preview={conflicts} /> : null}

        {errors?.length ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Limits not applied</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-5">
                {errors.map((error, index) => (
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
            disabled={applyChanges.isLoading || (!dirty && Boolean(appliedGuardrails))}
            onClick={() => {
              setForm(source);
              setConflicts(null);
              setErrors(null);
            }}
          >
            Discard
          </Button>
          <Button
            type="button"
            disabled={!canApply || applyChanges.isLoading}
            onClick={() => applyChanges.mutate(form)}
          >
            {applyChanges.isLoading ? "Applying…" : "Apply"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function RangeSliderField({
  label,
  min,
  max,
  values,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  values: [number, number];
  onChange: (values: [number, number]) => void;
}) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="rounded-md border border-border/70 px-2 py-1 text-sm font-medium text-foreground">
          {values[0]}-{values[1]}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={values}
        onValueChange={(next) => onChange([next[0] ?? min, next[1] ?? max])}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </Field>
  );
}

function ToggleField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
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

function SelectField({
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
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
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

function ImpactReview({ preview }: { preview: GuardrailImpactPreviewDto }) {
  const affectedTenantCount = preview.tenantPolicyConflicts.reduce(
    (total, conflict) => total + conflict.affectedCount,
    0,
  );

  return (
    <Card size="sm" className="bg-muted/20">
      <CardContent density="compact" className="grid gap-3 py-3 md:grid-cols-3">
        <ImpactItem label="Tenants" value={String(affectedTenantCount)} tone={preview.hasConflicts ? "danger" : "default"} />
        <ImpactItem
          label="Baseline"
          value={preview.standardSetupConflicts.length ? String(preview.standardSetupConflicts.length) : "Valid"}
          tone={preview.standardSetupConflicts.length ? "danger" : "default"}
        />
        <ImpactItem
          label="Status"
          value={preview.hasConflicts ? "Blocked" : "Ready"}
          tone={preview.hasConflicts ? "danger" : "default"}
        />
        {preview.hasConflicts ? (
          <div className="md:col-span-3">
            <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {preview.standardSetupConflicts.map((item) => (
                <li key={item}>{normalizePlatformDefaultsCopy(item)}</li>
              ))}
              {preview.tenantPolicyConflicts.map((conflict) => (
                <li key={conflict.reason}>
                  {conflict.reason} ({conflict.affectedCount})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ImpactItem({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border/70 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === "danger" ? "text-sm font-medium text-destructive" : "text-sm font-medium text-foreground"}>
        {value}
      </p>
    </div>
  );
}

function toGuardrailsRequest(
  guardrails: GuardrailsDto | null | undefined,
): ApplyGuardrailsRequest {
  if (!guardrails) {
    return { ...DEFAULT_LIMITS };
  }

  return {
    minObjectivesPerPlan: guardrails.minObjectivesPerPlan,
    maxObjectivesPerPlan: guardrails.maxObjectivesPerPlan,
    minManagerValidationSlaDays: guardrails.minManagerValidationSlaDays,
    maxManagerValidationSlaDays: guardrails.maxManagerValidationSlaDays,
    permittedWeightDecimalPlaces: guardrails.permittedWeightDecimalPlaces,
    maxAllowedWeightingValues: guardrails.maxAllowedWeightingValues,
    supportedMeasurementTypes: guardrails.supportedMeasurementTypes,
    maxTemplateTitleLength: guardrails.maxTemplateTitleLength,
    maxTemplateDescriptionLength: guardrails.maxTemplateDescriptionLength,
    maxTemplateTags: guardrails.maxTemplateTags,
  };
}

function validateGuardrails(form: ApplyGuardrailsRequest) {
  const issues: string[] = [];

  if (form.minObjectivesPerPlan > form.maxObjectivesPerPlan) {
    issues.push("Objective range is invalid.");
  }

  if (form.minManagerValidationSlaDays > form.maxManagerValidationSlaDays) {
    issues.push("Review-day range is invalid.");
  }

  return issues;
}
