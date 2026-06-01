"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  Link as LinkIcon,
  Plus,
  Send,
  Upload,
  Users,
} from "lucide-react";
import {
  canAccessCoreAccess,
  canManageCoreAccessProfiles,
  canImportCoreEmployees,
  canManageCoreEmployees,
  useAuth,
} from "@repo/auth";
import { DEFAULT_PAGE_SIZE, EmptyState, type PageSize } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { useTenantContext } from "@/components/core-tenant-context-provider";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import {
  getAccessBadgeTone,
  getAccessDisplayState,
  getInvitationEligibility,
  parseEmployeeAccessFilter,
} from "./employee-access";
import { buildEmployeeColumns } from "./columns";
import { useEmployeeFieldVisibility } from "./employee-field-visibility";
import { parseEmployeeReadinessFilter } from "./employee-readiness";
import { EmployeesTable } from "./employees-table";
import { PaginationBar } from "./pagination-bar";
import { Toolbar } from "./toolbar";
import type {
  EmployeeAccessFilter,
  EmployeeReadinessFilter,
  EmployeeRosterItem,
  EmployeeRosterSortDirection,
  EmployeeRosterSortField,
  EmployeeRosterStatus,
  WorkforceAccountStatusDto,
  WorkforceAccountSubject,
} from "./employee-roster.types";
import { useEmployeeRoster } from "./use-employees";
import {
  useWorkforceAccountStatuses,
} from "./use-workforce-accounts";
import { EmployeeCreateDialog } from "./employee-create-dialog";

const DEFAULT_EMPLOYEE_SORTING: SortingState = [{ id: "Name", desc: false }];

type EmployeeRosterRow = EmployeeRosterItem & {
  workforceAccount: WorkforceAccountStatusDto | null;
};

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "An unexpected error occurred.";
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

export default function EmployeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const accessWorkspaceHref = buildTenantContextHref("/access", tenantId);
  const accessReviewHref = buildTenantContextHref(
    "/access?access=NotInvited",
    tenantId
  );
  const canAccess = canAccessEmployeeRoster(user) || isTenantContextReadOnly;
  const canUseAccessWorkspace =
    (canAccessCoreAccess(user) || canManageCoreAccessProfiles(user)) &&
    !isTenantContextReadOnly;
  const canCreateEmployee =
    canManageCoreEmployees(user) && !isTenantContextReadOnly;
  const canImportEmployees =
    canImportCoreEmployees(user) && !isTenantContextReadOnly;
  const shouldRedirectAccessReview =
    searchParams.get("review") === "access" && canUseAccessWorkspace;
  const shouldOpenCreateEmployee = searchParams.get("create") === "1";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EmployeeRosterStatus | undefined>();
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
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [localAccountOverrides, setLocalAccountOverrides] = useState<
    Record<string, WorkforceAccountStatusDto>
  >({});
  const fieldVisibility = useEmployeeFieldVisibility(canAccess);
  const { sortBy, sortDir } = getRosterSortParams(sorting);

  const { data, error, isLoading, isFetching, refetch } = useEmployeeRoster({
    search: search || undefined,
    status,
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

  const baseRows = useMemo(
    () =>
      mergeEmployeeRows(data?.items ?? [], workforceAccounts ?? []).map(
        (row) => ({
          ...row,
          workforceAccount:
            localAccountOverrides[row.id] ?? row.workforceAccount,
        })
      ),
    [data?.items, localAccountOverrides, workforceAccounts]
  );

  const handleCopyInviteLink = useCallback(
    async (key: string, inviteLink: string | null) => {
      if (!inviteLink) {
        return;
      }

      try {
        await navigator.clipboard.writeText(inviteLink);
        setCopiedLinkKey(key);
      } catch {
        setCopiedLinkKey(null);
      }
    },
    []
  );

  const totalMatchingCount = data?.totalCount ?? 0;
  const tableRows = useMemo<EmployeeRosterRow[]>(() => baseRows, [baseRows]);

  const currentTableLoading = isLoading && !data;
  const currentTableRefetching = isFetching && !!data;

  const columns = useMemo<ColumnDef<EmployeeRosterRow>[]>(() => {
    const baseColumns =
      buildEmployeeColumns<EmployeeRosterRow>(fieldVisibility);
    const [nameColumn, emailColumn, ...remainingColumns] = baseColumns;
    const primaryColumns = remainingColumns.filter(
      (column) =>
        column.id === "Manager" ||
        column.id === "Status" ||
        column.id === "OrgUnit"
    );

    const accountColumn: ColumnDef<EmployeeRosterRow> = {
      id: "Account",
      header: "Access",
      meta: {
        headerClassName: "w-[10rem] min-[1700px]:w-[11rem]",
        cellClassName: "w-[10rem] min-[1700px]:w-[11rem]",
      },
      cell: ({ row }) => {
        const account = row.original.workforceAccount;
        const accessState = getAccessDisplayState(account);
        const eligibility = getInvitationEligibility(account);

        const handleCopyAndToast = async (
          key: string,
          inviteLink: string | null
        ) => {
          await handleCopyInviteLink(key, inviteLink);
          if (inviteLink) {
            toast({ title: "Invite link copied" });
          }
        };

        return (
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <Badge
                variant={getAccessBadgeTone(accessState)}
                className="max-w-[7.4rem] truncate px-2 min-[1700px]:max-w-[9.4rem]"
              >
                {isLoadingWorkforceAccounts ? "Loading access..." : accessState}
              </Badge>

              {eligibility.canCopyInviteLink ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCopyAndToast(
                            `table:${row.original.id}`,
                            eligibility.inviteLink
                          );
                        }}
                        aria-label="Copy invite link"
                        className="px-1.5 cursor-pointer"
                      >
                        <LinkIcon className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>
                      Copy invite link
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          </div>
        );
      },
      enableSorting: false,
    };

    return [nameColumn!, emailColumn!, accountColumn, ...primaryColumns];
  }, [
    fieldVisibility,
    handleCopyInviteLink,
    isLoadingWorkforceAccounts,
    toast,
  ]);

  const replaceEmployeesQueryParams = useCallback(
    (updates: Record<string, string | null>) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());

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
    [searchParams]
  );

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

  const handleAccessChange = useCallback(
    (value: EmployeeAccessFilter | undefined) => {
      setAccess(value);
      setPage(1);
      replaceEmployeesQueryParams({
        access: value ?? null,
        review: null,
      });
    },
    [replaceEmployeesQueryParams]
  );

  const handleReadinessChange = useCallback(
    (value: EmployeeReadinessFilter | undefined) => {
      setReadiness(value);
      setPage(1);
      replaceEmployeesQueryParams({ readiness: value ?? null });
    },
    [replaceEmployeesQueryParams]
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

  const handleRowClick = useCallback(
    (employee: EmployeeRosterRow) => {
      router.push(
        buildTenantContextHref(`/employees/${employee.id}`, tenantId)
      );
    },
    [router, tenantId]
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
    (employeeId: string) => {
      router.push(buildTenantContextHref(`/employees/${employeeId}`, tenantId));
    },
    [router, tenantId]
  );

  useEffect(() => {
    if (!copiedLinkKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopiedLinkKey(null);
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [copiedLinkKey]);

  useEffect(() => {
    if (!fieldVisibility.showHireDate) {
      setSorting((current) =>
        current[0]?.id === "HireDate" ? DEFAULT_EMPLOYEE_SORTING : current
      );
    }
  }, [fieldVisibility.showHireDate]);

  useEffect(() => {
    setReadiness(parseEmployeeReadinessFilter(searchParams.get("readiness")));
    setAccess(parseEmployeeAccessFilter(searchParams.get("access")));
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    setIsCreateEmployeeOpen(shouldOpenCreateEmployee);
  }, [shouldOpenCreateEmployee]);

  const isInitialPageLoading =
    canAccess && currentTableLoading && !error && !data;

  useEffect(() => {
    if (shouldRedirectAccessReview) {
      router.replace(accessReviewHref);
      return;
    }

    if (!canAccess && canUseAccessWorkspace) {
      router.replace(accessWorkspaceHref);
    }
  }, [
    accessReviewHref,
    accessWorkspaceHref,
    canAccess,
    canUseAccessWorkspace,
    router,
    shouldRedirectAccessReview,
  ]);

  if (isInitialPageLoading) {
    return (
      <CorePageLoadingState
        title="Employees"
        description="Manage the roster."
        message="Loading employees..."
        variant="list"
      />
    );
  }

  if (shouldRedirectAccessReview) {
    return (
      <CorePageLoadingState
        title="Employees"
        description="Opening Access."
        message="Opening access review"
        variant="redirect"
      />
    );
  }

  if (!canAccess && canUseAccessWorkspace) {
    return (
      <CorePageLoadingState
        title="Employees"
        description="Opening Access."
        message="Opening Access workspace"
        variant="redirect"
      />
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="Employees" description="Manage the roster." />
        <EmptyState
          icon={Users}
          title="Employee roster is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Employees"
        description="Manage roster data. Access operations live in Access."
        actions={
          canCreateEmployee || canImportEmployees || canUseAccessWorkspace ? (
            <div className="flex flex-wrap gap-2">
              {canUseAccessWorkspace ? (
                <Button asChild variant="outline">
                  <Link href={accessWorkspaceHref}>
                    <Send />
                    Open Access
                  </Link>
                </Button>
              ) : null}
              {canCreateEmployee ? (
                <Button onClick={() => handleCreateEmployeeOpenChange(true)}>
                  <Plus />
                  Add employee
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
        <Alert variant="destructive">
          <AlertTitle>Failed to load employees</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error.message || "An unexpected error occurred."}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {workforceAccountsError ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load account states</AlertTitle>
          <AlertDescription>
            {workforceAccountsError.message ||
              "Roster account visibility is currently unavailable."}
          </AlertDescription>
        </Alert>
      ) : null}

      <EmployeesTable
        columns={columns}
        data={tableRows}
        isLoading={currentTableLoading}
        isRefetching={currentTableRefetching}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        onRowClick={handleRowClick}
        emptyTitle={
          access === "NotInvited"
            ? "No employees need access"
            : "No employees found"
        }
        emptyDescription={
          access
            ? "Try another access filter."
            : "Try another search or filter."
        }
      />

      {totalMatchingCount > 0 ? (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalCount={totalMatchingCount}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      ) : null}

      <EmployeeCreateDialog
        open={isCreateEmployeeOpen}
        onOpenChange={handleCreateEmployeeOpenChange}
        onCreated={handleCreateEmployeeCreated}
      />
    </div>
  );
}
