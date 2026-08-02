"use client";

import { BadgeCheck, UserPlus, UsersRound } from "lucide-react";
import { InvitationRecord } from "./activation";
import {
  RecordSurface,
  StatusBlock,
  StatusGrid,
  SupportingSurface,
} from "./record-ui";
import { CapabilityList, UnavailableAction } from "../availability";
import { useTenantRecord } from "./record-shell";
import { SupportAccessPanel } from "./support-access";
import { formatDate } from "../language";
import { activationCompletedAt, hasEstablishedAccess } from "./tenant-record-facts";

/**
 * Who can administer this tenant, and how they came to.
 *
 * Access owns the Platform-side identity picture: the initial administrator's
 * invitation and every recovery it permits, the membership and administration
 * access that activation establishes, and the governed route by which a provider
 * operator could one day reach customer content. It is not the Core HR employee
 * directory and never becomes one.
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
  const activatedAt = activationCompletedAt(tenant.history);

  return (
    <div className="space-y-5">
      <InvitationRecord tenant={tenant} />

      <RecordSurface
        id="membership-title"
        title="Membership and administration access"
        description="Established by activation, and the foundation later access management extends."
        icon={BadgeCheck}
      >
        <StatusGrid className="max-w-2xl">
          <StatusBlock
            label="Tenant membership"
            value={established ? "Active" : "Not yet established"}
            tone={established ? "positive" : "muted"}
            hint={
              established && activatedAt
                ? `Since ${formatDate(activatedAt)}`
                : established
                  ? undefined
                  : "Created when the invited administrator activates."
            }
          />
          <StatusBlock
            label="Administration access"
            value={established ? "Tenant administration" : "Not yet granted"}
            tone={established ? "positive" : "muted"}
            hint={
              established
                ? "Durable tenant-scoped access, not temporary bootstrap authority."
                : undefined
            }
          />
        </StatusGrid>
      </RecordSurface>

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
