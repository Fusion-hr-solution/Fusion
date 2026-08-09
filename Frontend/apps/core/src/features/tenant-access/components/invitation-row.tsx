"use client";

import { useState } from "react";
import type { AdministratorInvitationDto } from "@repo/api";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
} from "@repo/ds";
import { AsyncButton } from "@repo/ds/shell";
import { MoreHorizontal } from "lucide-react";
import {
  problemTypeOf,
  useReplaceInvitationEmail,
  useResendInvitation,
  useRevokeInvitation,
} from "../api/use-tenant-access";
import {
  COPY,
  INVITATION_STATE_LABEL,
  INVITATION_STATE_TONE,
  formatDay,
} from "./access-language";
import { ConfirmDialog, IdentityMark, StatusMark } from "./access-ui";

interface InvitationRowProps {
  invitation: AdministratorInvitationDto;
  canManage: boolean;
  onChanged: (message: string) => void;
}

/**
 * A pending invitation sitting in the same list as established administrators.
 *
 * Same list because the question "who can administer this tenant" has to be
 * answerable in one place; visibly different because an invitation is an
 * intention, and a tenant that reads it as access believes it has continuity it
 * does not have.
 */
export function InvitationRow({ invitation, canManage, onChanged }: InvitationRowProps) {
  const [replacing, setReplacing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();

  const isPending = invitation.state === "Pending";

  async function handleResend() {
    setProblem(null);
    try {
      const result = await resend.mutateAsync(invitation.invitationId);
      onChanged(
        result.deliveryFailed
          ? `The invitation is still valid, but the email to ${invitation.email} could not be delivered.`
          : `Invitation resent to ${invitation.email}.`
      );
    } catch (error) {
      // Row-local: one invitation failing says nothing about the others.
      setProblem(
        problemTypeOf(error) === "invitation-not-pending"
          ? "This invitation is no longer pending."
          : "The invitation could not be resent."
      );
    }
  }

  return (
    <>
      <div className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40">
        <IdentityMark invitation />

        <div className="min-w-0 flex-1">
          <p className="truncate type-label text-foreground">{invitation.email}</p>
          <p className="truncate type-meta text-muted-foreground">
            Invited {formatDay(invitation.issuedAt)}
          </p>
          {invitation.deliveryStatus === "Failed" ? (
            <p className="mt-0.5 type-meta text-warning">
              The email could not be delivered. Resend it.
            </p>
          ) : null}
          {problem ? (
            <p role="alert" className="mt-0.5 type-meta text-destructive">
              {problem}
            </p>
          ) : null}
          <div className="mt-1.5 sm:hidden">
            <StatusMark tone={INVITATION_STATE_TONE[invitation.state]}>
              {INVITATION_STATE_LABEL[invitation.state]}
            </StatusMark>
          </div>
        </div>

        <div className="hidden w-32 shrink-0 sm:block">
          <StatusMark tone={INVITATION_STATE_TONE[invitation.state]}>
            {INVITATION_STATE_LABEL[invitation.state]}
          </StatusMark>
        </div>

        <p className="hidden w-40 shrink-0 whitespace-nowrap type-meta text-muted-foreground lg:block">
          {isPending ? `Expires ${formatDay(invitation.expiresAt)}` : ""}
        </p>

        {/* Fixed width, where there is room, so the metadata column lines up
            with the administrator rows above. */}
        <div className="flex shrink-0 items-center justify-end gap-1 lg:w-28">
          {canManage && isPending ? (
            <>
              <AsyncButton
                size="sm"
                variant="outline"
                pending={resend.isLoading}
                onClick={() => void handleResend()}
              >
                Resend
              </AsyncButton>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`More actions for ${invitation.email}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setReplacing(true)}>
                    Change email address
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => setRevoking(true)}>
                    Revoke invitation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </div>

      <ChangeEmailDialog
        invitation={replacing ? invitation : null}
        onClose={() => setReplacing(false)}
        onReplaced={onChanged}
      />

      <ConfirmDialog
        open={revoking}
        title="Revoke invitation"
        consequence={COPY.revokeInvitationConsequence}
        subject={{ title: invitation.email, subtitle: `Invited ${formatDay(invitation.issuedAt)}` }}
        confirmLabel="Revoke invitation"
        destructive
        busy={revoke.isLoading}
        onOpenChange={(open) => !open && setRevoking(false)}
        onConfirm={async () => {
          try {
            await revoke.mutateAsync(invitation.invitationId);
            onChanged(`Invitation to ${invitation.email} revoked.`);
          } catch {
            setProblem("The invitation could not be revoked.");
          }
          setRevoking(false);
        }}
      />
    </>
  );
}

function ChangeEmailDialog({
  invitation,
  onClose,
  onReplaced,
}: {
  invitation: AdministratorInvitationDto | null;
  onClose: () => void;
  onReplaced: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const replace = useReplaceInvitationEmail();

  if (!invitation) {
    return null;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setEmail("");
          setProblem(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change invited address</DialogTitle>
          <DialogDescription>{COPY.replaceEmailConsequence}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="replacement-email">New email address</Label>
          <Input
            id="replacement-email"
            type="email"
            value={email}
            autoFocus
            placeholder={invitation.email}
            aria-invalid={problem !== null}
            onChange={(event) => setEmail(event.target.value)}
          />
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={replace.isLoading}>
            Cancel
          </Button>
          <AsyncButton
            pending={replace.isLoading}
            disabled={email.trim().length === 0 || replace.isLoading}
            onClick={async () => {
              setProblem(null);
              try {
                await replace.mutateAsync({
                  invitationId: invitation.invitationId,
                  email: email.trim(),
                });
                onReplaced(`Invitation sent to ${email.trim()}.`);
                setEmail("");
                onClose();
              } catch (error) {
                switch (problemTypeOf(error)) {
                  case "existing-account":
                    setProblem(COPY.existingAccount);
                    break;
                  case "duplicate-pending-invitation":
                    setProblem(COPY.duplicatePending);
                    break;
                  case "validation-failed":
                    setProblem("Enter a valid email address.");
                    break;
                  default:
                    setProblem("The invitation could not be changed.");
                }
              }
            }}
          >
            Send invitation
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
