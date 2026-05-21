"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type {
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { DraftOrgUnitKindManager } from "./draft-org-unit-kind-manager";
import {
  useDeleteDraftOrgUnit,
  useUpdateDraftOrgUnit,
} from "./use-draft-structure";
import {
  createDraftOrgUnitFormValues,
  DraftStructureAttributeFields,
  formatUnitOptionLabel,
  sanitizeDraftAttributes,
} from "./draft-structure-form-utils";
import type { DraftOrgUnitFormValues } from "./draft-structure-form-utils";

const ROOT_VALUE = "__root__";

interface DraftUnitSheetProps {
  unit: DraftOrgUnitDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated?: () => void;
  onSchemaUpdated?: () => void;
  readOnly?: boolean;
  readOnlyDescription?: string;
  readOnlyNotice?: string;
  schema: DraftStructureSchemaDto;
  existingUnits: DraftOrgUnitDto[];
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

export function DraftUnitSheet({
  unit,
  open,
  onOpenChange,
  onMutated,
  onSchemaUpdated,
  readOnly = false,
  readOnlyDescription = "Review this unit here. Reopen the draft in Setup to make changes.",
  readOnlyNotice = "This unit is read-only in the current setup phase.",
  schema,
  existingUnits,
}: DraftUnitSheetProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStrategy, setDeleteStrategy] = useState<string>("");
  const [editableSchema, setEditableSchema] = useState(schema);
  const schemaRef = useRef(schema);
  const editableSchemaRef = useRef(editableSchema);
  const unitRef = useRef(unit);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DraftOrgUnitFormValues>({
    defaultValues: createDraftOrgUnitFormValues(schema, unit),
  });

  const selectedKindKey = watch("orgUnitKindKey");

  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  useEffect(() => {
    editableSchemaRef.current = editableSchema;
  }, [editableSchema]);

  useEffect(() => {
    unitRef.current = unit;
  }, [unit]);

  useEffect(() => {
    if (!open) {
      setEditableSchema(schema);
    }
  }, [open, schema]);

  useEffect(() => {
    reset(
      createDraftOrgUnitFormValues(
        open ? editableSchemaRef.current : schemaRef.current,
        unitRef.current
      )
    );
    setServerError(null);
    setDeleteOpen(false);
    setDeleteStrategy("");
  }, [open, reset, unit?.id, unit?.version]);

  const descendantIds = useMemo(
    () => (unit ? getDescendantIds(unit.id, existingUnits) : new Set<string>()),
    [existingUnits, unit]
  );

  const parentCandidates = useMemo(
    () =>
      existingUnits.filter(
        (candidate) =>
          candidate.id !== unit?.id && !descendantIds.has(candidate.id)
      ),
    [descendantIds, existingUnits, unit?.id]
  );

  const childUnits = useMemo(
    () => existingUnits.filter((candidate) => candidate.parentId === unit?.id),
    [existingUnits, unit?.id]
  );

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

  if (!unit) {
    return null;
  }

  const onSubmit = async (values: DraftOrgUnitFormValues) => {
    if (readOnly) {
      return;
    }

    setServerError(null);

    try {
      const input: UpdateDraftOrgUnitRequest = {
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

      await update.mutateAsync({
        id: unit.id,
        version: unit.version,
        input,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.errors.join(", "));
      } else {
        setServerError("An unexpected error occurred.");
      }
    }
  };

  const handleDelete = async () => {
    if (readOnly) {
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b pr-14">
            <SheetTitle>{unit.displayName}</SheetTitle>
            <SheetDescription>
              {readOnly
                ? readOnlyDescription
                : "Edit this unit in the draft. Live structure changes only after publish."}
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
              <section className="space-y-2 text-sm text-muted-foreground">
                <p>Unit code: {unit.referenceKey}</p>
                <p>
                  Parent unit: {unit.parentDisplayName ?? "Organization root"}
                </p>
              </section>

              <Separator />

              {readOnly ? (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  {readOnlyNotice}
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="edit-draft-reference-key">Unit Code</Label>
                <Input
                  id="edit-draft-reference-key"
                  disabled={readOnly}
                  {...register("referenceKey", {
                    required: "Unit code is required",
                    maxLength: {
                      value: 150,
                      message: "Maximum 150 characters",
                    },
                  })}
                />
                {errors.referenceKey && (
                  <p className="text-sm text-destructive">
                    {errors.referenceKey.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-draft-display-name">Unit Name</Label>
                <Input
                  id="edit-draft-display-name"
                  disabled={readOnly}
                  {...register("displayName", {
                    required: "Unit name is required",
                    maxLength: {
                      value: 200,
                      message: "Maximum 200 characters",
                    },
                  })}
                />
                {errors.displayName && (
                  <p className="text-sm text-destructive">
                    {errors.displayName.message}
                  </p>
                )}
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
                          nextSchema.orgUnitKinds[0]?.key ?? ""
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
                {errors.orgUnitKindKey && (
                  <p className="text-sm text-destructive">
                    {errors.orgUnitKindKey.message}
                  </p>
                )}
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

                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-draft-location">Location</Label>
                      <Input
                        id="edit-draft-location"
                        placeholder="Dubai HQ"
                        disabled={readOnly}
                        {...register("location", {
                          maxLength: {
                            value: 100,
                            message: "Maximum 100 characters",
                          },
                        })}
                      />
                      {errors.location && (
                        <p className="text-sm text-destructive">
                          {errors.location.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-draft-description">Description</Label>
                    <Textarea
                      id="edit-draft-description"
                      rows={3}
                      disabled={readOnly}
                      {...register("description", {
                        maxLength: {
                          value: 500,
                          message: "Maximum 500 characters",
                        },
                      })}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive">
                        {errors.description.message}
                      </p>
                    )}
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

              <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Delete behavior</p>
                <p className="mt-2">
                  If this unit has children, choose a new parent or promote them
                  to root before deleting it.
                </p>
              </div>

              {serverError && (
                <p className="text-sm text-destructive">{serverError}</p>
              )}
            </div>

            <SheetFooter className="border-t bg-muted/50 sm:flex-row sm:justify-between">
              {readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={update.isLoading || remove.isLoading}
                  >
                    Delete Unit
                  </Button>
                  <Button
                    type="submit"
                    disabled={update.isLoading || remove.isLoading}
                  >
                    {update.isLoading && <Spinner className="mr-1" />}
                    Save Changes
                  </Button>
                </>
              )}
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!readOnly && deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete structure item?</AlertDialogTitle>
            <AlertDialogDescription>
              {childUnits.length > 0
                ? "Choose how to keep the child branch intact before deleting this unit."
                : "This removes the unit from the draft workspace."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {childUnits.length > 0 && (
            <div className="grid gap-2">
              <Label>Child handling</Label>
              <Select value={deleteStrategy} onValueChange={setDeleteStrategy}>
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
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                remove.isLoading || (childUnits.length > 0 && !deleteStrategy)
              }
              onClick={handleDelete}
            >
              {remove.isLoading && <Spinner className="mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
