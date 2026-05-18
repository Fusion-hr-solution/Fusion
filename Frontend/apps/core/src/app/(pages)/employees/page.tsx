"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ColumnDef,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Link as LinkIcon, Send, Upload, Users } from "lucide-react";
import { useApiQueryClient } from "@repo/api/query";
import { useAuth } from "@repo/auth";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import {
  type AccessInviteRole,
  getAccessBadgeTone,
  getAccessDisplayState,
  getBulkSelectionSummary,
  getInvitationEligibility,
  getReviewDrawerRows,
  getSuggestedInviteRole,
  parseEmployeeAccessFilter,
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
  WorkforceAccountBulkProvisionResultDto,
  WorkforceAccountStatusDto,
  WorkforceAccountSubject,
  WorkforceInvitationDeliveryState,
} from "./employee-roster.types";
import { useEmployeeRoster, useResolveEmployeeRoster } from "./use-employees";
import {
  useBulkProvisionWorkforceAccountInvites,
  useResolveWorkforceAccountStatuses,
  useWorkforceAccountStatuses,
} from "./use-workforce-accounts";

const DEFAULT_EMPLOYEE_SORTING: SortingState = [{ id: "Name", desc: false }];

type EmployeeRosterRow = EmployeeRosterItem & {
  workforceAccount: WorkforceAccountStatusDto | null;
};

type SelectionScope = "page" | "allMatching";

type ResultFilter = "All" | "Created" | "Skipped" | "Conflicts" | "EmailFailed";

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

function getOutcomeBadgeVariant(
  outcome: WorkforceAccountBulkProvisionResultDto["outcome"]
): "default" | "secondary" | "outline" | "destructive" {
  switch (outcome) {
    case "Created":
      return "default";
    case "Active":
    case "Inactive":
      return "secondary";
    case "Conflict":
      return "destructive";
    default:
      return "outline";
  }
}

function getOutcomeBadgeLabel(
  outcome: WorkforceAccountBulkProvisionResultDto["outcome"]
): string {
  switch (outcome) {
    case "Created":
      return "Invitation created";
    case "Pending":
      return "Invited";
    case "Active":
      return "Account active";
    case "Inactive":
    case "Conflict":
      return "Needs review";
    default:
      return outcome;
  }
}

function getBulkResultDisplayName(
  result: WorkforceAccountBulkProvisionResultDto
): string {
  return (
    result.account.fullName?.trim() || result.account.email || result.employeeId
  );
}

function summarizeBulkProvisionResults(
  results: WorkforceAccountBulkProvisionResultDto[]
) {
  const createdResults = results.filter(
    (result) => result.outcome === "Created"
  );
  const createdCount = createdResults.length;
  const skippedCount = results.length - createdCount;
  const conflictCount = results.filter(
    (result) => result.outcome === "Conflict"
  ).length;
  const linkableCount = results.filter(
    (result) => !!result.account.inviteLink
  ).length;
  const sentCount = createdResults.filter(
    (result) => result.account.deliveryStatus === "Sent"
  ).length;
  const suppressedCount = createdResults.filter(
    (result) =>
      result.account.deliveryStatus === "Suppressed" ||
      result.account.deliveryStatus === "Skipped"
  ).length;
  const failedCount = createdResults.filter(
    (result) => result.account.deliveryStatus === "Failed"
  ).length;
  const fallbackCount = results.filter(
    (result) => !!result.account.inviteLink
  ).length;

  let title = "No new invitations were created.";

  if (createdCount > 0) {
    const invitationLabel = `${createdCount} invitation${
      createdCount === 1 ? "" : "s"
    } created.`;

    if (suppressedCount === createdCount) {
      title = `${invitationLabel} Email delivery is disabled in this environment.`;
    } else if (failedCount === createdCount) {
      title = `${invitationLabel} Email failed; invite links are still available.`;
    } else if (failedCount > 0) {
      title = `${invitationLabel} Some emails failed; invite links are still available.`;
    } else if (suppressedCount > 0) {
      title = `${invitationLabel} Email delivery is disabled for some invitations in this environment.`;
    } else if (sentCount > 0) {
      title = `${invitationLabel} Invitation emails sent to the mail server.`;
    } else {
      title = invitationLabel;
    }
  }

  return {
    title,
    createdCount,
    skippedCount,
    conflictCount,
    linkableCount,
    failedCount,
    fallbackCount,
    sentCount,
    suppressedCount,
  };
}

function buildInviteLinksClipboardText(
  results: WorkforceAccountBulkProvisionResultDto[]
): string {
  return results
    .filter((result) => !!result.account.inviteLink)
    .map(
      (result) =>
        `${getBulkResultDisplayName(result)} <${result.account.email}>: ${result.account.inviteLink}`
    )
    .join("\n");
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

function getDeliveryBadgeLabel(
  status: WorkforceInvitationDeliveryState | null
): string {
  switch (status) {
    case "Suppressed":
    case "Skipped":
      return "Fallback link available";
    case "Failed":
      return "Email failed";
    case "NotAttempted":
      return "Fallback link available";
    case "Sent":
      return "Email sent";
    default:
      return "No email status";
  }
}

function getDeliveryBadgeVariant(
  status: WorkforceInvitationDeliveryState | null
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "Failed":
      return "destructive";
    case "Sent":
      return "secondary";
    default:
      return "outline";
  }
}

function resultMatchesFilter(
  result: WorkforceAccountBulkProvisionResultDto,
  filter: ResultFilter
): boolean {
  if (filter === "All") {
    return true;
  }

  if (filter === "Created") {
    return result.outcome === "Created";
  }

  if (filter === "Skipped") {
    return result.outcome !== "Created";
  }

  if (filter === "Conflicts") {
    return result.outcome === "Conflict";
  }

  return result.account.deliveryStatus === "Failed";
}

function BulkResultsSummaryBanner({
  results,
  copiedLinkKey,
  onCopyAllLinks,
  onDismiss,
  onOpenDetails,
}: {
  results: WorkforceAccountBulkProvisionResultDto[];
  copiedLinkKey: string | null;
  onCopyAllLinks: () => void;
  onDismiss: () => void;
  onOpenDetails: () => void;
}) {
  const summary = summarizeBulkProvisionResults(results);

  return (
    <Alert className="py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <AlertTitle className="text-sm">{summary.title}</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{summary.createdCount} created</Badge>
            {summary.skippedCount > 0 ? (
              <Badge variant="outline">{summary.skippedCount} skipped</Badge>
            ) : null}
            {summary.conflictCount > 0 ? (
              <Badge variant="destructive">
                {summary.conflictCount} conflict
                {summary.conflictCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {summary.suppressedCount > 0 ? (
              <Badge variant="outline">Email disabled</Badge>
            ) : null}
            {summary.failedCount > 0 ? (
              <Badge variant="destructive">Email failed</Badge>
            ) : null}
            {summary.fallbackCount > 0 ? (
              <Badge variant="outline">
                {summary.fallbackCount} fallback link
                {summary.fallbackCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </AlertDescription>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onOpenDetails}>
            View details
          </Button>
          {summary.linkableCount > 0 ? (
            <Button size="sm" variant="outline" onClick={onCopyAllLinks}>
              <Copy />
              {copiedLinkKey === "all-results"
                ? "Links copied"
                : "Copy all links"}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </Alert>
  );
}

function BulkResultsDialog({
  copiedLinkKey,
  onCopyInviteLink,
  onOpenChange,
  open,
  results,
}: {
  copiedLinkKey: string | null;
  onCopyInviteLink: (key: string, inviteLink: string | null) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  results: WorkforceAccountBulkProvisionResultDto[];
}) {
  const [filter, setFilter] = useState<ResultFilter>("All");
  const summary = summarizeBulkProvisionResults(results);
  const filteredResults = useMemo(
    () => results.filter((result) => resultMatchesFilter(result, filter)),
    [filter, results]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[80vh] max-h-[80vh] gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Invitation results</DialogTitle>
          <DialogDescription>
            Review outcomes, delivery status, and available invite links.
          </DialogDescription>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{summary.createdCount} created</Badge>
            {summary.skippedCount > 0 ? (
              <Badge variant="outline">{summary.skippedCount} skipped</Badge>
            ) : null}
            {summary.suppressedCount > 0 ? (
              <Badge variant="outline">
                {summary.suppressedCount} email disabled
              </Badge>
            ) : null}
            {summary.failedCount > 0 ? (
              <Badge variant="destructive">
                {summary.failedCount} email failed
              </Badge>
            ) : null}
            {summary.fallbackCount > 0 ? (
              <Badge variant="outline">
                {summary.fallbackCount} fallback link
                {summary.fallbackCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {summary.conflictCount > 0 ? (
              <Badge variant="destructive">
                {summary.conflictCount} conflict
                {summary.conflictCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          {summary.suppressedCount > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Email is disabled in this environment. Pending invites remain
              usable through their fallback links.
            </p>
          ) : null}
        </DialogHeader>

        <div className="border-b px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {(
              ["All", "Created", "Skipped", "Conflicts", "EmailFailed"] as const
            ).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
              >
                {value === "EmailFailed" ? "Email failed" : value}
              </Button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Access state</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="w-35 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result) => {
                  return (
                    <TableRow key={result.employeeId}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {getBulkResultDisplayName(result)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {result.account.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getOutcomeBadgeVariant(result.outcome)}>
                          {getOutcomeBadgeLabel(result.outcome)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getAccessBadgeTone(
                            getAccessDisplayState(result.account)
                          )}
                        >
                          {getAccessDisplayState(result.account)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {result.account.deliveryStatus ? (
                          <Badge
                            variant={getDeliveryBadgeVariant(
                              result.account.deliveryStatus
                            )}
                          >
                            {getDeliveryBadgeLabel(
                              result.account.deliveryStatus
                            )}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {result.account.inviteLink ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void onCopyInviteLink(
                                `result:${result.employeeId}`,
                                result.account.inviteLink
                              )
                            }
                          >
                            <Copy className="size-3.5" />
                            {copiedLinkKey === `result:${result.employeeId}`
                              ? "Copied"
                              : "Copy"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SelectedAccessActionBar({
  canOfferSelectAllMatching,
  isSelectingAllMatching,
  managerSuggestionCount,
  notIncludedCount,
  pendingWithLinkCount,
  onClearSelection,
  onCopyInviteLinks,
  onReviewInvitations,
  onSelectAllMatching,
  pageSelectedCount,
  readyCount,
  selectedCount,
  selectionScope,
  totalMatchingCount,
}: {
  canOfferSelectAllMatching: boolean;
  isSelectingAllMatching: boolean;
  managerSuggestionCount: number;
  notIncludedCount: number;
  pendingWithLinkCount: number;
  onClearSelection: () => void;
  onCopyInviteLinks: () => void;
  onReviewInvitations: () => void;
  onSelectAllMatching: () => void;
  pageSelectedCount: number;
  readyCount: number;
  selectedCount: number;
  selectionScope: SelectionScope;
  totalMatchingCount: number;
}) {
  const hasReadyRows = readyCount > 0;
  const isPendingOnly = !hasReadyRows && pendingWithLinkCount === selectedCount;

  return (
    <div className="rounded-xl border bg-background px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{selectedCount} selected</Badge>
            {hasReadyRows ? (
              <Badge variant="outline">{readyCount} ready to invite</Badge>
            ) : isPendingOnly ? (
              <Badge variant="outline">Already invited</Badge>
            ) : (
              <Badge variant="outline">No invitations ready</Badge>
            )}
            {hasReadyRows && managerSuggestionCount > 0 ? (
              <Badge variant="outline">
                {managerSuggestionCount} manager suggestion
                {managerSuggestionCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {notIncludedCount > 0 && hasReadyRows ? (
              <Badge variant="outline">{notIncludedCount} not included</Badge>
            ) : null}
          </div>

          {canOfferSelectAllMatching ? (
            <p className="text-sm text-muted-foreground">
              All {pageSelectedCount} employees on this page are selected.
              <Button
                className="h-auto px-2"
                size="sm"
                variant="link"
                onClick={onSelectAllMatching}
                disabled={isSelectingAllMatching}
              >
                {isSelectingAllMatching
                  ? "Selecting all..."
                  : `Select all ${totalMatchingCount} matching employees`}
              </Button>
            </p>
          ) : selectionScope === "allMatching" ? (
            <p className="text-sm text-muted-foreground">
              Bulk actions will apply to all employees matching the current
              filters.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onClearSelection}>
            Clear selection
          </Button>
          {hasReadyRows ? (
            <Button size="sm" onClick={onReviewInvitations}>
              <Send />
              Review invitations
            </Button>
          ) : isPendingOnly ? (
            <Button size="sm" onClick={onCopyInviteLinks}>
              <Copy />
              Copy invite links
            </Button>
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
  const canAccess = canAccessEmployeeRoster(user);
  const shouldAutoReviewAccess = searchParams.get("review") === "access";
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
  const [isNotIncludedExpanded, setIsNotIncludedExpanded] = useState(false);
  const [isResultDetailsOpen, setIsResultDetailsOpen] = useState(false);
  const [selectedRolesByEmployeeId, setSelectedRolesByEmployeeId] = useState<
    Record<string, AccessInviteRole>
  >({});
  const [bulkResults, setBulkResults] = useState<
    WorkforceAccountBulkProvisionResultDto[] | null
  >(null);
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
      (data?.items ?? []).map((employee) => buildWorkforceAccountSubject(employee)),
    [data?.items]
  );
  const {
    data: workforceAccounts,
    error: workforceAccountsError,
    isLoading: isLoadingWorkforceAccounts,
  } = useWorkforceAccountStatuses(workforceAccountSubjects);
  const bulkProvision = useBulkProvisionWorkforceAccountInvites();

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
                {isLoadingWorkforceAccounts ? "Loading..." : accessState}
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
                        className="px-1.5"
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

  const handleCopyAllInviteLinks = useCallback(async () => {
    if (!bulkResults) {
      return;
    }

    const content = buildInviteLinksClipboardText(bulkResults);
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopiedLinkKey("all-results");
    } catch {
      setCopiedLinkKey(null);
    }
  }, [bulkResults]);

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
    },
    []
  );

  const handleReadinessChange = useCallback(
    (value: EmployeeReadinessFilter | undefined) => {
      setReadiness(value);
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

  const handleRowClick = useCallback(
    (employee: EmployeeRosterRow) => {
      router.push(`/employees/${employee.id}`);
    },
    [router]
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
    const inviteableEmployees = reviewRows.inviteableRows.map(
      (row) => row.employee
    );

    if (inviteableEmployees.length === 0) {
      return;
    }

    setBulkActionError(null);
    setSelectionError(null);

    try {
      const results = await bulkProvision.mutateAsync({
        items: inviteableEmployees.map((employee) => ({
          employeeId: employee.id,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          role:
            selectedRolesByEmployeeId[employee.id] ??
            getSuggestedInviteRole(employee.directReportCount),
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

      setBulkResults(results);
      if (
        access === "NotInvited" &&
        results.some((result) => result.outcome === "Created")
      ) {
        setAccess("Invited");
      }
      setIsResultDetailsOpen(false);
      setIsAccessWorkflowOpen(false);
      setSelectionScope("page");
      setAllMatchingSelectionRows(null);
      setRowSelection({});
      setSelectedRolesByEmployeeId({});
    } catch (nextError) {
      setBulkActionError(getErrorMessage(nextError));
    }
  }, [
    access,
    bulkProvision,
    queryClient,
    reviewRows.inviteableRows,
    selectedRolesByEmployeeId,
  ]);

  const handleSelectedRoleChange = useCallback(
    (employeeId: string, role: AccessInviteRole) => {
      setSelectedRolesByEmployeeId((current) => ({
        ...current,
        [employeeId]: role,
      }));
    },
    []
  );

  const handleClearSelection = useCallback(() => {
    setSelectionScope("page");
    setAllMatchingSelectionRows(null);
    setRowSelection({});
    setSelectedRolesByEmployeeId({});
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
    setSelectedRolesByEmployeeId({});
    setIsAccessWorkflowOpen(false);
    setSelectionError(null);
    setBulkActionError(null);
  }, [access, readiness, search, sortBy, sortDir, status]);

  useEffect(() => {
    setSelectedRolesByEmployeeId((current) => {
      const next: Record<string, AccessInviteRole> = {};

      for (const employee of selectedEmployees) {
        next[employee.id] =
          current[employee.id] ??
          getSuggestedInviteRole(employee.directReportCount);
      }

      return next;
    });

    if (selectedEmployees.length === 0) {
      setIsAccessWorkflowOpen(false);
      setIsNotIncludedExpanded(false);
    }
  }, [selectedEmployees]);

  const isInitialPageLoading =
    canAccess &&
    currentTableLoading &&
    !error &&
    !data;

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
        description="Manage the tenant roster and send access invitations when employees are ready."
        actions={
          !isTenantContextReadOnly ? (
            <Button asChild>
              <Link href="/employees/import">
                <Upload />
                Import employees
              </Link>
            </Button>
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
          isSelectingAllMatching={isSelectingAllMatching}
          managerSuggestionCount={selectionSummary.managerSuggestionCount}
          notIncludedCount={selectionSummary.notIncludedCount}
          pendingWithLinkCount={selectionSummary.pendingWithLinkCount}
          onClearSelection={handleClearSelection}
          onCopyInviteLinks={() => void handleCopySelectedInviteLinks()}
          onReviewInvitations={() => {
            if (selectionSummary.readyToInviteCount === 0) {
              return;
            }
            setIsAccessWorkflowOpen(true);
          }}
          onSelectAllMatching={() => void handleSelectAllMatching()}
          pageSelectedCount={selectedPageEmployees.length}
          readyCount={selectionSummary.readyToInviteCount}
          selectedCount={selectedEmployees.length}
          selectionScope={selectionScope}
          totalMatchingCount={totalMatchingCount}
        />
      ) : null}

      {bulkResults ? (
        <BulkResultsSummaryBanner
          results={bulkResults}
          copiedLinkKey={copiedLinkKey}
          onCopyAllLinks={() => void handleCopyAllInviteLinks()}
          onDismiss={() => {
            setBulkResults(null);
            setIsResultDetailsOpen(false);
          }}
          onOpenDetails={() => setIsResultDetailsOpen(true)}
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
            ? "Try a different access filter or search."
            : "Try a different search or status filter."
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

      <Sheet
        open={isAccessWorkflowOpen}
        onOpenChange={(open) => {
          setIsAccessWorkflowOpen(open);
          if (!open) {
            setIsNotIncludedExpanded(false);
          }
        }}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-5xl">
          <SheetHeader className="border-b pr-14">
            <SheetTitle>Review invitations</SheetTitle>
            <SheetDescription>
              Confirm recipients and roles before sending access invitations.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {reviewRows.inviteableRows.length > 0 ? (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Suggested access</TableHead>
                      <TableHead className="w-45">Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewRows.inviteableRows.map(
                      ({ employee, suggestedRole }) => {
                        const plannedRole =
                          selectedRolesByEmployeeId[employee.id] ??
                          suggestedRole;

                        return (
                          <TableRow key={employee.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {employee.firstName} {employee.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {employee.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {suggestedRole === "Manager" ? (
                                <div className="space-y-0.5">
                                  <p className="text-sm font-medium">
                                    Manager suggested
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Has direct reports
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Employee default
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={plannedRole}
                                onValueChange={(value) =>
                                  handleSelectedRoleChange(
                                    employee.id,
                                    value as AccessInviteRole
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Employee">
                                    Employee
                                  </SelectItem>
                                  <SelectItem value="Manager">
                                    Manager
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      }
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-xl border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                No selected employees are ready for invitations.
              </div>
            )}

            {reviewRows.notIncludedRows.length > 0 ? (
              <div className="mt-3 rounded-xl border bg-muted/5 px-4 py-3">
                <button
                  type="button"
                  className="w-full text-left text-sm text-muted-foreground"
                  onClick={() =>
                    setIsNotIncludedExpanded((current) => !current)
                  }
                >
                  {reviewRows.notIncludedRows.length} not included: already
                  invited, active, inactive, or conflict
                </button>
                {isNotIncludedExpanded ? (
                  <div className="mt-3 space-y-2">
                    {reviewRows.notIncludedRows.map(({ employee, reason }) => (
                      <div
                        key={`not-included:${employee.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {employee.email}
                          </p>
                        </div>
                        <Badge variant="outline">{reason}</Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <SheetFooter className="sticky bottom-0 border-t bg-background/95 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">
                {selectionSummary.readyToInviteCount} invitations ready
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAccessWorkflowOpen(false)}
                disabled={bulkProvision.isLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleBulkProvision()}
                disabled={
                  reviewRows.inviteableRows.length === 0 ||
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
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {bulkResults ? (
        <BulkResultsDialog
          copiedLinkKey={copiedLinkKey}
          onCopyInviteLink={handleCopyInviteLink}
          onOpenChange={setIsResultDetailsOpen}
          open={isResultDetailsOpen}
          results={bulkResults}
        />
      ) : null}
    </div>
  );
}
