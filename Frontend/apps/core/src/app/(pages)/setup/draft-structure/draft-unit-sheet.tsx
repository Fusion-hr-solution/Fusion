"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { DraftOrgUnitDto, UpdateDraftOrgUnitRequest } from "@repo/api";
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

const ROOT_VALUE = "__root__";

interface DraftUnitSheetProps {
  unit: DraftOrgUnitDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated: () => void;
  allowedTypes: string[];
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
  allowedTypes,
  existingUnits,
}: DraftUnitSheetProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStrategy, setDeleteStrategy] = useState<string>("");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UpdateDraftOrgUnitRequest>({
    defaultValues: {
      code: unit?.code ?? "",
      name: unit?.name ?? "",
      type: unit?.type ?? allowedTypes[0] ?? "",
      parentId: unit?.parentId ?? null,
    },
  });

  useEffect(() => {
    reset({
      code: unit?.code ?? "",
      name: unit?.name ?? "",
      type: unit?.type ?? allowedTypes[0] ?? "",
      parentId: unit?.parentId ?? null,
    });
    setServerError(null);
    setDeleteOpen(false);
    setDeleteStrategy("");
  }, [allowedTypes, reset, unit]);

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
      toast.success(`Structure item "${data.name}" updated`);
      setServerError(null);
      onMutated();
    },
  });

  const remove = useDeleteDraftOrgUnit({
    onSuccess: () => {
      toast.success(`Structure item "${unit?.name}" deleted`);
      setDeleteOpen(false);
      setDeleteStrategy("");
      onOpenChange(false);
      onMutated();
    },
  });

  if (!unit) {
    return null;
  }

  const onSubmit = async (values: UpdateDraftOrgUnitRequest) => {
    setServerError(null);

    try {
      await update.mutateAsync({
        id: unit.id,
        version: unit.version,
        input: {
          ...values,
          parentId: values.parentId || null,
        },
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
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{unit.name}</SheetTitle>
            <SheetDescription>
              Update this structure item without touching the live organization
              structure.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
              <section className="space-y-2 text-sm text-muted-foreground">
                <p>Draft code: {unit.code}</p>
                <p>Parent: {unit.parentName ?? "Root"}</p>
              </section>

              <Separator />

              <div className="grid gap-2">
                <Label htmlFor="edit-draft-code">Code</Label>
                <Input
                  id="edit-draft-code"
                  {...register("code", {
                    required: "Code is required",
                    maxLength: { value: 50, message: "Maximum 50 characters" },
                  })}
                />
                {errors.code && (
                  <p className="text-sm text-destructive">{errors.code.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-draft-name">Name</Label>
                <Input
                  id="edit-draft-name"
                  {...register("name", {
                    required: "Name is required",
                    maxLength: { value: 200, message: "Maximum 200 characters" },
                  })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Type</Label>
                <Controller
                  control={control}
                  name="type"
                  rules={{ required: "Type is required" }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.type && (
                  <p className="text-sm text-destructive">{errors.type.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Parent</Label>
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
                        <SelectValue placeholder="Select a parent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ROOT_VALUE}>Root</SelectItem>
                        {parentCandidates.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
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
                Delete Item
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
                      Reparent to {candidate.name}
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