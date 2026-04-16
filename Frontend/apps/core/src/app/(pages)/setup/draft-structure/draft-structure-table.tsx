"use client";

import type { DraftOrgUnitDto } from "@repo/api";
import { ArrowUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export type DraftStructureSortField =
  | "code"
  | "name"
  | "type"
  | "parentName"
  | "updatedAt";

interface DraftStructureTableProps {
  data: DraftOrgUnitDto[];
  isLoading: boolean;
  sortBy: DraftStructureSortField;
  sortDirection: "asc" | "desc";
  onSortChange: (field: DraftStructureSortField) => void;
  onRowClick: (unit: DraftOrgUnitDto) => void;
}

function SortHeader({
  label,
  field,
  sortBy,
  sortDirection,
  onSortChange,
}: {
  label: string;
  field: DraftStructureSortField;
  sortBy: DraftStructureSortField;
  sortDirection: "asc" | "desc";
  onSortChange: (field: DraftStructureSortField) => void;
}) {
  const directionHint = sortBy === field ? sortDirection : undefined;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 gap-1 font-medium"
      onClick={() => onSortChange(field)}
    >
      {label}
      <ArrowUpDown className="size-3 text-muted-foreground" />
      <span className="sr-only">
        {directionHint ? `Sorted ${directionHint}` : "Not sorted"}
      </span>
    </Button>
  );
}

function formatTimestamp(value: string | null, fallback: string) {
  if (!value) return fallback;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DraftStructureTable({
  data,
  isLoading,
  sortBy,
  sortDirection,
  onSortChange,
  onRowClick,
}: DraftStructureTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
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
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>No draft units yet</EmptyTitle>
          <EmptyDescription>
            Add the first unit to begin preparing a draft structure for import
            correction and later governance.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortHeader
                label="Code"
                field="code"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Name"
                field="name"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Type"
                field="type"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Parent"
                field="parentName"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Last Modified"
                field="updatedAt"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((unit) => (
            <TableRow
              key={unit.id}
              className="cursor-pointer"
              onClick={() => onRowClick(unit)}
            >
              <TableCell className="font-mono text-xs">{unit.code}</TableCell>
              <TableCell className="font-medium">{unit.name}</TableCell>
              <TableCell>{unit.type}</TableCell>
              <TableCell>{unit.parentName ?? "Root"}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatTimestamp(unit.updatedAt, formatTimestamp(unit.createdAt, "-"))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}