"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type {
  EmployeeRosterItem,
  EmployeeRosterSortDirection,
  EmployeeRosterSortField,
} from "./employee-roster.types";

interface EmployeesTableProps {
  data: EmployeeRosterItem[];
  isLoading: boolean;
  isRefetching: boolean;
  sortBy: EmployeeRosterSortField;
  sortDir: EmployeeRosterSortDirection;
  onSortChange: (field: EmployeeRosterSortField) => void;
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const SORTABLE_COLUMNS: Array<{
  field: EmployeeRosterSortField;
  label: string;
  className?: string;
}> = [
  { field: "Name", label: "Name" },
  { field: "Email", label: "Email" },
  { field: "Department", label: "Department" },
  { field: "Status", label: "Status" },
  { field: "HireDate", label: "Hire date", className: "text-right" },
];

function getAriaSort(
  field: EmployeeRosterSortField,
  activeField: EmployeeRosterSortField,
  direction: EmployeeRosterSortDirection
): "ascending" | "descending" | "none" {
  if (field !== activeField) {
    return "none";
  }

  return direction === "Asc" ? "ascending" : "descending";
}

function getSortHint(
  field: EmployeeRosterSortField,
  activeField: EmployeeRosterSortField,
  direction: EmployeeRosterSortDirection
) {
  if (field !== activeField) {
    return "Not sorted";
  }

  return direction === "Asc" ? "Sorted ascending" : "Sorted descending";
}

function getSortIcon(
  field: EmployeeRosterSortField,
  activeField: EmployeeRosterSortField,
  direction: EmployeeRosterSortDirection
) {
  if (field !== activeField) {
    return <ArrowUpDown className="size-3.5" />;
  }

  return direction === "Asc" ? (
    <ArrowUp className="size-3.5" />
  ) : (
    <ArrowDown className="size-3.5" />
  );
}

function formatDate(value: string) {
  return DATE_FORMATTER.format(new Date(value));
}

function getEmployeeName(employee: EmployeeRosterItem) {
  return `${employee.firstName} ${employee.lastName}`;
}

function renderValue(value: string | null) {
  return value?.trim() || "Not set";
}

export function EmployeesTable({
  data,
  isLoading,
  isRefetching,
  sortBy,
  sortDir,
  onSortChange,
}: EmployeesTableProps) {
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
          <EmptyTitle>No employees found</EmptyTitle>
          <EmptyDescription>
            Try a different search or status filter.
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
          <TableRow>
            {SORTABLE_COLUMNS.map((column) => (
              <TableHead
                key={column.field}
                className={column.className}
                aria-sort={getAriaSort(column.field, sortBy, sortDir)}
              >
                <Button
                  variant="ghost"
                  className="-ml-3 h-8 gap-1 px-3"
                  onClick={() => onSortChange(column.field)}
                >
                  {column.label}
                  {getSortIcon(column.field, sortBy, sortDir)}
                  <span className="sr-only">
                    {getSortHint(column.field, sortBy, sortDir)}
                  </span>
                </Button>
              </TableHead>
            ))}
            <TableHead>Job title</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell className="font-medium">
                {getEmployeeName(employee)}
              </TableCell>
              <TableCell>{employee.email}</TableCell>
              <TableCell>{renderValue(employee.department)}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    employee.status === "Active" ? "secondary" : "outline"
                  }
                >
                  {employee.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatDate(employee.hireDate)}
              </TableCell>
              <TableCell>{renderValue(employee.jobTitle)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}