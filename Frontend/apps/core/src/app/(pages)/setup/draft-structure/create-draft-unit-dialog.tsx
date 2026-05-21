"use client";

import { useEffect, useRef, useState } from "react";
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
  buildDraftOrgUnitKindKey,
  createDraftOrgUnitFormValues,
  DraftStructureAttributeFields,
  formatUnitOptionLabel,
  sanitizeDraftAttributes,
} from "./draft-structure-form-utils";
import { DraftOrgUnitKindManager } from "./draft-org-unit-kind-manager";
import { useCreateDraftOrgUnit } from "./use-draft-structure";

const ROOT_VALUE = "__root__";

interface CreateDraftUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (unit: DraftOrgUnitDto) => void;
  onSchemaUpdated?: () => void;
  readOnly?: boolean;
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
  onSchemaUpdated,
  readOnly = false,
  schema,
  existingUnits,
  initialParentId,
}: CreateDraftUnitDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [editableSchema, setEditableSchema] = useState(schema);
  const schemaRef = useRef(schema);
  const editableSchemaRef = useRef(editableSchema);
  const initialParent =
    existingUnits.find((unit) => unit.id === initialParentId) ?? null;
  const dialogTitle = initialParent ? "Add child unit" : "Add top-level unit";
  const dialogDescription = initialParent
    ? `Start a new unit under ${initialParent.displayName}. You can still change the parent here.`
    : "Start a new top-level unit in the draft structure.";

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DraftOrgUnitFormValues>({
    defaultValues: buildDefaultValues(schema, initialParentId),
  });

  const selectedKindKey = watch("orgUnitKindKey");

  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  useEffect(() => {
    editableSchemaRef.current = editableSchema;
  }, [editableSchema]);

  useEffect(() => {
    if (!open) {
      setEditableSchema(schema);
    }
  }, [open, schema]);

  useEffect(() => {
    reset(
      buildDefaultValues(
        open ? editableSchemaRef.current : schemaRef.current,
        initialParentId
      )
    );
  }, [initialParentId, open, reset]);

  const create = useCreateDraftOrgUnit({
    onSuccess: (data) => {
      toast.success(`Unit "${data.displayName}" created`);
      setServerError(null);
      onOpenChange(false);
      onCreated?.(data);
    },
  });

  const onSubmit = async (values: DraftOrgUnitFormValues) => {
    if (readOnly) {
      return;
    }

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
          editableSchema,
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
      setEditableSchema(schema);
      setServerError(null);
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex h-[min(90vh,52rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b p-6 pr-14">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="grid gap-2">
              <Label htmlFor="draft-reference-key">Unit Code</Label>
              <Input
                id="draft-reference-key"
                placeholder="ENG"
                disabled={readOnly}
                {...register("referenceKey", {
                  required: "Unit code is required",
                  maxLength: { value: 150, message: "Maximum 150 characters" },
                })}
              />
              {errors.referenceKey ? (
                <p className="text-sm text-destructive">
                  {errors.referenceKey.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="draft-display-name">Unit Name</Label>
              <Input
                id="draft-display-name"
                placeholder="Engineering"
                disabled={readOnly}
                {...register("displayName", {
                  required: "Unit name is required",
                  maxLength: { value: 200, message: "Maximum 200 characters" },
                })}
              />
              {errors.displayName ? (
                <p className="text-sm text-destructive">
                  {errors.displayName.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Unit Type</Label>
                <DraftOrgUnitKindManager
                  schema={editableSchema}
                  existingUnits={existingUnits}
                  currentKindKey={selectedKindKey}
                  disabled={readOnly}
                  onSchemaUpdated={(nextSchema) => {
                    setEditableSchema(nextSchema);
                    if (
                      !nextSchema.orgUnitKinds.some(
                        (kind) => kind.key === selectedKindKey
                      )
                    ) {
                      setValue(
                        "orgUnitKindKey",
                        nextSchema.orgUnitKinds[0]?.key ??
                          buildDraftOrgUnitKindKey("")
                      );
                    }
                    onSchemaUpdated?.();
                  }}
                  triggerVariant="ghost"
                />
              </div>
              <Controller
                control={control}
                name="orgUnitKindKey"
                rules={{ required: "Unit type is required" }}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a unit type" />
                    </SelectTrigger>
                    <SelectContent>
                      {editableSchema.orgUnitKinds.map((kind) => (
                        <SelectItem key={kind.key} value={kind.key}>
                          {kind.displayLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.orgUnitKindKey ? (
                <p className="text-sm text-destructive">
                  {errors.orgUnitKindKey.message}
                </p>
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
                    disabled={readOnly}
                    onValueChange={(value) => {
                      field.onChange(value === ROOT_VALUE ? null : value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a parent unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ROOT_VALUE}>
                        Organization root
                      </SelectItem>
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
              <p className="mb-4 text-sm font-medium">Supporting details</p>

              <div className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="draft-location">Location</Label>
                    <Input
                      id="draft-location"
                      placeholder="Dubai HQ"
                      disabled={readOnly}
                      {...register("location", {
                        maxLength: {
                          value: 100,
                          message: "Maximum 100 characters",
                        },
                      })}
                    />
                    {errors.location ? (
                      <p className="text-sm text-destructive">
                        {errors.location.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="draft-description">Description</Label>
                  <Textarea
                    id="draft-description"
                    placeholder="Optional notes"
                    rows={3}
                    disabled={readOnly}
                    {...register("description", {
                      maxLength: {
                        value: 500,
                        message: "Maximum 500 characters",
                      },
                    })}
                  />
                  {errors.description ? (
                    <p className="text-sm text-destructive">
                      {errors.description.message}
                    </p>
                  ) : null}
                </div>

                <DraftStructureAttributeFields
                  schema={editableSchema}
                  selectedKindKey={selectedKindKey}
                  control={control}
                  errors={errors}
                  disabled={readOnly}
                />
              </div>
            </div>

            {serverError ? (
              <p className="text-sm text-destructive">{serverError}</p>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 px-6 py-4">
            {readOnly ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Close
              </Button>
            ) : (
              <Button type="submit" disabled={create.isLoading}>
                {create.isLoading ? <Spinner className="mr-1" /> : null}
                Add unit
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
