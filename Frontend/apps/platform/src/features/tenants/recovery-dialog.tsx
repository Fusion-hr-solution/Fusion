"use client";

import { useState } from "react";
import { Ban, RefreshCw, Send, UserPen, type LucideIcon } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { AsyncButton } from "@repo/ds/shell";
import type { RecoveryAction } from "./api";
import { failureKind, failureMessage } from "./api";
import { useInvitationRecovery } from "./queries";

/**
 * The confirmed recoveries, shared by the tenant detail and the directory's row
 * menu. One implementation so a shortcut cannot state a different consequence
 * from the authoritative page, or skip a confirmation the page requires.
 */

/**
 * Each recovery reads faster with a glyph that matches what it does — resending
 * and reissuing are otherwise easy to confuse in a plain text menu.
 */
export const RECOVERY_ICON: Record<RecoveryAction, LucideIcon> = {
  resend: Send,
  reissue: RefreshCw,
  replace: UserPen,
  revoke: Ban,
};

const CONFIRMATION_COPY: Record<
  Exclude<RecoveryAction, "resend">,
  { title: string; consequence: string; confirm: string }
> = {
  revoke: {
    title: "Revoke invitation?",
    consequence:
      "The current invitation will no longer be usable. This tenant will have no active administrator invitation.",
    confirm: "Revoke invitation",
  },
  replace: {
    title: "Replace invited email",
    consequence:
      "Replacing the email invalidates the current invitation and creates a new invitation.",
    confirm: "Replace invited email",
  },
  reissue: {
    title: "Reissue invitation?",
    consequence: "A new invitation with a new expiry will be created.",
    confirm: "Reissue invitation",
  },
};

export function ConfirmRecoveryDialog({
  action,
  tenantId,
  invitationId,
  currentEmail,
  onCompleted,
  onClose,
}: {
  action: Exclude<RecoveryAction, "resend">;
  tenantId: string;
  invitationId: string;
  currentEmail: string;
  /** Fires once the change is recorded, so the caller can state the outcome. */
  onCompleted?: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(currentEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const recovery = useInvitationRecovery(action);

  const copy = CONFIRMATION_COPY[action];

  function confirm() {
    if (action === "replace") {
      const next = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
        setEmailError("Enter a valid email address.");
        return;
      }
      if (next.toLowerCase() === currentEmail.toLowerCase()) {
        setEmailError("Enter an address different from the current one.");
        return;
      }
    }

    // The dialog closes only once the change is recorded, so a refused command
    // is answered where it was issued rather than behind a vanished dialog.
    recovery
      .mutateAsync({ tenantId, invitationId, email: email.trim() })
      .then(() => {
        onCompleted?.();
        onClose();
      })
      .catch(() => {
        // Reported inline by the mutation's error state.
      });
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.consequence}</DialogDescription>
        </DialogHeader>

        {/* The address the action acts on, stated where the decision is made
            rather than left to be remembered from the surface behind. */}
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {/* Revoking sends nothing, so it names the invitation rather than
                claiming a destination. */}
            {action === "replace"
              ? "Current email"
              : action === "revoke"
                ? "Invitation for"
                : "Sends to"}
          </span>{" "}
          <span className="font-medium text-foreground [overflow-wrap:anywhere]">
            {currentEmail}
          </span>
        </div>

        {action === "replace" ? (
          <div className="space-y-2">
            <Label htmlFor="replacement-email">New administrator email</Label>
            <Input
              id="replacement-email"
              type="email"
              value={email}
              autoFocus
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "replacement-email-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError(null);
              }}
            />
            {emailError ? (
              <p id="replacement-email-error" className="text-sm text-destructive">
                {emailError}
              </p>
            ) : null}
          </div>
        ) : null}

        {recovery.error ? <RecoveryFailure error={recovery.error} /> : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={recovery.isLoading}>
            Cancel
          </Button>
          <AsyncButton
            onClick={confirm}
            pending={recovery.isLoading}
            variant={action === "revoke" ? "destructive" : "default"}
          >
            {copy.confirm}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Failures are separated by what the operator can do about them. A stale
 * command, a withdrawn permission and an unreachable service all refuse the
 * same request and need different responses.
 */
export function RecoveryFailure({ error }: { error: Error }) {
  const kind = failureKind(error);

  const message =
    kind === "conflict"
      ? "The invitation changed before this action ran. The tenant has been refreshed to its current state."
      : kind === "permission"
        ? "Your Platform administration access has changed. Sign in again to continue."
        : kind === "not-found"
          ? "This invitation no longer exists. The tenant has been refreshed."
          : kind === "unavailable"
            ? "The service is unavailable right now. Nothing was changed — try again shortly."
            : (failureMessage(error) ?? "The action could not be completed.");

  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
