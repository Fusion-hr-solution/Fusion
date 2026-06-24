"use client";

import { Building2 } from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type { PlatformOrganizationSummaryDto } from "@repo/api";
import { DataTable } from "@/components/data-table";

interface OrganizationsTableProps {
  columns: ColumnDef<PlatformOrganizationSummaryDto>[];
  data: PlatformOrganizationSummaryDto[];
  isLoading: boolean;
  isRefetching: boolean;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onRowClick: (org: PlatformOrganizationSummaryDto) => void;
}

export function OrganizationsTable({
  columns,
  data,
  isLoading,
  isRefetching,
  sorting,
  onSortingChange,
  onRowClick,
}: OrganizationsTableProps) {
  return (
    <DataTable<PlatformOrganizationSummaryDto>
      columns={columns}
      data={data}
      isLoading={isLoading}
      isFetching={isRefetching}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRowClick={onRowClick}
      getRowId={(row) => row.id}
      emptyIcon={Building2}
      emptyTitle="No organizations found"
      emptyDescription="Try adjusting your filters, or create a new organization."
      skeletonRowCount={5}
    />
  );
}
