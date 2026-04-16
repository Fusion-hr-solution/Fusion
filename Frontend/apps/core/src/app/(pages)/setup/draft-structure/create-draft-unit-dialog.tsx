"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { CreateDraftOrgUnitRequest, DraftOrgUnitDto } from "@repo/api";
import { ApiError } from "@repo/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useCreateDraftOrgUnit } from "./use-draft-structure";

const ROOT_VALUE = "__root__";

interface CreateDraftUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  allowedTypes: string[];
  existingUnits: DraftOrgUnitDto[];
}

export function CreateDraftUnitDialog({
  open,
  onOpenChange,
  onCreated,
  allowedTypes,
  existingUnits,
}: CreateDraftUnitDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateDraftOrgUnitRequest>({
    defaultValues: {
      code: "",
      name: "",
      type: allowedTypes[0] ?? "",
      parentId: null,
    },
  });

  useEffect(() => {
    reset({
      code: "",
      name: "",
      type: allowedTypes[0] ?? "",
      parentId: null,
    });
  }, [allowedTypes, reset, open]);

  const create = useCreateDraftOrgUnit({
    onSuccess: (data) => {
      toast.success(`Structure item "${data.name}" created`);
      setServerError(null);
      onOpenChange(false);
      onCreated();
    },
  });

  const onSubmit = async (values: CreateDraftOrgUnitRequest) => {
    setServerError(null);

    try {
      await create.mutateAsync({
        ...values,
        parentId: values.parentId || null,
      });
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
      reset({
        code: "",
        name: "",
        type: allowedTypes[0] ?? "",
        parentId: null,
      });
      setServerError(null);
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Structure Item</DialogTitle>
          <DialogDescription>
            Add a structure item for preparation and later correction before
            governance and publication.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="draft-code">Code</Label>
            <Input
              id="draft-code"
              placeholder="ENG"
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
            <Label htmlFor="draft-name">Name</Label>
            <Input
              id="draft-name"
              placeholder="Engineering"
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
                    {existingUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={create.isLoading}>
              {create.isLoading && <Spinner className="mr-1" />}
              Add Structure Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}