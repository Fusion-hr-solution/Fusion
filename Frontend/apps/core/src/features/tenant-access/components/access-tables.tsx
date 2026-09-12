"use client";

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
  ADMINISTRATOR_STATUS_LABEL,
  ADMINISTRATOR_STATUS_TONE,
  COPY,
  formatDay,
  formatRelativeDays,
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
  return (
    <div className="flex min-w-0 items-center gap-3">
      <IdentityMark name={name} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("type-label truncate", muted ? "text-muted-foreground" : "text-foreground")}>
            {name}
          </span>
          {self ? (
            <span className="type-meta shrink-0 rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
              You
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
    <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-3.5">
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
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Added on</TableHead>
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
                    {ADMINISTRATOR_STATUS_LABEL[administrator.status]}
                  </StatusBadge>
                </TableCell>
                <TableCell className="hidden lg:table-cell type-meta whitespace-nowrap text-muted-foreground">
                  {formatDay(administrator.accessEstablishedAt)}
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Actions for ${administrator.name}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onSelect(administrator.membershipId)}>
                        <SlidersHorizontal className="size-4" />
                        Manage access
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          void navigator.clipboard?.writeText(administrator.email);
                          toast.success("Email address copied.");
                        }}
                      >
                        <Copy className="size-4" />
                        Copy email address
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
  const [replacing, setReplacing] = useState<AdministratorInvitationDto | null>(null);
  const [revoking, setRevoking] = useState<AdministratorInvitationDto | null>(null);

  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();

  async function handleResend(invitation: AdministratorInvitationDto) {
    try {
      const result = await resend.mutateAsync(invitation.invitationId);
      toast.success(
        result.deliveryFailed
          ? `The invitation is still valid, but the email to ${invitation.email} could not be delivered.`
          : `Invitation resent to ${invitation.email}.`
      );
    } catch (error) {
      toast.error(
        problemTypeOf(error) === "invitation-not-pending"
          ? "This invitation is no longer pending."
          : "The invitation could not be resent."
      );
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden lg:table-cell">Expires</TableHead>
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
                      {invitation.deliveryStatus === "Failed" ? "Delivery failed" : "Pending"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell whitespace-nowrap">
                    <p className="type-meta text-foreground">{formatDay(invitation.expiresAt)}</p>
                    <p className={cn("type-meta", overdue ? "text-destructive" : "text-muted-foreground")}>
                      {formatRelativeDays(invitation.expiresAt)}
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
                            <DropdownMenuItem onSelect={() => setReplacing(invitation)}>
                              <PenLine className="size-4" />
                              Change email address
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setRevoking(invitation)}
                            >
                              <Ban className="size-4" />
                              Revoke invitation
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
        title="Revoke invitation"
        consequence={COPY.revokeInvitationConsequence}
        subject={
          revoking
            ? { title: revoking.email, subtitle: `Invited ${formatDay(revoking.issuedAt)}` }
            : undefined
        }
        confirmLabel="Revoke invitation"
        destructive
        busy={revoke.isLoading}
        onOpenChange={(open) => !open && setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          try {
            await revoke.mutateAsync(revoking.invitationId);
            toast.success(`Invitation to ${revoking.email} revoked.`);
          } catch {
            toast.error("The invitation could not be revoked.");
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
                toast.success(`Invitation sent to ${email.trim()}.`);
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

// ── Removed ────────────────────────────────────────────────

export function RemovedTable({ removed }: { removed: RemovedAdministratorDto[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="hidden sm:table-cell">Removed on</TableHead>
            <TableHead>Removed by</TableHead>
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
                {formatDay(person.removedAt)}
              </TableCell>
              <TableCell className="type-meta text-muted-foreground">{person.removedBy}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
