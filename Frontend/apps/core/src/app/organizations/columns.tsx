"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { PlatformOrganizationSummaryDto } from "@repo/api";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowUpDown } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function SortHeader({
  label,
  column,
}: {
  label: string;
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (desc?: boolean) => void;
  };
}) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 gap-1 font-medium"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      <ArrowUpDown className="size-3 text-muted-foreground" />
    </Button>
  );
}

function DateCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const date = new Date(value);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="tabular-nums">
            {formatDistanceToNow(date, { addSuffix: true })}
          </span>
        </TooltipTrigger>
        <TooltipContent>{format(date, "PPpp")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const columns: ColumnDef<PlatformOrganizationSummaryDto>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortHeader label="Organization" column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("name")}</span>
    ),
  },
  {
    accessorKey: "operationalStatus",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.operationalStatus} />,
    enableSorting: false,
  },
  {
    accessorKey: "activeUserCount",
    header: ({ column }) => <SortHeader label="Users" column={column} />,
    cell: ({ row }) => (
      <span className="tabular-nums">{row.getValue("activeUserCount")}</span>
    ),
  },
  {
    accessorKey: "pendingInviteCount",
    header: "Pending",
    cell: ({ row }) => {
      const count = row.getValue("pendingInviteCount") as number;
      return (
        <span
          className={`tabular-nums ${count > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
        >
          {count}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortHeader label="Created" column={column} />,
    cell: ({ row }) => <DateCell value={row.getValue("createdAt")} />,
  },
  {
    accessorKey: "lastActivityAt",
    header: ({ column }) => (
      <SortHeader label="Last Activity" column={column} />
    ),
    cell: ({ row }) => <DateCell value={row.getValue("lastActivityAt")} />,
  },
];
