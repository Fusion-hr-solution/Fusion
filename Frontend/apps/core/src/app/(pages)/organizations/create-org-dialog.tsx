"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { CreatePlatformOrganizationRequest } from "@repo/api";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useCreateOrganization } from "./use-organizations";

interface CreateOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrgDialog({ open, onOpenChange }: CreateOrgDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePlatformOrganizationRequest>({
    defaultValues: {
      name: "",
      firstAdminEmail: "",
      firstAdminFirstName: "",
      firstAdminLastName: "",
      internalNotes: "",
    },
  });

  const create = useCreateOrganization({
    onSuccess: (data) => {
      toast.success(`"${data.organization.name}" created`, {
        description: "First admin invite has been sent.",
      });
      reset();
      setServerError(null);
      onOpenChange(false);
    },
  });

  const onSubmit = async (values: CreatePlatformOrganizationRequest) => {
    setServerError(null);
    try {
      await create.mutateAsync(values);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.errors.join(", "));
      } else {
        setServerError("An unexpected error occurred.");
      }
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      reset();
      setServerError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Set up a new tenant and send the first admin invite.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              {...register("name", {
                required: "Organization name is required",
                minLength: { value: 2, message: "At least 2 characters" },
                maxLength: { value: 100, message: "Maximum 100 characters" },
              })}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="firstAdminEmail">Admin Email</Label>
            <Input
              id="firstAdminEmail"
              type="email"
              placeholder="admin@acme.com"
              {...register("firstAdminEmail", {
                required: "Admin email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Invalid email address",
                },
              })}
              aria-invalid={!!errors.firstAdminEmail}
            />
            {errors.firstAdminEmail && (
              <p className="text-sm text-destructive">
                {errors.firstAdminEmail.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="firstAdminFirstName">First Name</Label>
              <Input
                id="firstAdminFirstName"
                placeholder="Jane"
                {...register("firstAdminFirstName")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="firstAdminLastName">Last Name</Label>
              <Input
                id="firstAdminLastName"
                placeholder="Doe"
                {...register("firstAdminLastName")}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="internalNotes">Internal Notes</Label>
            <Textarea
              id="internalNotes"
              placeholder="Optional notes visible only to platform admins…"
              className="min-h-15"
              {...register("internalNotes", {
                maxLength: { value: 4000, message: "Maximum 4000 characters" },
              })}
            />
            {errors.internalNotes && (
              <p className="text-sm text-destructive">
                {errors.internalNotes.message}
              </p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={create.isLoading}>
              {create.isLoading && <Spinner className="mr-1" />}
              Create Organization
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
