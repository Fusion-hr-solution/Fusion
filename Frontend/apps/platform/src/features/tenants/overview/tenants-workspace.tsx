"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Download,
  Plus,
  Search,
  SearchX,
} from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ds/components/ui/table";
import { cn } from "@repo/ds/lib/utils";
import {
  AsyncButton,
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
} from "@repo/ds/shell";
import type {
  OverviewFilter,
  TenantOverviewQuery,
  TenantOverviewRow,
  TenantOverviewSort,
} from "../api";
import { failureKind, listAllMatchingTenants, TENANT_PAGE_SIZE } from "../api";
import { formatDate, MODULE_IDS } from "../language";
import { useTenantOverview } from "../queries";
import { RecoveryFailure } from "../recovery-dialog";
import { activationSummary } from "./tenant-activation";
import { TenantActivitySection } from "./tenant-activity";
import { TenantFilterPanel } from "./tenant-filter-panel";
import { downloadCsv, exportFileName, toCsv } from "./tenant-export";
import { TenantModulesCell } from "./tenant-modules-cell";
import { TenantMonogram } from "./tenant-monogram";
import { TenantPagination } from "./tenant-pagination";
import { TenantRowActions } from "./tenant-row-actions";
import { TenantSummaryCards } from "./tenant-summary-cards";
import {
  isQueryNarrowed,
  parseQuery,
  serializeQuery,
  withQueryChange,
  type AdvancedFilters,
} from "./tenant-query";

/**
 * The Platform tenant directory.
 *
 * The page answers two questions in order: where the customer estate stands,
 * and which tenant needs something done. The summary carries the first and
 * doubles as the control that scopes the second; the directory beneath it stays
 * the workspace, not a widget under a dashboard.
 *
 * The query lives in the URL, so opening a tenant and coming back — or sharing
 * the link — returns to the same list rather than resetting to everything.
 */
export function TenantsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo(
    () => parseQuery(new URLSearchParams(searchParams.toString()), MODULE_IDS),
    [searchParams]
  );

  const commit = useCallback(
    (next: TenantOverviewQuery) => {
      const serialized = serializeQuery(next);
      router.replace(serialized ? `${pathname}?${serialized}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname]
  );

  const update = useCallback(
    (change: Partial<TenantOverviewQuery>) => commit(withQueryChange(query, change)),
    [commit, query]
  );

  // Typing is local until it settles, so the URL does not gain an entry per
  // keystroke and the list does not refetch on every character.
  const [searchDraft, setSearchDraft] = useState(query.search);
  useEffect(() => setSearchDraft(query.search), [query.search]);

  useEffect(() => {
    if (searchDraft === query.search) return;
    const timer = setTimeout(() => update({ search: searchDraft }), 300);
    return () => clearTimeout(timer);
  }, [searchDraft, query.search, update]);

  const { data, error, isLoading, isFetching, refetch } = useTenantOverview(query);

  const [actionError, setActionError] = useState<Error | null>(null);

  const rows = data?.rows ?? [];
  const isNarrowed = isQueryNarrowed(query);

  const serialized = serializeQuery(query);
  const provisionHref = serialized
    ? `/tenants/new?from=${encodeURIComponent(serialized)}`
    : "/tenants/new";

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Tenants"
        description="Manage customer tenants, entitlements, and administrator activation."
        actions={
          <Button asChild>
            {/* The current query travels with the operator so returning from
                provisioning lands on the list they left, not on an unfiltered
                one they have to rebuild. */}
            <Link href={provisionHref}>
              <Plus aria-hidden="true" className="size-4" />
              Provision tenant
            </Link>
          </Button>
        }
      />

      <TenantSummaryCards
        counts={data?.counts ?? null}
        selected={query.filter}
        isLoading={isLoading}
        onSelect={(filter: OverviewFilter) => update({ filter })}
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Tenant directory</h2>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="pl-9"
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search tenants or administrator email"
                aria-label="Search tenants or administrator email"
              />
            </div>

            <TenantFilterPanel
              filters={query}
              onApply={(filters: AdvancedFilters) => update(filters)}
            />

            <ExportButton query={query} disabled={Boolean(error)} />
          </div>
        </header>

        {actionError ? (
          <div className="border-b border-border bg-destructive/5 px-4 py-3">
            <RecoveryFailure error={actionError} />
          </div>
        ) : null}

        {isLoading ? <DirectorySkeleton /> : null}

        {!isLoading && error ? (
          <TenantsFailure error={error} onRetry={refetch} />
        ) : null}

        {!isLoading && !error && rows.length === 0 ? (
          <TenantsEmpty
            isNarrowed={isNarrowed}
            onClear={() => commit(withQueryChange(query, { filter: "All", search: "" }))}
          />
        ) : null}

        {!isLoading && !error && rows.length > 0 ? (
          <div
            aria-busy={isFetching}
            className={cn("transition-opacity", isFetching && "opacity-60")}
          >
            <TenantTable
              rows={rows}
              sort={query.sort}
              query={serialized}
              onSortChange={(sort: TenantOverviewSort) => update({ sort })}
              onActionFailed={setActionError}
            />
            <TenantRows rows={rows} query={serialized} onActionFailed={setActionError} />

            <TenantPagination
              page={data!.page}
              pageSize={TENANT_PAGE_SIZE}
              totalCount={data!.totalCount}
              onPageChange={(page: number) => update({ page })}
            />
          </div>
        ) : null}
      </section>

      <TenantActivitySection />
    </PageContainer>
  );
}

/**
 * The file describes the whole current query, not the page on screen, so it
 * refetches every matching tenant before writing. The control carries its own
 * progress and cannot be pressed twice into two downloads.
 */
function ExportButton({
  query,
  disabled,
}: {
  query: TenantOverviewQuery;
  disabled: boolean;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setIsExporting(true);
    setFailed(false);

    try {
      const result = await listAllMatchingTenants(query);
      downloadCsv(toCsv(result.rows), exportFileName());
    } catch {
      // The list on screen is untouched: only the download failed.
      setFailed(true);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {failed ? (
        <span role="alert" className="text-sm text-destructive">
          Export failed. Try again.
        </span>
      ) : null}
      {/* The convention forbids progressive wording beside a spinner, so the
          label is held in place and hidden rather than swapped for "Exporting…". */}
      <AsyncButton
        variant="outline"
        onClick={run}
        disabled={disabled}
        pending={isExporting}
        aria-label="Export the matching tenants as CSV"
        pendingLabel="Export the matching tenants as CSV"
      >
        <Download aria-hidden="true" className="size-4" />
        Export
      </AsyncButton>
    </div>
  );
}

/**
 * The operational list.
 *
 * Five columns, each earning its width: who the tenant is, where its activation
 * stands, what it is entitled to, when it appeared, and what can be done. The
 * separate status, invitation and administrator columns are gone — they were
 * three cells restating one situation, and the row read as a wall of badges.
 */
function TenantTable({
  rows,
  sort,
  query,
  onSortChange,
  onActionFailed,
}: {
  rows: TenantOverviewRow[];
  sort: TenantOverviewSort;
  /** Serialized directory query, carried into each tenant so returning restores it. */
  query: string;
  onSortChange: (next: TenantOverviewSort) => void;
  onActionFailed: (error: Error | null) => void;
}) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableHead
              ascending="NameAscending"
              descending="NameDescending"
              sort={sort}
              onSortChange={onSortChange}
            >
              Tenant
            </SortableHead>
            <TableHead>Activation</TableHead>
            <TableHead className="hidden lg:table-cell">Modules</TableHead>
            <SortableHead
              ascending="CreatedAscending"
              descending="CreatedDescending"
              sort={sort}
              onSortChange={onSortChange}
              className="hidden whitespace-nowrap lg:table-cell"
            >
              Created
            </SortableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
              <TableRow key={row.tenantId} className="group">
                <TableCell className="max-w-[18rem] py-3 xl:max-w-[24rem]">
                  <div className="flex min-w-0 items-center gap-3">
                    <TenantMonogram name={row.name} />
                    <div className="min-w-0">
                      <TenantLink id={row.tenantId} name={row.name} query={query} />
                      <p
                        className="truncate text-sm text-muted-foreground"
                        title={row.initialAdministratorEmail ?? undefined}
                      >
                        {row.initialAdministratorEmail ?? "Administrator not recorded"}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-3">
                  <ActivationCell row={row} />
                </TableCell>

                <TableCell className="hidden py-3 lg:table-cell">
                  <TenantModulesCell modules={row.modules} />
                </TableCell>

                <TableCell className="hidden whitespace-nowrap py-3 text-muted-foreground lg:table-cell">
                  {formatDate(row.createdAt)}
                </TableCell>

                <TableCell className="py-3 text-right">
                  <TenantRowActions row={row} onActionFailed={onActionFailed} />
                </TableCell>
              </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Two lines on every row, including the ordinary ones. Letting only exceptions
 * grow a second line would make the list jump as states change, and would put
 * the routine rows and the urgent ones on different rhythms.
 */
function ActivationCell({ row }: { row: TenantOverviewRow }) {
  const { status, detail, isException } = activationSummary(row);

  return (
    <div className="min-w-0">
      {/* The lifecycle status repeats down almost every row, so it sits back as
          context. The line below it is what actually differs between rows, and
          it is what the operator is scanning for. */}
      <p className="truncate text-sm text-muted-foreground" title={status}>
        {status}
      </p>
      <p
        className={cn(
          "flex items-center gap-1.5 truncate text-sm",
          isException ? "font-medium text-destructive" : "text-foreground"
        )}
      >
        {/* A dot, not colour alone: the words already say what is wrong, and
            the marker only helps the eye find the row again. */}
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            isException
              ? "bg-destructive"
              : row.administratorActivationStatus === "Active"
                ? "bg-emerald-500"
                : "bg-muted-foreground/40"
          )}
        />
        {detail}
      </p>
    </div>
  );
}

/**
 * The tenant's name is the way into its record. It reads as text until it is
 * approached, then answers with colour alone — no underline on hover, and no
 * browser-default visited colour making some names look different from others.
 *
 * Keyboard focus still draws a ring, so the link is not identified by colour
 * alone for anyone arriving without a pointer.
 */
function TenantLink({
  id,
  name,
  query,
}: {
  id: string;
  name: string;
  /** The directory's own query, so returning restores this list. */
  query: string;
}) {
  return (
    <Link
      href={query ? `/tenants/${id}?from=${encodeURIComponent(query)}` : `/tenants/${id}`}
      title={name}
      className="block truncate rounded-sm font-medium text-foreground no-underline visited:text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {name}
    </Link>
  );
}

function SortableHead({
  ascending,
  descending,
  sort,
  onSortChange,
  className,
  children,
}: {
  ascending: TenantOverviewSort;
  descending: TenantOverviewSort;
  sort: TenantOverviewSort;
  onSortChange: (next: TenantOverviewSort) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isAscending = sort === ascending;
  const isActive = isAscending || sort === descending;
  const Icon = isAscending ? ArrowUp : ArrowDown;

  return (
    <TableHead
      className={className}
      // Announced to assistive technology, so the sort is not conveyed by the
      // arrow glyph alone.
      aria-sort={
        isActive ? (isAscending ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSortChange(isAscending ? descending : ascending)}
        // A button resets text-transform, so the sortable headers would
        // otherwise render in sentence case beside the plain uppercase ones.
        className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 uppercase tracking-wider hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
        <Icon
          aria-hidden="true"
          className={cn("size-3 shrink-0", isActive ? "opacity-100" : "opacity-0")}
        />
      </button>
    </TableHead>
  );
}

/**
 * Below the table breakpoint the same records stay an operational list — the
 * same order, language and actions, divided into rows rather than turned into a
 * catalogue of cards.
 */
function TenantRows({
  rows,
  query,
  onActionFailed,
}: {
  rows: TenantOverviewRow[];
  query: string;
  onActionFailed: (error: Error | null) => void;
}) {
  return (
    <ul className="divide-y divide-border md:hidden">
      {rows.map((row) => {
        const { status, detail, isException } = activationSummary(row);

        return (
          <li key={row.tenantId} className="flex items-start gap-3 px-4 py-3.5">
            <TenantMonogram name={row.name} />

            <div className="min-w-0 flex-1">
              <TenantLink id={row.tenantId} name={row.name} query={query} />
              <p className="truncate text-sm text-muted-foreground">
                {row.initialAdministratorEmail ?? "Administrator not recorded"}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{status}</p>
              <p
                className={cn(
                  "truncate text-sm",
                  isException ? "font-medium text-destructive" : "text-foreground"
                )}
              >
                {detail}
              </p>
            </div>

            <TenantRowActions row={row} onActionFailed={onActionFailed} />
          </li>
        );
      })}
    </ul>
  );
}

function TenantsEmpty({
  isNarrowed,
  onClear,
}: {
  isNarrowed: boolean;
  onClear: () => void;
}) {
  // A query that matched nothing is a different answer from a platform with no
  // tenants, and only one of them is fixed by clearing the query.
  return isNarrowed ? (
    <PageEmpty
      icon={SearchX}
      title="No tenants match"
      description="No tenant matches the current search and filters."
      action={
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear search and filters
        </Button>
      }
    />
  ) : (
    <PageEmpty
      icon={Building2}
      title="No tenants yet"
      description="No customer tenant has been provisioned."
      action={
        <Button asChild size="sm">
          <Link href="/tenants/new">
            <Plus aria-hidden="true" className="size-4" />
            Provision tenant
          </Link>
        </Button>
      }
    />
  );
}

/** A retrieval failure is never presented as an empty tenant set. */
function TenantsFailure({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const kind = failureKind(error);

  return (
    <PageError
      title={
        kind === "permission"
          ? "You no longer have Platform access"
          : "Tenants could not be loaded"
      }
      description={
        kind === "permission"
          ? "Your Platform administration access has changed. Sign in again to continue."
          : "The tenant list is unavailable right now. Your tenants are unaffected."
      }
      onRetry={kind === "permission" ? undefined : onRetry}
    />
  );
}

/** The directory's own shape while it loads, rather than a generic spinner. */
function DirectorySkeleton() {
  return (
    <div aria-busy aria-label="Loading tenants">
      {Array.from({ length: TENANT_PAGE_SIZE }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
        >
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3.5 w-52 max-w-full" />
          </div>
          <div className="hidden w-48 space-y-1.5 md:block">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <Skeleton className="hidden h-4 w-20 lg:block" />
          <Skeleton className="hidden h-4 w-24 lg:block" />
          <Skeleton className="size-8 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}
