"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type {
  AgreedActionInput,
  CheckInDetailDto,
  CompleteCheckInRequest,
  FollowUpActionOwnerKind,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { checkInTerms } from "./check-in-terms";

type DraftAction = {
  key: string;
  description: string;
  ownerKind: FollowUpActionOwnerKind;
  dueDate: string;
  linkedObjectiveId: string | null;
};

export function CompleteCheckInDialog({
  open,
  checkIn,
  isSaving,
  errors,
  onSubmit,
  onClose,
}: {
  open: boolean;
  checkIn: CheckInDetailDto;
  isSaving: boolean;
  errors: string[];
  onSubmit: (request: CompleteCheckInRequest) => void;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [discussed, setDiscussed] = useState<string[]>([]);
  const [actions, setActions] = useState<DraftAction[]>([]);

  useEffect(() => {
    if (open) {
      setSummary("");
      setDiscussed(checkIn.linkedObjectives.map((objective) => objective.objectiveId));
      setActions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit = useMemo(() => {
    if (isSaving || summary.trim().length === 0) return false;
    return actions.every(
      (action) => action.description.trim().length > 0 && action.dueDate.length > 0,
    );
  }, [isSaving, summary, actions]);

  const toggleDiscussed = (id: string) =>
    setDiscussed((list) =>
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
    );

  const addAction = () =>
    setActions((list) => [
      ...list,
      {
        key: crypto.randomUUID(),
        description: "",
        ownerKind: "Employee",
        dueDate: "",
        linkedObjectiveId: null,
      },
    ]);

  const updateAction = (key: string, patch: Partial<DraftAction>) =>
    setActions((list) =>
      list.map((action) => (action.key === key ? { ...action, ...patch } : action)),
    );

  const removeAction = (key: string) =>
    setActions((list) => list.filter((action) => action.key !== key));

  const submit = () => {
    const mapped: AgreedActionInput[] = actions.map((action) => ({
      description: action.description.trim(),
      ownerKind: action.ownerKind,
      dueDate: new Date(`${action.dueDate}T00:00:00`).toISOString(),
      linkedObjectiveId: action.linkedObjectiveId,
    }));
    onSubmit({
      expectedVersion: checkIn.version,
      summary: summary.trim(),
      discussedObjectiveIds: discussed.length > 0 ? discussed : null,
      actions: mapped.length > 0 ? mapped : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{checkInTerms.completeTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="complete-summary">{checkInTerms.summaryLabel}</Label>
            <Textarea
              id="complete-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder={checkInTerms.summaryPlaceholder}
              maxLength={4000}
              rows={4}
            />
          </div>

          {checkIn.linkedObjectives.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                {checkInTerms.discussedLabel}
              </legend>
              <div className="space-y-1 rounded-lg border p-2">
                {checkIn.linkedObjectives.map((objective) => (
                  <label
                    key={objective.objectiveId}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={discussed.includes(objective.objectiveId)}
                      onChange={() => toggleDiscussed(objective.objectiveId)}
                      className="size-4 accent-primary"
                    />
                    <span className="truncate text-foreground">
                      {objective.objectiveTitle}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{checkInTerms.agreedActionsLabel}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={addAction}
              >
                <Plus className="size-3.5" />
                {checkInTerms.addAction}
              </Button>
            </div>

            {actions.map((action) => (
              <div key={action.key} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start gap-2">
                  <Input
                    value={action.description}
                    onChange={(event) =>
                      updateAction(action.key, { description: event.target.value })
                    }
                    placeholder={checkInTerms.actionDescriptionPlaceholder}
                    maxLength={1000}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeAction(action.key)}
                    className="mt-2 text-muted-foreground hover:text-foreground"
                    aria-label={checkInTerms.removeAction}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {checkInTerms.actionOwnerLabel}
                    </Label>
                    <Select
                      value={action.ownerKind}
                      onValueChange={(value) =>
                        updateAction(action.key, {
                          ownerKind: value as FollowUpActionOwnerKind,
                        })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Employee">
                          {checkInTerms.ownerYou} (employee)
                        </SelectItem>
                        <SelectItem value="Reviewer">{checkInTerms.ownerManager}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {checkInTerms.actionDueLabel}
                    </Label>
                    <Input
                      type="date"
                      value={action.dueDate}
                      onChange={(event) =>
                        updateAction(action.key, { dueDate: event.target.value })
                      }
                      className="h-9"
                    />
                  </div>
                </div>
                {checkIn.linkedObjectives.length > 0 ? (
                  <Select
                    value={action.linkedObjectiveId ?? "none"}
                    onValueChange={(value) =>
                      updateAction(action.key, {
                        linkedObjectiveId: value === "none" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Link to an objective (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No objective</SelectItem>
                      {checkIn.linkedObjectives.map((objective) => (
                        <SelectItem key={objective.objectiveId} value={objective.objectiveId}>
                          {objective.objectiveTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            ))}
          </div>

          {errors.length > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-inside list-disc space-y-0.5">
                  {errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            {checkInTerms.keep}
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {isSaving ? <Spinner className="size-4" /> : null}
            {isSaving ? checkInTerms.completing : checkInTerms.completeCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
