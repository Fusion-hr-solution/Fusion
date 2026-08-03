"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Copy, SearchX } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ds/components/ui/tooltip";
import { cn } from "@repo/ds/lib/utils";
import { PageContainer, PageEmpty, PageError, StatusBadge } from "@repo/ds/shell";
import { failureKind, type TenantDetail } from "../api";
import { TENANT_STATUS_LABEL, TENANT_STATUS_TONE, formatDate } from "../language";
import { TenantMonogram } from "../overview/tenant-monogram";
import { useTenantDetail } from "../queries";
import {
  RECORD_DESTINATIONS,
  destinationHref,
  directoryHref,
  isActiveDestination,
  recordQuery,
} from "./record-routes";
import { provisioningOrigin } from "./tenant-record-facts";

/**
 * The tenant's durable Platform record.
 *
 * Everything a Platform Administrator can ask about one customer tenant is
 * answered inside this frame: who administers it, what it is entitled to, how
 * it is running, what has happened to it, and which Platform-owned settings
 * apply. Administrator activation is one conditional concern inside that, not
 * the record's purpose — the frame therefore looks the same before and after a
 * tenant activates, and a later capability fills an area rather than rearranging
 * the record.
 *
 * The record is loaded once, here, and read from context by every destination.
 * Moving between them is navigation within one record, so it must not read as
 * six pages that each fetch a tenant.
 */

interface RecordValue {
  tenant: TenantDetail;
  /** The directory query to return to, decoded. */
  from: string | null;
  /**
   * The suffix every link inside the record must carry so the directory behind
   * it survives. It re-encodes `from` rather than appending it raw — the
   * directory query contains its own `=` and `&`, and splicing it in would make
   * the record's own route absorb it and lose the way back.
   */
  query: string;
  /**
   * Re-reads the record. Shared rather than re-subscribed per destination, so a
   * destination that offers a refresh reuses the one query the shell already
   * holds instead of issuing a second request for the same tenant.
   */
  refresh: () => void;
  isRefreshing: boolean;
}

const RecordContext = createContext<RecordValue | null>(null);

export function useTenantRecord(): RecordValue {
  const value = useContext(RecordContext);
  if (!value) {
    throw new Error("Tenant record destinations must render inside the record shell.");
  }
  return value;
}

export function TenantRecordShell({
  tenantId,
  children,
}: {
  tenantId: string;
  children: ReactNode;
}) {
  const {
    data: tenant,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useTenantDetail(tenantId);
  const searchParams = useSearchParams();

  // Returning lands on the directory the operator left, not an unfiltered one.
  // It is carried across the record's own destinations too, so a detour through
  // Audit does not lose the list behind it.
  const from = searchParams.get("from");
  const query = recordQuery(from);

  // A fresh object here would re-render every consumer on each `isFetching`
  // transition, which is most of the record.
  const record = useMemo<RecordValue | null>(
    () =>
      tenant
        ? {
            tenant,
            from,
            query,
            refresh: refetch,
            isRefreshing: isFetching && !isLoading,
          }
        : null,
    [tenant, from, query, refetch, isFetching, isLoading]
  );

  return (
    <PageContainer width="default">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href={directoryHref(from)}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Tenants
        </Link>
      </Button>

      {isLoading ? <RecordSkeleton /> : null}

      {!isLoading && error ? (
        <RecordFailure error={error} onRetry={refetch} />
      ) : null}

      {!isLoading && !error && tenant && record ? (
        <RecordContext.Provider value={record}>
          <RecordHeader tenant={tenant} />
          <RecordNavigation tenantId={tenant.tenantId} query={query} />
          {children}
        </RecordContext.Provider>
      ) : null}
    </PageContainer>
  );
}

/**
 * The record's identity.
 *
 * The monogram gives the tenant a shape to recognise before the name is read,
 * which matters when an operator moves between several tenants in a session.
 * It is derived from the name rather than stored — a reading aid, not a brand,
 * and deliberately square so it cannot be mistaken for a person's avatar.
 *
 * The identifying facts sit in one separated strip rather than as three loose
 * strings, so they read as the record's metadata rather than as a sentence.
 */
function RecordHeader({ tenant }: { tenant: TenantDetail }) {
  const origin = provisioningOrigin(tenant.history);

  return (
    <header className="mb-5 flex min-w-0 items-start gap-3.5 sm:gap-4">
      <TenantMonogram
        name={tenant.name}
        className="mt-0.5 size-11 rounded-xl text-sm sm:size-12"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {tenant.name}
          </h1>
          <StatusBadge
            tone={TENANT_STATUS_TONE[tenant.administratorActivationStatus]}
            dot
          >
            {TENANT_STATUS_LABEL[tenant.administratorActivationStatus]}
          </StatusBadge>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-y-1 text-xs text-muted-foreground">
          <span className="pr-3">
            <TenantIdentifier tenantId={tenant.tenantId} />
          </span>
          <span className="border-l border-border px-3">
            Created {formatDate(tenant.createdAt)}
          </span>
          {origin?.actorName ? (
            <span className="border-l border-border px-3">
              Provisioned by {origin.actorName}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/**
 * The record's destinations.
 *
 * A horizontal strip rather than a second sidebar: the tenant is the subject,
 * and these are views of it. The strip scrolls inside itself on a narrow
 * screen so every destination stays reachable without the page itself
 * scrolling sideways.
 */
function RecordNavigation({
  tenantId,
  query,
}: {
  tenantId: string;
  query: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Tenant record"
      // overflow-y-hidden explicitly: setting one axis to auto makes the other
      // auto too, which let the strip scroll vertically by a stray pixel.
      className="-mx-6 mb-6 overflow-x-auto overflow-y-hidden border-b border-border px-6"
    >
      <ul className="flex w-max min-w-full gap-0.5">
        {RECORD_DESTINATIONS.map((destination) => {
          const href = destinationHref(tenantId, destination.segment);
          const isActive = isActiveDestination(
            pathname,
            tenantId,
            destination.segment
          );
          const Icon = destination.icon;

          return (
            <li key={destination.segment || "overview"}>
              <Link
                href={`${href}${query}`}
                // Read out as the current page, so the active destination is
                // not carried by weight and a rule alone.
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2.5 text-sm transition-colors motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  isActive
                    ? "border-primary bg-primary/[0.06] font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-foreground/[0.035] hover:text-foreground"
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground/80"
                  )}
                />
                {destination.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The immutable identifier, shortened to stay out of the way and copied whole.
 * It is the record's canonical route key, so it has to be retrievable exactly —
 * reading it off the address bar is not something anyone should have to do.
 */
export function TenantIdentifier({
  tenantId,
  showLabel = true,
}: {
  tenantId: string;
  /** Off where the surrounding row already names the field. */
  showLabel?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tenantId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the full value stays in the tooltip.
    }
  }

  const shortened = `${tenantId.slice(0, 8)}…${tenantId.slice(-4)}`;

  return (
    <TooltipProvider delayDuration={200}>
      <span className="inline-flex items-center gap-1.5">
        {showLabel ? <span>Tenant ID</span> : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Tenant ID copied" : `Copy tenant ID ${tenantId}`}
              className="inline-flex min-h-7 min-w-7 items-center gap-1.5 rounded-sm px-1 font-mono text-xs text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              {shortened}
              {copied ? (
                <Check
                  aria-hidden="true"
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                />
              ) : (
                <Copy aria-hidden="true" className="size-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied" : tenantId}</TooltipContent>
        </Tooltip>
      </span>
    </TooltipProvider>
  );
}

function RecordFailure({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const kind = failureKind(error);

  if (kind === "not-found") {
    return (
      <PageEmpty
        headingLevel={1}
        icon={SearchX}
        title="Tenant not found"
        description="This tenant does not exist, or it was removed."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/tenants">Back to Tenants</Link>
          </Button>
        }
      />
    );
  }

  return (
    <PageError
      headingLevel={1}
      title={
        kind === "permission"
          ? "You no longer have Platform access"
          : "This tenant could not be loaded"
      }
      description={
        kind === "permission"
          ? "Your Platform administration access has changed. Sign in again to continue."
          : "The tenant record is unavailable right now. Nothing about the tenant has changed."
      }
      onRetry={kind === "permission" ? undefined : onRetry}
    />
  );
}

/** Holds the record's real shape — header, destinations, then content. */
function RecordSkeleton() {
  return (
    <div aria-busy aria-label="Loading tenant">
      <div className="mb-5 flex items-start gap-4">
        <Skeleton className="size-12 shrink-0 rounded-xl" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-6 w-44 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
        </div>
      </div>

      <div className="mb-6 flex gap-4 border-b border-border pb-3">
        {RECORD_DESTINATIONS.map((destination) => (
          <Skeleton key={destination.segment || "overview"} className="h-4 w-24" />
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <div className="space-y-4 rounded-2xl border border-border bg-card px-5 py-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-64 max-w-full" />
            <div className="flex gap-8">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="rounded-2xl border border-border bg-card px-5 py-5">
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card px-5 py-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}
