"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { PlatformConfigurationImpactDto } from "@repo/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export function ConfigurationCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader density="compact">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent density="compact" className="grid gap-4">
        {children}
      </CardContent>
    </Card>
  );
}

export function CountSlider({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-sm font-medium tabular-nums">
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        onValueChange={([next]) => {
          if (typeof next === "number") {
            onChange(next);
          }
        }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function WeightChoices({
  label,
  description,
  choices,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  choices: number[];
  value: number[];
  disabled: boolean;
  onChange: (weights: number[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>{label}</Label>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {choices.map((weight) => {
          const selected = value.includes(weight);
          return (
            <Button
              key={weight}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              disabled={disabled}
              onClick={() =>
                onChange(
                  selected
                    ? value.filter((item) => item !== weight)
                    : [...value, weight].sort((a, b) => a - b),
                )
              }
            >
              {weight}%
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function MeasurementChoices({
  quantitative,
  qualitative,
  quantitativeLabel = "Quantitative",
  qualitativeLabel = "Qualitative",
  disabled,
  quantitativeDisabled,
  qualitativeDisabled,
  onChange,
}: {
  quantitative: boolean;
  qualitative: boolean;
  quantitativeLabel?: string;
  qualitativeLabel?: string;
  disabled: boolean;
  quantitativeDisabled?: boolean;
  qualitativeDisabled?: boolean;
  onChange: (quantitative: boolean, qualitative: boolean) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ToggleRow
        label={quantitativeLabel}
        checked={quantitative}
        disabled={disabled || quantitativeDisabled}
        onChange={(checked) => onChange(checked, qualitative)}
      />
      <ToggleRow
        label={qualitativeLabel}
        checked={qualitative}
        disabled={disabled || qualitativeDisabled}
        onChange={(checked) => onChange(quantitative, checked)}
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
      <Label>{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Single apply surface shared by both configuration screens. It presents the three
 * outcomes consistently:
 *  - "Can't apply yet": blocking reasons, from local pre-checks or the server's blocked
 *    result (same wording either way). Local reasons take precedence so instant feedback wins.
 *  - "Impact blocked": platform-only, when existing tenant configs fall outside new limits.
 *  - "Apply failed": reserved for transport/unexpected errors and stale conflicts.
 */
export function ConfigurationApplyPanel({
  localErrors,
  serverErrors = [],
  impact = null,
  applyError,
  isApplying,
  isDirty,
  canApply,
  onApply,
  dirtyHint,
}: {
  localErrors: string[];
  serverErrors?: string[];
  impact?: PlatformConfigurationImpactDto | null;
  applyError: string | null;
  isApplying: boolean;
  isDirty: boolean;
  canApply: boolean;
  onApply: () => void;
  dirtyHint: string;
}) {
  const blockingReasons = localErrors.length > 0 ? localErrors : serverErrors;

  return (
    <Card size="sm">
      <CardContent density="compact" className="space-y-3">
        {applyError ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Apply failed</AlertTitle>
            <AlertDescription>{applyError}</AlertDescription>
          </Alert>
        ) : null}
        {blockingReasons.length > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Can&apos;t apply yet</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {blockingReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {impact ? (
          <Alert>
            <AlertTriangle />
            <AlertTitle>Existing tenants affected</AlertTitle>
            <AlertDescription>
              {impact.affectedTenantConfigurationCount
                ? `${impact.affectedTenantConfigurationCount} tenant configuration(s) are outside these limits.`
                : "These limits cannot be applied as entered."}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isDirty ? dirtyHint : "No unapplied changes."}
          </p>
          <Button size="sm" onClick={onApply} disabled={!canApply}>
            {isApplying ? "Applying..." : "Apply changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
