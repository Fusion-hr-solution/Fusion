"use client";

import { useEffect, useState } from "react";
import type {
  TeamObjectiveDto,
  TeamObjectiveWorkspaceDto,
  UpsertTeamObjectiveRequest,
} from "@repo/api";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { measurementMethodLabel } from "@/lib/labels";
import { teamObjectiveEditor } from "@/components/campaigns/campaign-terminology";

export type TeamObjectiveEditorState = {
  mode: "create" | "edit";
  /** Present when editing. */
  objective?: TeamObjectiveDto;
  /** Preselected strategy pillar when launched from a pillar band. */
  strategicObjectiveId?: string;
};

type EditorForm = {
  strategicObjectiveId: string;
  title: string;
  successCriteria: string;
  measurementMethod: string;
  description: string;
};

function initialForm(
  state: TeamObjectiveEditorState,
  workspace: TeamObjectiveWorkspaceDto,
): EditorForm {
  if (state.mode === "edit" && state.objective) {
    return {
      strategicObjectiveId: state.objective.strategicObjectiveId,
      title: state.objective.title,
      successCriteria: state.objective.successCriteria,
      measurementMethod: state.objective.measurementMethod,
      description: state.objective.description ?? "",
    };
  }

  return {
    strategicObjectiveId:
      state.strategicObjectiveId ?? workspace.strategicObjectives[0]?.id ?? "",
    title: "",
    successCriteria: "",
    measurementMethod:
      workspace.enabledMeasurementMethods.length === 1
        ? workspace.enabledMeasurementMethods[0]!
        : "",
    description: "",
  };
}

export function TeamObjectiveEditorDialog({
  state,
  workspace,
  isSaving,
  errors,
  onSubmit,
  onClose,
}: {
  state: TeamObjectiveEditorState | null;
  workspace: TeamObjectiveWorkspaceDto;
  isSaving: boolean;
  errors: string[];
  onSubmit: (request: UpsertTeamObjectiveRequest) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EditorForm | null>(null);

  // (Re)seed the form only when a new editing session opens — never while the user types,
  // so failures preserve entered values.
  useEffect(() => {
    setForm(state ? initialForm(state, workspace) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state || !form) {
    return null;
  }

  const isCreate = state.mode === "create";
  const missing =
    !form.strategicObjectiveId ||
    !form.title.trim() ||
    !form.successCriteria.trim() ||
    !form.measurementMethod;

  const submit = () => {
    onSubmit({
      strategicObjectiveId: form.strategicObjectiveId,
      title: form.title.trim(),
      successCriteria: form.successCriteria.trim(),
      measurementMethod: form.measurementMethod,
      description: form.description.trim() ? form.description.trim() : null,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => (!open && !isSaving ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isCreate ? teamObjectiveEditor.createTitle : teamObjectiveEditor.editTitle}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!missing && !isSaving) submit();
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
            <Label htmlFor="team-objective-pillar">{teamObjectiveEditor.strategicLabel}</Label>
            <NativeSelect
              id="team-objective-pillar"
              className="w-full"
              value={form.strategicObjectiveId}
              disabled={isSaving}
              onChange={(event) =>
                setForm({ ...form, strategicObjectiveId: event.target.value })
              }
            >
              {workspace.strategicObjectives.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.title}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-objective-title">{teamObjectiveEditor.titleLabel}</Label>
            <Input
              id="team-objective-title"
              value={form.title}
              maxLength={200}
              disabled={isSaving}
              placeholder={teamObjectiveEditor.titlePlaceholder}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-objective-success">
              {teamObjectiveEditor.successCriteriaLabel}
            </Label>
            <Textarea
              id="team-objective-success"
              value={form.successCriteria}
              maxLength={500}
              rows={2}
              disabled={isSaving}
              placeholder={teamObjectiveEditor.successCriteriaPlaceholder}
              onChange={(event) => setForm({ ...form, successCriteria: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>{teamObjectiveEditor.measurementLabel}</Label>
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
              aria-label={teamObjectiveEditor.measurementLabel}
            >
              {workspace.enabledMeasurementMethods.map((method) => (
                <ToggleGroupItem
                  key={method}
                  value={method}
                  className="min-h-9 rounded-full px-3"
                >
                  {measurementMethodLabel(method)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-objective-description">
              {teamObjectiveEditor.descriptionLabel}
            </Label>
            <Textarea
              id="team-objective-description"
              value={form.description}
              maxLength={2000}
              rows={3}
              disabled={isSaving}
              placeholder={teamObjectiveEditor.descriptionPlaceholder}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={isSaving} onClick={onClose}>
              {teamObjectiveEditor.cancel}
            </Button>
            <Button type="submit" disabled={missing || isSaving}>
              {isSaving ? (
                <>
                  <Spinner /> {teamObjectiveEditor.submitting}
                </>
              ) : isCreate ? (
                teamObjectiveEditor.submitCreate
              ) : (
                teamObjectiveEditor.submitEdit
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
