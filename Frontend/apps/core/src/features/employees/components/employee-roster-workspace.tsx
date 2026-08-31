"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Send, Upload } from "lucide-react";
import {
  canAccessCoreAccess,
  canAccessCoreOrgChart,
  canManageCoreAccessProfiles,
  canImportCoreEmployees,
  canManageCoreEmployees,
  useAuth,
} from "@repo/auth";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/lib/table-config";
import {
  PageContainer,
  PageHeader,
  PageError,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmployeesPageSkeleton } from "@/shell/route-skeletons";
import { buildEmployeeColumns } from "@/app/(pages)/employees/columns";
import { EmployeeCreateDialog } from "@/app/(pages)/employees/employee-create-dialog";
import { EmployeeRowActions } from "@/app/(pages)/employees/employee-row-actions";
import { parseEmployeeReadinessFilter } from "@/app/(pages)/employees/employee-readiness";
import type {
  EmployeeAccessFilter,
  EmployeeReadinessFilter,
  EmployeeRosterItem,
  EmployeeRosterSortDirection,
  EmployeeRosterSortField,
  EmployeeRosterStatus,
  WorkforceAccountStatusDto,
  WorkforceAccountSubject,
} from "@/app/(pages)/employees/employee-roster.types";
import { EmployeesTable } from "@/app/(pages)/employees/employees-table";
import { DataTablePagination as PaginationBar } from "@/components/data-table-pagination";
import { Toolbar } from "@/app/(pages)/employees/toolbar";
import { useEmployeeRoster } from "@/app/(pages)/employees/use-employees";
import { useWorkforceAccountStatuses } from "@/app/(pages)/employees/use-workforce-accounts";
import {
  getAccessBadgeTone,
  getAccessDisplayState,
  parseEmployeeAccessFilter,
} from "@/features/access/shared/employee-access";
import { useEmployeeFieldVisibility } from "@/features/employees/shared/employee-field-visibility";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";

const DEFAULT_EMPLOYEE_SORTING: SortingState = [{ id: "Name", desc: false }];

type EmployeeRosterRow = EmployeeRosterItem & {
  workforceAccount: WorkforceAccountStatusDto | null;
};

function parseEmployeeStatus(
  value: string | null | undefined
): EmployeeRosterStatus | undefined {
  return value === "Active" || value === "Inactive" ? value : undefined;
}

function parsePositiveInteger(
  value: string | null | undefined,
  fallback: number
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const EMPLOYEES_DEFAULT_PAGE_SIZE: PageSize = 10;

function parsePageSize(value: string | null | undefined): PageSize {
  const parsed = Number(value);

  return PAGE_SIZE_OPTIONS.includes(parsed as PageSize)
    ? (parsed as PageSize)
    : EMPLOYEES_DEFAULT_PAGE_SIZE;
}

function parseFilterId(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

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

function buildWorkforceAccountSubject(
  employee: EmployeeRosterItem
): WorkforceAccountSubject {
  return {
    employeeId: employee.id,
    email: employee.email,
    firstName: employee.firstName,
    lastName: employee.lastName,
  };
}

function mergeEmployeeRows(
  employees: EmployeeRosterItem[],
  accounts: WorkforceAccountStatusDto[]
): EmployeeRosterRow[] {
  const accountsByEmployeeId = new Map(
    accounts.map((account) => [account.employeeId, account])
  );

  return employees.map((employee) => ({
    ...employee,
    workforceAccount: accountsByEmployeeId.get(employee.id) ?? null,
  }));
}

function getEmployeeOptionLabel(employee: EmployeeRosterItem) {
  return (
    employee.displayName?.trim() || `${employee.firstName} ${employee.lastName}`
  );
}

function buildOrgUnitSeedOptions(rows: EmployeeRosterItem[]) {
  const orgUnitsById = new Map<
    string,
    {
      id: string;
      code: string;
      name: string;
      type: string;
      parentId: null;
      parentName: null;
      isActive: true;
    }
  >();

  for (const row of rows) {
    if (!row.orgUnitId || !row.orgUnitName) {
      continue;
    }

    orgUnitsById.set(row.orgUnitId, {
      id: row.orgUnitId,
      code: "",
      name: row.orgUnitName,
      type: "",
      parentId: null,
      parentName: null,
      isActive: true,
    });
  }

  return [...orgUnitsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export default function EmployeeRosterWorkspace() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessWorkspaceHref = "/access";
  const accessReviewHref = "/access?access=NotInvited";
  const canAccess = canAccessEmployeeRoster(user);
  const canUseAccessWorkspace =
    canAccessCoreAccess(user) || canManageCoreAccessProfiles(user);
  const canUseOrgChart = canAccessCoreOrgChart(user);
  const canManageEmployee = canManageCoreEmployees(user);
  const canImportEmployees = canImportCoreEmployees(user);
  const shouldRedirectAccessReview =
    searchParams.get("review") === "access" && canUseAccessWorkspace;
  const shouldOpenCreateEmployee = searchParams.get("create") === "1";
  const [page, setPage] = useState(() =>
    parsePositiveInteger(searchParams.get("page"), 1)
  );
  const [pageSize, setPageSize] = useState<PageSize>(() =>
    parsePageSize(searchParams.get("pageSize"))
  );
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [status, setStatus] = useState<EmployeeRosterStatus | undefined>(() =>
    parseEmployeeStatus(searchParams.get("status"))
  );
  const [orgUnitCode, setOrgUnitCode] = useState<string | undefined>(
    () => searchParams.get("orgUnitCode") ?? undefined
  );
  const [managerId, setManagerId] = useState<string | undefined>(() =>
    parseFilterId(searchParams.get("managerId"))
  );
  const [access, setAccess] = useState<EmployeeAccessFilter | undefined>(
    parseEmployeeAccessFilter(searchParams.get("access"))
  );
  const [readiness, setReadiness] = useState<
    EmployeeReadinessFilter | undefined
  >(parseEmployeeReadinessFilter(searchParams.get("readiness")));
  const [sorting, setSorting] = useState<SortingState>(
    DEFAULT_EMPLOYEE_SORTING
  );
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(
    shouldOpenCreateEmployee
  );
  const [selectedManager, setSelectedManager] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const fieldVisibility = useEmployeeFieldVisibility(canAccess);
  const { sortBy, sortDir } = getRosterSortParams(sorting);

  const { data, error, isLoading, isFetching, refetch } = useEmployeeRoster({
    search: search || undefined,
    status,
    orgUnitCode,
    managerId,
    access,
    readiness,
    sortBy,
    sortDir,
    page,
    pageSize,
  });
  const workforceAccountSubjects = useMemo<WorkforceAccountSubject[]>(
    () =>
      (data?.items ?? []).map((employee) =>
        buildWorkforceAccountSubject(employee)
      ),
    [data?.items]
  );
  const {
    data: workforceAccounts,
    error: workforceAccountsError,
    isLoading: isLoadingWorkforceAccounts,
  } = useWorkforceAccountStatuses(workforceAccountSubjects);

  const totalMatchingCount = data?.totalCount ?? 0;
  const tableRows = useMemo<EmployeeRosterRow[]>(
    () => mergeEmployeeRows(data?.items ?? [], workforceAccounts ?? []),
    [data?.items, workforceAccounts]
  );
  const managerSeedOptions = useMemo<EmployeeRosterItem[]>(() => {
    const managersById = new Map<string, EmployeeRosterItem>();

    for (const row of tableRows) {
      if (row.directReportCount > 0) {
        managersById.set(row.id, row);
      }
    }

    return [...managersById.values()].sort((left, right) =>
      getEmployeeOptionLabel(left).localeCompare(getEmployeeOptionLabel(right))
    );
  }, [tableRows]);
  const orgUnitSeedOptions = useMemo(
    () => buildOrgUnitSeedOptions(tableRows),
    [tableRows]
  );
  const selectedManagerName = useMemo(() => {
    if (!managerId) {
      return null;
    }

    if (selectedManager?.id === managerId) {
      return selectedManager.name;
    }

    return (
      tableRows.find((row) => row.managerId === managerId)?.managerName ?? null
    );
  }, [managerId, selectedManager, tableRows]);
  const selectedOrgUnitName = useMemo(() => {
    if (!orgUnitCode) {
      return null;
    }

    if (selectedOrgUnit?.code === orgUnitCode) {
      return selectedOrgUnit.name;
    }

    return null;
  }, [orgUnitCode, selectedOrgUnit]);
  const hasActiveFilters =
    search.trim().length > 0 ||
    !!status ||
    !!orgUnitCode ||
    !!managerId ||
    !!access ||
    !!readiness;

  const currentTableLoading = isLoading && !data;
  const currentTableRefetching = isFetching && !!data;

  const columns = useMemo<ColumnDef<EmployeeRosterRow>[]>(() => {
    const baseColumns = buildEmployeeColumns<EmployeeRosterRow>(fieldVisibility);

    const accessColumn: ColumnDef<EmployeeRosterRow> = {
      id: "Account",
      header: "Access",
      meta: {
        headerClassName: "w-[8rem]",
        cellClassName: "w-[8rem]",
      },
      cell: ({ row }) => {
        if (workforceAccountsError) {
          return <Badge variant="outline">Unavailable</Badge>;
        }

        const accessState = getAccessDisplayState(
          row.original.workforceAccount
        );

        return (
          <Badge
            className="max-w-full truncate"
            variant={
              isLoadingWorkforceAccounts
                ? "outline"
                : getAccessBadgeTone(accessState)
            }
          >
            {isLoadingWorkforceAccounts ? "Loading" : accessState}
          </Badge>
        );
      },
      enableSorting: false,
    };

    const actionsColumn: ColumnDef<EmployeeRosterRow> = {
      id: "Actions",
      header: "Actions",
      meta: {
        headerClassName: "w-[5rem]",
        cellClassName: "w-[5rem]",
      },
      cell: ({ row }) => (
        <div className="flex justify-center">
          <EmployeeRowActions
            employee={row.original}
            canViewEmployee={canAccess}
            canManageEmployee={canManageEmployee}
            canUseAccessWorkspace={canUseAccessWorkspace}
            canUseOrgChart={canUseOrgChart}
          />
        </div>
      ),
      enableSorting: false,
    };

    return [...baseColumns, accessColumn, actionsColumn];
  }, [
    canAccess,
    canManageEmployee,
    canUseAccessWorkspace,
    canUseOrgChart,
    fieldVisibility,
    isLoadingWorkforceAccounts,
    workforceAccountsError,
  ]);

  const replaceEmployeesQueryParams = useCallback(
    (updates: Record<string, string | null>) => {
      const nextSearchParams = new URLSearchParams(window.location.search);

      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          nextSearchParams.delete(key);
          continue;
        }

        nextSearchParams.set(key, value);
      }

      const nextSearch = nextSearchParams.toString();
      const nextPath = window.location.pathname;
      const nextUrl = nextSearch ? `${nextPath}?${nextSearch}` : nextPath;

      window.history.replaceState(window.history.state, "", nextUrl);
    },
    []
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      replaceEmployeesQueryParams({
        search: value.trim() ? value.trim() : null,
        page: null,
      });
    },
    [replaceEmployeesQueryParams]
  );

  const handleStatusChange = useCallback(
    (value: EmployeeRosterStatus | undefined) => {
      setStatus(value);
      setPage(1);
      replaceEmployeesQueryParams({
        status: value ?? null,
        page: null,
      });
    },
    [replaceEmployeesQueryParams]
  );

  const handleOrgUnitChange = useCallback(
    (value: string | undefined, label?: string | null) => {
      setOrgUnitCode(value);
      setSelectedOrgUnit(value && label ? { code: value, name: label } : null);
      setPage(1);
      replaceEmployeesQueryParams({
        orgUnitCode: value ?? null,
        orgUnitId: null,
        page: null,
      });
    },
    [replaceEmployeesQueryParams]
  );

  const handleManagerChange = useCallback(
    (value: string | undefined, label?: string | null) => {
      setManagerId(value);
      setSelectedManager(value && label ? { id: value, name: label } : null);
      setPage(1);
      replaceEmployeesQueryParams({
        managerId: value ?? null,
        page: null,
      });
    },
    [replaceEmployeesQueryParams]
  );

  const handleAccessChange = useCallback(
    (value: EmployeeAccessFilter | undefined) => {
      setAccess(value);
      setPage(1);
      replaceEmployeesQueryParams({
        access: value ?? null,
        review: null,
        page: null,
      });
    },
    [replaceEmployeesQueryParams]
  );

  const handleReadinessChange = useCallback(
    (value: EmployeeReadinessFilter | undefined) => {
      setReadiness(value);
      setPage(1);
      replaceEmployeesQueryParams({ readiness: value ?? null, page: null });
    },
    [replaceEmployeesQueryParams]
  );

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setStatus(undefined);
    setOrgUnitCode(undefined);
    setManagerId(undefined);
    setAccess(undefined);
    setReadiness(undefined);
    setPage(1);
    setSelectedManager(null);
    setSelectedOrgUnit(null);
    replaceEmployeesQueryParams({
      search: null,
      status: null,
      orgUnitCode: null,
      orgUnitId: null,
      managerId: null,
      access: null,
      readiness: null,
      review: null,
      page: null,
    });
  }, [replaceEmployeesQueryParams]);

  const handleSortingChange = useCallback((nextSorting: SortingState) => {
    setSorting(
      nextSorting.length > 0 ? [nextSorting[0]!] : DEFAULT_EMPLOYEE_SORTING
    );
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback(
    (size: PageSize) => {
      setPageSize(size);
      setPage(1);
      replaceEmployeesQueryParams({
        page: null,
        pageSize: size === EMPLOYEES_DEFAULT_PAGE_SIZE ? null : String(size),
      });
    },
    [replaceEmployeesQueryParams]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      replaceEmployeesQueryParams({
        page: nextPage === 1 ? null : String(nextPage),
      });
    },
    [replaceEmployeesQueryParams]
  );

  const handleRowClick = useCallback(
    (employee: EmployeeRosterRow) => {
      router.push(`/employees/${employee.stableEmployeeKey}`);
    },
    [router]
  );

  const updateCreateEmployeeQueryParam = useCallback(
    (open: boolean) => {
      replaceEmployeesQueryParams({ create: open ? "1" : null });
    },
    [replaceEmployeesQueryParams]
  );

  const handleCreateEmployeeOpenChange = useCallback(
    (open: boolean) => {
      setIsCreateEmployeeOpen(open);
      updateCreateEmployeeQueryParam(open);
    },
    [updateCreateEmployeeQueryParam]
  );

  const handleCreateEmployeeCreated = useCallback(
    (employeeKey: string) => {
      router.push(`/employees/${employeeKey}`);
    },
    [router]
  );

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
    setStatus(parseEmployeeStatus(searchParams.get("status")));
    setOrgUnitCode(searchParams.get("orgUnitCode") ?? undefined);
    setManagerId(parseFilterId(searchParams.get("managerId")));
    setReadiness(parseEmployeeReadinessFilter(searchParams.get("readiness")));
    setAccess(parseEmployeeAccessFilter(searchParams.get("access")));
    setPage(parsePositiveInteger(searchParams.get("page"), 1));
    setPageSize(parsePageSize(searchParams.get("pageSize")));
  }, [searchParams]);

  useEffect(() => {
    if (!managerId) {
      setSelectedManager(null);
    }
  }, [managerId]);

  useEffect(() => {
    if (!orgUnitCode) {
      setSelectedOrgUnit(null);
    }
  }, [orgUnitCode]);

  useEffect(() => {
    setIsCreateEmployeeOpen(shouldOpenCreateEmployee);
  }, [shouldOpenCreateEmployee]);

  const isInitialPageLoading =
    canAccess && currentTableLoading && !error && !data;

  useEffect(() => {
    if (shouldRedirectAccessReview) {
      router.replace(accessReviewHref);
    }
  }, [accessReviewHref, router, shouldRedirectAccessReview]);

  if (isInitialPageLoading || shouldRedirectAccessReview) {
    return (
      <EmployeesPageSkeleton
        label={shouldRedirectAccessReview ? "Opening access review" : "Loading employees"}
      />
    );
  }

  if (!canAccess) {
    return (
      <PageContainer width="wide" className="space-y-5">
        <PageHeader title="Employees" description="Browse and manage workforce records." />
        <PagePermissionNotice
          title="You do not have access to the employee directory"
          description="Contact a tenant HR administrator if you need access."
        />
      </PageContainer>
    );
  }

  const emptyTitle = hasActiveFilters
    ? "No employees match these filters"
    : "No employees yet";
  const emptyContent = hasActiveFilters ? (
    <Button variant="outline" size="sm" onClick={handleClearFilters}>
      Clear filters
    </Button>
  ) : canManageEmployee || canImportEmployees ? (
    <div className="flex flex-wrap justify-center gap-2">
      {canManageEmployee ? (
        <Button size="sm" onClick={() => handleCreateEmployeeOpenChange(true)}>
          <Plus />
          Add employee
        </Button>
      ) : null}
      {canImportEmployees ? (
        <Button asChild variant="outline" size="sm">
          <Link href="/employees/import">
            <Upload />
            Import employees
          </Link>
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <PageContainer width="wide" className="space-y-5">
      <PageHeader
        title="Employees"
        description="Browse and manage workforce records."
        actions={
          canManageEmployee || canImportEmployees || canUseAccessWorkspace ? (
            <div className="flex flex-wrap gap-2">
              {canManageEmployee ? (
                <Button onClick={() => handleCreateEmployeeOpenChange(true)}>
                  <Plus />
                  Add employee
                </Button>
              ) : null}
              {canUseAccessWorkspace ? (
                <Button asChild variant="outline">
                  <Link href={accessWorkspaceHref}>
                    <Send />
                    Manage access
                  </Link>
                </Button>
              ) : null}
              {canImportEmployees ? (
                <Button asChild variant="outline">
                  <Link href="/employees/import">
                    <Upload />
                    Import employees
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {error ? (
        <PageError
          title="Employees could not be loaded"
          description="Could not load employee data. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : null}

      {workforceAccountsError ? (
        <Alert variant="destructive">
          <AlertTitle>Access states could not be loaded.</AlertTitle>
          <AlertDescription>
            {workforceAccountsError.message ||
              "Employee access badges are temporarily unavailable."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
        <Toolbar
          search={search}
          onSearchChange={handleSearchChange}
          status={status}
          onStatusChange={handleStatusChange}
          orgUnitCode={orgUnitCode}
          selectedOrgUnitName={selectedOrgUnitName}
          onOrgUnitChange={handleOrgUnitChange}
          orgUnitSeedOptions={orgUnitSeedOptions}
          managerId={managerId}
          selectedManagerName={selectedManagerName}
          onManagerChange={handleManagerChange}
          managerSeedOptions={managerSeedOptions}
          access={access}
          onAccessChange={handleAccessChange}
          readiness={readiness}
          onReadinessChange={handleReadinessChange}
          onClearFilters={handleClearFilters}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? `${totalMatchingCount} matching employee${totalMatchingCount === 1 ? "" : "s"}`
              : `${totalMatchingCount} employee${totalMatchingCount === 1 ? "" : "s"}`}
          </p>
          {currentTableRefetching ? (
            <Badge variant="secondary">Updating</Badge>
          ) : null}
        </div>
      </div>

      <EmployeesTable
        columns={columns}
        data={tableRows}
        isLoading={currentTableLoading}
        isRefetching={currentTableRefetching}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        onRowClick={handleRowClick}
        emptyTitle={emptyTitle}
        emptyContent={emptyContent}
      />

      {totalMatchingCount > 0 ? (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalCount={totalMatchingCount}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      ) : null}

      <EmployeeCreateDialog
        open={isCreateEmployeeOpen}
        onOpenChange={handleCreateEmployeeOpenChange}
        onCreated={handleCreateEmployeeCreated}
      />
    </PageContainer>
  );
}
