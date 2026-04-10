"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import type {
  PlatformOrganizationDetailDto,
  UpdatePlatformOrganizationRequest,
} from "@repo/api";
import { ApiError } from "@repo/api";
import { format, formatDistanceToNow } from "date-fns";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusBadge, InviteStatusBadge } from "./status-badge";
import { toast } from "sonner";
import {
  useOrganizationDetail,
  useUpdateOrganization,
  useResendFirstAdminInvite,
  useRevokeFirstAdminInvite,
} from "./use-organizations";
import {
  Pencil,
  X,
  Check,
  Copy,
  ExternalLink,
  Users,
  Mail,
  UserCheck,
  Clock,
  Send,
  Ban,
  StickyNote,
} from "lucide-react";

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

  const resend = useResendFirstAdminInvite({
    onSuccess: () => {
      toast.success("Invite re-sent successfully");
      refetch();
      onMutated();
    },
  });

  const revoke = useRevokeFirstAdminInvite({
    onSuccess: () => {
      toast.success("Invite revoked");
      refetch();
      onMutated();
    },
  });

  const canResend =
    org.firstAdminInvite.status === "pending" ||
    org.firstAdminInvite.status === "expired";
  const canRevoke = org.firstAdminInvite.status === "pending";
  const inviteActionsLoading = resend.isLoading || revoke.isLoading;

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

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="invite" className="flex-1">Admin Invite</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
          </TabsList>

          {/* ── Overview tab ─────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-5 pt-1">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                icon={<Users className="size-4 text-blue-600" />}
                label="Active Users"
                value={org.activeUserCount}
              />
              <MetricCard
                icon={<Mail className="size-4 text-amber-600" />}
                label="Pending Invites"
                value={org.pendingInviteCount}
                highlight={org.pendingInviteCount > 0}
              />
              <MetricCard
                icon={<UserCheck className="size-4 text-emerald-600" />}
                label="Primary Admin"
                value={org.primaryAdminEmail ?? "—"}
                text
              />
              <MetricCard
                icon={<Clock className="size-4 text-muted-foreground" />}
                label="Last Activity"
                value={
                  org.lastActivityAt
                    ? formatDistanceToNow(new Date(org.lastActivityAt), {
                        addSuffix: true,
                      })
                    : "No activity"
                }
                text
                tooltip={
                  org.lastActivityAt
                    ? format(new Date(org.lastActivityAt), "PPpp")
                    : undefined
                }
              />
            </div>

            <Separator />

            {/* Tenant ID */}
            <section className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tenant ID
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-2 py-1 text-xs font-mono select-all truncate">
                  {org.id}
                </code>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(org.id);
                    toast.success("Tenant ID copied");
                  }}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </section>

            <Separator />

            {/* Internal Notes */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <StickyNote className="size-3.5 text-muted-foreground" />
                <h3 className="text-sm font-medium">Internal Notes</h3>
              </div>
              {org.internalNotes ? (
                <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {org.internalNotes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No internal notes.
                </p>
              )}
            </section>
          </TabsContent>

          {/* ── Admin Invite tab ─────────────────────────────── */}
          <TabsContent value="invite" className="space-y-5 pt-1">
            <div className="rounded-lg border">
              {/* Invite header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-sm font-medium">First Admin Invite</h3>
                <InviteStatusBadge status={org.firstAdminInvite.status} />
              </div>

              {/* Invite details */}
              <div className="divide-y">
                {org.firstAdminInvite.email && (
                  <DetailRow label="Email" value={org.firstAdminInvite.email} />
                )}
                {org.firstAdminInvite.sentAt && (
                  <DetailRow
                    label="Sent"
                    value={format(
                      new Date(org.firstAdminInvite.sentAt),
                      "PPp"
                    )}
                  />
                )}
                {org.firstAdminInvite.expiresAt && (
                  <DetailRow
                    label="Expires"
                    value={format(
                      new Date(org.firstAdminInvite.expiresAt),
                      "PPp"
                    )}
                  />
                )}
              </div>

              {/* Invite link + actions */}
              {(org.firstAdminInvite.inviteLink || canResend || canRevoke) && (
                <div className="border-t px-4 py-3 space-y-3">
                  {org.firstAdminInvite.inviteLink && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Invite Link
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-muted px-2 py-1.5 text-xs font-mono truncate select-all">
                          {org.firstAdminInvite.inviteLink}
                        </code>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    org.firstAdminInvite.inviteLink!
                                  );
                                  toast.success("Invite link copied");
                                }}
                              >
                                <Copy className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy link</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={org.firstAdminInvite.inviteLink}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="outline" size="icon-sm">
                                  <ExternalLink className="size-3.5" />
                                </Button>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>Open in new tab</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  )}

                  {(canResend || canRevoke) && (
                    <div className="flex items-center gap-2">
                      {canResend && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={inviteActionsLoading}
                          onClick={() => resend.mutate(org.id)}
                        >
                          {resend.isLoading ? (
                            <Spinner className="mr-1" />
                          ) : (
                            <Send className="size-3" />
                          )}
                          Resend Invite
                        </Button>
                      )}
                      {canRevoke && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={inviteActionsLoading}
                          onClick={() => revoke.mutate(org.id)}
                        >
                          {revoke.isLoading ? (
                            <Spinner className="mr-1" />
                          ) : (
                            <Ban className="size-3" />
                          )}
                          Revoke
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Settings tab (edit form) ─────────────────────── */}
          <TabsContent value="settings" className="space-y-5 pt-1">
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
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Organization Details</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                </div>

                <div className="rounded-lg border divide-y">
                  <DetailRow label="Name" value={org.name} />
                  <DetailRow label="Status" value={org.operationalStatus} capitalize />
                  <DetailRow
                    label="Created"
                    value={format(new Date(org.createdAt), "PPP")}
                  />
                  {org.updatedAt && (
                    <DetailRow
                      label="Last Updated"
                      value={format(new Date(org.updatedAt), "PPP")}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Internal Notes</h3>
                  {org.internalNotes ? (
                    <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {org.internalNotes}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No internal notes. Click edit to add some.
                    </p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
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
  icon,
  label,
  value,
  text,
  highlight,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  text?: boolean;
  highlight?: boolean;
  tooltip?: string;
}) {
  const content = (
    <div className="rounded-lg border p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p
        className={cn(
          text ? "text-sm truncate" : "text-lg font-bold tabular-nums",
          highlight ? "text-amber-600 dark:text-amber-400" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

/* ------------------------------------------------------------------ */
/* Detail row for key-value lists                                      */
/* ------------------------------------------------------------------ */

function DetailRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-right truncate ml-4", capitalize && "capitalize")}>
        {value}
      </span>
    </div>
  );
}
