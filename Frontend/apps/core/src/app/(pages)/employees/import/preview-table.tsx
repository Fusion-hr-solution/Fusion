"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmployeeImportPreviewRowDto } from "./employee-import.types";
import type {
  EmployeeImportIssueGroup,
  EmployeeImportValidationUiModel,
} from "./employee-import-validation";

const PREVIEW_FIELD_COLUMNS = [
  { key: "employeeNumber", label: "Employee number" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "hireDate", label: "Hire date" },
  { key: "jobTitle", label: "Job title" },
  { key: "orgUnitCode", label: "Org unit code" },
  { key: "managerEmail", label: "Manager email" },
] as const satisfies ReadonlyArray<{
  key: keyof EmployeeImportPreviewRowDto;
  label: string;
}>;

interface EmployeeImportPreviewTableProps {
  rows: EmployeeImportPreviewRowDto[];
  hasGroupedIssues: boolean;
  validationUi?: EmployeeImportValidationUiModel | null;
  focusedGroup: EmployeeImportIssueGroup | null;
  activeIssueGroupKey: string | null;
  onSelectGroup: (group: EmployeeImportIssueGroup) => void;
}

export function EmployeeImportPreviewTable({
  rows,
  hasGroupedIssues,
  validationUi,
  focusedGroup,
  activeIssueGroupKey,
  onSelectGroup,
}: EmployeeImportPreviewTableProps) {
  const columns: ColumnDef<EmployeeImportPreviewRowDto>[] = [
    {
      accessorKey: "rowNumber",
      header: "Row",
      cell: ({ row }) => {
        const rowGroups =
          validationUi?.groupsByRowNumber.get(row.original.rowNumber) ?? [];
        const hasRowIssues = rowGroups.length > 0;

        return (
          <div className="flex items-center gap-2">
            {hasRowIssues ? (
              <span className="size-2 rounded-full bg-destructive" />
            ) : null}
            <span>{row.original.rowNumber}</span>
          </div>
        );
      },
    },
    ...(hasGroupedIssues
      ? [
          {
            id: "issues",
            header: "Issues",
            cell: ({ row }) => {
              const rowGroups =
                validationUi?.groupsByRowNumber.get(row.original.rowNumber) ??
                [];

              if (rowGroups.length === 0) {
                return <span className="text-muted-foreground">-</span>;
              }

              return (
                <div className="flex flex-wrap gap-1">
                  {rowGroups.map((group) => (
                    <button
                      key={`${row.original.rowNumber}-${group.key}`}
                      type="button"
                      className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
                        activeIssueGroupKey === group.key
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-destructive/20 bg-background text-destructive/80 hover:bg-destructive/5"
                      }`}
                      onClick={() => onSelectGroup(group)}
                      aria-pressed={activeIssueGroupKey === group.key}
                    >
                      {group.shortLabel}
                    </button>
                  ))}
                </div>
              );
            },
          } satisfies ColumnDef<EmployeeImportPreviewRowDto>,
        ]
      : []),
    ...PREVIEW_FIELD_COLUMNS.map(
      (column) =>
        ({
          id: column.key,
          accessorFn: (row) => row[column.key],
          header: column.label,
          cell: ({ row }) => {
            const value = row.original[column.key];

            return value ?? <span className="text-muted-foreground">-</span>;
          },
        }) satisfies ColumnDef<EmployeeImportPreviewRowDto>
    ),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.rowNumber),
  });

  const isFocusedFieldColumn = (columnId: string) =>
    focusedGroup?.fieldKeys.includes(
      columnId as keyof EmployeeImportPreviewRowDto
    ) ?? false;

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const className = [
                  header.column.id === "issues" ? "w-56 max-w-56" : undefined,
                  isFocusedFieldColumn(header.column.id)
                    ? "bg-destructive/10"
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <TableHead key={header.id} className={className || undefined}>
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
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => {
              const rowGroups =
                validationUi?.groupsByRowNumber.get(row.original.rowNumber) ??
                [];
              const hasRowIssues = rowGroups.length > 0;
              const isActiveRow =
                !!activeIssueGroupKey &&
                rowGroups.some((group) => group.key === activeIssueGroupKey);

              return (
                <TableRow
                  key={row.id}
                  id={`employee-import-preview-row-${row.original.rowNumber}`}
                  className={
                    hasRowIssues
                      ? isActiveRow
                        ? "bg-destructive/10"
                        : "bg-destructive/5"
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const className = [
                      cell.column.id === "issues" ? "max-w-56" : undefined,
                      isFocusedFieldColumn(cell.column.id)
                        ? isActiveRow
                          ? "bg-destructive/10"
                          : "bg-destructive/5"
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <TableCell
                        key={cell.id}
                        className={className || undefined}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getAllLeafColumns().length}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No rows match the current preview filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
