"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import { AsyncButton } from "@repo/ds/shell";
import type { BootstrapInvitationSummary, RecoveryAction } from "../api";
import { recoveryLabel } from "../language";
import { useInvitationRecovery } from "../queries";
import {
  ConfirmRecoveryDialog,
  RECOVERY_ICON,
  RecoveryFailure,
} from "../recovery-dialog";
import type { ActivationPhase } from "./activation-progression";

/**
 * The recoveries this state permits, ranked by what the state actually needs.
 *
 * Emphasis is the whole point of the ranking. A delivered invitation is waiting
 * on its recipient, so resending is merely available; a bounced one is waiting
 * on the platform, so resending leads. Dressing every state the same would make
 * the page look urgent even when nothing is wrong.
 */
interface Ranking {
  primary: RecoveryAction | null;
  secondary: RecoveryAction[];
  overflow: RecoveryAction[];
}

export function rankActions(
  phase: ActivationPhase,
  allowed: readonly RecoveryAction[]
): Ranking {
  const has = (action: RecoveryAction) => allowed.includes(action);
  const keep = (actions: RecoveryAction[]) => actions.filter(has);

  switch (phase) {
    case "pending-delivery-failed":
      // The message did not arrive; sending it again is the fix.
      return {
        primary: has("resend") ? "resend" : null,
        secondary: keep(["replace"]),
        overflow: keep(["revoke"]),
      };

    case "blocked":
      // Nothing usable remains, so a new invitation is the only way forward.
      return {
        primary: has("reissue") ? "reissue" : null,
        secondary: keep(["replace"]),
        overflow: keep(["revoke"]),
      };

    case "pending-sent":
      // The recipient acts next. Nothing here is urgent.
      return {
        primary: null,
        secondary: keep(["resend"]),
        overflow: keep(["replace", "revoke"]),
      };

    default:
      // Activated: the invitation is spent and offers nothing.
      return { primary: null, secondary: [], overflow: [] };
  }
}

/**
 * Overview and Access ask different questions of the same invitation.
 *
 * Overview asks what to do next, so it offers the one action this state calls
 * for and sends the operator to Access for the rest. Access is the invitation's
 * home and offers everything the state permits. Two surfaces, one ranking —
 * they cannot disagree about which action leads.
 */
type RecoveryScope = "next-action" | "complete";

/** How long a completed recovery keeps saying so. */
const CONFIRMATION_MS = 6000;

/** What a completed recovery says about itself. */
export function recoveryConfirmation(
  action: RecoveryAction,
  email: string
): string {
  switch (action) {
    case "resend":
      return `Invitation resent to ${email}.`;
    case "revoke":
      return "Invitation revoked. This tenant has no active invitation.";
    case "replace":
      return "Invited email replaced. A new invitation has been created.";
    case "reissue":
      return `Invitation reissued to ${email}.`;
  }
}

export function RecoveryActions({
  tenantId,
  invitation,
  phase,
  scope = "complete",
}: {
  tenantId: string;
  invitation: BootstrapInvitationSummary;
  phase: ActivationPhase;
  scope?: RecoveryScope;
}) {
  const [pendingAction, setPendingAction] = useState<Exclude<
    RecoveryAction,
    "resend"
  > | null>(null);

  // Where focus returns when a dialog closes. A dialog can be opened from a
  // visible action or from the overflow menu, and only the second has a trigger
  // that outlives it — Radix unmounts the menu item before focus comes back —
  // so the opening control is captured at the moment it is used. Without this,
  // every dialog opened from Overview dropped focus to the body, because the
  // overflow trigger it used to target is never rendered there.
  const openerRef = useRef<HTMLElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const resend = useInvitationRecovery("resend");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // A completed recovery is otherwise silent: the control stops being busy and
  // the surface re-renders, neither of which is announced. This states the
  // outcome — the counterpart of the failure alert — and then gets out of the
  // way rather than becoming permanent copy.
  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => setConfirmation(null), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [confirmation]);

  const ranked = rankActions(phase, invitation.allowedActions);

  // The next action is the primary one when the state has an urgent answer, and
  // otherwise the leading available one — for a delivered invitation, resending
  // is worth offering but is not something the platform is being asked for.
  const nextAction = ranked.primary ?? ranked.secondary[0] ?? null;
  const { primary, secondary, overflow } =
    scope === "complete"
      ? ranked
      : {
          primary: ranked.primary,
          secondary: ranked.primary ? [] : nextAction ? [nextAction] : [],
          overflow: [],
        };

  const isResending = resend.isLoading;

  function open(action: RecoveryAction, opener: HTMLElement | null) {
    setConfirmation(null);
    openerRef.current = opener;

    // Resending is the one recovery that neither invalidates nor creates
    // anything, so it runs without an interruption.
    if (action === "resend") {
      resend
        .mutateAsync({ tenantId, invitationId: invitation.invitationId })
        .then(() => setConfirmation(recoveryConfirmation(action, invitation.email)))
        .catch(() => {
          // Reported by the mutation's error state below.
        });
      return;
    }

    setPendingAction(action);
  }

  if (!primary && secondary.length === 0 && overflow.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary ? (
        <ActionButton
          action={primary}
          variant="default"
          pending={primary === "resend" && isResending}
          onClick={(event) => open(primary, event.currentTarget)}
        />
      ) : null}

      {secondary.map((action) => (
        <ActionButton
          key={action}
          action={action}
          variant="outline"
          pending={action === "resend" && isResending}
          onClick={(event) => open(action, event.currentTarget)}
        />
      ))}

      {overflow.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={menuTriggerRef}
              variant="outline"
              size="icon"
              aria-label="More invitation actions"
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflow.map((action) => {
              const Icon = RECOVERY_ICON[action];
              return (
                <DropdownMenuItem
                  key={action}
                  // The item is gone by the time the dialog closes, so focus
                  // returns to the trigger that opened the menu.
                  onSelect={() => open(action, menuTriggerRef.current)}
                  className="gap-2"
                  // Revoking deliberately leaves the tenant with no way in, so
                  // it is marked as the destructive choice in the menu.
                  variant={action === "revoke" ? "destructive" : "default"}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {recoveryLabel(action)}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {resend.error ? <RecoveryFailure error={resend.error} /> : null}

      {confirmation && !resend.error ? (
        <p role="status" className="text-sm text-muted-foreground">
          {confirmation}
        </p>
      ) : null}

      {pendingAction ? (
        <ConfirmRecoveryDialog
          action={pendingAction}
          tenantId={tenantId}
          invitationId={invitation.invitationId}
          currentEmail={invitation.email}
          onCompleted={() =>
            setConfirmation(
              recoveryConfirmation(pendingAction, invitation.email)
            )
          }
          onClose={() => {
            setPendingAction(null);
            // Deferred past the dialog's own close sequence, which otherwise
            // moves focus after this handler and undoes the restore.
            requestAnimationFrame(() => openerRef.current?.focus());
          }}
        />
      ) : null}
    </div>
  );
}

function ActionButton({
  action,
  variant,
  pending,
  onClick,
}: {
  action: RecoveryAction;
  variant: "default" | "outline";
  pending: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const Icon = RECOVERY_ICON[action];
  const label = recoveryLabel(action);

  return (
    <AsyncButton
      type="button"
      variant={variant}
      onClick={onClick}
      pending={pending}
      pendingLabel={label}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </AsyncButton>
  );
}
