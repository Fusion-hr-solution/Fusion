"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export interface DataTableColumnMeta {
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading: boolean;
  isFetching: boolean;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onRowClick?: (row: TData) => void;
  getRowId: (row: TData) => string;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyContent?: ReactNode;
  skeletonRowCount?: number;
  minWidth?: string;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  isFetching,
  sorting,
  onSortingChange,
  onRowClick,
  getRowId,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  emptyIcon: EmptyIcon,
  emptyTitle = "No results found",
  emptyDescription,
  emptyContent,
  skeletonRowCount = 6,
  minWidth,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      ...(enableRowSelection ? { rowSelection: rowSelection ?? {} } : {}),
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    onRowSelectionChange: enableRowSelection ? onRowSelectionChange : undefined,
    enableRowSelection: enableRowSelection ?? false,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    getRowId,
  });

  if (isLoading && !isFetching) {
    return (
      <div className="space-y-2">
        {Array.from({ length: skeletonRowCount }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          {EmptyIcon ? (
            <EmptyMedia variant="icon">
              <EmptyIcon />
            </EmptyMedia>
          ) : null}
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          {emptyDescription ? (
            <p className="text-sm text-muted-foreground">{emptyDescription}</p>
          ) : null}
        </EmptyHeader>
        {emptyContent ? <EmptyContent>{emptyContent}</EmptyContent> : null}
      </Empty>
    );
  }

  return (
    <div className="relative overflow-x-auto rounded-xl border">
      {isFetching && (
        <div className="bg-background/50 absolute inset-0 z-10 rounded-xl" />
      )}

      <Table
        style={minWidth ? { minWidth } : undefined}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as
                  | DataTableColumnMeta
                  | undefined;

                return (
                  <TableHead
                    key={header.id}
                    className={
                      ["text-center", meta?.headerClassName ?? null]
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
              className={
                onRowClick
                  ? "group/row cursor-pointer hover:bg-muted/40"
                  : undefined
              }
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row.original)}
              onKeyDown={(event) => {
                if (!onRowClick) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row.original);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as
                  | DataTableColumnMeta
                  | undefined;

                return (
                  <TableCell
                    key={cell.id}
                    className={[
                      "overflow-hidden text-center align-middle whitespace-normal py-2",
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
