"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type {
  CreateDraftOrgUnitRequest,
  DraftOrgUnitDto,
  DraftStructureSchemaDto,
} from "@repo/api";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { DraftOrgUnitFormValues } from "./draft-structure-form-utils";
import {
  createDraftOrgUnitFormValues,
  DraftStructureAttributeFields,
  formatUnitOptionLabel,
  sanitizeDraftAttributes,
} from "./draft-structure-form-utils";
import { useCreateDraftOrgUnit } from "./use-draft-structure";

const ROOT_VALUE = "__root__";

interface CreateDraftUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  schema: DraftStructureSchemaDto;
  existingUnits: DraftOrgUnitDto[];
  initialParentId?: string | null;
}

function buildDefaultValues(
  schema: DraftStructureSchemaDto,
  initialParentId: string | null | undefined
): DraftOrgUnitFormValues {
  return {
    ...createDraftOrgUnitFormValues(schema),
    parentId: initialParentId ?? null,
  };
}

export function CreateDraftUnitDialog({
  open,
  onOpenChange,
  onCreated,
  schema,
  existingUnits,
  initialParentId,
}: CreateDraftUnitDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<DraftOrgUnitFormValues>({
    defaultValues: buildDefaultValues(schema, initialParentId),
  });

  const selectedKindKey = watch("orgUnitKindKey");

  useEffect(() => {
    reset(buildDefaultValues(schema, initialParentId));
  }, [initialParentId, open, reset, schema]);

  const create = useCreateDraftOrgUnit({
    onSuccess: (data) => {
      toast.success(`Unit "${data.displayName}" created`);
      setServerError(null);
      onOpenChange(false);
      onCreated();
    },
  });

  const onSubmit = async (values: DraftOrgUnitFormValues) => {
    setServerError(null);

    try {
      const payload: CreateDraftOrgUnitRequest = {
        referenceKey: values.referenceKey.trim(),
        displayName: values.displayName.trim(),
        orgUnitKindKey: values.orgUnitKindKey,
        location: values.location.trim() || null,
        description: values.description.trim() || null,
        parentId: values.parentId || null,
        attributes: sanitizeDraftAttributes(
          schema,
          values.orgUnitKindKey,
          values.attributes
        ),
      };

      await create.mutateAsync(payload);
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.errors.join(", "));
      } else {
        setServerError("An unexpected error occurred.");
      }
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset(buildDefaultValues(schema, initialParentId));
      setServerError(null);
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex h-[min(90vh,52rem)] max-w-[calc(100%-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b p-6 pr-14">
          <DialogTitle>Add unit</DialogTitle>
          <DialogDescription>
            Add a new unit under the draft organization without changing the
            live structure immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="grid gap-2">
              <Label htmlFor="draft-reference-key">Unit Code</Label>
              <Input
                id="draft-reference-key"
                placeholder="engineering-root"
                {...register("referenceKey", {
                  required: "Unit code is required",
                  maxLength: { value: 150, message: "Maximum 150 characters" },
                })}
              />
              {errors.referenceKey ? (
                <p className="text-sm text-destructive">{errors.referenceKey.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="draft-display-name">Unit Name</Label>
              <Input
                id="draft-display-name"
                placeholder="Engineering"
                {...register("displayName", {
                  required: "Unit name is required",
                  maxLength: { value: 200, message: "Maximum 200 characters" },
                })}
              />
              {errors.displayName ? (
                <p className="text-sm text-destructive">{errors.displayName.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Unit Type</Label>
              <Controller
                control={control}
                name="orgUnitKindKey"
                rules={{ required: "Unit type is required" }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a unit type" />
                    </SelectTrigger>
                    <SelectContent>
                      {schema.orgUnitKinds.map((kind) => (
                        <SelectItem key={kind.key} value={kind.key}>
                          {kind.displayLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.orgUnitKindKey ? (
                <p className="text-sm text-destructive">{errors.orgUnitKindKey.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Parent Unit</Label>
              <Controller
                control={control}
                name="parentId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ROOT_VALUE}
                    onValueChange={(value) => {
                      field.onChange(value === ROOT_VALUE ? null : value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a parent unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ROOT_VALUE}>Organization root</SelectItem>
                      {existingUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {formatUnitOptionLabel(unit)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="text-sm font-medium">Optional details</p>
                <p className="text-sm text-muted-foreground">
                  Keep the first pass focused on the hierarchy. Add these details
                  only if they help right now.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="draft-location">Location</Label>
                    <Input
                      id="draft-location"
                      placeholder="Dubai HQ"
                      {...register("location", {
                        maxLength: { value: 100, message: "Maximum 100 characters" },
                      })}
                    />
                    {errors.location ? (
                      <p className="text-sm text-destructive">{errors.location.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="draft-description">Description</Label>
                  <Textarea
                    id="draft-description"
                    placeholder="Optional notes about this unit"
                    rows={3}
                    {...register("description", {
                      maxLength: { value: 500, message: "Maximum 500 characters" },
                    })}
                  />
                  {errors.description ? (
                    <p className="text-sm text-destructive">{errors.description.message}</p>
                  ) : null}
                </div>

                <DraftStructureAttributeFields
                  schema={schema}
                  selectedKindKey={selectedKindKey}
                  control={control}
                  errors={errors}
                />
              </div>
            </div>

            {serverError ? (
              <p className="text-sm text-destructive">{serverError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={create.isLoading}>
              {create.isLoading ? <Spinner className="mr-1" /> : null}
              Add unit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}