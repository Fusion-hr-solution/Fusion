"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmployeeFieldVisibility } from "@/features/employees/shared/employee-field-visibility";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import type { EmployeeRosterItem } from "./employee-roster.types";

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
      className="gap-1 font-medium"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      <ArrowUpDown className="size-3 text-muted-foreground" />
    </Button>
  );
}

function getEmployeeName(employee: EmployeeRosterItem) {
  return (
    employee.displayName?.trim() ||
    (employee.preferredName?.trim()
      ? `${employee.preferredName} ${employee.lastName}`
      : `${employee.firstName} ${employee.lastName}`)
  );
}

function renderValue(value: string | null) {
  return value?.trim() || "—";
}

function formatDate(value: string): string {
  if (!value?.trim()) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getManagerBadge(employee: EmployeeRosterItem): {
  label: string;
  variant: "secondary" | "destructive";
} | null {
  switch (employee.hierarchyStatus) {
    case "Root":
      return { label: "Top-level leader", variant: "secondary" };
    case "NoManagerAssigned":
      return { label: "No manager assigned", variant: "secondary" };
    case "ManagerInactive":
      return { label: "Manager inactive", variant: "destructive" };
    case "ManagerMissing":
      return { label: "Manager missing", variant: "destructive" };
    default:
      return null;
  }
}

export function buildEmployeeColumns<TEmployee extends EmployeeRosterItem>(
  fieldVisibility: EmployeeFieldVisibility,
  options?: {
    tenantId?: string | null;
    tenantSlug?: string | null;
  }
): ColumnDef<TEmployee>[] {
  const columns: ColumnDef<TEmployee>[] = [
    {
      id: "Name",
      accessorFn: getEmployeeName,
      meta: {
        headerClassName: "w-[8.5rem]",
        cellClassName: "w-[8.5rem]",
      },
      header: ({ column }) => <SortHeader label="Employee" column={column} />,
      cell: ({ row }) => {
        const profileHref = buildTenantContextHref(
          `/employees/${row.original.stableEmployeeKey}`,
          options?.tenantId ?? null,
          options?.tenantSlug ?? null
        );

        return (
          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-center gap-2">
              <Link
                href={profileHref}
                className="truncate font-medium hover:underline focus-visible:underline"
                title={getEmployeeName(row.original)}
                onClick={(event) => event.stopPropagation()}
              >
                {getEmployeeName(row.original)}
              </Link>
              {row.original.status === "Inactive" ? (
                <Badge variant="outline">Inactive</Badge>
              ) : null}
            </div>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "Email",
      accessorKey: "email",
      meta: {
        headerClassName: "w-[6.5rem]",
        cellClassName: "w-[6.5rem]",
      },
      header: ({ column }) => <SortHeader label="Email" column={column} />,
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <span
            className="block max-w-[6.5rem] truncate text-muted-foreground"
            title={row.original.email}
          >
            {row.original.email}
          </span>
        </div>
      ),
      enableSorting: true,
    },
    {
      id: "HireDate",
      accessorKey: "hireDate",
      meta: {
        headerClassName: "w-[7.5rem]",
        cellClassName: "w-[7.5rem]",
      },
      header: ({ column }) => <SortHeader label="Hire date" column={column} />,
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <span className="truncate text-muted-foreground" title={row.original.hireDate}>
            {formatDate(row.original.hireDate)}
          </span>
        </div>
      ),
      enableSorting: true,
    },
  ];

  if (fieldVisibility.showJobTitle) {
    columns.push({
      id: "JobTitle",
      accessorKey: "jobTitle",
      meta: {
        headerClassName: "w-[8rem]",
        cellClassName: "w-[8rem]",
      },
      header: "Job title",
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <span
            className="block max-w-[8rem] truncate text-muted-foreground"
            title={row.original.jobTitle ?? undefined}
          >
            {renderValue(row.original.jobTitle)}
          </span>
        </div>
      ),
      enableSorting: false,
    });
  }

  columns.push({
    id: "OrgUnit",
    accessorKey: "orgUnitName",
    meta: {
      headerClassName: "w-[8rem]",
      cellClassName: "w-[8rem]",
    },
    header: "Org unit",
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <span
          className="block max-w-[8rem] truncate text-muted-foreground"
          title={row.original.orgUnitName ?? undefined}
        >
          {renderValue(row.original.orgUnitName)}
        </span>
      </div>
    ),
    enableSorting: false,
  });

  columns.push({
    id: "Manager",
    accessorKey: "managerName",
    meta: {
      headerClassName: "w-[8.5rem]",
      cellClassName: "w-[8.5rem]",
    },
    header: "Manager",
    cell: ({ row }) => {
      const badge = getManagerBadge(row.original);

      if (badge) {
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      }

      return (
        <div className="flex items-center justify-center">
          <span
            className="block max-w-[8.5rem] truncate font-medium"
            title={row.original.managerName ?? undefined}
          >
            {row.original.managerName}
          </span>
        </div>
      );
    },
    enableSorting: false,
  });

  return columns;
}
