"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@repo/ui";
import type { CreateObjectiveTemplateRequest, ObjectiveTemplateDto } from "@repo/api";

export interface ObjectiveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ObjectiveTemplateDto | null;
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: CreateObjectiveTemplateRequest) => void;
}

export function ObjectiveTemplateDialog({
  open,
  onOpenChange,
  template,
  submitting,
  errorMessage,
  onSubmit,
}: ObjectiveTemplateDialogProps) {
  const isEdit = !!template;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [weight, setWeight] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setDescription(template?.description ?? "");
    setCategory(template?.category ?? "");
    setWeight(template?.defaultWeight != null ? String(template.defaultWeight) : "");
    setValidation(null);
  }, [open, template]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setValidation("Name is required.");
      return;
    }
    let weightValue: number | null = null;
    if (weight.trim()) {
      const parsed = Number(weight);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        setValidation("Default weight must be between 0 and 100.");
        return;
      }
      weightValue = parsed;
    }
    setValidation(null);
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      defaultWeight: weightValue,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit objective template" : "New objective template"}</DialogTitle>
          <DialogDescription>
            Reusable objective definitions HR maintains for use in performance planning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tmpl-name">Name</Label>
            <Input id="tmpl-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tmpl-description">Description</Label>
            <Input
              id="tmpl-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tmpl-category">Category</Label>
              <Input
                id="tmpl-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tmpl-weight">Default weight (%)</Label>
              <Input
                id="tmpl-weight"
                type="number"
                min={0}
                max={100}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          {(validation || errorMessage) && (
            <p className="text-sm text-destructive">{validation ?? errorMessage}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
