"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getHierarchyIssueMeta } from "./employee-hierarchy-status";
import type { EmployeeRosterItem } from "./employee-roster.types";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

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

function getEmployeeName(employee: EmployeeRosterItem) {
  return `${employee.firstName} ${employee.lastName}`;
}

function formatDate(value: string) {
  return DATE_FORMATTER.format(new Date(value));
}

function renderValue(value: string | null) {
  return value?.trim() || "Not set";
}

function getManagerLabel(employee: EmployeeRosterItem) {
  if (employee.hierarchyStatus === "ManagerMissing") {
    return employee.managerName ?? "Manager needs attention";
  }

  if (employee.hierarchyStatus === "NoManagerAssigned") {
    return "No manager assigned";
  }

  return employee.managerName ?? "Manager needs attention";
}

export const employeeColumns: ColumnDef<EmployeeRosterItem>[] = [
  {
    id: "Name",
    accessorFn: getEmployeeName,
    header: ({ column }) => <SortHeader label="Name" column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{getEmployeeName(row.original)}</span>
    ),
    enableSorting: true,
  },
  {
    id: "Email",
    accessorKey: "email",
    header: ({ column }) => <SortHeader label="Email" column={column} />,
    enableSorting: true,
  },
  {
    id: "Manager",
    accessorKey: "managerName",
    header: "Manager",
    cell: ({ row }) => {
      const issueMeta = getHierarchyIssueMeta(row.original.hierarchyStatus);
      const isUnassigned = row.original.hierarchyStatus === "NoManagerAssigned";

      return (
        <div className="min-w-[180px] space-y-1">
          <div
            className={isUnassigned ? "text-muted-foreground" : "font-medium"}
          >
            {getManagerLabel(row.original)}
          </div>
          {issueMeta ? (
            <Badge variant={issueMeta.variant}>{issueMeta.label}</Badge>
          ) : null}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: "Status",
    accessorKey: "status",
    header: ({ column }) => <SortHeader label="Status" column={column} />,
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "Active" ? "secondary" : "outline"}
      >
        {row.original.status}
      </Badge>
    ),
    enableSorting: true,
  },
  {
    id: "HireDate",
    accessorKey: "hireDate",
    header: ({ column }) => (
      <div className="text-right">
        <SortHeader label="Hire date" column={column} />
      </div>
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {formatDate(row.original.hireDate)}
      </span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "jobTitle",
    header: "Job title",
    cell: ({ row }) => renderValue(row.original.jobTitle),
    enableSorting: false,
  },
  {
    accessorKey: "orgUnitName",
    header: "Org unit",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.orgUnitName ?? "—"}
      </span>
    ),
    enableSorting: false,
  },
];
