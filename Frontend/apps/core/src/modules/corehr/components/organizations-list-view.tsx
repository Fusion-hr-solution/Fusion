"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Filter, MoreVertical, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_OPERATIONAL_LOGS, MOCK_ORG_STATS } from "../data/mock-organizations";
import { useOrganizations } from "../context/organizations-context";
import type { OrganizationLifecycle } from "../types/organization";
import { CoreHrBreadcrumbs } from "./core-hr-breadcrumbs";
import { LifecycleBadge } from "./lifecycle-badge";

const STATUS_FILTER: Array<OrganizationLifecycle | "all"> = [
  "all",
  "active",
  "invited",
  "attention",
  "suspended",
];

function matchesFilter(
  lifecycle: OrganizationLifecycle,
  filter: OrganizationLifecycle | "all"
) {
  if (filter === "all") return true;
  if (filter === "attention") return lifecycle === "attention";
  return lifecycle === filter;
}

export function OrganizationsListView() {
  const { organizations } = useOrganizations();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrganizationLifecycle | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return organizations.filter((o) => {
      const byStatus = matchesFilter(o.lifecycle, status);
      const byQ =
        !needle || o.name.toLowerCase().includes(needle);
      return byStatus && byQ;
    });
  }, [organizations, q, status]);

  return (
    <div className="bg-ch-surface font-chBody text-ch-on-surface">
      <div className="mx-auto w-full max-w-7xl p-6 lg:p-12">
        <div className="mb-6">
          <CoreHrBreadcrumbs
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
            href="/corehr/organizations/new"
            className="inline-flex items-center gap-2 bg-ch-primary-container px-6 py-3 font-chHeadline font-bold text-ch-on-primary-container transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5" aria-hidden />
            Create Organization
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat label="Total Assets" value={String(MOCK_ORG_STATS.totalAssets)} />
          <Stat
            label="Attention Needed"
            value={String(MOCK_ORG_STATS.attentionNeeded)}
            valueClass="text-ch-error"
          />
          <Stat
            label="Invited Pending"
            value={String(MOCK_ORG_STATS.invitedPending)}
          />
          <Stat
            label="Active Users"
            value={MOCK_ORG_STATS.activeUsersLabel}
            valueClass="text-ch-tertiary"
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-stone-200 bg-ch-surface-container-low">
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
                className="w-full rounded border-none bg-ch-surface-container-low py-2.5 pl-10 pr-4 text-sm text-ch-on-surface placeholder:text-stone-400"
                type="search"
              />
            </div>
            <div className="flex w-full gap-2 md:w-auto">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as OrganizationLifecycle | "all")
                }
                className="cursor-pointer rounded border-none bg-ch-surface-container-low px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-ch-on-surface"
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
                className="flex items-center gap-2 rounded bg-ch-surface-container-low px-4 py-2.5 transition-colors hover:bg-ch-surface-container-high"
              >
                <Filter className="h-4 w-4" aria-hidden />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Filter
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-ch-surface-container-low">
                  {[
                    "Organization Name",
                    "Lifecycle Status",
                    "Admin Status",
                    "Users / Pending",
                    "Last Activity",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "border-none px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-ch-secondary",
                        h === "Users / Pending" && "text-right",
                        h === "Actions" && "text-center"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-ch-surface-container-lowest">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-t border-stone-100 transition-colors hover:bg-ch-surface-container-low"
                  >
                    <td className="px-6 py-5">
                      <Link
                        href={`/corehr/organizations/${encodeURIComponent(row.id)}`}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-stone-100 font-bold text-stone-400">
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
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="p-2 text-stone-500 transition-colors hover:bg-ch-surface-container-high"
                          title="More actions"
                        >
                          <MoreVertical className="h-5 w-5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-stone-200 bg-ch-surface-container-lowest px-6 py-4 md:flex-row">
            <span className="text-xs text-ch-secondary">
              Showing 1 to {filtered.length} of {organizations.length}{" "}
              organizations
            </span>
            <LedgerPagination />
          </div>
        </section>

        <div className="mt-12 grid grid-cols-1 gap-8">
          <div>
            <h3 className="mb-6 font-chHeadline text-sm font-bold uppercase tracking-widest text-ch-on-surface">
              Recent Operational Logs
            </h3>
            <div className="space-y-4">
              {MOCK_OPERATIONAL_LOGS.map((log) => (
                <div
                  key={log.id}
                  className="group flex items-start gap-4 bg-ch-surface-container-low/50 p-4 transition-colors hover:bg-ch-surface-container-low"
                >
                  <div
                    className={cn(
                      "mt-1 h-2 w-2 rounded-full",
                      log.tone === "primary" ? "bg-ch-primary" : "bg-ch-error"
                    )}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-ch-on-surface">{log.body}</p>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-tighter text-ch-secondary">
                      {log.meta}
                    </span>
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
    <div className="bg-ch-surface-container-low p-6 transition-all hover:bg-ch-surface-container">
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

function LedgerPagination() {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-ch-surface-container-high"
        aria-label="Previous page"
      >
        ‹
      </button>
      <span className="flex h-8 w-8 items-center justify-center rounded bg-ch-primary text-xs font-bold text-white">
        1
      </span>
      <span className="text-stone-400">…</span>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded text-xs font-medium transition-colors hover:bg-ch-surface-container-high"
      >
        2
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-ch-surface-container-high"
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}
