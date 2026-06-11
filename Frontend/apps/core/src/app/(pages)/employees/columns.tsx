"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getEmployeeActionIssues,
  buildEmployeeFixHref,
  getEmployeeReadinessBadgeLabel,
  getEmployeeReadinessBadgeVariant,
} from "./employee-readiness";
import { getHierarchyIssueMeta } from "./employee-hierarchy-status";
import type { EmployeeFieldVisibility } from "./employee-field-visibility";
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

  if (employee.hierarchyStatus === "Root") {
    return "Top-level leader";
  }

  if (employee.hierarchyStatus === "NoManagerAssigned") {
    return "No manager assigned";
  }

  return employee.managerName ?? "Manager needs attention";
}

export function buildEmployeeColumns<TEmployee extends EmployeeRosterItem>(
  fieldVisibility: EmployeeFieldVisibility
): ColumnDef<TEmployee>[] {
  const columns: ColumnDef<TEmployee>[] = [
    {
      id: "Name",
      accessorFn: getEmployeeName,
      meta: {
        headerClassName: "w-[14rem] min-[1700px]:w-[17rem]",
        cellClassName: "w-[14rem] min-[1700px]:w-[17rem]",
      },
      header: ({ column }) => <SortHeader label="Name" column={column} />,
      cell: ({ row }) => {
        const issues = getEmployeeActionIssues(row.original.readiness);
        const visibleIssues = issues.slice(0, 2);
        const remainingCount = issues.length - visibleIssues.length;

        return (
          <div className="min-w-0 space-y-1.5">
            <div className="truncate font-medium">
              {getEmployeeName(row.original)}
            </div>
            {visibleIssues.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {visibleIssues.map((issue) => {
                  const href = buildEmployeeFixHref(issue);
                  const badge = (
                    <Badge variant={getEmployeeReadinessBadgeVariant(issue)}>
                      {getEmployeeReadinessBadgeLabel(issue)}
                    </Badge>
                  );

                  return href ? (
                    <Link
                      key={`${issue.code}:${issue.fieldKey ?? "none"}`}
                      href={href}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {badge}
                    </Link>
                  ) : (
                    <span key={`${issue.code}:${issue.fieldKey ?? "none"}`}>
                      {badge}
                    </span>
                  );
                })}
                {remainingCount > 0 ? (
                  <Badge variant="outline">+{remainingCount} more</Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "Email",
      accessorKey: "email",
      meta: {
        headerClassName: "w-[17rem] min-[1700px]:w-[20rem]",
        cellClassName: "w-[17rem] min-[1700px]:w-[20rem]",
      },
      header: ({ column }) => <SortHeader label="Email" column={column} />,
      cell: ({ row }) => (
        <span
          className="block truncate text-muted-foreground"
          title={row.original.email}
        >
          {row.original.email}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: "Manager",
      accessorKey: "managerName",
      meta: {
        headerClassName: "w-[12rem] min-[1700px]:w-[15rem]",
        cellClassName: "w-[12rem] min-[1700px]:w-[15rem]",
      },
      header: "Manager",
      cell: ({ row }) => {
        const issueMeta = getHierarchyIssueMeta(row.original.hierarchyStatus);
        const isUnassigned =
          row.original.hierarchyStatus === "NoManagerAssigned";

        return (
          <div className="min-w-0 space-y-1">
            <div
              className={
                isUnassigned
                  ? "truncate text-muted-foreground"
                  : "truncate font-medium"
              }
              title={getManagerLabel(row.original)}
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
      meta: {
        headerClassName:
          "hidden w-[7rem] min-[1500px]:table-cell min-[1700px]:w-[8rem]",
        cellClassName:
          "hidden w-[7rem] min-[1500px]:table-cell min-[1700px]:w-[8rem]",
      },
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
  ];

  if (fieldVisibility.showHireDate) {
    columns.push({
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
    });
  }

  if (fieldVisibility.showJobTitle) {
    columns.push({
      id: "JobTitle",
      accessorKey: "jobTitle",
      header: "Job title",
      cell: ({ row }) => renderValue(row.original.jobTitle),
      enableSorting: false,
    });
  }

  columns.push({
    id: "OrgUnit",
    accessorKey: "orgUnitName",
    meta: {
      headerClassName: "hidden w-[17rem] min-[1800px]:table-cell",
      cellClassName: "hidden w-[17rem] min-[1800px]:table-cell",
    },
    header: "Org unit",
    cell: ({ row }) => (
      <span
        className="block truncate text-muted-foreground"
        title={row.original.orgUnitName ?? undefined}
      >
        {row.original.orgUnitName ?? "—"}
      </span>
    ),
    enableSorting: false,
  });

  return columns;
}
