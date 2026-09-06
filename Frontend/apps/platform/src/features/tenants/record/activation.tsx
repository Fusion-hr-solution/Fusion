"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import type { BootstrapInvitationSummary, TenantDetail } from "../api";
import {
  DELIVERY_LABEL,
  INVITATION_LABEL,
  INVITATION_TONE,
  daysUntil,
  formatDate,
} from "../language";
import { ActivationProgression, type ActivationPhase } from "./activation-progression";
import {
  FactTile,
  IconTile,
  RecordSurface,
  StatusBlock,
  StatusGrid,
} from "./record-ui";
import { RecoveryActions } from "./recovery-actions";
import { activationCompletedAt } from "./tenant-record-facts";

/**
 * Administrator activation, which is a condition of the tenant rather than the
 * tenant's purpose.
 *
 * While it is unresolved it is the one thing on the record that someone still
 * owes, so Overview leads with it and it is the only surface allowed emphasis.
 * Once it resolves it becomes a completed fact and the record's weight moves to
 * what the tenant actually is. The full invitation and every recovery live under
 * Access, which is their durable home.
 */

export function activationPhase(tenant: TenantDetail): ActivationPhase {
  if (tenant.administratorActivationStatus === "Active") {
    return "active";
  }

  const invitation = tenant.bootstrapInvitation;
  if (!invitation || invitation.state !== "Pending") {
    return "blocked";
  }

  return invitation.lastDelivery?.outcome === "Failed"
    ? "pending-delivery-failed"
    : "pending-sent";
}

interface Responsibility {
  label: string;
  detail: string;
  isPlatform: boolean;
  icon: LucideIcon;
}

/**
 * Who the tenant is waiting on, said plainly.
 *
 * A blocked invitation names what happened to it rather than only its
 * consequence: "expired" and "revoked" call for the same recovery but are not
 * the same event, and an operator deciding whether to reissue or to nominate
 * someone else needs to know which one it was.
 */
export function responsibility(
  phase: ActivationPhase,
  invitation?: BootstrapInvitationSummary | null
): Responsibility {
  switch (phase) {
    case "active":
      return {
        label: "Administrator access established",
        detail: "The invited administrator has activated this tenant.",
        isPlatform: false,
        icon: ShieldCheck,
      };

    case "pending-delivery-failed":
      return {
        label: "Platform action required",
        detail:
          "The invitation remains valid, but its message could not be delivered.",
        isPlatform: true,
        icon: TriangleAlert,
      };

    case "blocked":
      return {
        label:
          invitation?.state === "Expired"
            ? "Invitation expired"
            : invitation?.state === "Revoked"
              ? "Invitation revoked"
              : "Platform action required",
        detail: "No active invitation remains.",
        isPlatform: true,
        icon: TriangleAlert,
      };

    default:
      return {
        label: "Waiting for the invited administrator",
        detail: "The invitation was delivered and has not been used yet.",
        isPlatform: false,
        icon: Clock,
      };
  }
}

/**
 * The invitation as a surface, in the one shape both destinations need.
 *
 * Overview and Access ask different things of it — Overview leads with the
 * state and offers the single next action, Access owns the full recovery set —
 * but the state, its responsibility line, the invited address and the facts are
 * identical, so they are stated once.
 */
function ActivationPanel({
  id,
  eyebrow,
  tenant,
  children,
  footer,
}: {
  id: string;
  eyebrow: string;
  tenant: TenantDetail;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const invitation = tenant.bootstrapInvitation;
  const phase = activationPhase(tenant);
  const { label, detail, isPlatform, icon } = responsibility(phase, invitation);

  return (
    <RecordSurface
      id={id}
      title={eyebrow}
      headline={label}
      description={detail}
      icon={icon}
      tone={isPlatform ? "attention" : phase === "active" ? "positive" : "neutral"}
      emphasis
      footer={footer}
    >
      {invitation ? (
        <>
          <InvitedAdministrator
            invitation={invitation}
            label={phase === "active" ? "Administrator" : "Invited administrator"}
          />
          <InvitationFacts invitation={invitation} className="mt-4" />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          This tenant has no invitation on record.
        </p>
      )}

      {children}
    </RecordSurface>
  );
}

/**
 * Overview's conditional attention surface: who was invited, whether the
 * invitation can still work, whether its message arrived, who acts next and
 * what the platform can do — in that order, because that is the order the
 * question is actually asked.
 */
export function ActivationAttention({
  tenant,
  accessHref,
}: {
  tenant: TenantDetail;
  accessHref: string;
}) {
  const invitation = tenant.bootstrapInvitation;
  const phase = activationPhase(tenant);

  return (
    <ActivationPanel
      id="activation-title"
      eyebrow="Administrator activation"
      tenant={tenant}
      footer={
        // The next action, and the way to the rest of them. Overview does not
        // carry the full recovery surface; Access owns it.
        <div className="flex flex-wrap items-center justify-between gap-3">
          {invitation && invitation.allowedActions.length > 0 ? (
            <RecoveryActions
              tenantId={tenant.tenantId}
              invitation={invitation}
              phase={phase}
              scope="next-action"
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              No recovery action applies.
            </span>
          )}

          <Button asChild variant="ghost" size="sm" className="-mr-2">
            <Link href={accessHref}>
              Manage in Access
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>
      }
    >
      <div className="mt-5 border-t border-border/70 pt-4">
        <ActivationProgression phase={phase} />
      </div>
    </ActivationPanel>
  );
}

/**
 * Access's permanent home for the invitation: the same facts, plus every
 * recovery the current state permits.
 */
export function InvitationRecord({ tenant }: { tenant: TenantDetail }) {
  const invitation = tenant.bootstrapInvitation;
  const phase = activationPhase(tenant);
  const completedAt = activationCompletedAt(tenant.history);

  return (
    <ActivationPanel
      id="invitation-title"
      eyebrow="Initial administrator"
      tenant={tenant}
      footer={
        invitation && invitation.allowedActions.length > 0 ? (
          <RecoveryActions
            tenantId={tenant.tenantId}
            invitation={invitation}
            phase={phase}
          />
        ) : undefined
      }
    >
      <div className="mt-5 border-t border-border/70 pt-4">
        <div className="flex items-start gap-3">
          <ShieldCheck
            aria-hidden="true"
            className={
              phase === "active"
                ? "mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                : "mt-0.5 size-4 shrink-0 text-muted-foreground"
            }
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {phase === "active" ? "Tenant access established" : "On activation"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {phase === "active"
                ? `Active membership and tenant administrator access${
                    completedAt ? ` since ${formatDate(completedAt)}` : ""
                  }.`
                : "Active membership and tenant administrator access will be created."}
            </p>
          </div>
        </div>
      </div>
    </ActivationPanel>
  );
}

/**
 * The same concern once it is settled: a completed milestone stated compactly,
 * so a tenant's onboarding does not remain its identity for the rest of its
 * life — but with enough presence to still be a finding rather than a footnote.
 */
export function ActivationCompleted({
  tenant,
  accessHref,
}: {
  tenant: TenantDetail;
  accessHref: string;
}) {
  const completedAt = activationCompletedAt(tenant.history);
  const administrator = tenant.bootstrapInvitation?.email;

  return (
    <section
      aria-labelledby="activation-title"
      className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-border bg-card px-5 py-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <IconTile icon={CheckCircle2} tone="positive" />
        <div className="min-w-0">
          <h2 id="activation-title" className="text-sm font-semibold text-foreground">
            Administrator access established
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            {administrator ? (
              <span className="[overflow-wrap:anywhere]">{administrator}</span>
            ) : null}
            {administrator && completedAt ? (
              <span aria-hidden="true" className="text-border">
                •
              </span>
            ) : null}
            {completedAt ? <span>Activated {formatDate(completedAt)}</span> : null}
          </p>
        </div>
      </div>

      <Button asChild variant="ghost" size="sm" className="-mr-2 shrink-0">
        <Link href={accessHref}>
          Access
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </Button>
    </section>
  );
}

/**
 * The invited address, given the weight of a subject rather than of a field.
 * It is the fact the whole surface is about.
 */
function InvitedAdministrator({
  invitation,
  label,
}: {
  invitation: BootstrapInvitationSummary;
  label: string;
}) {
  return <FactTile icon={Mail} label={label} value={invitation.email} />;
}

/**
 * Validity and delivery stay two facts. A valid invitation whose message
 * bounced is recoverable; collapsing them into one status would hide that.
 */
export function InvitationFacts({
  invitation,
  className,
}: {
  invitation: BootstrapInvitationSummary;
  className?: string;
}) {
  const isPending = invitation.state === "Pending";
  const deliveryFailed = invitation.lastDelivery?.outcome === "Failed";
  const remainingDays = daysUntil(invitation.expiresAt);

  return (
    // Four facts when the invitation is live, two once it is settled — either
    // way one row, so the surface does not gain a ragged second line.
    <StatusGrid columns={isPending ? 4 : 2} className={className}>
      <StatusBlock
        label="Invitation"
        value={INVITATION_LABEL[invitation.state]}
        tone={INVITATION_TONE[invitation.state]}
      />

      {isPending ? (
        <StatusBlock
          label="Delivery"
          value={
            invitation.lastDelivery
              ? DELIVERY_LABEL[invitation.lastDelivery.outcome]
              : "Not sent"
          }
          tone={deliveryFailed ? "attention" : "default"}
        />
      ) : null}

      {/* Once the invitation is settled — accepted, expired, revoked or
          replaced — an expiry date is history rather than a deadline. */}
      {isPending ? (
        <StatusBlock
          label="Expires"
          value={
            remainingDays > 1
              ? `In ${remainingDays} days`
              : remainingDays === 1
                ? "Tomorrow"
                : remainingDays === 0
                  ? "Today"
                  : "Expired"
          }
          tone={remainingDays <= 1 ? "attention" : "default"}
        />
      ) : null}

      <StatusBlock label="Invited" value={formatDate(invitation.createdAt)} />
    </StatusGrid>
  );
}
