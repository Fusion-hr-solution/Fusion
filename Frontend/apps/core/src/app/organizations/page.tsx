"use client";

import { useState, useCallback } from "react";
import type { SortingState } from "@tanstack/react-table";
import type { PlatformOrganizationSummaryDto } from "@repo/api";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useOrganizationList } from "./use-organizations";
import { StatsCards } from "./stats-cards";
import { Toolbar } from "./toolbar";
import { OrganizationsTable } from "./organizations-table";
import { PaginationBar } from "./pagination-bar";
import { CreateOrgDialog } from "./create-org-dialog";
import { OrgDetailSheet } from "./org-detail-sheet";

const PAGE_SIZE = 20;

export default function OrganizationsPage() {
  // ---- list query state ----
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [attentionFilter, setAttentionFilter] = useState<boolean | undefined>();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const orderBy = sorting[0]?.id ?? "createdAt";
  const orderDirection = sorting[0]?.desc ? "desc" : "asc";

  const { data, isLoading, refetch } = useOrganizationList({
    skip,
    take: PAGE_SIZE,
    search: search || undefined,
    orderBy,
    orderDirection,
    filterByStatus: statusFilter.length > 0 ? statusFilter : undefined,
    filterNeedsAttention: attentionFilter,
  });

  // ---- dialogs ----
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const handleRowClick = useCallback((org: PlatformOrganizationSummaryDto) => {
    setDetailId(org.id);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setSkip(0);
  }, []);

  const handleStatusFilterChange = useCallback((value: string[]) => {
    setStatusFilter(value);
    setSkip(0);
  }, []);

  const handleAttentionFilterChange = useCallback(
    (value: boolean | undefined) => {
      setAttentionFilter(value);
      setSkip(0);
    },
    []
  );

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Organizations
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage tenant organizations, invites, and lifecycle.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New Organization
        </Button>
      </div>

      {/* Stats */}
      <StatsCards stats={data?.stats} isLoading={isLoading} />

      {/* Toolbar */}
      <Toolbar
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        attentionFilter={attentionFilter}
        onAttentionFilterChange={handleAttentionFilterChange}
      />

      {/* Table */}
      <OrganizationsTable
        data={data?.items ?? []}
        isLoading={isLoading}
        sorting={sorting}
        onSortingChange={setSorting}
        onRowClick={handleRowClick}
      />

      {/* Pagination */}
      {data && data.totalCount > 0 && (
        <PaginationBar
          skip={skip}
          take={PAGE_SIZE}
          totalCount={data.totalCount}
          onPageChange={setSkip}
        />
      )}

      {/* Dialogs */}
      <CreateOrgDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refetch}
      />

      <OrgDetailSheet
        tenantId={detailId}
        open={!!detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        onMutated={refetch}
      />
    </div>
  );
}
