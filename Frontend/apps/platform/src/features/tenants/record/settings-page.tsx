"use client";

import { Clock, Fingerprint, Globe, Languages, Pencil } from "lucide-react";
import {
  FactTile,
  RecordSurface,
  StatusBlock,
  StatusGrid,
} from "./record-ui";
import { UnavailableAction } from "../availability";
import {
  labelForLocale,
  labelForTimeZone,
} from "../provisioning/provisioning-options";
import { TENANT_STATUS_LABEL, formatDate } from "../language";
import { TenantIdentifier, useTenantRecord } from "./record-shell";
import { provisioningOrigin } from "./tenant-record-facts";

/**
 * The Platform-owned configuration this tenant was established with.
 *
 * Read-only, because nothing in the current feature can change it: the regional
 * defaults are recorded at provisioning, and the identity facts are immutable
 * by design. Editing them afterwards is accepted product direction but is not
 * built, so the control that will do it is present and unavailable rather than
 * a form that cannot be submitted.
 */
export function TenantSettingsDestination() {
  const { tenant } = useTenantRecord();
  const origin = provisioningOrigin(tenant.history);

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <RecordSurface
        id="regional-defaults-title"
        title="Regional defaults"
        description="Applied to this tenant's workspace unless a person overrides them."
        icon={Globe}
        action={<UnavailableAction label="Edit settings" icon={Pencil} />}
      >
        {/* Settings, not table rows: each default is a decision someone made
            at provisioning and may need to check at a glance. */}
        <ul className="space-y-3">
          <FactTile
            as="li"
            icon={Clock}
            label="Time zone"
            value={labelForTimeZone(tenant.timeZone)}
          />
          <FactTile
            as="li"
            icon={Languages}
            label="Locale"
            value={labelForLocale(tenant.locale)}
          />
        </ul>
      </RecordSurface>

      <RecordSurface
        id="tenant-identity-title"
        title="Tenant identity"
        description="Fixed at provisioning and never reassigned."
        icon={Fingerprint}
      >
        <StatusGrid className="gap-y-4">
          <StatusBlock label="Tenant name" value={tenant.name} />
          <StatusBlock
            label="Tenant ID"
            value={
              <TenantIdentifier tenantId={tenant.tenantId} showLabel={false} />
            }
          />
          <StatusBlock
            label="Status"
            value={TENANT_STATUS_LABEL[tenant.administratorActivationStatus]}
            tone={
              tenant.administratorActivationStatus === "Active"
                ? "positive"
                : "default"
            }
          />
          <StatusBlock
            label="Created"
            value={formatDate(tenant.createdAt)}
            hint={origin?.actorName ? `By ${origin.actorName}` : undefined}
          />
        </StatusGrid>
      </RecordSurface>
    </div>
  );
}
