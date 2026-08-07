"use client";

import { InvitationRecord } from "./activation";
import { ContinuityHealth } from "./continuity-health";
import { useTenantRecord } from "./record-shell";

/**
 * Whether this tenant can administer itself, and how it got there.
 *
 * Access owns the Platform-side identity picture: the initial administrator's
 * invitation, every recovery it permits, and the continuity that results. It is
 * not the Core HR employee directory and never becomes one.
 *
 * Read-only apart from one exception. Routine administration — inviting,
 * suspending, removing authority — belongs to the customer and happens in their
 * own workspace. The only thing Platform may do here is restore administration
 * to a tenant that has lost all of it, and even that hands control back to the
 * customer rather than taking it.
 *
 * The placeholder panels that used to sit here are gone. Both now describe
 * things that either exist for real or were never going to: administrator
 * management is the customer's, and an unavailable support-access affordance
 * implied a workflow Fusion does not have.
 */
export function TenantAccessDestination() {
  const { tenant } = useTenantRecord();

  return (
    <div className="space-y-5">
      <InvitationRecord tenant={tenant} />
      <ContinuityHealth tenantId={tenant.tenantId} />
    </div>
  );
}
