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
import { cn } from "@/lib/utils";

export type DraftStructureSortField =
  | "referenceKey"
  | "displayName"
  | "orgUnitKindLabel"
  | "parentDisplayName"
  | "location"
  | "updatedAt";

interface DraftStructureTableProps {
  embedded?: boolean;
  data: DraftOrgUnitDto[];
  isLoading: boolean;
  selectedUnitId?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
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
  embedded = false,
  data,
  isLoading,
  selectedUnitId = null,
  emptyTitle = "No structure items yet",
  emptyDescription =
    "Add the first structure item to begin preparing a draft structure for import correction and later governance.",
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
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div
      className={cn(
        "h-full min-h-0 overflow-auto bg-background",
        embedded ? "rounded-none border-0" : "rounded-xl border"
      )}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <TableRow className="hover:bg-muted/10">
            <TableHead>
              <SortHeader
                label="Reference Key"
                field="referenceKey"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Display Name"
                field="displayName"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Kind"
                field="orgUnitKindLabel"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Parent"
                field="parentDisplayName"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead>
              <SortHeader
                label="Location"
                field="location"
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
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/20",
                selectedUnitId === unit.id ? "bg-muted/30" : ""
              )}
              onClick={() => onRowClick(unit)}
            >
              <TableCell className="font-mono text-xs">
                {unit.referenceKey}
              </TableCell>
              <TableCell className="font-medium">{unit.displayName}</TableCell>
              <TableCell>{unit.orgUnitKindLabel}</TableCell>
              <TableCell>{unit.parentDisplayName ?? "Root"}</TableCell>
              <TableCell>{unit.location ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatTimestamp(
                  unit.updatedAt,
                  formatTimestamp(unit.createdAt, "-")
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
