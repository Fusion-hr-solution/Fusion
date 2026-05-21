"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type {
  CreateDraftOrgUnitRequest,
  DraftOrgUnitDto,
  DraftStructureSchemaDto,
  UpdateDraftOrgUnitRequest,
} from "@repo/api";
import { ApiError } from "@repo/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { toast } from "sonner";
import { DraftOrgUnitKindManager } from "./draft-org-unit-kind-manager";
import {
  buildDraftOrgUnitKindKey,
  createDraftOrgUnitFormValues,
  DraftStructureAttributeFields,
  formatUnitOptionLabel,
  sanitizeDraftAttributes,
} from "./draft-structure-form-utils";
import type { DraftOrgUnitFormValues } from "./draft-structure-form-utils";
import {
  useCreateDraftOrgUnit,
  useDeleteDraftOrgUnit,
  useUpdateDraftOrgUnit,
} from "./use-draft-structure";

const ROOT_VALUE = "__root__";

interface DraftUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated?: () => void;
  onSchemaUpdated?: () => void;
  readOnly?: boolean;
  schema: DraftStructureSchemaDto;
  existingUnits: DraftOrgUnitDto[];
  initialParentId?: string | null;
  unit?: DraftOrgUnitDto | null;
}

function getDescendantIds(
  unitId: string,
  units: DraftOrgUnitDto[],
  descendantIds = new Set<string>()
): Set<string> {
  const children = units.filter((unit) => unit.parentId === unitId);

  for (const child of children) {
    if (!descendantIds.has(child.id)) {
      descendantIds.add(child.id);
      getDescendantIds(child.id, units, descendantIds);
    }
  }

  return descendantIds;
}

function buildDefaultValues(
  schema: DraftStructureSchemaDto,
  initialParentId: string | null | undefined,
  unit?: DraftOrgUnitDto | null
): DraftOrgUnitFormValues {
  if (unit) {
    return createDraftOrgUnitFormValues(schema, unit);
  }

  return {
    ...createDraftOrgUnitFormValues(schema),
    parentId: initialParentId ?? null,
  };
}

export function DraftUnitDialog({
  open,
  onOpenChange,
  onMutated,
  onSchemaUpdated,
  readOnly = false,
  schema,
  existingUnits,
  initialParentId,
  unit,
}: DraftUnitDialogProps) {
  const isEditMode = !!unit;

  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStrategy, setDeleteStrategy] = useState<string>("");
  const [editableSchema, setEditableSchema] = useState(schema);
  const schemaRef = useRef(schema);
  const editableSchemaRef = useRef(editableSchema);

  const initialParent =
    existingUnits.find((u) => u.id === initialParentId) ?? null;
  const dialogTitle = isEditMode
    ? `Edit ${unit.displayName}`
    : initialParent
      ? "Add child unit"
      : "Add top-level unit";
  const dialogDescription = isEditMode
    ? "Edit this unit in the draft. Live structure changes only after publish."
    : initialParent
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
    defaultValues: buildDefaultValues(schema, initialParentId, unit),
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
    reset(buildDefaultValues(open ? editableSchemaRef.current : schemaRef.current, initialParentId, unit));
    setServerError(null);
    setDeleteOpen(false);
    setDeleteStrategy("");
  }, [open, reset, initialParentId, unit?.id, unit?.version]);

  const descendantIds = useMemo(
    () => (unit ? getDescendantIds(unit.id, existingUnits) : new Set<string>()),
    [existingUnits, unit]
  );

  const parentCandidates = useMemo(
    () =>
      isEditMode && unit
        ? existingUnits.filter(
            (candidate) =>
              candidate.id !== unit.id && !descendantIds.has(candidate.id)
          )
        : existingUnits,
    [descendantIds, existingUnits, isEditMode, unit]
  );

  const childUnits = useMemo(
    () => existingUnits.filter((candidate) => candidate.parentId === unit?.id),
    [existingUnits, unit?.id]
  );

  const create = useCreateDraftOrgUnit({
    onSuccess: (data) => {
      toast.success(`Unit "${data.displayName}" created`);
      setServerError(null);
      onOpenChange(false);
      onMutated?.();
    },
  });

  const update = useUpdateDraftOrgUnit({
    onSuccess: (data) => {
      toast.success(`Unit "${data.displayName}" updated`);
      setServerError(null);
      onMutated?.();
    },
  });

  const remove = useDeleteDraftOrgUnit({
    onSuccess: () => {
      toast.success(`Unit "${unit?.displayName}" deleted`);
      setDeleteOpen(false);
      setDeleteStrategy("");
      onOpenChange(false);
      onMutated?.();
    },
  });

  const onSubmit = async (values: DraftOrgUnitFormValues) => {
    if (readOnly) {
      return;
    }

    setServerError(null);

    const payload = {
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

    try {
      if (isEditMode) {
        await update.mutateAsync({
          id: unit.id,
          version: unit.version,
          input: payload as UpdateDraftOrgUnitRequest,
        });
      } else {
        await create.mutateAsync(payload as CreateDraftOrgUnitRequest);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.errors.join(", "));
      } else {
        setServerError("An unexpected error occurred.");
      }
    }
  };

  const handleDelete = async () => {
    if (readOnly || !unit) {
      return;
    }

    if (childUnits.length > 0 && !deleteStrategy) {
      return;
    }

    try {
      await remove.mutateAsync({
        id: unit.id,
        version: unit.version,
        replacementParentId:
          deleteStrategy && deleteStrategy !== ROOT_VALUE
            ? deleteStrategy
            : undefined,
        promoteChildrenToRoot: deleteStrategy === ROOT_VALUE,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.errors.join(", "));
      } else {
        setServerError("An unexpected error occurred.");
      }
      setDeleteOpen(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset(buildDefaultValues(schema, initialParentId));
      setEditableSchema(schema);
      setServerError(null);
      setDeleteOpen(false);
      setDeleteStrategy("");
    }

    onOpenChange(nextOpen);
  };

  const isMutating = create.isLoading || update.isLoading || remove.isLoading;

  return (
    <>
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
              {isEditMode ? (
                <section className="space-y-2 text-sm text-muted-foreground">
                  <p>Unit code: {unit.referenceKey}</p>
                  <p>
                    Parent unit: {unit.parentDisplayName ?? "Organization root"}
                  </p>
                </section>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="draft-reference-key">Unit Code</Label>
                <Input
                  id="draft-reference-key"
                  placeholder="ENG"
                  disabled={readOnly}
                  {...register("referenceKey", {
                    required: "Unit code is required",
                    maxLength: {
                      value: 150,
                      message: "Maximum 150 characters",
                    },
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
                    maxLength: {
                      value: 200,
                      message: "Maximum 200 characters",
                    },
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
                        {parentCandidates.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {formatUnitOptionLabel(candidate)}
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
              ) : isEditMode ? (
                <div className="flex w-full items-center justify-between">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isMutating}
                  >
                    Delete Unit
                  </Button>
                  <Button type="submit" disabled={isMutating}>
                    {update.isLoading ? <Spinner className="mr-1" /> : null}
                    Save Changes
                  </Button>
                </div>
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

      <AlertDialog open={!readOnly && deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete structure item?</AlertDialogTitle>
            <AlertDialogDescription>
              {childUnits.length > 0
                ? "Choose what happens to its children."
                : "Removes this unit."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {childUnits.length > 0 ? (
            <div className="grid gap-2">
              <Label>Child handling</Label>
              <Select
                value={deleteStrategy}
                onValueChange={setDeleteStrategy}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a replacement parent or promote to root" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_VALUE}>
                    Promote children to root
                  </SelectItem>
                  {parentCandidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      Reparent to {formatUnitOptionLabel(candidate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                remove.isLoading ||
                (childUnits.length > 0 && !deleteStrategy)
              }
              onClick={handleDelete}
            >
              {remove.isLoading ? <Spinner className="mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
