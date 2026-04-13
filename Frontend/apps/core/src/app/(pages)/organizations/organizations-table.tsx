"use client";

import { RowActions } from "./row-actions";
import type { PlatformOrganizationSummaryDto } from "@repo/api";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { columns } from "./columns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Building2 } from "lucide-react";

interface OrganizationsTableProps {
  data: PlatformOrganizationSummaryDto[];
  isLoading: boolean;
  isRefetching: boolean;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  onRowClick: (org: PlatformOrganizationSummaryDto) => void;
  onMutated?: () => void;
}

export function OrganizationsTable({
  data,
  isLoading,
  isRefetching,
  sorting,
  onSortingChange,
  onRowClick,
  onMutated,
}: OrganizationsTableProps) {
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>No organizations found</EmptyTitle>
          <EmptyDescription>
            Try adjusting your filters, or create a new organization.
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
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => onRowClick(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <RowActions org={row.original} onMutated={onMutated} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
