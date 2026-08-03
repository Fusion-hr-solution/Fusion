"use client";

import { UserPlus, UsersRound } from "lucide-react";
import { InvitationRecord } from "./activation";
import { SupportingSurface } from "./record-ui";
import { CapabilityList, UnavailableAction } from "../availability";
import { useTenantRecord } from "./record-shell";
import { SupportAccessPanel } from "./support-access";
import { hasEstablishedAccess } from "./tenant-record-facts";

/**
 * Who can administer this tenant, and how they came to.
 *
 * Access owns the Platform-side identity picture: the initial administrator's
 * invitation, every recovery it permits, and the access outcome activation
 * establishes. It also owns the governed route by which a provider operator
 * could one day reach customer content. It is not the Core HR employee directory
 * and never becomes one.
 *
 * The quieter panels below are the areas a later capability fills. They are
 * visible because their ownership is settled — concealing them would mean
 * rebuilding this destination when they arrive — and they state plainly that
 * they do not work yet, so nothing here reads as a permission problem or as a
 * tenant left half-configured.
 */
export function TenantAccessDestination() {
  const { tenant } = useTenantRecord();
  const established = hasEstablishedAccess(tenant);

  return (
    <div className="space-y-5">
      <InvitationRecord tenant={tenant} />

      <div className="grid gap-5 lg:grid-cols-2">
        <SupportingSurface
          id="administrators-title"
          title="Additional administrators"
          description={
            established
              ? "Further tenant administration will be managed here."
              : "The invited administrator establishes the first tenant access on activation."
          }
          icon={UsersRound}
          action={<UnavailableAction label="Invite administrator" icon={UserPlus} />}
        >
          <CapabilityList
            items={[
              "Additional administrators",
              "Roles and permissions",
              "Delegation and revocation",
              "Administrator recovery",
            ]}
          />
        </SupportingSurface>

        <SupportAccessPanel id="support-access-title" />
      </div>
    </div>
  );
}
