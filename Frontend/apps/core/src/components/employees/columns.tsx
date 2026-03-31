"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Mail, Eye, UserPen } from "lucide-react";
import {
  Button,
  Badge,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Checkbox,
} from "@repo/ui";
import type { EmployeeListItem } from "@/types/employee";

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Map frontend column IDs to backend sort field names */
export const columnToSortField: Record<string, string> = {
  fullName: "Name",
  department: "Department",
  status: "Status",
  hireDate: "HireDate",
};

/** Get sort icon based on current sort state */
function SortIcon({ columnId, sortBy, sortDir }: { columnId: string; sortBy?: string; sortDir?: string }) {
  const field = columnToSortField[columnId];
  if (!field) return null;
  
  if (sortBy !== field) {
    return <ArrowUpDown className="ml-2 h-4 w-4" />;
  }
  if (sortDir === "Asc") {
    return <ArrowUp className="ml-2 h-4 w-4" />;
  }
  return <ArrowDown className="ml-2 h-4 w-4" />;
}

/** Create columns with sort handlers */
export function createColumns(
  onSort?: (columnId: string) => void,
  sortBy?: string,
  sortDir?: string
): ColumnDef<EmployeeListItem>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "fullName",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => onSort?.("fullName")}
          className="-ml-4"
        >
          Employee
          <SortIcon columnId="fullName" sortBy={sortBy} sortDir={sortDir} />
        </Button>
      ),
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {getInitials(employee.firstName, employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <Link
                href={`/core/employees/${employee.id}`}
                className="font-medium hover:underline"
              >
                {employee.fullName}
              </Link>
              <span className="text-xs text-muted-foreground">
                {employee.email}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "department",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => onSort?.("department")}
          className="-ml-4"
        >
          Department
          <SortIcon columnId="department" sortBy={sortBy} sortDir={sortDir} />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("department") || "—"}</div>,
    },
    {
      accessorKey: "jobTitle",
      header: "Job Title",
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {row.getValue("jobTitle") || "—"}
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => onSort?.("status")}
          className="-ml-4"
        >
          Status
          <SortIcon columnId="status" sortBy={sortBy} sortDir={sortDir} />
        </Button>
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant={status === "active" ? "default" : "secondary"}>
            {status === "active" ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "hireDate",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => onSort?.("hireDate")}
          className="-ml-4"
        >
          Hire Date
          <SortIcon columnId="hireDate" sortBy={sortBy} sortDir={sortDir} />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("hireDate"));
        return (
          <div className="text-muted-foreground">
            {date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(employee.email)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Copy email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/core/employees/${employee.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/core/employees/${employee.id}/edit`}>
                  <UserPen className="mr-2 h-4 w-4" />
                  Edit employee
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

// Legacy export for backwards compatibility
export const columns = createColumns();
