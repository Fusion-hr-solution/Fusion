"use client";

import { useCallback, useEffect, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import type { PlatformOrganizationSummaryDto } from "@repo/api";
import { canAccessOrganizations, useAuth } from "@repo/auth";
import { DEFAULT_PAGE_SIZE, EmptyState, type PageSize } from "@repo/ui";
import { Building, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { useOrganizationList } from "@/features/organizations/api/use-organizations";
import { StatsCards } from "@/app/(pages)/organizations/stats-cards";
import { Toolbar } from "@/app/(pages)/organizations/toolbar";
import { OrganizationsTable } from "@/app/(pages)/organizations/organizations-table";
import { PaginationBar } from "@/app/(pages)/organizations/pagination-bar";
import { CreateOrgDialog } from "@/app/(pages)/organizations/create-org-dialog";
import { OrgDetailSheet } from "@/app/(pages)/organizations/org-detail-sheet";

export default function OrganizationsWorkspace() {
  const { user } = useAuth();
  const canManageOrganizations = canAccessOrganizations(user);
  const searchParams = useSearchParams();

  const [skip, setSkip] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

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
    setSkip(0);
  }, [statusParamsKey]);

  const isInitialPageLoading =
    canManageOrganizations && isLoading && !data && !error;

  if (isInitialPageLoading) {
    return (
      <CorePageLoadingState
        title="Organizations"
        description="Loading organizations."
        message="Loading organizations..."
        variant="summary-list"
      />
    );
  }

  if (!canManageOrganizations) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Organizations"
          description="Platform admin workspace only."
        />
        <EmptyState
          icon={Building}
          title="Organization management is not available here"
          description="Use the platform administration area."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
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
        <Alert variant="destructive">
          <AlertTitle>Failed to load organizations</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Could not load organizations. Try again in a moment.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <OrganizationsTable
        data={data?.items ?? []}
        isLoading={isLoading && !data}
        isRefetching={isFetching && !!data}
        sorting={sorting}
        onSortingChange={setSorting}
        onRowClick={handleRowClick}
      />

      {data && data.totalCount > 0 ? (
        <PaginationBar
          skip={skip}
          take={pageSize}
          totalCount={data.totalCount}
          onPageChange={setSkip}
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
    </div>
  );
}
