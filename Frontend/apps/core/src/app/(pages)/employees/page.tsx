"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ColumnDef,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
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
import { useApiQueryClient } from "@repo/api/query";
import {
  canAccessCoreAccess,
  canManageCoreAccess,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  getBulkSelectionSummary,
  getInvitationEligibility,
  getReviewDrawerRows,
  getSuggestedInviteRole,
  parseEmployeeAccessFilter,
  type BulkSelectionSummary,
} from "./employee-access";
import { buildEmployeeColumns } from "./columns";
import { useEmployeeFieldVisibility } from "./employee-field-visibility";
import { parseEmployeeReadinessFilter } from "./employee-readiness";
import { EmployeesTable } from "./employees-table";
import { PaginationBar } from "./pagination-bar";
import { Toolbar } from "./toolbar";
import { employeeRosterQueryKeys } from "./employee-query-keys";
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
import { useEmployeeRoster, useResolveEmployeeRoster } from "./use-employees";
import {
  useBulkProvisionWorkforceAccountInvites,
  useResolveWorkforceAccountStatuses,
  useWorkforceAccountStatuses,
} from "./use-workforce-accounts";
import { EmployeeCreateDialog } from "./employee-create-dialog";
import { useAccessProfiles } from "../settings/use-core-access";

const EMPTY_ACCESS_PROFILES: Array<{ id: string; name: string }> = [];

const DEFAULT_EMPLOYEE_SORTING: SortingState = [{ id: "Name", desc: false }];

type EmployeeRosterRow = EmployeeRosterItem & {
  workforceAccount: WorkforceAccountStatusDto | null;
};

type SelectionScope = "page" | "allMatching";

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

function getSuggestedAccessProfileId(
  accessProfiles: Array<{ id: string; name: string }>,
  directReportCount: number,
  currentProfileId?: string | null
): string | null {
  if (
    currentProfileId &&
    accessProfiles.some((profile) => profile.id === currentProfileId)
  ) {
    return currentProfileId;
  }

  const suggestedName = getSuggestedInviteRole(directReportCount);
  return (
    accessProfiles.find((profile) => profile.name === suggestedName)?.id ??
    accessProfiles.find((profile) => profile.name === "Employee")?.id ??
    accessProfiles[0]?.id ??
    null
  );
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

function buildSelectedInviteLinksClipboardText(
  employees: EmployeeRosterRow[]
): string {
  return employees
    .filter((employee) => !!employee.workforceAccount?.inviteLink)
    .map((employee) => {
      const fullName = `${employee.firstName} ${employee.lastName}`.trim();
      return `${fullName} <${employee.email}>: ${employee.workforceAccount?.inviteLink}`;
    })
    .join("\n");
}

function SelectedAccessActionBar({
  canOfferSelectAllMatching,
  canManageAccess,
  isSelectingAllMatching,
  onClearSelection,
  onCopyInviteLinks,
  onReviewInvitations,
  onSelectAllMatching,
  selectedCount,
  totalMatchingCount,
  summary,
}: {
  canOfferSelectAllMatching: boolean;
  canManageAccess: boolean;
  isSelectingAllMatching: boolean;
  onClearSelection: () => void;
  onCopyInviteLinks: () => void;
  onReviewInvitations: () => void;
  onSelectAllMatching: () => void;
  selectedCount: number;
  totalMatchingCount: number;
  summary: BulkSelectionSummary;
}) {
  const hasProvisionable = summary.provisionableCount > 0;
  const hasPendingOnly =
    !hasProvisionable &&
    summary.pendingInvitationCount > 0 &&
    summary.notIncludedCount === 0;

  return (
    <div className="rounded-xl border bg-muted/10 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{selectedCount} selected</Badge>
          {hasProvisionable ? (
            <Badge>{summary.provisionableCount} to invite</Badge>
          ) : null}
          {summary.pendingInvitationCount > 0 ? (
            <Badge variant="secondary">
              {summary.pendingInvitationCount} pending
            </Badge>
          ) : null}
          {canOfferSelectAllMatching ? (
            <Button
              className="cursor-pointer h-auto px-0 text-xs text-muted-foreground"
              size="sm"
              variant="link"
              onClick={onSelectAllMatching}
              disabled={isSelectingAllMatching}
            >
              {isSelectingAllMatching
                ? "Selecting all..."
                : `Select all ${totalMatchingCount}`}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onClearSelection}>
            Clear selection
          </Button>
          {canManageAccess && hasProvisionable ? (
            <Button size="sm" onClick={onReviewInvitations}>
              <Send />
              {summary.provisionableCount === 1
                ? "Invite 1 employee"
                : `Invite ${summary.provisionableCount} employees`}
            </Button>
          ) : canManageAccess &&
            hasPendingOnly &&
            summary.hasPendingWithLink ? (
            <Button size="sm" onClick={onCopyInviteLinks}>
              <Copy />
              {summary.pendingInvitationCount === 1
                ? "Copy 1 link"
                : `Copy ${summary.pendingInvitationCount} links`}
            </Button>
          ) : !canManageAccess ? (
            <Badge variant="outline">Access restricted</Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useApiQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const canAccess = canAccessEmployeeRoster(user) || isTenantContextReadOnly;
  const canUseAccessWorkspace =
    (canAccessCoreAccess(user) || canManageCoreAccessProfiles(user)) &&
    !isTenantContextReadOnly;
  const canManageAccess = canManageCoreAccess(user) && !isTenantContextReadOnly;
  const canCreateEmployee =
    canManageCoreEmployees(user) && !isTenantContextReadOnly;
  const canImportEmployees =
    canImportCoreEmployees(user) && !isTenantContextReadOnly;
  const shouldAutoReviewAccess = searchParams.get("review") === "access";
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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectionScope, setSelectionScope] = useState<SelectionScope>("page");
  const [allMatchingSelectionRows, setAllMatchingSelectionRows] = useState<
    EmployeeRosterRow[] | null
  >(null);
  const [isAccessWorkflowOpen, setIsAccessWorkflowOpen] = useState(false);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(
    shouldOpenCreateEmployee
  );
  const [isNotIncludedExpanded, setIsNotIncludedExpanded] = useState(false);
  const [
    selectedAccessProfilesByEmployeeId,
    setSelectedAccessProfilesByEmployeeId,
  ] = useState<Record<string, string>>({});
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);
  const [hasAppliedReviewHandoff, setHasAppliedReviewHandoff] = useState(false);
  const [isSelectingAllMatching, setIsSelectingAllMatching] = useState(false);
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
  const resolveEmployeeRoster = useResolveEmployeeRoster();
  const resolveWorkforceAccountStatuses = useResolveWorkforceAccountStatuses();
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
  const bulkProvision = useBulkProvisionWorkforceAccountInvites();
  const { data: accessProfilesData } = useAccessProfiles(canManageAccess);
  const accessProfiles = accessProfilesData ?? EMPTY_ACCESS_PROFILES;

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

  const resolveMatchingRows = useCallback(async (): Promise<
    EmployeeRosterRow[]
  > => {
    const employees = await resolveEmployeeRoster({
      search: search || undefined,
      status,
      access,
      readiness,
      sortBy,
      sortDir,
    });
    const accounts = await resolveWorkforceAccountStatuses(
      employees.map((employee) => buildWorkforceAccountSubject(employee))
    );

    return mergeEmployeeRows(employees, accounts).map((row) => ({
      ...row,
      workforceAccount: localAccountOverrides[row.id] ?? row.workforceAccount,
    }));
  }, [
    localAccountOverrides,
    access,
    readiness,
    resolveEmployeeRoster,
    resolveWorkforceAccountStatuses,
    search,
    sortBy,
    sortDir,
    status,
  ]);

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
  const selectedPageEmployees = useMemo(
    () => tableRows.filter((employee) => rowSelection[employee.id]),
    [rowSelection, tableRows]
  );
  const selectedEmployees = useMemo(
    () =>
      selectionScope === "allMatching"
        ? (allMatchingSelectionRows ?? [])
        : selectedPageEmployees,
    [allMatchingSelectionRows, selectedPageEmployees, selectionScope]
  );
  const reviewRows = useMemo(
    () => getReviewDrawerRows(selectedEmployees),
    [selectedEmployees]
  );
  const selectionSummary = useMemo(
    () => getBulkSelectionSummary(selectedEmployees),
    [selectedEmployees]
  );
  const allVisibleRowsSelected =
    tableRows.length > 0 && tableRows.every((row) => rowSelection[row.id]);
  const canOfferSelectAllMatching =
    selectionScope !== "allMatching" &&
    allVisibleRowsSelected &&
    totalMatchingCount > tableRows.length;

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

    const selectionColumn: ColumnDef<EmployeeRosterRow> = {
      id: "select",
      meta: {
        headerClassName: "w-11 px-2",
        cellClassName: "w-11 px-2 text-center",
      },
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all employees on this page"
          checked={
            table.getIsAllRowsSelected()
              ? true
              : table.getIsSomeRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(checked) =>
            table.toggleAllRowsSelected(checked === true)
          }
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.firstName} ${row.original.lastName}`}
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          onClick={(event) => event.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };

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

    return [
      selectionColumn,
      nameColumn!,
      emailColumn!,
      accountColumn,
      ...primaryColumns,
    ];
  }, [
    fieldVisibility,
    handleCopyInviteLink,
    isLoadingWorkforceAccounts,
    toast,
  ]);

  const handleCopySelectedInviteLinks = useCallback(async () => {
    const content = buildSelectedInviteLinksClipboardText(selectedEmployees);
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopiedLinkKey("selected");
    } catch {
      setCopiedLinkKey(null);
    }
  }, [selectedEmployees]);

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

  const handleRowSelectionChange = useCallback(
    (nextSelection: RowSelectionState) => {
      setSelectionScope("page");
      setAllMatchingSelectionRows(null);
      setSelectionError(null);
      setBulkActionError(null);
      setRowSelection(nextSelection);
    },
    []
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

  const handleSelectAllMatching = useCallback(async () => {
    setSelectionError(null);
    setBulkActionError(null);
    setIsSelectingAllMatching(true);

    try {
      const matchingRows = await resolveMatchingRows();

      setAllMatchingSelectionRows(matchingRows);
      setSelectionScope("allMatching");
      setRowSelection(
        Object.fromEntries(matchingRows.map((employee) => [employee.id, true]))
      );
      return matchingRows.length > 0;
    } catch (nextError) {
      setSelectionError(getErrorMessage(nextError));
      return false;
    } finally {
      setIsSelectingAllMatching(false);
    }
  }, [resolveMatchingRows]);

  const handleBulkProvision = useCallback(async () => {
    const provisionableEmployees = reviewRows.provisionableRows.map(
      (row) => row.employee
    );

    if (provisionableEmployees.length === 0) {
      return;
    }

    setBulkActionError(null);
    setSelectionError(null);

    try {
      const results = await bulkProvision.mutateAsync({
        items: provisionableEmployees.map((employee) => ({
          accessProfileId:
            selectedAccessProfilesByEmployeeId[employee.id] ??
            getSuggestedAccessProfileId(
              accessProfiles,
              employee.directReportCount
            ) ??
            "",
          employeeId: employee.id,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
        })),
      });

      const nextOverrides = Object.fromEntries(
        results.map((result) => [result.employeeId, result.account])
      ) as Record<string, WorkforceAccountStatusDto>;

      setLocalAccountOverrides((current) => ({
        ...current,
        ...nextOverrides,
      }));

      await queryClient.invalidateQueries({
        queryKey: employeeRosterQueryKeys.workforceAccounts(),
      });
      await queryClient.invalidateQueries({
        queryKey: employeeRosterQueryKeys.lists(),
      });

      const createdCount = results.filter(
        (r) => r.outcome === "Created"
      ).length;
      toast({
        title: `${createdCount} invitation${createdCount === 1 ? "" : "s"} created`,
      });
      if (
        access === "NotInvited" &&
        results.some((result) => result.outcome === "Created")
      ) {
        setAccess("Invited");
        replaceEmployeesQueryParams({
          access: "Invited",
          review: null,
        });
      } else {
        replaceEmployeesQueryParams({ review: null });
      }
      setIsAccessWorkflowOpen(false);
      setSelectionScope("page");
      setAllMatchingSelectionRows(null);
      setRowSelection({});
      setSelectedAccessProfilesByEmployeeId({});
    } catch (nextError) {
      setBulkActionError(getErrorMessage(nextError));
    }
  }, [
    accessProfiles,
    access,
    bulkProvision,
    queryClient,
    replaceEmployeesQueryParams,
    reviewRows.provisionableRows,
    selectedAccessProfilesByEmployeeId,
    toast,
  ]);

  const handleSelectedAccessProfileChange = useCallback(
    (employeeId: string, accessProfileId: string) => {
      setSelectedAccessProfilesByEmployeeId((current) => ({
        ...current,
        [employeeId]: accessProfileId,
      }));
    },
    []
  );

  const handleClearSelection = useCallback(() => {
    setSelectionScope("page");
    setAllMatchingSelectionRows(null);
    setRowSelection({});
    setSelectedAccessProfilesByEmployeeId({});
    setSelectionError(null);
    setBulkActionError(null);
  }, []);

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

  useEffect(() => {
    if (!shouldAutoReviewAccess) {
      setHasAppliedReviewHandoff(false);
      return;
    }

    if (
      hasAppliedReviewHandoff ||
      access !== "NotInvited" ||
      isLoading ||
      !data
    ) {
      return;
    }

    setHasAppliedReviewHandoff(true);

    if (data.totalCount === 0) {
      return;
    }

    let isCancelled = false;

    const applyReviewSelection = async () => {
      const hasMatchingRows = await handleSelectAllMatching();
      if (!isCancelled && hasMatchingRows) {
        setIsAccessWorkflowOpen(true);
      }
    };

    void applyReviewSelection();

    return () => {
      isCancelled = true;
    };
  }, [
    access,
    data,
    handleSelectAllMatching,
    hasAppliedReviewHandoff,
    isLoading,
    shouldAutoReviewAccess,
  ]);

  useEffect(() => {
    if (selectionScope === "allMatching") {
      return;
    }

    const availableIds = new Set(tableRows.map((row) => row.id));
    setRowSelection((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([employeeId, isSelected]) =>
            isSelected && availableIds.has(employeeId)
        )
      )
    );
  }, [selectionScope, tableRows]);

  useEffect(() => {
    setSelectionScope("page");
    setAllMatchingSelectionRows(null);
    setRowSelection({});
    setSelectedAccessProfilesByEmployeeId({});
    setIsAccessWorkflowOpen(false);
    setSelectionError(null);
    setBulkActionError(null);
  }, [access, readiness, search, sortBy, sortDir, status]);

  useEffect(() => {
    setSelectedAccessProfilesByEmployeeId((current) => {
      const next: Record<string, string> = {};

      for (const employee of selectedEmployees) {
        next[employee.id] =
          current[employee.id] ??
          getSuggestedAccessProfileId(
            accessProfiles,
            employee.directReportCount
          ) ??
          "";
      }

      return next;
    });

    if (selectedEmployees.length === 0) {
      setIsAccessWorkflowOpen(false);
      setIsNotIncludedExpanded(false);
    }
  }, [accessProfiles, selectedEmployees]);

  const isInitialPageLoading =
    canAccess && currentTableLoading && !error && !data;

  useEffect(() => {
    if (!canAccess && canUseAccessWorkspace) {
      router.replace("/access");
    }
  }, [canAccess, canUseAccessWorkspace, router]);

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
                  <Link href="/access">
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

      <Toolbar
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        access={access}
        onAccessChange={handleAccessChange}
        readiness={readiness}
        onReadinessChange={handleReadinessChange}
      />

      {selectionError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not extend the selection</AlertTitle>
          <AlertDescription>{selectionError}</AlertDescription>
        </Alert>
      ) : null}

      {bulkActionError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not send access invitations</AlertTitle>
          <AlertDescription>{bulkActionError}</AlertDescription>
        </Alert>
      ) : null}

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

      {selectedEmployees.length > 0 && !isTenantContextReadOnly ? (
        <SelectedAccessActionBar
          canOfferSelectAllMatching={canOfferSelectAllMatching}
          canManageAccess={canManageAccess}
          isSelectingAllMatching={isSelectingAllMatching}
          onClearSelection={handleClearSelection}
          onCopyInviteLinks={() => void handleCopySelectedInviteLinks()}
          onReviewInvitations={() => {
            if (selectionSummary.provisionableCount === 0) {
              return;
            }
            setIsAccessWorkflowOpen(true);
          }}
          onSelectAllMatching={() => void handleSelectAllMatching()}
          selectedCount={selectedEmployees.length}
          totalMatchingCount={totalMatchingCount}
          summary={selectionSummary}
        />
      ) : null}

      <EmployeesTable
        columns={columns}
        data={tableRows}
        isLoading={currentTableLoading}
        isRefetching={currentTableRefetching}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        onRowClick={handleRowClick}
        rowSelection={rowSelection}
        onRowSelectionChange={handleRowSelectionChange}
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

      <Dialog
        open={isAccessWorkflowOpen}
        onOpenChange={(open) => {
          setIsAccessWorkflowOpen(open);
          if (!open) {
            setIsNotIncludedExpanded(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>Assign access profiles</DialogTitle>
            <DialogDescription>
              Choose a profile before sending invitations.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
            {accessProfiles.length === 0 ? (
              <Alert>
                <AlertTitle>No access profiles available</AlertTitle>
                <AlertDescription>
                  Create an access profile in Settings first.
                </AlertDescription>
              </Alert>
            ) : null}

            {reviewRows.provisionableRows.length > 0 ? (
              <div className="rounded-lg border">
                {reviewRows.provisionableRows.map(({ employee }) => {
                  const suggestedProfileId = getSuggestedAccessProfileId(
                    accessProfiles,
                    employee.directReportCount
                  );
                  const plannedProfileId =
                    selectedAccessProfilesByEmployeeId[employee.id] ??
                    suggestedProfileId ??
                    "";

                  return (
                    <div
                      key={employee.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {employee.email}
                        </p>
                      </div>
                      <Select
                        value={plannedProfileId}
                        onValueChange={(value) =>
                          handleSelectedAccessProfileChange(employee.id, value)
                        }
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Choose access profile" />
                        </SelectTrigger>
                        <SelectContent>
                          {accessProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                No selected employees are ready to invite.
              </p>
            )}

            {reviewRows.notIncludedRows.length > 0 ? (
              <div className="rounded-lg border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-sm text-muted-foreground"
                  onClick={() =>
                    setIsNotIncludedExpanded((current) => !current)
                  }
                >
                  {reviewRows.notIncludedRows.length} excluded
                </button>
                {isNotIncludedExpanded ? (
                  <div className="border-t px-4 py-2">
                    {reviewRows.notIncludedRows.map(({ employee, reason }) => (
                      <div
                        key={`not-included:${employee.id}`}
                        className="flex items-center justify-between gap-3 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {employee.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {reason}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-popover px-6 py-4">
            <div className="space-y-1">
              {reviewRows.notIncludedRows.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {reviewRows.notIncludedRows.length} excluded from this run.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {selectionSummary.provisionableCount} ready to invite
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAccessWorkflowOpen(false)}
                disabled={bulkProvision.isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleBulkProvision()}
                disabled={
                  accessProfiles.length === 0 ||
                  reviewRows.provisionableRows.length === 0 ||
                  bulkProvision.isLoading ||
                  isSelectingAllMatching
                }
              >
                <Send />
                {bulkProvision.isLoading ? (
                  <Spinner className="size-3.5" />
                ) : null}
                Send invitations
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EmployeeCreateDialog
        open={isCreateEmployeeOpen}
        onOpenChange={handleCreateEmployeeOpenChange}
        onCreated={handleCreateEmployeeCreated}
      />
    </div>
  );
}
