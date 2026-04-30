"use client";

import { useCallback, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { Upload, Users } from "lucide-react";
import { useAuth } from "@repo/auth";
import { DEFAULT_PAGE_SIZE, EmptyState, type PageSize } from "@repo/ui";
import { PageHeader } from "@/components/page-header";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import { EmployeeReportingLinesSheet } from "./employee-reporting-lines-sheet";
import { EmployeesTable } from "./employees-table";
import { PaginationBar } from "./pagination-bar";
import { Toolbar } from "./toolbar";
import type {
  EmployeeRosterSortDirection,
  EmployeeRosterSortField,
  EmployeeRosterStatus,
  EmployeeRosterItem,
} from "./employee-roster.types";
import { useEmployeeRoster } from "./use-employees";

const DEFAULT_EMPLOYEE_SORTING: SortingState = [{ id: "Name", desc: false }];

function isEmployeeRosterSortField(
  value: string | undefined
): value is EmployeeRosterSortField {
  return (
    value === "Name" ||
    value === "Email" ||
    value === "Status" ||
    value === "HireDate"
  );
}

function getRosterSortParams(sorting: SortingState): {
  sortBy: EmployeeRosterSortField;
  sortDir: EmployeeRosterSortDirection;
} {
  const primarySort = sorting[0];

  return {
    sortBy: isEmployeeRosterSortField(primarySort?.id)
      ? primarySort.id
      : "Name",
    sortDir: primarySort?.desc ? "Desc" : "Asc",
  };
}

export default function EmployeesPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canAccess = canAccessEmployeeRoster(user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EmployeeRosterStatus | undefined>();
  const [sorting, setSorting] = useState<SortingState>(
    DEFAULT_EMPLOYEE_SORTING
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const { sortBy, sortDir } = getRosterSortParams(sorting);

  const { data, error, isLoading, isFetching, refetch } = useEmployeeRoster({
    search: search || undefined,
    status,
    sortBy,
    sortDir,
    page,
    pageSize,
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback(
    (value: EmployeeRosterStatus | undefined) => {
      setStatus(value);
      setPage(1);
    },
    []
  );

  const handleSortingChange = useCallback((nextSorting: SortingState) => {
    setSorting(
      nextSorting.length > 0 ? [nextSorting[0]!] : DEFAULT_EMPLOYEE_SORTING
    );
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((size: PageSize) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const handleRowClick = useCallback((employee: EmployeeRosterItem) => {
    setSelectedEmployeeId(employee.id);
  }, []);

  const isInitialPageLoading =
    (isAuthLoading && !user) ||
    (!isAuthLoading && canAccess && isLoading && !data && !error);

  if (isInitialPageLoading) {
    return (
      <CorePageLoadingState
        title="Employees"
        description="The operational roster is available only to tenant HR administrators."
        message="Loading employees..."
        variant="list"
      />
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Employees"
          description="The operational roster is available only to tenant HR administrators."
        />
        <EmptyState
          icon={Users}
          title="Employee roster is not available for this role"
          description="Ask a tenant HR administrator to manage the operational roster."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Employees"
        description="Review the tenant roster and launch repeatable bulk employee imports from the official workflow."
        actions={
          <Button asChild>
            <Link href="/employees/import">
              <Upload />
              Import employees
            </Link>
          </Button>
        }
      />

      <Toolbar
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
      />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load employees</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error.message || "An unexpected error occurred."}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <EmployeesTable
        data={data?.items ?? []}
        isLoading={isLoading && !data}
        isRefetching={isFetching && !!data}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        onRowClick={handleRowClick}
      />

      {data && data.totalCount > 0 && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalCount={data.totalCount}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <EmployeeReportingLinesSheet
        employeeId={selectedEmployeeId}
        open={selectedEmployeeId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEmployeeId(null);
          }
        }}
      />
    </div>
  );
}
