"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
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
import { ApiError } from "@repo/api";
import { useInitiateAdministratorRecovery } from "../queries";

interface AdministratorRecoveryDialogProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInitiated: () => void;
}

/**
 * Starting Platform-assisted recovery.
 *
 * Two fields, because recovery is a narrow exception rather than a case-handling
 * workflow: who the verified customer representative is, and a statement that
 * the verification actually happened. Fusion deliberately stores no identity
 * documents or contact records — an optional reference points at wherever that
 * verification lives.
 */
export function AdministratorRecoveryDialog({
  tenantId,
  open,
  onOpenChange,
  onInitiated,
}: AdministratorRecoveryDialogProps) {
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const initiate = useInitiateAdministratorRecovery();

  useEffect(() => {
    if (open) {
      setEmail("");
      setReference("");
      setAcknowledged(false);
      setProblem(null);
    }
  }, [open]);

  const canSubmit = email.trim().length > 0 && acknowledged && !initiate.isLoading;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setProblem(null);

    try {
      await initiate.mutateAsync({
        tenantId,
        recipientEmail: email.trim(),
        verificationAcknowledged: acknowledged,
        verificationReference: reference.trim() || undefined,
      });
      onInitiated();
      onOpenChange(false);
    } catch (error) {
      // Same envelope shape as everywhere else: the type lives under details.code.
      const details = error instanceof ApiError ? (error.details as { code?: unknown } | null) : null;
      const code = typeof details?.code === "string" ? details.code
        : error instanceof ApiError ? error.code : null;

      switch (code) {
        case "recovery-not-eligible":
          setProblem(
            "This tenant now has a usable Tenant Administrator, so recovery no longer applies."
          );
          break;
        case "recovery-already-pending":
          setProblem("A recovery invitation is already pending for this tenant.");
          break;
        case "existing-account":
          setProblem(
            "This email already belongs to a Fusion account and cannot be used for recovery."
          );
          break;
        case "validation-failed":
          setProblem("Enter a valid recipient email address and confirm the verification.");
          break;
        default:
          setProblem("The recovery invitation could not be sent. Try again.");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Initiate administrator recovery</DialogTitle>
            <DialogDescription>
              Recovery establishes customer-controlled Tenant Administrator access. It does not
              grant Platform access to the tenant workspace or business data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Verified recipient email address</Label>
              <Input
                id="recovery-email"
                type="email"
                value={email}
                autoFocus
                autoComplete="off"
                aria-invalid={problem !== null}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recovery-reference">Verification reference (optional)</Label>
              <Input
                id="recovery-reference"
                value={reference}
                maxLength={128}
                placeholder="e.g. support ticket"
                onChange={(event) => setReference(event.target.value)}
              />
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="recovery-acknowledged"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              <Label htmlFor="recovery-acknowledged" className="text-sm font-normal leading-6">
                I confirm the external customer verification process was completed for this
                recipient.
              </Label>
            </div>

            {problem ? (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={initiate.isLoading}
            >
              Cancel
            </Button>
            <AsyncButton type="submit" pending={initiate.isLoading} disabled={!canSubmit}>
              Send recovery invitation
            </AsyncButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
