"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, FilterX, Plus, Search } from "lucide-react";
import {
  coreFieldClassName,
  corePrimaryButtonClassName,
} from "@/lib/core-ui-classes";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks";
import { useOrganizations } from "../context/organizations-context";
import { MOCK_OPERATIONAL_LOGS } from "../data/mock-organizations";
import type { OrganizationLifecycle } from "../types/organization";
import { PlatformAdminBreadcrumbs } from "./platform-admin-breadcrumbs";
import { LifecycleBadge } from "./lifecycle-badge";
import { OrganizationRowActions } from "./organization-row-actions";

const PAGE_SIZE = 8;

function getVisiblePages(
  total: number,
  current: number
): Array<number | "ellipsis"> {
  if (total <= 0) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("ellipsis");
    out.push(n);
  }
  return out;
}

const STATUS_FILTER: Array<OrganizationLifecycle | "all"> = [
  "all",
  "draft",
  "active",
  "invited",
  "attention",
  "suspended",
  "archived",
];

export function OrganizationsListView() {
  const { organizations, totalCount, stats, loading, error, refresh } =
    useOrganizations();

  // Use API stats when available, fallback to empty stats
  const displayStats = useMemo(() => {
    if (stats) {
      return {
        totalAssets: stats.totalOrganizations,
        attentionNeeded: stats.attentionNeeded,
        invitedPending: stats.invitedPending,
        activeUsersLabel: stats.activeUserCount.toLocaleString(),
      };
    }
    return {
      totalAssets: 0,
      attentionNeeded: 0,
      invitedPending: 0,
      activeUsersLabel: "0",
    };
  }, [stats]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrganizationLifecycle | "all">("all");
  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState<
    | "createdAt"
    | "name"
    | "operationalStatus"
    | "activeUserCount"
    | "pendingInviteCount"
    | "lastActivityAt"
  >("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const debouncedQ = useDebounce(q, 300);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const hasActiveFilters = q.trim() !== "" || status !== "all";

  const clearFilters = useCallback(() => {
    setQ("");
    setStatus("all");
  }, []);

  const toggleSort = useCallback(
    (key: typeof sortBy) => {
      if (sortBy === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return;
      }
      setSortBy(key);
      setSortDir("desc");
    },
    [sortBy]
  );

  // Reset to the first page when filters/sort change.
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, sortBy, sortDir]);

  // Keep page within bounds.
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const skip = (page - 1) * PAGE_SIZE;
    const take = PAGE_SIZE;
    const trimmedSearch = debouncedQ.trim();

    void refresh({
      skip,
      take,
      search: trimmedSearch ? trimmedSearch : undefined,
      filterByStatus: status === "all" ? undefined : status,
      orderBy: sortBy,
      orderDirection: sortDir,
    });
  }, [page, debouncedQ, status, sortBy, sortDir, refresh]);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="bg-ch-surface font-chBody text-ch-on-surface">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6">
          <PlatformAdminBreadcrumbs
            items={[
              { label: "Dashboard", href: "/" },
              { label: "Organizations" },
            ]}
          />
        </div>

        <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="space-y-1">
            <h1 className="font-chHeadline text-4xl font-extrabold tracking-tight text-ch-on-surface">
              Organizations
            </h1>
            <p className="text-ch-secondary">
              Manage customer accounts, lifecycles, and access control.
            </p>
          </div>
          <Link
            href="/organizations/new"
            className={cn(
              corePrimaryButtonClassName,
              "!w-auto gap-2 transition-transform active:scale-95"
            )}
          >
            <Plus className="h-5 w-5" aria-hidden />
            Create Organization
          </Link>
        </div>

        {error ? (
          <p className="mb-6 rounded-ch-md border border-ch-error/40 bg-ch-error-container/20 px-4 py-3 text-sm text-ch-error">
            {error}
          </p>
        ) : null}

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat label="Organizations" value={String(displayStats.totalAssets)} />
          <Stat
            label="Attention Needed"
            value={String(displayStats.attentionNeeded)}
            valueClass="text-ch-error"
          />
          <Stat label="Invited Pending" value={String(displayStats.invitedPending)} />
          <Stat
            label="Active Users (sum)"
            value={displayStats.activeUsersLabel}
            valueClass="text-ch-tertiary"
          />
        </div>

        <section className="overflow-hidden rounded-ch-lg border border-stone-200 bg-ch-surface-container-low">
          <div className="flex flex-col items-center justify-between gap-4 border-b border-stone-200 bg-ch-surface-container-lowest p-4 md:flex-row">
            <div className="relative w-full md:w-96">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                aria-hidden
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by organization name..."
                className={cn(
                  coreFieldClassName,
                  "border-none bg-ch-surface-container-low py-2.5 pl-10 pr-4"
                )}
                type="search"
              />
            </div>
            <div className="flex w-full gap-2 md:w-auto">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as OrganizationLifecycle | "all")
                }
                className="cursor-pointer rounded-ch-md border-none bg-ch-surface-container-low px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-ch-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ch-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-ch-surface"
                aria-label="Filter by lifecycle"
              >
                {STATUS_FILTER.map((s) => (
                  <option key={s} value={s}>
                    {s === "all"
                      ? "All Statuses"
                      : s === "attention"
                        ? "Attention Needed"
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className={cn(
                  "flex items-center gap-2 rounded-ch-md px-4 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ch-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-ch-surface",
                  hasActiveFilters
                    ? "bg-ch-primary-container text-ch-on-primary-container hover:bg-ch-primary-container/80"
                    : "cursor-not-allowed bg-ch-surface-container-low text-ch-secondary opacity-60"
                )}
                title={hasActiveFilters ? "Clear all filters" : "No active filters"}
              >
                {hasActiveFilters ? (
                  <FilterX className="h-4 w-4" aria-hidden />
                ) : (
                  <Filter className="h-4 w-4" aria-hidden />
                )}
                <span className="text-xs font-bold uppercase tracking-widest">
                  {hasActiveFilters ? "Clear" : "Filter"}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-ch-surface-container-low">
                  <th className="border-none px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-ch-secondary">
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="inline-flex items-center gap-2"
                    >
                      Organization Name
                      {sortBy === "name" ? (
                        <span className="text-[9px] text-ch-secondary">
                          {sortDir}
                        </span>
                      ) : null}
                    </button>
                  </th>
                  <th className="border-none px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-ch-secondary">
                    <button
                      type="button"
                      onClick={() => toggleSort("operationalStatus")}
                      className="inline-flex items-center gap-2"
                    >
                      Lifecycle Status
                      {sortBy === "operationalStatus" ? (
                        <span className="text-[9px] text-ch-secondary">
                          {sortDir}
                        </span>
                      ) : null}
                    </button>
                  </th>
                  <th className="border-none px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-ch-secondary">
                    Admin Status
                  </th>
                  <th className="border-none px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-ch-secondary text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("pendingInviteCount")}
                      className="inline-flex items-center gap-2"
                    >
                      Users / Pending
                      {sortBy === "pendingInviteCount" ? (
                        <span className="text-[9px] text-ch-secondary">
                          {sortDir}
                        </span>
                      ) : null}
                    </button>
                  </th>
                  <th className="border-none px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-ch-secondary">
                    <button
                      type="button"
                      onClick={() => toggleSort("lastActivityAt")}
                      className="inline-flex items-center gap-2"
                    >
                      Last Activity
                      {sortBy === "lastActivityAt" ? (
                        <span className="text-[9px] text-ch-secondary">
                          {sortDir}
                        </span>
                      ) : null}
                    </button>
                  </th>
                  <th className="border-none px-6 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-ch-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-ch-surface-container-lowest">
                {loading && organizations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center text-sm text-ch-secondary"
                    >
                      Loading organizations…
                    </td>
                  </tr>
                ) : null}
                {!loading && totalCount === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center text-sm text-ch-secondary"
                    >
                      No organizations match your search or filters.
                    </td>
                  </tr>
                ) : null}
                {organizations.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-t border-stone-100 transition-colors hover:bg-ch-surface-container-low"
                  >
                    <td className="px-6 py-5">
                      <Link
                        href={`/organizations/${encodeURIComponent(row.id)}`}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-ch-md bg-stone-100 font-bold text-stone-400">
                          {row.initials}
                        </div>
                        <span className="text-sm font-semibold text-ch-on-surface hover:underline">
                          {row.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-5">
                      <LifecycleBadge lifecycle={row.lifecycle} />
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          row.lifecycle === "attention" && "text-ch-error",
                          row.lifecycle === "invited" && "text-ch-secondary"
                        )}
                      >
                        {row.adminStatus}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-ch-on-surface">
                          {row.userCount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-ch-secondary">
                          {row.pendingInvites} Pending
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-ch-on-surface">
                          {row.lastActivity ?? "—"}
                        </span>
                        <span className="text-[10px] text-ch-secondary">
                          Created: {row.createdAt}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <OrganizationRowActions org={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-stone-200 bg-ch-surface-container-lowest px-6 py-4 md:flex-row">
            <span className="text-xs text-ch-secondary">
              {totalCount === 0 ? (
                <>No organizations match your filters.</>
              ) : (
                <>
                  Showing {rangeStart} to {rangeEnd} of {totalCount}{" "}
                  organizations
                </>
              )}
            </span>
            <OrganizationsPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </section>

        <div className="mt-12 grid grid-cols-1 gap-8">
          <div>
            <h3 className="mb-6 font-chHeadline text-sm font-bold uppercase tracking-widest text-ch-on-surface">
              Operational Logs
            </h3>
            <div className="space-y-4">
              {MOCK_OPERATIONAL_LOGS.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 rounded-ch-lg bg-ch-surface-container-low p-4"
                >
                  <div
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      log.tone === "error"
                        ? "bg-ch-error"
                        : log.tone === "primary"
                          ? "bg-ch-primary"
                          : "bg-ch-secondary"
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ch-on-surface">{log.body}</p>
                    <p className="mt-1 text-xs text-ch-secondary">{log.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-ch-lg bg-ch-surface-container-low p-6 transition-all hover:bg-ch-surface-container">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ch-secondary">
        {label}
      </span>
      <div
        className={cn(
          "mt-2 font-chHeadline text-3xl font-black text-ch-on-surface",
          valueClass
        )}
      >
        {value}
      </div>
    </div>
  );
}

function OrganizationsPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <div className="text-xs text-ch-secondary" aria-hidden>
        Page 1 of 1
      </div>
    );
  }

  const visible = getVisiblePages(totalPages, page);

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1"
      aria-label="Pagination"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          "flex h-8 min-w-8 items-center justify-center rounded-ch-md px-2 text-sm font-medium transition-colors",
          page <= 1
            ? "cursor-not-allowed text-stone-300"
            : "text-ch-on-surface hover:bg-ch-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-ch-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-ch-surface"
        )}
        aria-label="Previous page"
      >
        ‹
      </button>
      {visible.map((item, i) =>
        item === "ellipsis" ? (
          <span
            key={`e-${i}`}
            className="flex h-8 w-8 items-center justify-center text-stone-400"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "flex h-8 min-w-8 items-center justify-center rounded-ch-md px-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ch-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-ch-surface",
              item === page
                ? "bg-ch-primary-container text-ch-on-primary-container shadow-sm"
                : "text-ch-on-surface hover:bg-ch-surface-container-high"
            )}
          >
            {item}
          </button>
        )
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          "flex h-8 min-w-8 items-center justify-center rounded-ch-md px-2 text-sm font-medium transition-colors",
          page >= totalPages
            ? "cursor-not-allowed text-stone-300"
            : "text-ch-on-surface hover:bg-ch-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-ch-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-ch-surface"
        )}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
