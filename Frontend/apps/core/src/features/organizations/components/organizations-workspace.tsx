"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type { PlatformOrganizationSummaryDto } from "@repo/api";
import { canAccessOrganizations, useAuth } from "@repo/auth";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@repo/ui";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  PageContainer,
  PageHeader,
  PageError,
  PageLoading,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { useOrganizationList } from "@/features/organizations/api/use-organizations";
import { StatsCards } from "@/app/(pages)/organizations/stats-cards";
import { Toolbar } from "@/app/(pages)/organizations/toolbar";
import { OrganizationsTable } from "@/app/(pages)/organizations/organizations-table";
import { columns as baseColumns } from "@/app/(pages)/organizations/columns";
import { RowActions } from "@/app/(pages)/organizations/row-actions";
import { CreateOrgDialog } from "@/app/(pages)/organizations/create-org-dialog";
import { OrgDetailSheet } from "@/app/(pages)/organizations/org-detail-sheet";

export default function OrganizationsWorkspace() {
  const { user } = useAuth();
  const canManageOrganizations = canAccessOrganizations(user);
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const skip = (page - 1) * pageSize;
  const orderBy = sorting[0]?.id ?? "createdAt";
  const orderDirection = sorting[0]?.desc ? "desc" : "asc";

  const { data, error, isLoading, isFetching, refetch } = useOrganizationList({
    skip,
    take: pageSize,
    search: search || undefined,
    orderBy,
    orderDirection,
    filterByStatus: statusFilter.length > 0 ? statusFilter : undefined,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const createParam = searchParams.get("create");
  const detailParam = searchParams.get("detail");
  const statusParamsKey = searchParams.getAll("status").join(",");

  const columns = useMemo<ColumnDef<PlatformOrganizationSummaryDto>[]>(() => {
    const actionsColumn: ColumnDef<PlatformOrganizationSummaryDto> = {
      id: "Actions",
      header: "",
      meta: {
        headerClassName: "w-10",
        cellClassName: "w-10",
      },
      cell: ({ row }) => (
        <div onClick={(event) => event.stopPropagation()} role="presentation">
          <RowActions org={row.original} />
        </div>
      ),
      enableSorting: false,
    };

    return [...baseColumns, actionsColumn];
  }, []);

  const handleRowClick = useCallback((org: PlatformOrganizationSummaryDto) => {
    setDetailId(org.id);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: string[]) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((size: PageSize) => {
    setPageSize(size);
    setPage(1);
  }, []);

  useEffect(() => {
    setCreateOpen(createParam === "1");
  }, [createParam]);

  useEffect(() => {
    setDetailId(detailParam);
  }, [detailParam]);

  useEffect(() => {
    const nextStatusFilter = statusParamsKey ? statusParamsKey.split(",") : [];

    setStatusFilter((current) => {
      if (
        current.length === nextStatusFilter.length &&
        current.every((value, index) => value === nextStatusFilter[index])
      ) {
        return current;
      }

      return nextStatusFilter;
    });
    setPage(1);
  }, [statusParamsKey]);

  const isInitialPageLoading =
    canManageOrganizations && isLoading && !data && !error;

  if (isInitialPageLoading) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader title="Organizations" description="Loading organizations." />
        <PageLoading rows={8} label="Loading organizations..." />
      </PageContainer>
    );
  }

  if (!canManageOrganizations) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          title="Organizations"
          description="Platform admin workspace only."
        />
        <PagePermissionNotice
          title="Organization management is not available here"
          description="Use the platform administration area."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Tenant organizations and lifecycle."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Organization
          </Button>
        }
      />

      <StatsCards stats={data?.stats} isLoading={isLoading && !data} />

      <Toolbar
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
      />

      {error ? (
        <PageError
          title="Failed to load organizations"
          description="Could not load organizations. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : null}

      <OrganizationsTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading && !data}
        isRefetching={isFetching && !!data}
        sorting={sorting}
        onSortingChange={setSorting}
        onRowClick={handleRowClick}
      />

      {data && data.totalCount > 0 ? (
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          totalCount={data.totalCount}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      ) : null}

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} />

      <OrgDetailSheet
        tenantId={detailId}
        open={!!detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      />
    </PageContainer>
  );
}
