"use client";

import { Boxes, Gauge } from "lucide-react";
import {
  RecordSurface,
  StatusBlock,
  StatusGrid,
  SupportingSurface,
} from "./record-ui";
import {
  CapabilityList,
  NOT_AVAILABLE,
  NOT_CONNECTED,
} from "../availability";
import { useTenantRecord } from "./record-shell";
import { coreSetupState, hasEstablishedAccess } from "./tenant-record-facts";

/**
 * How the tenant is running, as far as Platform is authorised and able to see.
 *
 * Deliberately a partial diagnostic view rather than a full one. Every fact
 * here is supplied by the domain that owns it; where no owner publishes one,
 * the destination says the source is not connected instead of inventing a
 * health score, a region, a job count or a readiness figure. A control plane
 * that guesses is worse than one that admits what it cannot see.
 */
export function TenantOperationsDestination() {
  const { tenant } = useTenantRecord();
  const setup = coreSetupState(tenant);
  const established = hasEstablishedAccess(tenant);
  const delivery = tenant.bootstrapInvitation?.lastDelivery;

  return (
    <div className="space-y-5">
      <RecordSurface
        id="tenant-operations-title"
        title="Tenant operations"
        description="Platform-visible facts reported by their owning services."
        icon={Boxes}
      >
        <StatusGrid columns={3}>
          <StatusBlock
            label="Core HR setup"
            value={setup ?? NOT_CONNECTED}
            tone={setup ? "default" : "muted"}
            hint={setup ? undefined : "Core HR owns this state."}
          />
          <StatusBlock
            label="Tenant membership"
            value={established ? "Active" : "Not yet established"}
            tone={established ? "positive" : "muted"}
          />
          <StatusBlock
            label="Last invitation delivery"
            value={
              delivery
                ? delivery.outcome === "Failed"
                  ? "Delivery failed"
                  : "Sent"
                : "No delivery recorded"
            }
            tone={
              delivery?.outcome === "Failed"
                ? "attention"
                : delivery
                  ? "default"
                  : "muted"
            }
          />
        </StatusGrid>
      </RecordSurface>

      {/* Two different silences, kept apart. A source that exists but is not
          wired up is not the same as a workflow nobody has built. */}
      <SupportingSurface
        id="platform-operations-title"
        title="Operational sources"
        description="Usage and cross-domain operations become visible here as their sources connect."
        icon={Gauge}
      >
        <div className="space-y-4">
          <CapabilityList
            state={NOT_CONNECTED}
            items={["Usage and capacity", "Last customer activity"]}
          />
          <CapabilityList
            state={NOT_AVAILABLE}
            items={["Integrations and synchronization", "Imports and processing jobs"]}
          />
        </div>
      </SupportingSurface>
    </div>
  );
}
