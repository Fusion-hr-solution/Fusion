"use client";

import { useEffect, useState } from "react";
import type {
  EmployeeObjectiveDto,
  EmployeeObjectivePlanWorkspaceDto,
  ObjectiveAlignmentType,
  SaveEmployeeObjectiveRequest,
} from "@repo/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { measurementMethodLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { objectiveEditorTerms } from "./my-objectives-terms";

export type ObjectiveEditorState =
  | { mode: "create" }
  | { mode: "edit"; objective: EmployeeObjectiveDto };

type EditorForm = {
  title: string;
  description: string;
  alignmentKey: string;
  weight: string;
  deadline: string;
  measurementMethod: string;
  measurementIndicator: string;
  targetValue: string;
  targetUnit: string;
  successCriteria: string;
};

function emptyForm(workspace: EmployeeObjectivePlanWorkspaceDto): EditorForm {
  return {
    title: "",
    description: "",
    alignmentKey: "",
    weight: "",
    deadline: "",
    measurementMethod:
      workspace.enabledMeasurementMethods.length === 1
        ? workspace.enabledMeasurementMethods[0]!
        : "",
    measurementIndicator: "",
    targetValue: "",
    targetUnit: "",
    successCriteria: "",
  };
}

function fromObjective(objective: EmployeeObjectiveDto): EditorForm {
  return {
    title: objective.title,
    description: objective.description ?? "",
    alignmentKey:
      objective.alignmentType && objective.alignmentTargetId
        ? `${objective.alignmentType}:${objective.alignmentTargetId}`
        : "",
    weight: objective.weight?.toString() ?? "",
    deadline: toDateInput(objective.deadline),
    measurementMethod: objective.measurementMethod ?? "",
    measurementIndicator: objective.measurementIndicator ?? "",
    targetValue: objective.targetValue ?? "",
    targetUnit: objective.targetUnit ?? "",
    successCriteria: objective.successCriteria ?? "",
  };
}

function toRequest(form: EditorForm): SaveEmployeeObjectiveRequest {
  const [alignmentType, alignmentTargetId] = form.alignmentKey
    ? form.alignmentKey.split(":")
    : [null, null];
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    alignmentType: (alignmentType as ObjectiveAlignmentType | null) ?? null,
    alignmentTargetId: alignmentTargetId || null,
    weight: form.weight ? Number(form.weight) : null,
    deadline: form.deadline ? new Date(`${form.deadline}T00:00:00Z`).toISOString() : null,
    measurementMethod: form.measurementMethod || null,
    measurementIndicator: form.measurementIndicator.trim() || null,
    targetValue: form.targetValue.trim() || null,
    targetUnit: form.targetUnit.trim() || null,
    successCriteria: form.successCriteria.trim() || null,
  };
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Create/edit an objective in a focused modal — the same editing surface pattern as the
 * manager team-objective editor, so authoring feels like one product. The weight menu is
 * budget-aware: it shows what each choice leaves toward the plan's remaining 100%.
 */
export function ObjectiveEditorDialog({
  state,
  workspace,
  /** Weight already committed to other objectives — the budget this objective competes for. */
  weightSpentElsewhere,
  isSaving,
  errors,
  onSubmit,
  onClose,
}: {
  state: ObjectiveEditorState | null;
  workspace: EmployeeObjectivePlanWorkspaceDto;
  weightSpentElsewhere: number;
  isSaving: boolean;
  errors: string[];
  onSubmit: (request: SaveEmployeeObjectiveRequest) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EditorForm | null>(null);

  // Seed the form only when a new editing session opens — never while the user types,
  // so a failed save preserves entered values.
  useEffect(() => {
    if (!state) {
      setForm(null);
      return;
    }
    setForm(state.mode === "edit" ? fromObjective(state.objective) : emptyForm(workspace));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state || !form) {
    return null;
  }

  const isCreate = state.mode === "create";
  const quantitative = form.measurementMethod === "Quantitative";
  const qualitative = form.measurementMethod === "Qualitative";
  const budget = Math.max(0, 100 - weightSpentElsewhere);
  const selectedWeight = form.weight ? Number(form.weight) : 0;
  const leaves = budget - selectedWeight;

  const missing = !form.title.trim();

  const teamOptions = workspace.alignmentOptions.filter((option) => option.type === "TeamObjective");
  const strategyOptions = workspace.alignmentOptions.filter(
    (option) => option.type === "StrategicObjective",
  );

  return (
    <Dialog open onOpenChange={(open) => (!open && !isSaving ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isCreate ? objectiveEditorTerms.createTitle : objectiveEditorTerms.editTitle}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!missing && !isSaving) onSubmit(toRequest(form));
          }}
        >
          {errors.length > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="objective-title">{objectiveEditorTerms.titleLabel}</Label>
            <Input
              id="objective-title"
              value={form.title}
              maxLength={150}
              disabled={isSaving}
              placeholder={objectiveEditorTerms.titlePlaceholder}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objective-alignment">{objectiveEditorTerms.alignmentLabel}</Label>
            <NativeSelect
              id="objective-alignment"
              className="w-full"
              value={form.alignmentKey}
              disabled={isSaving}
              onChange={(event) => setForm({ ...form, alignmentKey: event.target.value })}
            >
              <option value="">{objectiveEditorTerms.alignmentPlaceholder}</option>
              {teamOptions.length > 0 ? (
                <optgroup label={objectiveEditorTerms.alignmentTeamGroup}>
                  {teamOptions.map((option) => (
                    <option key={`${option.type}:${option.targetId}`} value={`${option.type}:${option.targetId}`}>
                      {option.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {strategyOptions.length > 0 ? (
                <optgroup label={objectiveEditorTerms.alignmentStrategyGroup}>
                  {strategyOptions.map((option) => (
                    <option key={`${option.type}:${option.targetId}`} value={`${option.type}:${option.targetId}`}>
                      {option.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </NativeSelect>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>{objectiveEditorTerms.weightLabel}</Label>
                {form.weight ? (
                  <span
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      leaves < 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {leaves < 0
                      ? objectiveEditorTerms.weightOver(-leaves)
                      : objectiveEditorTerms.weightLeaves(leaves)}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {workspace.allowedWeights.map((weight) => {
                  const selected = form.weight === String(weight);
                  const overflows = weight > budget;
                  return (
                    <button
                      key={weight}
                      type="button"
                      disabled={isSaving}
                      aria-pressed={selected}
                      onClick={() => setForm({ ...form, weight: String(weight) })}
                      className={cn(
                        "h-9 min-w-11 rounded-lg border px-2.5 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : overflows
                            ? "border-dashed border-destructive/40 bg-background text-muted-foreground hover:border-destructive/60"
                            : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      {weight}%
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective-deadline">{objectiveEditorTerms.deadlineLabel}</Label>
              <Input
                id="objective-deadline"
                type="date"
                value={form.deadline}
                disabled={isSaving}
                onChange={(event) => setForm({ ...form, deadline: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{objectiveEditorTerms.measurementLabel}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={2}
              value={form.measurementMethod}
              disabled={isSaving}
              onValueChange={(value) =>
                value ? setForm({ ...form, measurementMethod: value }) : undefined
              }
              className="flex w-full flex-wrap"
              aria-label={objectiveEditorTerms.measurementLabel}
            >
              {workspace.enabledMeasurementMethods.map((method) => (
                <ToggleGroupItem key={method} value={method} className="min-h-9 rounded-full px-3">
                  {measurementMethodLabel(method)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {quantitative ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label htmlFor="objective-indicator">{objectiveEditorTerms.indicatorLabel}</Label>
                <Input
                  id="objective-indicator"
                  value={form.measurementIndicator}
                  disabled={isSaving}
                  placeholder={objectiveEditorTerms.indicatorPlaceholder}
                  onChange={(event) => setForm({ ...form, measurementIndicator: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objective-target">{objectiveEditorTerms.targetLabel}</Label>
                <Input
                  id="objective-target"
                  value={form.targetValue}
                  disabled={isSaving}
                  placeholder={objectiveEditorTerms.targetPlaceholder}
                  onChange={(event) => setForm({ ...form, targetValue: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objective-unit">{objectiveEditorTerms.unitLabel}</Label>
                <Input
                  id="objective-unit"
                  value={form.targetUnit}
                  disabled={isSaving}
                  placeholder={objectiveEditorTerms.unitPlaceholder}
                  onChange={(event) => setForm({ ...form, targetUnit: event.target.value })}
                />
              </div>
            </div>
          ) : null}

          {qualitative ? (
            <div className="space-y-2">
              <Label htmlFor="objective-success">{objectiveEditorTerms.successLabel}</Label>
              <Textarea
                id="objective-success"
                value={form.successCriteria}
                maxLength={500}
                rows={2}
                disabled={isSaving}
                placeholder={objectiveEditorTerms.successPlaceholder}
                onChange={(event) => setForm({ ...form, successCriteria: event.target.value })}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="objective-context">{objectiveEditorTerms.contextLabel}</Label>
            <Textarea
              id="objective-context"
              value={form.description}
              maxLength={500}
              rows={2}
              disabled={isSaving}
              placeholder={objectiveEditorTerms.contextPlaceholder}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={isSaving} onClick={onClose}>
              {objectiveEditorTerms.cancel}
            </Button>
            <Button type="submit" disabled={missing || isSaving}>
              {isSaving ? (
                <>
                  <Spinner /> {objectiveEditorTerms.saving}
                </>
              ) : (
                objectiveEditorTerms.save
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
