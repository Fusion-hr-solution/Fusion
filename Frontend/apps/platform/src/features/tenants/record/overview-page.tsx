"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Boxes,
  Gauge,
  ScrollText,
  UsersRound,
} from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import type { TenantDetail } from "../api";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { ActivationAttention, ActivationCompleted } from "./activation";
import { EntitlementState, useTenantEntitlements } from "./module-entitlements";
import {
  RecordEmpty,
  RecordSurface,
  StatusBlock,
  StatusGrid,
  SupportingSurface,
} from "./record-ui";
import {
  CapabilityList,
  NOT_CONNECTED,
} from "../availability";
import { useTenantRecord } from "./record-shell";
import { NO_EVENTS, SupportAccessPanel } from "./support-access";
import { EventTimeline } from "./tenant-events";
import {
  coreSetupState,
  hasEstablishedAccess,
  initialAdministratorEmail,
  recentEvents,
} from "./tenant-record-facts";

/**
 * The tenant's executive and operational summary.
 *
 * Ordered by what a Platform Administrator needs first: anything unresolved,
 * then what the tenant is, then how it is running, then what has happened. Each
 * summary is bounded and hands off to the destination that owns the detail, so
 * Overview never becomes a second copy of the whole record.
 *
 * The composition is deliberately uneven. Three solid summaries carry the
 * tenant's real facts; the areas whose sources are not connected sit together
 * in a quieter right-hand column, where they hold their place without competing
 * with information that exists.
 */

const ACTIVITY_PREVIEW = 4;

export function TenantOverviewDestination() {
  const { tenant, query } = useTenantRecord();
  const to = (segment: string) => `/tenants/${tenant.tenantId}/${segment}${query}`;
  const isActive = hasEstablishedAccess(tenant);

  return (
    <div className="space-y-5">
      {/* Unresolved activation dominates. Once settled it becomes one compact
          line, so a tenant's onboarding does not stay its identity forever. */}
      {isActive ? (
        <ActivationCompleted tenant={tenant} accessHref={to("access")} />
      ) : (
        <ActivationAttention tenant={tenant} accessHref={to("access")} />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <AccessSummary tenant={tenant} accessHref={to("access")} />
        <EntitlementSummary tenant={tenant} entitlementsHref={to("entitlements")} />
        <OperationsSummary tenant={tenant} operationsHref={to("operations")} />
      </div>

      {/* items-start so a short activity list is not stretched to match the
          column beside it, which would leave an empty state floating in a
          void the content never asked for. */}
      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {/* Stacked, the secondary summaries come before history: what the
            tenant is outranks what has happened to it. Side by side, history
            takes the wider column and they move to the rail beside it. */}
        <div className="order-1 space-y-5 lg:order-2">
          <TenantFootprint />
          <SupportAccessPanel id="support-access-summary-title" />
        </div>
        {/* No explicit row: `order` alone puts history first on wide screens.
            Pinning it to row 1 while the rail was ordered after it forced the
            rail into a second row, which left a tall empty band under the
            page and made the document itself scroll. */}
        <RecentActivity
          tenant={tenant}
          auditHref={to("audit")}
          className="order-2 lg:order-1 lg:col-span-2"
        />
      </div>
    </div>
  );
}

function AccessSummary({
  tenant,
  accessHref,
}: {
  tenant: TenantDetail;
  accessHref: string;
}) {
  const administrator = initialAdministratorEmail(tenant);
  const established = hasEstablishedAccess(tenant);

  return (
    <RecordSurface
      id="access-summary-title"
      title="Administrators and access"
      icon={UsersRound}
      action={<DestinationLink href={accessHref} label="Access" />}
    >
      <StatusGrid className="gap-y-4">
        {/* The administrator is what the other two are about, so it takes the
            full width and they sit beneath it as a pair. */}
        <StatusBlock
          wide
          label="Initial administrator"
          value={administrator ?? "None nominated"}
          tone={administrator ? "default" : "muted"}
        />
        <StatusBlock
          label="Membership"
          value={established ? "Active" : "Not yet established"}
          tone={established ? "positive" : "muted"}
        />
        <StatusBlock
          label="Administration access"
          value={established ? "Granted" : "Not yet granted"}
          tone={established ? "positive" : "muted"}
        />
      </StatusGrid>
    </RecordSurface>
  );
}

function EntitlementSummary({
  tenant,
  entitlementsHref,
}: {
  tenant: TenantDetail;
  entitlementsHref: string;
}) {
  const { granted, entitlements, isLoading, error } = useTenantEntitlements(tenant);

  return (
    <RecordSurface
      id="entitlement-summary-title"
      title="Entitlements"
      icon={Boxes}
      action={<DestinationLink href={entitlementsHref} label="Entitlements" />}
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          Entitlements could not be loaded.
        </p>
      ) : (
        <>
          {/* A real number, so it is allowed to be the largest thing here. */}
          <p className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold leading-none tracking-tight text-foreground">
              {granted.length}
            </span>
            <span className="text-sm text-muted-foreground">
              of {entitlements.length} modules enabled
            </span>
          </p>

          <ul className="mt-4 space-y-2.5 text-sm">
            {granted.map(({ option, state, setupState }) => (
              // Wraps rather than truncates: "Core HR" squeezed to "Core H…"
              // beside a long setup state helps nobody.
              <li
                key={option.key}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5"
              >
                <span className="font-medium text-foreground">{option.label}</span>
                <EntitlementState state={state} setupState={setupState} />
              </li>
            ))}
          </ul>
        </>
      )}
    </RecordSurface>
  );
}

function OperationsSummary({
  tenant,
  operationsHref,
}: {
  tenant: TenantDetail;
  operationsHref: string;
}) {
  const setup = coreSetupState(tenant);
  const delivery = tenant.bootstrapInvitation?.lastDelivery;

  return (
    <RecordSurface
      id="operations-summary-title"
      title="Operations"
      icon={Activity}
      action={<DestinationLink href={operationsHref} label="Operations" />}
    >
      <StatusGrid columns={1} className="gap-y-4">
        <StatusBlock
          label="Core HR setup"
          value={setup ?? NOT_CONNECTED}
          tone={setup ? "default" : "muted"}
        />
        <StatusBlock
          // "Last": once an invitation is revoked or expired its delivery is
          // history, and an unqualified label would read as current.
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
  );
}

/**
 * The aggregates a Platform Administrator is authorised to see about a tenant's
 * size and use. None of their owning domains publishes a Platform projection
 * yet, so the area says so once and names what will fill it.
 *
 * A zero here would be a lie with the same shape as the truth — a tenant with
 * no employees and a tenant whose employee count nobody has connected would
 * read identically. The place is held; the number is not invented.
 */
const FOOTPRINT_AGGREGATES = [
  "Employees",
  "Identity accounts",
  "Tenant administrators",
  "Managers",
  "Organizational units",
  "Last customer activity",
];

function TenantFootprint() {
  return (
    <SupportingSurface
      id="footprint-title"
      title="Tenant footprint"
      description="How large this tenant is and how it is being used."
      icon={Gauge}
    >
      <CapabilityList state={NOT_CONNECTED} items={FOOTPRINT_AGGREGATES} />
    </SupportingSurface>
  );
}

function RecentActivity({
  tenant,
  auditHref,
  className,
}: {
  tenant: TenantDetail;
  auditHref: string;
  className?: string;
}) {
  // Copies and sorts the whole history to take four; not worth redoing per render.
  const entries = useMemo(
    () => recentEvents(tenant.history, ACTIVITY_PREVIEW),
    [tenant.history]
  );

  return (
    <RecordSurface
      id="activity-summary-title"
      title="Recent activity"
      icon={ScrollText}
      action={<DestinationLink href={auditHref} label="Audit" />}
      className={className}
      bodyClassName={entries.length === 0 ? "pt-0" : undefined}
    >
      {entries.length === 0 ? (
        <RecordEmpty
          icon={ScrollText}
          {...NO_EVENTS}
          compact
        />
      ) : (
        <EventTimeline entries={entries} />
      )}
    </RecordSurface>
  );
}

/** The way from a bounded summary to the destination that owns the detail. */
function DestinationLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-mr-2 -mt-1">
      {/* Labelled rather than padded with a hidden span: `sr-only` is
          absolutely positioned and would escape the scroll container. */}
      <Link href={href} aria-label={`Go to ${label}`}>
        {label}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </Button>
  );
}
