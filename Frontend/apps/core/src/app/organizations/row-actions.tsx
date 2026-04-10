"use client";

import { useState } from "react";
import type { PlatformOrganizationSummaryDto } from "@repo/api";
import { MoreHorizontal, Pause, Play, Archive, Send, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import {
  useSuspendOrganization,
  useReactivateOrganization,
  useArchiveOrganization,
  useResendFirstAdminInvite,
  useRevokeFirstAdminInvite,
} from "./use-organizations";

interface RowActionsProps {
  org: PlatformOrganizationSummaryDto;
  onMutated?: () => void;
}

type ConfirmAction = {
  title: string;
  description: string;
  actionLabel: string;
  variant?: "default" | "destructive";
  execute: () => void;
};

export function RowActions({ org, onMutated }: RowActionsProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null
  );

  const suspend = useSuspendOrganization({
    onSuccess: () => {
      toast.success(`${org.name} suspended`);
      onMutated?.();
    },
  });

  const reactivate = useReactivateOrganization({
    onSuccess: () => {
      toast.success(`${org.name} reactivated`);
      onMutated?.();
    },
  });

  const archive = useArchiveOrganization({
    onSuccess: () => {
      toast.success(`${org.name} archived`);
      onMutated?.();
    },
  });

  const resend = useResendFirstAdminInvite({
    onSuccess: () => {
      toast.success(`Invite re-sent for ${org.name}`);
      onMutated?.();
    },
  });

  const revoke = useRevokeFirstAdminInvite({
    onSuccess: () => {
      toast.success(`Invite revoked for ${org.name}`);
      onMutated?.();
    },
  });

  const isLoading =
    suspend.isLoading ||
    reactivate.isLoading ||
    archive.isLoading ||
    resend.isLoading ||
    revoke.isLoading;

  const canSuspend = org.isActive && !org.isArchived;
  const canReactivate = !org.isActive && !org.isArchived;
  const canArchive = !org.isArchived;
  const canResend =
    org.operationalStatus === "invited" || org.operationalStatus === "draft";
  const canRevoke = org.operationalStatus === "invited";

  const hasActions =
    canSuspend || canReactivate || canArchive || canResend || canRevoke;

  if (!hasActions) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isLoading}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {canResend && (
            <DropdownMenuItem
              onClick={() =>
                setConfirmAction({
                  title: "Resend Invite",
                  description: `Resend the first admin invite for "${org.name}"?`,
                  actionLabel: "Resend",
                  execute: () => resend.mutate(org.id),
                })
              }
            >
              <Send className="size-4" /> Resend Invite
            </DropdownMenuItem>
          )}
          {canRevoke && (
            <DropdownMenuItem
              onClick={() =>
                setConfirmAction({
                  title: "Revoke Invite",
                  description: `Revoke the pending invite for "${org.name}"? The org will return to draft state.`,
                  actionLabel: "Revoke",
                  variant: "destructive",
                  execute: () => revoke.mutate(org.id),
                })
              }
            >
              <Ban className="size-4" /> Revoke Invite
            </DropdownMenuItem>
          )}
          {(canResend || canRevoke) &&
            (canSuspend || canReactivate || canArchive) && (
              <DropdownMenuSeparator />
            )}
          {canSuspend && (
            <DropdownMenuItem
              onClick={() =>
                setConfirmAction({
                  title: "Suspend Organization",
                  description: `Suspend "${org.name}"? Users will be unable to access the platform.`,
                  actionLabel: "Suspend",
                  variant: "destructive",
                  execute: () => suspend.mutate(org.id),
                })
              }
            >
              <Pause className="size-4" /> Suspend
            </DropdownMenuItem>
          )}
          {canReactivate && (
            <DropdownMenuItem
              onClick={() =>
                setConfirmAction({
                  title: "Reactivate Organization",
                  description: `Reactivate "${org.name}"?`,
                  actionLabel: "Reactivate",
                  execute: () => reactivate.mutate(org.id),
                })
              }
            >
              <Play className="size-4" /> Reactivate
            </DropdownMenuItem>
          )}
          {canArchive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  setConfirmAction({
                    title: "Archive Organization",
                    description: `Archive "${org.name}"? This action cannot be easily undone.`,
                    actionLabel: "Archive",
                    variant: "destructive",
                    execute: () => archive.mutate(org.id),
                  })
                }
              >
                <Archive className="size-4" /> Archive
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction?.variant ?? "default"}
              onClick={() => {
                confirmAction?.execute();
                setConfirmAction(null);
              }}
            >
              {confirmAction?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
