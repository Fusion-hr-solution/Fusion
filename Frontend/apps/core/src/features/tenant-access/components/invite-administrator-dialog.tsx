"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@repo/ds";
import { AsyncButton } from "@repo/ds/shell";
import { problemTypeOf, useInviteAdministrator } from "../api/use-tenant-access";
import { COPY } from "./access-language";

interface InviteAdministratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (email: string, deliveryFailed: boolean) => void;
}

/**
 * One step, one field.
 *
 * There is nothing to choose here: the access being granted is fixed, so a role
 * picker or a permissions matrix would invent a decision the product does not
 * have. What the recipient will receive is stated once, plainly, and the dialog
 * stops there rather than becoming a policy document.
 */
export function InviteAdministratorDialog({
  open,
  onOpenChange,
  onInvited,
}: InviteAdministratorDialogProps) {
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const invite = useInviteAdministrator();

  useEffect(() => {
    if (open) {
      setEmail("");
      setProblem(null);
    }
  }, [open]);

  const trimmed = email.trim();
  const canSubmit = trimmed.length > 0 && !invite.isLoading;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setProblem(null);

    try {
      const result = await invite.mutateAsync(trimmed);
      onInvited(trimmed, result.deliveryFailed);
      onOpenChange(false);
    } catch (error) {
      // The address stays in the field on every recoverable failure — retyping it
      // is wasted effort the person already spent.
      switch (problemTypeOf(error)) {
        case "duplicate-pending-invitation":
          setProblem(COPY.duplicatePending);
          break;
        case "existing-account":
          setProblem(COPY.existingAccount);
          break;
        case "validation-failed":
          setProblem("Enter a valid email address.");
          break;
        case "permission-denied":
          setProblem(COPY.authorizationChanged);
          break;
        default:
          setProblem("The invitation could not be sent.");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Invite administrator</DialogTitle>
            <DialogDescription>
              The recipient will be granted Tenant Administrator access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="administrator-email">Email address</Label>
            <Input
              id="administrator-email"
              type="email"
              value={email}
              autoFocus
              autoComplete="off"
              placeholder="name@example.com"
              aria-invalid={problem !== null}
              aria-describedby={problem ? "administrator-email-problem" : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
            {problem ? (
              <p id="administrator-email-problem" role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={invite.isLoading}
            >
              Cancel
            </Button>
            <AsyncButton type="submit" pending={invite.isLoading} disabled={!canSubmit}>
              Send invitation
            </AsyncButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
