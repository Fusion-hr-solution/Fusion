import type { TenantDetail, TenantHistoryEntry } from "../api";

/**
 * What the Platform record can truthfully say about a tenant, derived once so
 * every destination says the same thing.
 *
 * Each function here answers from data the Platform actually owns. Where the
 * answer would require reading a source that is not connected, it returns null
 * and the interface states that instead of guessing — a wrong operational fact
 * on a control-plane record is worse than a missing one.
 */

interface ProvisioningOrigin {
  actorName: string | null;
  occurredAt: string;
}

/**
 * Who provisioned the tenant and when, taken from the provisioning event rather
 * than from the tenant row — the row records the moment, the event records the
 * person. Returns null when history has aged past the bounded window.
 */
export function provisioningOrigin(
  history: readonly TenantHistoryEntry[]
): ProvisioningOrigin | null {
  const provisioned = history.find(
    (entry) => entry.eventType === "TenantProvisioned"
  );

  return provisioned
    ? { actorName: provisioned.actorName, occurredAt: provisioned.occurredAt }
    : null;
}

/**
 * Whether the tenant has a durable membership and administration access.
 *
 * Activation is the only thing that moves a tenant to Active, and it creates
 * both in the same transaction. So the tenant's own status is authoritative for
 * this, and no membership projection is needed to answer it.
 */
export function hasEstablishedAccess(tenant: TenantDetail): boolean {
  return tenant.administratorActivationStatus === "Active";
}

/**
 * Core HR owns its setup state and does not report it to Platform.
 *
 * While no administrator has ever activated, nobody can have entered Core, so
 * `Setup not started` is provable rather than assumed. Once the tenant is
 * Active, Platform genuinely does not know, and says so.
 */
export function coreSetupState(tenant: TenantDetail): string | null {
  return hasEstablishedAccess(tenant) ? null : "Setup not started";
}

/**
 * When the administrator activated, from the event that did it. Null when the
 * tenant has not activated, or when history no longer reaches back that far.
 */
export function activationCompletedAt(
  history: readonly TenantHistoryEntry[]
): string | null {
  return (
    history.find((entry) => entry.eventType === "BootstrapCompleted")
      ?.occurredAt ?? null
  );
}

/**
 * The address the tenant is currently nominated to. Present before activation
 * as the invited address and after it as the administrator who accepted.
 */
export function initialAdministratorEmail(tenant: TenantDetail): string | null {
  return tenant.bootstrapInvitation?.email ?? null;
}

/**
 * The most recent events, newest first. The projection already orders them, but
 * a preview must not depend on that silently.
 */
export function recentEvents(
  history: readonly TenantHistoryEntry[],
  limit: number
): TenantHistoryEntry[] {
  return [...history]
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    )
    .slice(0, limit);
}
