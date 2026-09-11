"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Mail,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";
import {
  failureMessage,
  type RecoveryAction,
  type TenantContinuityHealth,
  type TenantDetail,
} from "../api";
import { formatDate, formatDateTime, relativeFromNow } from "../language";
import { useInvitationRecovery, useTenantContinuityHealth } from "../queries";
import { destinationHref } from "./record-routes";
import { useTenantRecord } from "./record-shell";

/**
 * The administrative handoff.
 *
 * A freshly provisioned tenant exists but is not yet under customer control —
 * this card is the platform's view of that transfer: who it is going to, how far
 * it has got, and the one action that moves it forward. It shows a single state
 * derived from the invitation and administrative-continuity truth, never a
 * checklist of every possibility, so the operator reads the situation at a
 * glance rather than assembling it.
 *
 * Recovery is the exception it points at rather than performs: a stranded tenant
 * is resolved through the Access destination, which owns the verified recovery
 * flow, so those states link there instead of duplicating the dialog.
 */
export function AdminHandoff() {
  const { tenant, query } = useTenantRecord();
  const { data: continuity } = useTenantContinuityHealth(tenant.tenantId);
  const view = resolveHandoff(tenant, continuity);
  const person = handoffPerson(tenant, continuity);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <UsersRound
          aria-hidden="true"
          className="size-8 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Administrative handoff
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {view.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-4 rounded-xl border border-border bg-background px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar identity={person.identity} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {person.identity}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {person.role}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium",
              TONE_TEXT[view.status.tone]
            )}
          >
            <view.status.icon aria-hidden="true" className="size-4" />
            {view.status.label}
          </span>
          {view.meta ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{view.meta}</p>
          ) : null}
        </div>

        <div className="ml-auto">
          <HandoffAction
            action={view.action}
            accessHref={`${destinationHref(tenant.tenantId, "access")}${query}`}
          />
        </div>
      </div>
    </section>
  );
}

const TONE_TEXT: Record<HandoffTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

function HandoffAction({
  action,
  accessHref,
}: {
  action: HandoffView["action"];
  accessHref: string;
}) {
  const recovery = useInvitationRecovery(
    action?.type === "mutate" ? action.recovery : "resend"
  );
  // The action stays busy across the whole task, not just the request: the
  // mutation invalidates the record, and the button should not become
  // actionable again until that refetched result has settled and the card can
  // re-derive its state. `mutateAsync` resolves only after the awaited
  // invalidation, so it is the honest signal for that whole span.
  const [running, setRunning] = useState(false);

  if (!action) return null;

  if (action.type === "complete") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
        <CircleCheck aria-hidden="true" className="size-4" />
        Handoff complete
      </span>
    );
  }

  if (action.type === "navigate") {
    return (
      <Button
        asChild
        size="sm"
        variant={action.destructive ? "destructive" : "outline"}
      >
        <Link href={accessHref}>{action.label}</Link>
      </Button>
    );
  }

  const busy = running || recovery.isLoading;

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        const reissue = action.recovery === "reissue";
        setRunning(true);
        try {
          await recovery.mutateAsync({
            tenantId: action.tenantId,
            invitationId: action.invitationId,
          });
          toast.success(
            reissue ? "New invitation sent" : "Invitation resent",
            {
              description: reissue
                ? "A fresh onboarding invitation is on its way to the administrator."
                : "The onboarding invitation has been sent again.",
            }
          );
        } catch (error) {
          toast.error(
            reissue
              ? "Couldn't send a new invitation"
              : "Couldn't resend the invitation",
            { description: failureMessage(error) ?? undefined }
          );
        } finally {
          setRunning(false);
        }
      }}
    >
      {busy ? "Working…" : action.label}
    </Button>
  );
}

function PersonAvatar({ identity }: { identity: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/[0.10] text-xs font-semibold text-foreground/75 ring-1 ring-inset ring-border"
    >
      {personInitials(identity)}
    </span>
  );
}

// ── State derivation ───────────────────────────────────

type HandoffTone = "info" | "success" | "warning" | "danger";

interface HandoffView {
  description: string;
  status: { label: string; icon: LucideIcon; tone: HandoffTone };
  meta?: string;
  action:
    | {
        type: "mutate";
        label: string;
        recovery: RecoveryAction;
        tenantId: string;
        invitationId: string;
      }
    | { type: "navigate"; label: string; destructive?: boolean }
    | { type: "complete" }
    | null;
}

/**
 * The single state the handoff is in, in strict precedence: a stranded tenant
 * needing recovery outranks a completed handoff, which outranks the invitation's
 * own progress. Everything the card shows is one of these — it never blends two.
 */
function resolveHandoff(
  tenant: TenantDetail,
  continuity: TenantContinuityHealth | undefined
): HandoffView {
  const recovery = continuity?.recoveryStatus;

  if (recovery === "Required" || recovery === "Failed") {
    return {
      description: "No usable tenant administrator can currently sign in.",
      status: {
        label: "Recovery required",
        icon: TriangleAlert,
        tone: "warning",
      },
      meta: "Administrative continuity needs attention",
      action: {
        type: "navigate",
        label: "Initiate recovery",
        destructive: true,
      },
    };
  }

  if (recovery === "Pending") {
    const recipient = continuity?.latestRecoveryAttempt?.recipientEmail;
    return {
      description: "Administrative access is being restored.",
      status: { label: "Recovery pending", icon: Clock, tone: "warning" },
      meta: recipient ? `Recovery invitation sent to ${recipient}` : undefined,
      action: { type: "navigate", label: "Resend recovery invitation" },
    };
  }

  if (tenant.administratorActivationStatus === "Active") {
    return {
      description:
        "Administrative control has been transferred to the customer.",
      status: { label: "Active", icon: CircleCheck, tone: "success" },
      meta: acceptedMeta(tenant),
      action: { type: "complete" },
    };
  }

  const invitation = tenant.bootstrapInvitation;

  if (invitation) {
    const failed = invitation.lastDelivery?.outcome === "Failed";

    if (invitation.state === "Pending" && failed) {
      return {
        description:
          "The tenant is active, but the invitation was not delivered.",
        status: { label: "Delivery failed", icon: CircleAlert, tone: "danger" },
        meta: invitation.lastDelivery
          ? `Last attempt ${formatDateTime(invitation.lastDelivery.attemptedAt)}`
          : undefined,
        action: resend(tenant.tenantId, invitation.invitationId),
      };
    }

    if (invitation.state === "Pending") {
      return {
        description:
          "Control is being transferred to the customer administrator.",
        status: { label: "Invitation pending", icon: Mail, tone: "warning" },
        meta: `Sent ${relativeFromNow(invitation.createdAt)}`,
        action: resend(tenant.tenantId, invitation.invitationId),
      };
    }

    if (invitation.state === "Expired") {
      return {
        description:
          "The invitation expired before the administrator completed onboarding.",
        status: { label: "Invitation expired", icon: Clock, tone: "warning" },
        meta: `Expired ${formatDate(invitation.expiresAt)}`,
        action: {
          type: "mutate",
          label: "Send new invitation",
          recovery: "reissue",
          tenantId: tenant.tenantId,
          invitationId: invitation.invitationId,
        },
      };
    }

    if (invitation.state === "Revoked") {
      return {
        description: "The invitation was revoked before it was accepted.",
        status: {
          label: "Invitation revoked",
          icon: CircleAlert,
          tone: "danger",
        },
        action: {
          type: "mutate",
          label: "Send new invitation",
          recovery: "reissue",
          tenantId: tenant.tenantId,
          invitationId: invitation.invitationId,
        },
      };
    }
  }

  // Awaiting activation with nothing actionable on the invitation itself — the
  // Access destination is where the administrator picture is resolved.
  return {
    description: "Control has not yet been transferred to the customer.",
    status: { label: "Awaiting administrator", icon: Clock, tone: "info" },
    action: { type: "navigate", label: "View access" },
  };
}

function resend(tenantId: string, invitationId: string): HandoffView["action"] {
  return {
    type: "mutate",
    label: "Resend invitation",
    recovery: "resend",
    tenantId,
    invitationId,
  };
}

/** The activation moment, read from the bootstrap history rather than invented. */
function acceptedMeta(tenant: TenantDetail): string | undefined {
  const completed = tenant.history.find(
    (entry) => entry.eventType === "BootstrapCompleted"
  );
  return completed ? `Accepted ${formatDate(completed.occurredAt)}` : undefined;
}

function handoffPerson(
  tenant: TenantDetail,
  continuity: TenantContinuityHealth | undefined
): { identity: string; role: string } {
  const identity =
    tenant.bootstrapInvitation?.email ??
    continuity?.latestRecoveryAttempt?.recipientEmail ??
    "Tenant administrator";
  return { identity, role: "Tenant HR Administrator" };
}

function personInitials(identity: string): string {
  const local = identity.split("@")[0] ?? identity;
  const parts = local.split(/[.\-_+]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toLocaleUpperCase();
  }
  return local.slice(0, 2).toLocaleUpperCase();
}
