"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  PlatformOrganizationDetailDto,
  UpdatePlatformOrganizationRequest,
} from "@repo/api";
import { ApiError } from "@repo/api";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge, InviteStatusBadge } from "./status-badge";
import { toast } from "sonner";
import {
  useOrganizationDetail,
  useUpdateOrganization,
} from "./use-organizations";
import { Pencil, X, Check, Copy, ExternalLink } from "lucide-react";

interface OrgDetailSheetProps {
  tenantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated: () => void;
}

export function OrgDetailSheet({
  tenantId,
  open,
  onOpenChange,
  onMutated,
}: OrgDetailSheetProps) {
  const {
    data: org,
    isLoading,
    refetch,
  } = useOrganizationDetail(open ? tenantId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {isLoading || !org ? (
          <DetailSkeleton />
        ) : (
          <DetailContent org={org} refetch={refetch} onMutated={onMutated} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-4 pt-8">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-32" />
      <div className="space-y-3 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}

function DetailContent({
  org,
  refetch,
  onMutated,
}: {
  org: PlatformOrganizationDetailDto;
  refetch: () => void;
  onMutated: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {org.name}
          <StatusBadge status={org.operationalStatus} />
        </SheetTitle>
        <SheetDescription>
          Created {format(new Date(org.createdAt), "PPP")}
          {org.updatedAt &&
            ` · Updated ${format(new Date(org.updatedAt), "PPP")}`}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        {/* Edit section */}
        {editing ? (
          <EditForm
            org={org}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              refetch();
              onMutated();
            }}
          />
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3" />
                Edit
              </Button>
            </div>

            {/* Metrics */}
            <section className="grid grid-cols-2 gap-4">
              <MetricCard label="Active Users" value={org.activeUserCount} />
              <MetricCard
                label="Pending Invites"
                value={org.pendingInviteCount}
              />
              <MetricCard
                label="Primary Admin"
                value={org.primaryAdminEmail ?? "—"}
                text
              />
              <MetricCard
                label="Last Activity"
                value={
                  org.lastActivityAt
                    ? format(new Date(org.lastActivityAt), "PPp")
                    : "No activity yet"
                }
                text
              />
            </section>

            <Separator />

            {/* First Admin Invite */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium">First Admin Invite</h3>
              <div className="rounded-lg border p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <InviteStatusBadge status={org.firstAdminInvite.status} />
                </div>
                {org.firstAdminInvite.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span>{org.firstAdminInvite.email}</span>
                  </div>
                )}
                {org.firstAdminInvite.sentAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sent</span>
                    <span>
                      {format(new Date(org.firstAdminInvite.sentAt), "PPp")}
                    </span>
                  </div>
                )}
                {org.firstAdminInvite.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span>
                      {format(new Date(org.firstAdminInvite.expiresAt), "PPp")}
                    </span>
                  </div>
                )}
                {org.firstAdminInvite.inviteLink && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          org.firstAdminInvite.inviteLink!
                        );
                        toast.success("Invite link copied");
                      }}
                    >
                      <Copy className="size-3" />
                      Copy Link
                    </Button>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* Internal Notes */}
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Internal Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {org.internalNotes || "No notes."}
              </p>
            </section>
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Inline edit form                                                    */
/* ------------------------------------------------------------------ */

function EditForm({
  org,
  onCancel,
  onSaved,
}: {
  org: PlatformOrganizationDetailDto;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdatePlatformOrganizationRequest>({
    defaultValues: {
      name: org.name,
      internalNotes: org.internalNotes ?? "",
    },
  });

  const update = useUpdateOrganization(org.id, {
    onSuccess: () => {
      toast.success("Organization updated");
      onSaved();
    },
  });

  const onSubmit = async (values: UpdatePlatformOrganizationRequest) => {
    setServerError(null);
    try {
      await update.mutateAsync(values);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.errors.join(", "));
      } else {
        setServerError("An unexpected error occurred.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="edit-name">Organization Name</Label>
        <Input
          id="edit-name"
          {...register("name", {
            required: "Name is required",
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
        <Label htmlFor="edit-notes">Internal Notes</Label>
        <Textarea
          id="edit-notes"
          className="min-h-[80px]"
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

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!isDirty || update.isLoading}>
          {update.isLoading && <Spinner className="mr-1" />}
          <Check className="size-3" />
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={update.isLoading}
        >
          <X className="size-3" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Small metric card                                                   */
/* ------------------------------------------------------------------ */

function MetricCard({
  label,
  value,
  text,
}: {
  label: string;
  value: string | number;
  text?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`${
          text ? "text-sm" : "text-lg font-bold tabular-nums"
        } text-foreground`}
      >
        {value}
      </p>
    </div>
  );
}
