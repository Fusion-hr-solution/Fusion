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
import { Ban, Check, Copy, MoreHorizontal, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ds/components/ui/alert-dialog";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ds/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@repo/ds/lib/utils";
import { PageContainer, PageEmpty, PageError, StatusBadge } from "@repo/ds/shell";
import { failureKind, failureMessage, type TenantDetail } from "../api";
import { TenantMonogram } from "../overview/tenant-monogram";
import { useTenantDetail, useTenantLifecycle } from "../queries";
import {
  RECORD_DESTINATIONS,
  destinationHref,
  isActiveDestination,
  recordQuery,
} from "./record-routes";

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
 * The header establishes only the resource: who it is, whether it is usable, and
 * its canonical key. The status shown is the tenant's lifecycle — an existing
 * tenant is Active until Platform deactivates it, a capability the record does
 * not model yet — and deliberately not the administrator's invitation state,
 * which is a separate concern and belongs in the body. Provisioning facts,
 * created date, and internal id stay out of the header so it does not become a
 * fact sheet; they live in the Overview profile.
 */
function RecordHeader({ tenant }: { tenant: TenantDetail }) {
  return (
    <header className="mb-6 flex min-w-0 items-center gap-4 sm:gap-5">
      <TenantMonogram
        name={tenant.name}
        className="size-14 rounded-xl text-base sm:size-16 sm:text-lg"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="type-display min-w-0 break-words text-foreground">
            {tenant.name}
          </h1>
          <StatusBadge tone={tenant.isActive ? "success" : "neutral"} dot>
            {tenant.isActive ? "Active" : "Deactivated"}
          </StatusBadge>
        </div>

        <div className="mt-1">
          <TenantKey slug={tenant.slug} />
        </div>
      </div>

      <TenantLifecycleMenu tenant={tenant} />
    </header>
  );
}

/**
 * The record's overflow: tenant lifecycle only.
 *
 * An Active tenant can be deactivated; a deactivated one can be reactivated —
 * and nothing else lives here. Profile edits, product entitlements, and
 * invitation recovery act on their own objects elsewhere; this menu governs the
 * single platform-owned state that has no home of its own.
 *
 * Deactivation removes customer access, so it is confirmed before it runs and
 * says plainly what it does and does not touch. Reactivation restores access
 * and needs no confirmation. Both settle by refetching the record, so the
 * header status reflects the authoritative outcome.
 */
function TenantLifecycleMenu({ tenant }: { tenant: TenantDetail }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Busy across the whole task, not just the request: the mutation invalidates
  // the record, and neither control should free up until that refetched result
  // has settled. `mutateAsync` resolves only after the awaited invalidation.
  const [running, setRunning] = useState(false);
  const deactivate = useTenantLifecycle("deactivate");
  const reactivate = useTenantLifecycle("reactivate");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Tenant actions"
            className="size-9 shrink-0 self-start text-muted-foreground"
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onSelect={() => {
              void navigator.clipboard.writeText(tenant.tenantId).catch(() => {
                // Clipboard access can be refused; nothing else depends on it.
              });
            }}
          >
            <Copy />
            Copy tenant ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {tenant.isActive ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmOpen(true)}
            >
              <Ban />
              Deactivate tenant
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={running || reactivate.isLoading}
              onSelect={(event) => {
                event.preventDefault();
                setRunning(true);
                void reactivate
                  .mutateAsync(tenant.tenantId)
                  .then(() =>
                    toast.success("Tenant reactivated", {
                      description: `${tenant.name} is active again and available to its users.`,
                    })
                  )
                  .catch((error) =>
                    toast.error("Couldn't reactivate the tenant", {
                      description: failureMessage(error) ?? undefined,
                    })
                  )
                  .finally(() => setRunning(false));
              }}
            >
              <RotateCcw />
              Reactivate tenant
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {tenant.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its users will no longer be able to sign in to Fusion. All tenant
              data is kept, and you can reactivate the tenant at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running || deactivate.isLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={running || deactivate.isLoading}
              onClick={(event) => {
                event.preventDefault();
                setRunning(true);
                void deactivate
                  .mutateAsync(tenant.tenantId)
                  .then(() => {
                    setConfirmOpen(false);
                    toast.success("Tenant deactivated", {
                      description: `${tenant.name}'s users can no longer sign in to Fusion.`,
                    });
                  })
                  .catch((error) => {
                    // The record refetches on settle; the dialog stays open so
                    // the operator sees the attempt did not take.
                    toast.error("Couldn't deactivate the tenant", {
                      description: failureMessage(error) ?? undefined,
                    });
                  })
                  .finally(() => setRunning(false));
              }}
            >
              {running || deactivate.isLoading
                ? "Deactivating…"
                : "Deactivate tenant"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The tenant key.
 *
 * The human-readable, effectively immutable identifier a Platform Admin uses to
 * refer to this tenant — so it is shown in full and copied whole rather than
 * hidden behind the internal UUID. Copy is the whole interaction here; the key
 * is short enough to read, so it is the control, not a label beside one.
 */
function TenantKey({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the key is still readable in place.
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Tenant key copied" : `Copy tenant key ${slug}`}
            className="group -ml-1 inline-flex min-h-7 items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
          >
            <span className="font-mono">{slug}</span>
            {copied ? (
              <Check
                aria-hidden="true"
                className="size-3.5 text-success"
              />
            ) : (
              <Copy
                aria-hidden="true"
                className="size-3.5 text-muted-foreground/70 transition-colors group-hover:text-primary motion-reduce:transition-none"
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : "Copy tenant key"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
      <ul className="flex w-max min-w-full gap-7">
        {RECORD_DESTINATIONS.map((destination) => {
          const href = destinationHref(tenantId, destination.segment);
          const isActive = isActiveDestination(
            pathname,
            tenantId,
            destination.segment
          );

          return (
            <li key={destination.segment || "overview"}>
              <Link
                href={`${href}${query}`}
                // Read out as the current page, so the active destination is
                // not carried by weight and a rule alone.
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center whitespace-nowrap border-b-2 py-3 text-sm transition-colors motion-reduce:transition-none",
                  "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isActive
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
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
      <div className="mb-6 flex items-center gap-5">
        <Skeleton className="size-16 shrink-0 rounded-xl" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
        <Skeleton className="size-9 shrink-0 self-start rounded-md" />
      </div>

      <div className="mb-6 flex gap-7 border-b border-border pb-3">
        {RECORD_DESTINATIONS.map((destination) => (
          <Skeleton key={destination.segment || "overview"} className="h-4 w-20" />
        ))}
      </div>

      {/* Mirrors the Overview body exactly — lifecycle banner, then the
          [1.45fr / 1fr] grid of Administrative handoff + Products on the left
          and Tenant profile + Recent activity on the right — so the real
          content lands in place without a reflow. */}
      <div className="space-y-5">
        {/* Lifecycle banner */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
        </div>

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <HandoffSkeleton />
            <ProductsSkeleton />
          </div>
          <div className="flex flex-col gap-3">
            <ProfileSkeleton />
            <ActivitySkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A card header: leading icon, a title, and an optional trailing control. */
function SkeletonCardHeader({
  titleWidth,
  subtitleWidth,
  action,
}: {
  titleWidth: string;
  subtitleWidth?: string;
  action?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className={cn("h-4", titleWidth)} />
        {subtitleWidth ? <Skeleton className={cn("h-3.5", subtitleWidth)} /> : null}
      </div>
      {action ? <Skeleton className="h-8 w-24 shrink-0 rounded-md" /> : null}
    </div>
  );
}

/** Administrative handoff: header, then the person / status / action strip. */
function HandoffSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SkeletonCardHeader titleWidth="w-40" subtitleWidth="w-64" />
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-4 rounded-xl border border-border bg-background px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="ml-auto h-8 w-32 rounded-md" />
      </div>
    </div>
  );
}

/** Products: header with a trailing button, then six catalogue rows. */
function ProductsSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SkeletonCardHeader titleWidth="w-24" subtitleWidth="w-48" action />
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="size-5 shrink-0 rounded" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ml-auto h-5 w-20 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tenant profile: header with an Edit button, then four label / value rows. */
function ProfileSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SkeletonCardHeader titleWidth="w-28" action />
      <div className="mt-4 divide-y divide-border">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-baseline gap-10 py-3"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Recent activity: header with a link, then four timeline entries. */
function ActivitySkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SkeletonCardHeader titleWidth="w-28" action />
      <ol className="mt-4 space-y-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="flex gap-3">
            <Skeleton className="mt-1 size-2.5 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-20 shrink-0" />
              </div>
              <Skeleton className="h-3.5 w-56 max-w-full" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
