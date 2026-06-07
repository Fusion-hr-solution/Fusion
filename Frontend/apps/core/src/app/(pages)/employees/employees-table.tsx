"use client";

import type { ReactNode } from "react";

import { Users } from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import type { EmployeeRosterItem } from "./employee-roster.types";

interface EmployeesTableProps<TRow extends EmployeeRosterItem> {
  columns: ColumnDef<TRow>[];
  data: TRow[];
  isLoading: boolean;
  isRefetching: boolean;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onRowClick: (employee: TRow) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyContent?: ReactNode;
}

export function EmployeesTable<TRow extends EmployeeRosterItem>({
  columns,
  data,
  isLoading,
  isRefetching,
  sorting,
  onSortingChange,
  onRowClick,
  emptyTitle = "No employees found",
  emptyContent,
}: EmployeesTableProps<TRow>) {
  return (
    <DataTable<TRow>
      columns={columns}
      data={data}
      isLoading={isLoading}
      isFetching={isRefetching}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRowClick={onRowClick}
      getRowId={(row) => row.id}
      emptyIcon={Users}
      emptyTitle={emptyTitle}
      emptyContent={emptyContent}
      skeletonRowCount={6}
      minWidth="980px"
    />
  );
}
