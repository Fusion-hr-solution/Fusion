"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { addPart, updatePart } from "@/services/admin-sessions-service";
import type { AdminTrainingPart, CreatePartInput } from "@/types/admin";

interface PartFormDialogProps {
  trainingId: string;
  part: AdminTrainingPart | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function PartFormDialog({
  trainingId,
  part,
  open,
  onOpenChange,
  onSaved,
}: PartFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationHours, setDurationHours] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!part;

  useEffect(() => {
    if (open) {
      setTitle(part?.title ?? "");
      setDescription(part?.description ?? "");
      setDurationHours(String(part?.durationHours ?? 1));
      setError(null);
    }
  }, [open, part]);

  const { mutateAsync: doAdd, isLoading: addingPending } = useApiMutation(
    (input: CreatePartInput) => addPart(trainingId, input),
    { onSuccess: () => { onSaved(); onOpenChange(false); } },
  );

  const { mutateAsync: doUpdate, isLoading: updatingPending } = useApiMutation(
    (input: CreatePartInput) => updatePart(trainingId, part!.id, input),
    { onSuccess: () => { onSaved(); onOpenChange(false); } },
  );

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const hours = Number(durationHours);
    if (!Number.isFinite(hours) || hours < 0) {
      setError("Duration must be a non-negative number.");
      return;
    }
    const input: CreatePartInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      durationHours: hours,
    };
    try {
      if (isEditing) await doUpdate(input);
      else await doAdd(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save part.");
    }
  }

  const isLoading = addingPending || updatingPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Part" : "Add Part"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="partTitle">Title *</Label>
            <Input
              id="partTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              placeholder="e.g. Foundations"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partDescription">Description</Label>
            <Input
              id="partDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Optional summary"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partDuration">Duration (hours)</Label>
            <Input
              id="partDuration"
              type="number"
              min={0}
              step={0.5}
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : isEditing ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
