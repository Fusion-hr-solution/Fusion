"use client";

import { useState, useCallback } from "react";
import type { SortingState } from "@tanstack/react-table";
import type { PlatformOrganizationSummaryDto } from "@repo/api";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@repo/ui";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

import { useOrganizationList } from "./use-organizations";
import { StatsCards } from "./stats-cards";
import { Toolbar } from "./toolbar";
import { OrganizationsTable } from "./organizations-table";
import { PaginationBar } from "./pagination-bar";
import { CreateOrgDialog } from "./create-org-dialog";
import { OrgDetailSheet } from "./org-detail-sheet";

export default function OrganizationsPage() {
  // ---- list query state ----
  const [skip, setSkip] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const orderBy = sorting[0]?.id ?? "createdAt";
  const orderDirection = sorting[0]?.desc ? "desc" : "asc";

  const { data, isLoading, refetch } = useOrganizationList({
    skip,
    take: pageSize,
    search: search || undefined,
    orderBy,
    orderDirection,
    filterByStatus: statusFilter.length > 0 ? statusFilter : undefined,
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

  const handlePageSizeChange = useCallback((size: PageSize) => {
    setPageSize(size);
    setSkip(0);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Organizations"
        description="Manage tenant organizations, invites, and lifecycle."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Organization
          </Button>
        }
      />

      {/* Stats */}
      <StatsCards stats={data?.stats} isLoading={isLoading} />

      {/* Toolbar */}
      <Toolbar
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
      />

      {/* Table */}
      <OrganizationsTable
        data={data?.items ?? []}
        isLoading={isLoading}
        sorting={sorting}
        onSortingChange={setSorting}
        onRowClick={handleRowClick}
        onMutated={refetch}
      />

      {/* Pagination */}
      {data && data.totalCount > 0 && (
        <PaginationBar
          skip={skip}
          take={pageSize}
          totalCount={data.totalCount}
          onPageChange={setSkip}
          onPageSizeChange={handlePageSizeChange}
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
