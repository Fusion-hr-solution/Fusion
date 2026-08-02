"use client";

import { Boxes, History, SlidersHorizontal } from "lucide-react";
import { eventActor, formatDateTime } from "../language";
import { ModuleCatalogue, useTenantEntitlements } from "./module-entitlements";
import {
  IconTile,
  RecordSurface,
  SupportingSurface,
} from "./record-ui";
import {
  NOT_CONNECTED,
  UnavailableAction,
} from "../availability";
import { useTenantRecord } from "./record-shell";
import { provisioningOrigin } from "./tenant-record-facts";

/**
 * Which Fusion products this tenant is entitled to.
 *
 * The catalogue is the whole recognised set, not just what the tenant has, so a
 * module that cannot be granted yet is visible as a product gap rather than
 * missing entirely. Entitlement is recorded at provisioning today; changing it
 * afterwards is accepted but not built, and the control that will do it stays
 * in the place it will occupy.
 */
export function TenantEntitlementsDestination() {
  const { tenant } = useTenantRecord();
  const { entitlements, isLoading, error } = useTenantEntitlements(tenant);
  const origin = provisioningOrigin(tenant.history);

  return (
    <div className="space-y-5">
      <RecordSurface
        id="catalogue-title"
        title="Fusion modules"
        description="Every module Fusion recognises, and what this tenant is entitled to."
        icon={Boxes}
        action={
          <UnavailableAction label="Manage entitlements" icon={SlidersHorizontal} />
        }
      >
        <ModuleCatalogue
          entitlements={entitlements}
          isLoading={isLoading}
          error={error}
        />
      </RecordSurface>

      {origin ? (
        // The provisioning decision is the tenant's only entitlement event so
        // far, and it is real. Saying "no history" would be false.
        <RecordSurface
          id="entitlement-history-title"
          title="Entitlement history"
          icon={History}
        >
          <div className="flex items-center gap-3">
            <IconTile icon={History} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Initial entitlements recorded
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <time dateTime={origin.occurredAt}>
                  {formatDateTime(origin.occurredAt)}
                </time>
                <span aria-hidden="true">·</span>
                <span>{eventActor(origin.actorName)}</span>
              </p>
            </div>
          </div>
        </RecordSurface>
      ) : (
        <SupportingSurface
          id="entitlement-history-title"
          title="Entitlement history"
          description="Every change to what this tenant is entitled to."
          icon={History}
        >
          <p className="text-sm font-medium text-muted-foreground">
            {NOT_CONNECTED}
          </p>
        </SupportingSurface>
      )}
    </div>
  );
}
