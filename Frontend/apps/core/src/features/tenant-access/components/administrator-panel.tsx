"use client";

import { useEffect, useState } from "react";
import type { TenantAdministratorDto } from "@repo/api";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ds";
import {
  problemTypeOf,
  useReactivateAdministrator,
  useRecentAccessActivity,
  useRefreshAccessWorkspace,
  useRevokeAdministratorAuthority,
  useSuspendAdministrator,
} from "../api/use-tenant-access";
import {
  ACTIVITY_LABEL,
  ADMINISTRATOR_STATUS_LABEL,
  ADMINISTRATOR_STATUS_TONE,
  COPY,
  formatDay,
  formatMoment,
} from "./access-language";
import { ConfirmDialog, IdentityMark, StatusMark } from "./access-ui";

type PendingAction = "suspend" | "reactivate" | "remove" | null;

interface AdministratorPanelProps {
  administrator: TenantAdministratorDto | null;
  currentUserId: string | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteAnother: () => void;
  onSelfRemoved: () => void;
  onChanged: (message: string) => void;
}

/**
 * One administrator's access.
 *
 * A panel rather than a page: this is a decision about someone already visible
 * in the list, not a destination. The actions are deliberately unequal —
 * suspension is reversible and sits as a button, removal is not and sits below
 * as quiet destructive text — because presenting them as peers invites the wrong
 * one.
 */
export function AdministratorPanel({
  administrator,
  currentUserId,
  canManage,
  onOpenChange,
  onInviteAnother,
  onSelfRemoved,
  onChanged,
}: AdministratorPanelProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const suspend = useSuspendAdministrator();
  const reactivate = useReactivateAdministrator();
  const remove = useRevokeAdministratorAuthority();
  const activity = useRecentAccessActivity(administrator !== null);
  const refreshWorkspace = useRefreshAccessWorkspace();

  useEffect(() => {
    setProblem(null);
    setPendingAction(null);
  }, [administrator?.membershipId]);

  if (!administrator) {
    return null;
  }

  const isSelf = currentUserId !== null && administrator.userId === currentUserId;
  const isSuspended = administrator.status === "Suspended";
  const blockedReason = administrator.blockedReason;
  const isBlocked = blockedReason !== null;
  const isBusy = suspend.isLoading || reactivate.isLoading || remove.isLoading;

  const history = (activity.data ?? [])
    .filter((item) => item.resourceId === administrator.membershipId)
    .slice(0, 3);

  async function run(action: Exclude<PendingAction, null>) {
    if (!administrator) {
      return;
    }

    setProblem(null);
    const args = { membershipId: administrator.membershipId, version: administrator.version };

    try {
      switch (action) {
        case "suspend":
          await suspend.mutateAsync(args);
          onChanged(`${administrator.name} can no longer access this tenant.`);
          break;
        case "reactivate":
          await reactivate.mutateAsync(args);
          onChanged(`${administrator.name} can access this tenant again.`);
          break;
        case "remove":
          await remove.mutateAsync(args);
          onChanged(`Administrator access removed from ${administrator.name}.`);
          break;
      }

      setPendingAction(null);

      if (action === "remove") {
        // The actor's own next request is rejected, so they are moved out rather
        // than left on a page they can no longer read.
        if (isSelf) {
          onSelfRemoved();
          return;
        }
        onOpenChange(false);
      }
    } catch (error) {
      switch (problemTypeOf(error)) {
        case "final-administrator":
          // The refusal is a fact about the tenant, not about this screen: reload
          // so the list and this panel agree with the server that refused.
          await refreshWorkspace();
          setProblem(COPY.finalAdministratorBlock);
          break;
        case "stale-state":
          // Reloaded before the message claims it, and awaited so the panel is
          // re-rendered from the current version rather than retrying the stale
          // one forever.
          await refreshWorkspace();
          setProblem(COPY.staleState);
          break;
        case "permission-denied":
          setProblem("You no longer have permission to manage administrator access.");
          break;
        default:
          setProblem("That change could not be applied.");
      }
      setPendingAction(null);
    }
  }

  return (
    <>
      <Sheet open onOpenChange={onOpenChange}>
        {/* Content flows from the top and the actions sit directly beneath it.
            Pinning the actions to the bottom of the viewport instead would open
            a hole in the middle of every panel whose administrator has little
            history — which is most of them. */}
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-sm">
          <SheetHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
            <IdentityMark name={administrator.name} />
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">
                {administrator.name}
                {isSelf ? (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">You</span>
                ) : null}
              </SheetTitle>
              <SheetDescription className="truncate">{administrator.email}</SheetDescription>
            </div>
          </SheetHeader>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <StatusMark tone={ADMINISTRATOR_STATUS_TONE[administrator.status]}>
                {ADMINISTRATOR_STATUS_LABEL[administrator.status]}
              </StatusMark>
              <p className="text-sm text-muted-foreground">
                Since {formatDay(administrator.accessEstablishedAt)}
              </p>
            </div>

            {history.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recent activity
                </h3>
                <ul className="mt-2 divide-y border-t">
                  {history.map((item) => (
                    <li key={item.id} className="py-2.5">
                      <p className="text-sm">{ACTIVITY_LABEL[item.action] ?? item.summary}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatMoment(item.occurredAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {problem ? (
              <p role="alert" className="mt-6 text-sm text-destructive">
                {problem}
              </p>
            ) : null}
          </div>

          {canManage ? (
            <div className="border-t px-5 py-4">
              {isBlocked ? (
                // The reason is stated where the action would have been, so the
                // absence reads as a rule rather than a missing feature.
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{blockedReason}</p>
                  <Button variant="outline" className="w-full" onClick={onInviteAnother}>
                    Invite administrator
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {isSuspended ? (
                    <Button
                      className="w-full"
                      disabled={isBusy}
                      onClick={() => setPendingAction("reactivate")}
                    >
                      Reactivate access
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={isBusy}
                      onClick={() => setPendingAction("suspend")}
                    >
                      Suspend access
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={isBusy}
                    onClick={() => setPendingAction("remove")}
                  >
                    Remove administrator access
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction === "suspend"
            ? "Suspend access"
            : pendingAction === "reactivate"
              ? "Reactivate access"
              : isSelf
                ? "Remove your own administrator access"
                : "Remove administrator access"
        }
        consequence={
          pendingAction === "suspend"
            ? COPY.suspendConsequence
            : pendingAction === "reactivate"
              ? COPY.reactivateConsequence
              : isSelf
                ? COPY.selfRemoveConsequence
                : COPY.removeConsequence
        }
        subject={{ title: administrator.name, subtitle: administrator.email }}
        confirmLabel={
          pendingAction === "suspend"
            ? "Suspend access"
            : pendingAction === "reactivate"
              ? "Reactivate access"
              : "Remove access"
        }
        destructive={pendingAction === "remove"}
        busy={isBusy}
        onOpenChange={(open) => !open && setPendingAction(null)}
        onConfirm={() => pendingAction && void run(pendingAction)}
      />
    </>
  );
}
