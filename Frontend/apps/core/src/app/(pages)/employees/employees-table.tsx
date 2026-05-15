"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
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
import type { EmployeeRosterItem } from "./employee-roster.types";

interface EmployeeTableColumnMeta {
  headerClassName?: string;
  cellClassName?: string;
}

interface EmployeesTableProps<TRow extends EmployeeRosterItem> {
  columns: ColumnDef<TRow>[];
  data: TRow[];
  isLoading: boolean;
  isRefetching: boolean;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onRowClick: (employee: TRow) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function EmployeesTable<TRow extends EmployeeRosterItem>({
  columns,
  data,
  isLoading,
  isRefetching,
  sorting,
  onSortingChange,
  onRowClick,
  rowSelection,
  onRowSelectionChange,
  emptyTitle = "No employees found",
  emptyDescription = "Try a different search or status filter.",
}: EmployeesTableProps<TRow>) {
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    onRowSelectionChange: (updater) => {
      if (!onRowSelectionChange) {
        return;
      }

      const next =
        typeof updater === "function" ? updater(rowSelection ?? {}) : updater;
      onRowSelectionChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableRowSelection: !!onRowSelectionChange,
    getRowId: (row) => row.id,
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
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="relative overflow-x-auto rounded-xl border">
      {isRefetching && (
        <div className="bg-background/50 absolute inset-0 z-10 rounded-xl" />
      )}

      <Table className="min-w-[840px] table-fixed min-[1500px]:min-w-[980px] min-[1800px]:min-w-[1120px]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as
                  | EmployeeTableColumnMeta
                  | undefined;

                return (
                  <TableHead
                    key={header.id}
                    className={
                      [
                        header.column.id === "HireDate" ? "text-right" : null,
                        meta?.headerClassName ?? null,
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
              className="group/employee-row data-[state=selected]:bg-muted/55 cursor-pointer hover:bg-muted/40"
              role="button"
              tabIndex={0}
              aria-label={`Open employee profile for ${row.original.firstName} ${row.original.lastName}`}
              onClick={() => onRowClick(row.original)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row.original);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as
                  | EmployeeTableColumnMeta
                  | undefined;

                return (
                  <TableCell
                    key={cell.id}
                    className={[
                      "overflow-hidden align-middle whitespace-normal py-3",
                      meta?.cellClassName ?? null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
