"use client";

import { useAccessWords } from "./access-language";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type {
  AdministratorInvitationDto,
  RemovedAdministratorDto,
  TenantAdministratorDto,
} from "@repo/api";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@repo/ds";
import { AsyncButton, StatusBadge } from "@repo/ds/shell";
import { Ban, Copy, MoreHorizontal, PenLine, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  problemTypeOf,
  useReplaceInvitationEmail,
  useResendInvitation,
  useRevokeInvitation,
} from "../api/use-tenant-access";
import {
  ADMINISTRATOR_STATUS_TONE,
  isPast,
} from "./access-language";
import { ConfirmDialog, IdentityMark } from "./access-ui";

const STATUS_BADGE_TONE = {
  positive: "success",
  caution: "warning",
  neutral: "neutral",
  muted: "muted",
} as const;

/** A person as an identity, not a string: mark, name, and an optional self tag. */
function PersonCell({
  name,
  email,
  self,
  muted,
}: {
  name: string;
  email?: string;
  self?: boolean;
  muted?: boolean;
}) {
  const t = useTranslations("admins");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <IdentityMark name={name} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("type-label truncate", muted ? "text-muted-foreground" : "text-foreground")}>
            {name}
          </span>
          {self ? (
            <span className="type-meta shrink-0 rounded-detail bg-primary-tint px-1.5 py-0.5 font-medium text-primary-ink">
              {t("table.you")}
            </span>
          ) : null}
        </div>
        {email ? <p className="truncate type-meta text-muted-foreground md:hidden">{email}</p> : null}
      </div>
    </div>
  );
}

/** A quiet, bordered surface an empty section stands on rather than collapsing. */
export function EmptyStateCard({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-surface border border-dashed px-4 py-3.5">
      <span aria-hidden className="shrink-0 text-muted-foreground/50">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="type-label text-foreground">{title}</p>
        {hint ? <p className="type-meta text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <h3 className="type-subsection-title text-foreground">
      {title} <span className="text-muted-foreground">({count})</span>
    </h3>
  );
}

// ── Administrators ─────────────────────────────────────────

export function AdministratorTable({
  administrators,
  currentUserId,
  selectedId,
  onSelect,
}: {
  administrators: TenantAdministratorDto[];
  currentUserId: string | null;
  selectedId: string | null;
  onSelect: (membershipId: string) => void;
}) {
  const t = useTranslations("admins");
  const words = useAccessWords();
  return (
    <div className="overflow-x-auto rounded-surface border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("table.name")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("table.email")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("table.status")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("table.addedOn")}</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {administrators.map((administrator) => {
            const isSelf = administrator.userId === currentUserId;
            const isSelected = administrator.membershipId === selectedId;
            const tone = STATUS_BADGE_TONE[ADMINISTRATOR_STATUS_TONE[administrator.status]];

            return (
              <TableRow
                key={administrator.membershipId}
                data-state={isSelected ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => onSelect(administrator.membershipId)}
              >
                <TableCell>
                  <PersonCell name={administrator.name} email={administrator.email} self={isSelf} />
                </TableCell>
                <TableCell className="hidden md:table-cell type-meta text-muted-foreground">
                  {administrator.email}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge tone={tone} dot>
                    {words.status(administrator.status)}
                  </StatusBadge>
                </TableCell>
                <TableCell className="hidden lg:table-cell type-meta whitespace-nowrap text-muted-foreground">
                  {words.day(administrator.accessEstablishedAt)}
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("table.actionsFor", { name: administrator.name })}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onSelect(administrator.membershipId)}>
                        <SlidersHorizontal className="size-4" />
                        {t("table.manage")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          void navigator.clipboard?.writeText(administrator.email);
                          toast.success(t("table.copied"));
                        }}
                      >
                        <Copy className="size-4" />
                        {t("table.copy")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}


// ── Invitations ────────────────────────────────────────────

export function InvitationsTable({
  invitations,
  canManage,
}: {
  invitations: AdministratorInvitationDto[];
  canManage: boolean;
}) {
  const t = useTranslations("admins");
  const words = useAccessWords();
  const [replacing, setReplacing] = useState<AdministratorInvitationDto | null>(null);
  const [revoking, setRevoking] = useState<AdministratorInvitationDto | null>(null);

  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();

  async function handleResend(invitation: AdministratorInvitationDto) {
    try {
      const result = await resend.mutateAsync(invitation.invitationId);
      toast.success(
        result.deliveryFailed
          ? t("table.resendFailedDelivery", { email: invitation.email })
          : t("table.resent", { email: invitation.email })
      );
    } catch (error) {
      toast.error(
        problemTypeOf(error) === "invitation-not-pending"
          ? t("table.notPending")
          : t("table.resendFailed")
      );
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-surface border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("table.name")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("table.email")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("table.status")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("table.expires")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => {
              const overdue = isPast(invitation.expiresAt);
              return (
                <TableRow key={invitation.invitationId} className="hover:bg-transparent">
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <IdentityMark invitation />
                      <div className="min-w-0">
                        <p className="truncate type-label text-foreground">
                          {invitation.name || invitation.email}
                        </p>
                        <p className="truncate type-meta text-muted-foreground md:hidden">
                          {invitation.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell type-meta text-muted-foreground">
                    {invitation.email}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StatusBadge tone="warning" dot>
                      {invitation.deliveryStatus === "Failed" ? t("table.deliveryFailed") : t("table.pending")}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell whitespace-nowrap">
                    <p className="type-meta text-foreground">{words.day(invitation.expiresAt)}</p>
                    <p className={cn("type-meta", overdue ? "text-destructive" : "text-muted-foreground")}>
                      {words.relativeDays(invitation.expiresAt)}
                    </p>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <div className="flex items-center justify-end gap-1">
                        <AsyncButton
                          size="sm"
                          variant="outline"
                          pending={resend.isLoading}
                          onClick={() => void handleResend(invitation)}
                        >
                          {t("table.resend")}
                        </AsyncButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={t("table.moreFor", { email: invitation.email })}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setReplacing(invitation)}>
                              <PenLine className="size-4" />
                              {t("table.changeEmail")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setRevoking(invitation)}
                            >
                              <Ban className="size-4" />
                              {t("table.revoke")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ChangeEmailDialog invitation={replacing} onClose={() => setReplacing(null)} />

      <ConfirmDialog
        open={revoking !== null}
        title={t("table.revoke")}
        consequence={words.copy("revokeInvitationConsequence")}
        subject={
          revoking
            ? { title: revoking.email, subtitle: t("table.invitedOn", { date: words.day(revoking.issuedAt) }) }
            : undefined
        }
        confirmLabel={t("table.revoke")}
        destructive
        busy={revoke.isLoading}
        onOpenChange={(open) => !open && setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          try {
            await revoke.mutateAsync(revoking.invitationId);
            toast.success(t("table.revoked", { email: revoking.email }));
          } catch {
            toast.error(t("table.revokeFailed"));
          }
          setRevoking(null);
        }}
      />
    </>
  );
}

function ChangeEmailDialog({
  invitation,
  onClose,
}: {
  invitation: AdministratorInvitationDto | null;
  onClose: () => void;
}) {
  const t = useTranslations("admins");
  const words = useAccessWords();
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const replace = useReplaceInvitationEmail();

  if (!invitation) return null;

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
          <DialogTitle>{t("table.changeTitle")}</DialogTitle>
          <DialogDescription>{words.copy("replaceEmailConsequence")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="replacement-email">{t("table.newEmail")}</Label>
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
            {t("table.cancel")}
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
                toast.success(t("table.sent", { email: email.trim() }));
                setEmail("");
                onClose();
              } catch (error) {
                switch (problemTypeOf(error)) {
                  case "existing-account":
                    setProblem(words.copy("existingAccount"));
                    break;
                  case "duplicate-pending-invitation":
                    setProblem(words.copy("duplicatePending"));
                    break;
                  case "validation-failed":
                    setProblem(t("table.invalidEmail"));
                    break;
                  default:
                    setProblem(t("table.changeFailed"));
                }
              }
            }}
          >
            {t("table.send")}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Removed ────────────────────────────────────────────────

export function RemovedTable({ removed }: { removed: RemovedAdministratorDto[] }) {
  const t = useTranslations("admins");
  const words = useAccessWords();
  return (
    <div className="overflow-x-auto rounded-surface border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("table.name")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("table.email")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("table.removedOn")}</TableHead>
            <TableHead>{t("table.removedBy")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {removed.map((person) => (
            <TableRow key={person.membershipId} className="hover:bg-transparent">
              <TableCell>
                <PersonCell name={person.name} email={person.email} muted />
              </TableCell>
              <TableCell className="hidden md:table-cell type-meta text-muted-foreground">
                {person.email}
              </TableCell>
              <TableCell className="hidden sm:table-cell type-meta whitespace-nowrap text-muted-foreground">
                {words.day(person.removedAt)}
              </TableCell>
              <TableCell className="type-meta text-muted-foreground">{person.removedBy}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
