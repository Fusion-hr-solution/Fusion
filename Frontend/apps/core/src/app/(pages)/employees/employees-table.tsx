"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { Users } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { employeeColumns } from "./columns";
import type { EmployeeRosterItem } from "./employee-roster.types";

interface EmployeesTableProps {
  data: EmployeeRosterItem[];
  isLoading: boolean;
  isRefetching: boolean;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onRowClick: (employee: EmployeeRosterItem) => void;
}

export function EmployeesTable({
  data,
  isLoading,
  isRefetching,
  sorting,
  onSortingChange,
  onRowClick,
}: EmployeesTableProps) {
  const table = useReactTable({
    data,
    columns: employeeColumns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  if (isLoading && !isRefetching) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No employees found</EmptyTitle>
          <EmptyDescription>
            Try a different search or status filter.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="relative rounded-xl border">
      {isRefetching && (
        <div className="bg-background/50 absolute inset-0 z-10 rounded-xl" />
      )}

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={
                    header.column.id === "HireDate" ? "text-right" : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-muted/40"
              role="button"
              tabIndex={0}
              aria-label={`Open reporting relationship for ${row.original.firstName} ${row.original.lastName}`}
              onClick={() => onRowClick(row.original)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row.original);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
