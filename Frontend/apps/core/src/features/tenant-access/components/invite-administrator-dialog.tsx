"use client";

import { useTranslations } from "next-intl";
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
import { useAccessWords } from "./access-language";

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
  const t = useTranslations("admins");
  const words = useAccessWords();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const invite = useInviteAdministrator();

  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setProblem(null);
    }
  }, [open]);

  const trimmedEmail = email.trim();
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const canSubmit =
    trimmedEmail.length > 0 &&
    trimmedFirst.length > 0 &&
    trimmedLast.length > 0 &&
    !invite.isLoading;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setProblem(null);

    try {
      const result = await invite.mutateAsync({
        email: trimmedEmail,
        firstName: trimmedFirst,
        lastName: trimmedLast,
      });
      onInvited(trimmedEmail, result.deliveryFailed);
      onOpenChange(false);
    } catch (error) {
      // The address stays in the field on every recoverable failure — retyping it
      // is wasted effort the person already spent.
      switch (problemTypeOf(error)) {
        case "duplicate-pending-invitation":
          setProblem(words.copy("duplicatePending"));
          break;
        case "existing-account":
          setProblem(words.copy("existingAccount"));
          break;
        case "validation-failed":
          setProblem(t("invite.invalidEmail"));
          break;
        case "permission-denied":
          setProblem(words.copy("authorizationChanged"));
          break;
        default:
          setProblem(t("invite.failed"));
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("invite.title")}</DialogTitle>
            <DialogDescription>
              {t("invite.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="administrator-first-name">{t("invite.firstName")}</Label>
                <Input
                  id="administrator-first-name"
                  value={firstName}
                  autoFocus
                  autoComplete="off"
                  placeholder={t("invite.firstNamePlaceholder")}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="administrator-last-name">{t("invite.lastName")}</Label>
                <Input
                  id="administrator-last-name"
                  value={lastName}
                  autoComplete="off"
                  placeholder={t("invite.lastNamePlaceholder")}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="administrator-email">{t("invite.email")}</Label>
              <Input
                id="administrator-email"
                type="email"
                value={email}
                autoComplete="off"
                placeholder={t("invite.emailPlaceholder")}
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
              {t("invite.send")}
            </AsyncButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
