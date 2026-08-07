"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@repo/ds";
import { StatusBadge } from "@repo/ds/shell";
import { SupportingSurface } from "./record-ui";
import { AdministratorRecoveryDialog } from "./administrator-recovery-dialog";
import { useTenantContinuityHealth } from "../queries";
import type { RecoveryStatusValue } from "../api";

/**
 * Whether this tenant can still administer itself, and the one exceptional
 * action Platform may take when it cannot.
 *
 * Read-only by design. Inviting, suspending, and removing administrators belong
 * to the customer; offering them here would quietly make Platform a
 * co-administrator of every tenant. The only action is recovery, and it appears
 * only when the tenant has nobody left who can sign in.
 */
export function ContinuityHealth({ tenantId }: { tenantId: string }) {
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const health = useTenantContinuityHealth(tenantId);

  if (health.isLoading) {
    return (
      <SupportingSurface id="continuity-title" title="Administrative continuity" icon={ShieldCheck}>
        <p className="text-sm text-muted-foreground">Checking administrator access…</p>
      </SupportingSurface>
    );
  }

  if (health.error || !health.data) {
    return (
      <SupportingSurface id="continuity-title" title="Administrative continuity" icon={ShieldCheck}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Administrator access could not be read.
          </p>
          <Button variant="outline" size="sm" onClick={() => void health.refetch()}>
            Retry
          </Button>
        </div>
      </SupportingSurface>
    );
  }

  const data = health.data;
  const needsRecovery = data.recoveryStatus === "Required" || data.recoveryStatus === "Failed";

  return (
    <>
      <SupportingSurface
        id="continuity-title"
        title="Administrative continuity"
        description="Whether this customer can administer their own tenant."
        icon={needsRecovery ? ShieldAlert : ShieldCheck}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Metric label="Usable administrators" value={data.usableAdministrators} />
            <Metric label="Suspended" value={data.suspendedAdministrators} />
            <Metric label="Pending invitations" value={data.pendingAdministratorInvitations} />
            <StatusBadge tone={TONE[data.recoveryStatus]}>
              {STATUS_LABEL[data.recoveryStatus]}
            </StatusBadge>
          </div>

          {needsRecovery ? (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <div>
                <p className="font-medium">Administrator recovery required</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No customer administrator can currently access this tenant. Platform-assisted
                  recovery can restore customer-controlled administration without giving Platform
                  operators access to the tenant workspace or HR data.
                </p>
              </div>
              <Button onClick={() => setRecoveryOpen(true)}>Initiate recovery invitation</Button>
            </div>
          ) : null}

          {data.latestRecoveryAttempt ? (
            <div className="rounded-lg border p-4 text-sm">
              <p className="font-medium">
                {data.recoveryStatus === "Completed"
                  ? "Recovery completed"
                  : data.recoveryStatus === "Pending"
                    ? "Recovery in progress"
                    : "Last recovery attempt"}
              </p>
              <dl className="mt-2 space-y-1 text-muted-foreground">
                <Row label="Recipient" value={data.latestRecoveryAttempt.recipientEmail} />
                <Row
                  label="Started"
                  value={new Date(data.latestRecoveryAttempt.initiatedAt).toLocaleString()}
                />
                <Row label="Invitation" value={data.latestRecoveryAttempt.state} />
                {data.latestRecoveryAttempt.deliveryStatus === "Failed" ? (
                  <Row label="Delivery" value="Failed — the invitation is still valid" />
                ) : null}
              </dl>
            </div>
          ) : null}
        </div>
      </SupportingSurface>

      <AdministratorRecoveryDialog
        tenantId={tenantId}
        open={recoveryOpen}
        onOpenChange={setRecoveryOpen}
        onInitiated={() => void health.refetch()}
      />
    </>
  );
}

const STATUS_LABEL: Record<RecoveryStatusValue, string> = {
  NotRequired: "Self-administered",
  AwaitingAdministratorActivation: "Awaiting administrator activation",
  Required: "Recovery required",
  Pending: "Recovery pending",
  Completed: "Recovered",
  Failed: "Recovery failed",
};

const TONE = {
  NotRequired: "success",
  AwaitingAdministratorActivation: "info",
  Required: "danger",
  Pending: "info",
  Completed: "success",
  Failed: "warning",
} as const;

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="text-muted-foreground">{label} </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
