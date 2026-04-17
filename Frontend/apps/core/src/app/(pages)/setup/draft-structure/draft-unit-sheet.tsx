"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { DraftOrgUnitDto, DraftStructureSchemaDto, UpdateDraftOrgUnitRequest } from "@repo/api";
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
  onMutated: () => void;
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
  schema,
  existingUnits,
}: DraftUnitSheetProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStrategy, setDeleteStrategy] = useState<string>("");

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<DraftOrgUnitFormValues>({
    defaultValues: createDraftOrgUnitFormValues(schema, unit),
  });

  const selectedKindKey = watch("orgUnitKindKey");

  useEffect(() => {
    reset(createDraftOrgUnitFormValues(schema, unit));
    setServerError(null);
    setDeleteOpen(false);
    setDeleteStrategy("");
  }, [reset, schema, unit]);

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
      onMutated();
    },
  });

  const remove = useDeleteDraftOrgUnit({
    onSuccess: () => {
      toast.success(`Unit "${unit?.displayName}" deleted`);
      setDeleteOpen(false);
      setDeleteStrategy("");
      onOpenChange(false);
      onMutated();
    },
  });

  if (!unit) {
    return null;
  }

  const onSubmit = async (values: DraftOrgUnitFormValues) => {
    setServerError(null);

    try {
      const input: UpdateDraftOrgUnitRequest = {
        referenceKey: values.referenceKey.trim(),
        displayName: values.displayName.trim(),
        orgUnitKindKey: values.orgUnitKindKey,
        businessCode: values.businessCode.trim() || null,
        description: values.description.trim() || null,
        parentId: values.parentId || null,
        attributes: sanitizeDraftAttributes(schema, values.orgUnitKindKey, values.attributes),
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
              Update this unit inside the draft organization without touching
              the live structure immediately.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
              <section className="space-y-2 text-sm text-muted-foreground">
                <p>Unit code: {unit.referenceKey}</p>
                <p>Parent unit: {unit.parentDisplayName ?? "Organization root"}</p>
              </section>

              <Separator />

              <div className="grid gap-2">
                <Label htmlFor="edit-draft-reference-key">Unit Code</Label>
                <Input
                  id="edit-draft-reference-key"
                  {...register("referenceKey", {
                    required: "Unit code is required",
                    maxLength: { value: 150, message: "Maximum 150 characters" },
                  })}
                />
                {errors.referenceKey && (
                  <p className="text-sm text-destructive">{errors.referenceKey.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-draft-display-name">Unit Name</Label>
                <Input
                  id="edit-draft-display-name"
                  {...register("displayName", {
                    required: "Unit name is required",
                    maxLength: { value: 200, message: "Maximum 200 characters" },
                  })}
                />
                {errors.displayName && (
                  <p className="text-sm text-destructive">{errors.displayName.message}</p>
                )}
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
                {errors.orgUnitKindKey && (
                  <p className="text-sm text-destructive">{errors.orgUnitKindKey.message}</p>
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
                      onValueChange={(value) => {
                        field.onChange(value === ROOT_VALUE ? null : value);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a parent unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ROOT_VALUE}>Organization root</SelectItem>
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
                <div className="mb-4 space-y-1">
                  <p className="text-sm font-medium">Optional details</p>
                  <p className="text-sm text-muted-foreground">
                    Keep the structure clean first. Add these details only when
                    they are useful right now.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-draft-business-code">Business Code</Label>
                      <Input
                        id="edit-draft-business-code"
                        {...register("businessCode", {
                          maxLength: { value: 100, message: "Maximum 100 characters" },
                        })}
                      />
                      {errors.businessCode && (
                        <p className="text-sm text-destructive">{errors.businessCode.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-draft-description">Description</Label>
                    <Textarea
                      id="edit-draft-description"
                      rows={3}
                      {...register("description", {
                        maxLength: { value: 500, message: "Maximum 500 characters" },
                      })}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive">{errors.description.message}</p>
                    )}
                  </div>

                  <DraftStructureAttributeFields
                    schema={schema}
                    selectedKindKey={selectedKindKey}
                    control={control}
                    errors={errors}
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Delete behavior</p>
                <p className="mt-2">
                  If this unit has children, delete requires reparenting them or
                  promoting them to root. Cascade delete is intentionally not
                  supported.
                </p>
              </div>

              {serverError && (
                <p className="text-sm text-destructive">{serverError}</p>
              )}
            </div>

            <SheetFooter className="border-t bg-muted/50 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={update.isLoading || remove.isLoading}
              >
                Delete Unit
              </Button>
              <Button type="submit" disabled={update.isLoading || remove.isLoading}>
                {update.isLoading && <Spinner className="mr-1" />}
                Save Changes
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete structure item?</AlertDialogTitle>
            <AlertDialogDescription>
              {childUnits.length > 0
                ? "Choose how to keep the child branch intact before deleting this item."
                : "This removes the structure item from the workspace."}
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
                  <SelectItem value={ROOT_VALUE}>Promote children to root</SelectItem>
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
            <AlertDialogCancel disabled={remove.isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isLoading || (childUnits.length > 0 && !deleteStrategy)}
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