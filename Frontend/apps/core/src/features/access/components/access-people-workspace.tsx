"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CircleAlert,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  UserCircle2,
  Users,
} from "lucide-react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import type {
  AccessProfileSummaryDto,
  WorkforceAccessSubjectSummaryDto,
} from "@repo/api";
import { createPlatformApiClient } from "@repo/api";
import {
  canAccessCoreAccess,
  canManageCoreAccess,
  canManageCoreAccessProfiles,
  useAuth,
} from "@repo/auth";
import { type PageSize } from "@repo/ui";
import { toast } from "sonner";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table";
import { DataTablePagination } from "@/components/data-table-pagination";
import { AccessToolbar } from "@/app/(pages)/access/access-toolbar";
import {
  useAccessSubjectSummary,
  useAccessSubjects,
  type AccessSubjectQueryParams,
} from "@/app/(pages)/access/use-access-subjects";
import {
  useBulkProvisionWorkforceAccountInvites,
  useResendWorkforceAccountInvite,
} from "@/app/(pages)/employees/use-workforce-accounts";
import type {
  WorkforceAccountStatusDto,
  WorkforceBulkInviteResponseDto,
} from "@/app/(pages)/employees/employee-roster.types";
import { canAccessEmployeeProfile } from "@/lib/employee-roster-access";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { useAccessProfiles } from "@/features/access/api/use-core-access";
import {
  type BulkInviteResultSummary,
  getAccessActionErrorMessage,
  getAccessPrimaryAction,
  getBulkInviteSuccessMessage,
  getResendSuccessMessage,
  getSheetModeForSubject,
  summarizeBulkInviteResults,
  suggestProfileForSubject,
  summarizeProfileSuggestions,
  type EmployeeAccessSheetMode,
} from "@/features/access/components/access-action-helpers";
import {
  getPrimaryAccessProfile,
  getSuggestedInviteRole,
} from "@/features/access/shared/employee-access";
import { EmployeeAccessManagementSheet } from "@/features/employees/profile/employee-access-management-sheet";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const WORKFORCE_ACCOUNT_STATUSES_PATH =
  "/corehr/employees/workforce-accounts/statuses";

const ACCESS_FILTER_OPTIONS = [
  { value: "all", label: "All access states" },
  { value: "NotInvited", label: "Not invited" },
  { value: "InvitePending", label: "Invite pending" },
  { value: "ActiveAccount", label: "Active account" },
  { value: "NeedsReview", label: "Needs review" },
] as const;

const EMPLOYEE_STATUS_OPTIONS = [
  { value: "all", label: "All employee statuses" },
  { value: "Active", label: "Active employees" },
  { value: "Inactive", label: "Inactive employees" },
] as const;

type AccessFilterValue = (typeof ACCESS_FILTER_OPTIONS)[number]["value"];
type EmployeeStatusFilterValue =
  (typeof EMPLOYEE_STATUS_OPTIONS)[number]["value"];

interface AccessEmployeeRef {
  employeeId: string;
  stableEmployeeKey: string;
  displayName: string;
  workEmail: string;
  firstName: string;
  lastName: string;
  directReportCount: number;
  initialMode?: EmployeeAccessSheetMode;
}

function parsePositiveInt(rawValue: string | null, fallback: number) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseAccessFilter(rawValue: string | null): AccessFilterValue {
  return ACCESS_FILTER_OPTIONS.some((option) => option.value === rawValue)
    ? (rawValue as AccessFilterValue)
    : "all";
}

function parseEmployeeStatusFilter(
  rawValue: string | null
): EmployeeStatusFilterValue {
  return EMPLOYEE_STATUS_OPTIONS.some((option) => option.value === rawValue)
    ? (rawValue as EmployeeStatusFilterValue)
    : "all";
}

function getAccessBadgeVariant(
  accessState: WorkforceAccessSubjectSummaryDto["accessState"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (accessState) {
    case "ActiveAccount":
      return "default";
    case "InvitePending":
      return "secondary";
    case "NeedsReview":
      return "destructive";
    default:
      return "outline";
  }
}

function getSuggestedAccessProfileId(
  accessProfiles: Array<{ id: string; name: string }>,
  directReportCount: number,
  currentProfileIds: string[]
) {
  const currentProfileId = currentProfileIds[0];
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
    ""
  );
}

function SummaryCard({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
        active
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-primary/20 hover:bg-muted/10"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums">{count}</p>
    </button>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}

export function BulkInviteDialog({
  open,
  onOpenChange,
  subjects,
  accessProfiles,
  isSubmitting,
  onConfirm,
  onViewPendingInvites,
  canManageProfiles = false,
  profilesHref = "",
  queryParams,
  allResultsSelected = false,
  totalCount = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: WorkforceAccessSubjectSummaryDto[];
  accessProfiles: AccessProfileSummaryDto[];
  isSubmitting: boolean;
  onConfirm: (request: {
    accessProfileId: string;
    employeeIds?: string[] | null;
    search?: string | null;
    access?: string | null;
    profileId?: string | null;
    employeeStatus?: string | null;
    employeeKey?: string | null;
  }) => Promise<WorkforceBulkInviteResponseDto>;
  onViewPendingInvites: () => void;
  canManageProfiles?: boolean;
  profilesHref?: string;
  queryParams: AccessSubjectQueryParams;
  allResultsSelected?: boolean;
  totalCount?: number;
}) {
  const [profileAssignments, setProfileAssignments] = useState<
    Record<string, string>
  >({});
  const [showReview, setShowReview] = useState(false);
  const [resultSummary, setResultSummary] =
    useState<BulkInviteResultSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedCount = allResultsSelected ? totalCount : subjects.length;

  useEffect(() => {
    if (!open) return;

    setResultSummary(null);
    setActionError(null);
    setShowReview(false);

    const assignments: Record<string, string> = {};
    for (const subject of subjects) {
      assignments[subject.employeeId] = suggestProfileForSubject(
        subject,
        accessProfiles
      );
    }
    setProfileAssignments(assignments);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setProfileAssignments((prev) => {
      const assignments: Record<string, string> = {};
      for (const subject of subjects) {
        assignments[subject.employeeId] =
          prev[subject.employeeId] ??
          suggestProfileForSubject(subject, accessProfiles);
      }
      return assignments;
    });
  }, [accessProfiles, subjects, open]);

  const profileSummary = useMemo(
    () =>
      summarizeProfileSuggestions(subjects, accessProfiles, profileAssignments),
    [accessProfiles, subjects, profileAssignments]
  );

  function getProfileId(subject: WorkforceAccessSubjectSummaryDto): string {
    return (
      profileAssignments[subject.employeeId] ??
      suggestProfileForSubject(subject, accessProfiles)
    );
  }

  function setProfileId(
    subject: WorkforceAccessSubjectSummaryDto,
    profileId: string
  ) {
    setProfileAssignments((prev) => ({
      ...prev,
      [subject.employeeId]: profileId,
    }));
  }

  function pickMajorityProfile(): string {
    const counts = new Map<string, number>();
    for (const pid of Object.values(profileAssignments)) {
      counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
    let best = "";
    let bestCount = 0;
    for (const [pid, count] of counts) {
      if (count > bestCount) {
        best = pid;
        bestCount = count;
      }
    }
    return best || "";
  }

  async function handleSubmit() {
    try {
      const response = await onConfirm({
        accessProfileId: pickMajorityProfile(),
        search: queryParams.search,
        access: queryParams.access,
        profileId: queryParams.profileId,
        employeeStatus: queryParams.employeeStatus,
        employeeKey: queryParams.employeeKey,
        employeeIds: allResultsSelected ? undefined : subjects.map((s) => s.employeeId),
      });
      setResultSummary(summarizeBulkInviteResults(response));
      setActionError(null);
    } catch (error) {
      setActionError(getAccessActionErrorMessage("bulkInvite", error));
    }
  }

  function handleDismiss() {
    setResultSummary(null);
    setActionError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {resultSummary ? (
          <>
            <DialogHeader>
              <DialogTitle>Bulk invite results</DialogTitle>
              <DialogDescription>
                {getBulkInviteSuccessMessage({
                  items: [],
                  totalRequested: resultSummary.totalRequested,
                  invitedCount: resultSummary.invitedCount,
                  refreshedCount: resultSummary.refreshedCount,
                  alreadyActiveCount: resultSummary.alreadyActiveCount,
                  skippedCount: resultSummary.skippedCount,
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-2 rounded-xl border bg-muted/10 p-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Invited
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {resultSummary.invitedCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Refreshed
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {resultSummary.refreshedCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Already active
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {resultSummary.alreadyActiveCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Skipped
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {resultSummary.skippedCount}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleDismiss}>Dismiss</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Review invitations</DialogTitle>
              <DialogDescription>
                Send invitations to {selectedCount} selected {selectedCount === 1 ? "person" : "people"}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/10 p-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Selected
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {selectedCount}
                  </p>
                </div>
              </div>

              {actionError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Invitation could not be created</AlertTitle>
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              ) : null}

              {accessProfiles.length === 0 ? (
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertTitle>No access profiles available</AlertTitle>
                  <AlertDescription>
                    Create or restore an access profile before sending
                    invitations.
                  </AlertDescription>
                </Alert>
              ) : showReview ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Profile assignments</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowReview(false)}
                      className="h-auto p-0 text-xs"
                    >
                      Back to summary
                    </Button>
                  </div>
                  <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border bg-background p-2">
                    {subjects.map((subject) => (
                      <div
                        key={subject.employeeId}
                        className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/10"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {subject.displayName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {subject.workEmail}
                          </p>
                        </div>
                        <Select
                          value={getProfileId(subject)}
                          onValueChange={(value) =>
                            setProfileId(subject, value)
                          }
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
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
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Access profile</p>
                    {subjects.length > 0 ? (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setShowReview(true)}
                        className="h-auto p-0 text-xs"
                      >
                        Review assignments
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Each person is assigned a suggested profile based on
                    their role.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {profileSummary.map((entry) => (
                      <Badge key={entry.profileName} variant="secondary">
                        {entry.count} {entry.profileName}
                      </Badge>
                    ))}
                  </div>

                  {canManageProfiles && profilesHref ? (
                    <Link
                      href={profilesHref}
                      className="block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Manage access profiles
                    </Link>
                  ) : null}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleSubmit()}
                disabled={
                  isSubmitting ||
                  selectedCount === 0 ||
                  accessProfiles.length === 0 ||
                  !pickMajorityProfile()
                }
              >
                {isSubmitting
                  ? "Sending..."
                  : `Send ${selectedCount} invite${selectedCount === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AccessPeopleWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const { tenantId, tenantSlug } = useTenantContext();

  const canViewAccess = canAccessCoreAccess(user);
  const canManageAccess = canManageCoreAccess(user);
  const canManageProfiles = canManageCoreAccessProfiles(user);
  const canOpenEmployeeProfile = canAccessEmployeeProfile(user);
  const profilesHref = buildTenantContextHref(
    "/settings?tab=access-profiles",
    tenantId,
    tenantSlug
  );

  const searchParam = searchParams.get("search") ?? "";
  const [searchText, setSearchText] = useState(searchParam);
  const deferredSearchText = useDeferredValue(searchText);
  const accessFilter = parseAccessFilter(searchParams.get("access"));
  const employeeStatusFilter = parseEmployeeStatusFilter(
    searchParams.get("employeeStatus")
  );
  const profileId = searchParams.get("profileId");
  const employeeKey = searchParams.get("employeeKey");
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const pageSize = parsePositiveInt(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE
  ) as PageSize;

  const queryParams = useMemo<AccessSubjectQueryParams>(
    () => ({
      search: deferredSearchText.trim() || null,
      access: accessFilter === "all" ? null : accessFilter,
      profileId: profileId || null,
      employeeStatus:
        employeeStatusFilter === "all" ? null : employeeStatusFilter,
      employeeKey: employeeKey?.trim() || null,
      page,
      pageSize,
    }),
    [
      accessFilter,
      deferredSearchText,
      employeeKey,
      employeeStatusFilter,
      page,
      pageSize,
      profileId,
    ]
  );

  const {
    data: accessPage,
    error: accessError,
    isLoading: isAccessLoading,
    refetch: refetchAccess,
  } = useAccessSubjects(queryParams, canViewAccess);
  const {
    data: summary,
    error: summaryError,
    isLoading: isSummaryLoading,
  } = useAccessSubjectSummary(canViewAccess);
  const { data: accessProfiles = [], isLoading: isProfilesLoading } =
    useAccessProfiles(canViewAccess || canManageProfiles);

  const bulkProvisionInvites = useBulkProvisionWorkforceAccountInvites();
  const resendInvite = useResendWorkforceAccountInvite();

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [allResultsSelected, setAllResultsSelected] = useState(false);
  const [activeEmployee, setActiveEmployee] =
    useState<AccessEmployeeRef | null>(null);
  const [isBulkInviteOpen, setIsBulkInviteOpen] = useState(false);
  const [pendingRowAction, setPendingRowAction] = useState<{
    employeeId: string;
    kind: "copyInviteLink" | "resendInvite";
  } | null>(null);

  const items = useMemo(() => accessPage?.items ?? [], [accessPage?.items]);
  const totalCount = accessPage?.totalCount ?? 0;
  const selectedEmployeeIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  );
  const selectedSubjects = useMemo(
    () =>
      allResultsSelected
        ? items
        : items.filter((subject) =>
            selectedEmployeeIds.includes(subject.employeeId)
          ),
    [allResultsSelected, items, selectedEmployeeIds]
  );
  const selectedSubjectCount = allResultsSelected ? totalCount : selectedSubjects.length;
  const isAllVisibleSelected =
    items.length > 0 && selectedEmployeeIds.length === items.length;
  const hasMorePages = totalCount > items.length;
  const hasActiveFilters =
    !!queryParams.search ||
    !!queryParams.access ||
    !!queryParams.profileId ||
    !!queryParams.employeeStatus ||
    !!queryParams.employeeKey;

  const updateSearchParam = useCallback(
    (updates: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }
      });

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (!canViewAccess && canManageProfiles) {
      router.replace(profilesHref);
    }
  }, [canManageProfiles, canViewAccess, profilesHref, router]);

  useEffect(() => {
    if (searchText !== searchParam) {
      setSearchText(searchParam);
    }
  }, [searchParam, searchText]);

  useEffect(() => {
    if (deferredSearchText === searchParam) {
      return;
    }

    updateSearchParam({
      search: deferredSearchText.trim() || null,
      page: "1",
    });
  }, [deferredSearchText, searchParam, updateSearchParam]);

  useEffect(() => {
    setRowSelection((current) => {
      if (allResultsSelected) {
        const all: RowSelectionState = {};
        for (const subject of items) {
          all[subject.employeeId] = true;
        }
        return all;
      }

      const visibleIds = new Set(items.map((subject) => subject.employeeId));
      const filtered: RowSelectionState = {};

      for (const [id, selected] of Object.entries(current)) {
        if (selected && visibleIds.has(id)) {
          filtered[id] = true;
        }
      }

      return filtered;
    });
  }, [allResultsSelected, items]);

  useEffect(() => {
    setAllResultsSelected(false);
  }, [
    queryParams.search,
    queryParams.access,
    queryParams.profileId,
    queryParams.employeeStatus,
    page,
    pageSize,
  ]);

  useEffect(() => {
    if (!employeeKey || activeEmployee) {
      return;
    }

    const match = items.find(
      (subject) => subject.stableEmployeeKey === employeeKey
    );
    if (!match) {
      return;
    }

    setActiveEmployee({
      employeeId: match.employeeId,
      stableEmployeeKey: match.stableEmployeeKey,
      displayName: match.displayName,
      workEmail: match.workEmail,
      firstName: match.firstName,
      lastName: match.lastName,
      directReportCount: match.directReportCount,
      initialMode: getSheetModeForSubject(match),
    });
  }, [activeEmployee, employeeKey, items]);

  function clearFilters() {
    updateSearchParam({
      search: null,
      access: null,
      profileId: null,
      employeeStatus: null,
      employeeKey: null,
      page: null,
      pageSize: null,
    });
  }

  async function fetchAccountStatus(
    subject: WorkforceAccessSubjectSummaryDto
  ): Promise<WorkforceAccountStatusDto | null> {
    const client = createPlatformApiClient();
    const statuses = await client.post<WorkforceAccountStatusDto[]>(
      WORKFORCE_ACCOUNT_STATUSES_PATH,
      {
        subjects: [
          {
            employeeId: subject.employeeId,
            email: subject.workEmail,
            firstName: subject.firstName,
            lastName: subject.lastName,
          },
        ],
      }
    );

    return statuses[0] ?? null;
  }

  function openEmployee(
    subject: WorkforceAccessSubjectSummaryDto,
    initialMode = getSheetModeForSubject(subject)
  ) {
    setActiveEmployee({
      employeeId: subject.employeeId,
      stableEmployeeKey: subject.stableEmployeeKey,
      displayName: subject.displayName,
      workEmail: subject.workEmail,
      firstName: subject.firstName,
      lastName: subject.lastName,
      directReportCount: subject.directReportCount,
      initialMode,
    });
  }

  async function handleCopyInviteLink(
    subject: WorkforceAccessSubjectSummaryDto
  ) {
    setPendingRowAction({
      employeeId: subject.employeeId,
      kind: "copyInviteLink",
    });

    try {
      const account = await fetchAccountStatus(subject);
      if (!account?.inviteLink) {
        toast.error("Invite link could not be copied.");
        return;
      }

      await navigator.clipboard.writeText(account.inviteLink);
      toast.success("Invite link copied.");
    } catch (error) {
      toast.error(getAccessActionErrorMessage("copyInviteLink", error));
    } finally {
      setPendingRowAction(null);
    }
  }

  async function handleResendInvite(subject: WorkforceAccessSubjectSummaryDto) {
    setPendingRowAction({
      employeeId: subject.employeeId,
      kind: "resendInvite",
    });

    try {
      const account = await resendInvite.mutateAsync({
        employeeId: subject.employeeId,
      });
      toast.success(getResendSuccessMessage(account));
      void refetchAccess();
    } catch (error) {
      toast.error(getAccessActionErrorMessage("resendInvite", error));
    } finally {
      setPendingRowAction(null);
    }
  }

  async function handlePrimaryAction(
    subject: WorkforceAccessSubjectSummaryDto
  ) {
    const primaryAction = getAccessPrimaryAction(subject, canManageAccess);

    if (primaryAction.kind === "copyInviteLink") {
      await handleCopyInviteLink(subject);
      return;
    }

    openEmployee(subject, primaryAction.mode);
  }

  async function handleBulkInvite(
    request: {
      accessProfileId: string;
      employeeIds?: string[] | null;
      search?: string | null;
      access?: string | null;
      profileId?: string | null;
      employeeStatus?: string | null;
      employeeKey?: string | null;
    }
  ): Promise<WorkforceBulkInviteResponseDto> {
    const payload = {
      accessProfileId: request.accessProfileId,
      specificEmployeeIds: allResultsSelected ? null : request.employeeIds,
      search: request.search,
      access: request.access,
      profileId: request.profileId,
      employeeStatus: request.employeeStatus,
      employeeKey: request.employeeKey,
    };
    const result = await bulkProvisionInvites.mutateAsync(payload);
    setRowSelection({});
    setAllResultsSelected(false);
    void refetchAccess();
    return result;
  }

  function viewPendingInvites() {
    updateSearchParam({
      access: "InvitePending",
      page: "1",
    });
  }

  const columns = useMemo<ColumnDef<WorkforceAccessSubjectSummaryDto>[]>(() => {
    const cols: ColumnDef<WorkforceAccessSubjectSummaryDto>[] = [];

    if (canManageAccess) {
      cols.push({
        id: "select",
        header: ({ table }) => {
          const allVisibleSelected = table.getIsAllRowsSelected();
          const isIndeterminate =
            !allResultsSelected && allVisibleSelected && hasMorePages;

          return (
            <Checkbox
              checked={
                isIndeterminate
                  ? "indeterminate"
                  : allResultsSelected || allVisibleSelected
              }
              onCheckedChange={() => {
                if (allResultsSelected) {
                  setAllResultsSelected(false);
                  table.toggleAllRowsSelected(false);
                  return;
                }

                if (table.getIsAllRowsSelected()) {
                  table.toggleAllRowsSelected(false);
                } else {
                  table.toggleAllRowsSelected(true);
                }
              }}
              aria-label={
                allResultsSelected ? "Deselect all" : "Select all on this page"
              }
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => {
              row.toggleSelected(!!checked);
              if (!checked) {
                setAllResultsSelected(false);
              }
            }}
            aria-label={`Select ${row.original.displayName}`}
            onClick={(event) => event.stopPropagation()}
          />
        ),
        meta: {
          headerClassName: "w-12 text-center",
          cellClassName: "w-12 text-center",
        },
        enableSorting: false,
      });
    }

    cols.push(
      {
        id: "Person",
        header: "Person",
        meta: {
          headerClassName: "w-[260px] max-w-[260px] text-left",
          cellClassName: "w-[260px] max-w-[260px] text-left",
        },
        cell: ({ row }) => {
          const subject = row.original;
          return (
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium text-foreground">
                  {subject.displayName}
                </p>
                {!subject.isActive ? (
                  <Badge variant="outline">Inactive employee</Badge>
                ) : null}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {subject.workEmail}
              </p>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "AccessState",
        header: "Access state",
        cell: ({ row }) => {
          const subject = row.original;
          return (
            <div className="flex justify-center">
              <Badge variant={getAccessBadgeVariant(subject.accessState)}>
                {subject.accessStateLabel}
              </Badge>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "AccessProfile",
        header: "Access profile",
        cell: ({ row }) => {
          const subject = row.original;
          const primaryProfile = getPrimaryAccessProfile(
            subject.accessProfiles
          );
          if (primaryProfile) {
            return (
              <span className="text-sm font-medium text-foreground">
                {primaryProfile.name}
              </span>
            );
          }

          if (subject.accessState === "NotInvited") {
            return (
              <span className="text-sm text-muted-foreground">
                Assigned on invite
              </span>
            );
          }

          return <span className="text-sm text-muted-foreground">—</span>;
        },
        enableSorting: false,
      },
      {
        id: "Invitation",
        header: "Invitation",
        cell: ({ row }) => {
          const subject = row.original;
          const invitationLabel = subject.invitationLabel || "—";
          const isMutedValue =
            invitationLabel === "Not sent" || invitationLabel === "—";
          return (
            <div className="flex justify-center">
              <p
                className={`max-w-44 text-center text-sm ${
                  isMutedValue ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {invitationLabel}
              </p>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "LastActivity",
        header: "Last activity",
        cell: ({ row }) => {
          const subject = row.original;
          const isMutedValue =
            subject.lastActivityLabel === "No activity" ||
            subject.lastActivityLabel === "—";
          return (
            <div className="flex justify-center">
              <p
                className={`max-w-48 text-center text-sm ${
                  isMutedValue ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {subject.lastActivityLabel}
              </p>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "Actions",
        header: "Action",
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
        cell: ({ row }) => {
          const subject = row.original;
          const primaryAction = getAccessPrimaryAction(
            subject,
            canManageAccess
          );
          const isCopyingInviteLink =
            pendingRowAction?.employeeId === subject.employeeId &&
            pendingRowAction.kind === "copyInviteLink";
          const isResendingInvite =
            pendingRowAction?.employeeId === subject.employeeId &&
            pendingRowAction.kind === "resendInvite";
          const employeeProfileHref = buildTenantContextHref(
            `/employees/${subject.stableEmployeeKey}`,
            tenantId,
            tenantSlug
          );
          const hasOperationalMenuItem =
            (canManageAccess &&
              (subject.accessState === "InvitePending" ||
                subject.accessState === "ActiveAccount" ||
                subject.accessState === "NeedsReview")) ||
            false;
          const canShowMenu = hasOperationalMenuItem || canOpenEmployeeProfile;

          return (
            <div
              className="flex items-center justify-center gap-2"
              onClick={(event) => event.stopPropagation()}
              role="presentation"
            >
              <Button
                size="sm"
                variant="outline"
                className="min-w-[8.5rem]"
                onClick={() => void handlePrimaryAction(subject)}
                disabled={isCopyingInviteLink || isResendingInvite}
              >
                {isCopyingInviteLink ? "Copying..." : primaryAction.label}
              </Button>
              {canShowMenu ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label={`Open more actions for ${subject.displayName}`}
                      disabled={isCopyingInviteLink || isResendingInvite}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canManageAccess &&
                    subject.accessState === "InvitePending" ? (
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          openEmployee(subject, "pending");
                        }}
                      >
                        <ShieldCheck className="size-4" />
                        Update access profile
                      </DropdownMenuItem>
                    ) : null}
                    {canManageAccess &&
                    subject.accessState === "InvitePending" ? (
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          void handleResendInvite(subject);
                        }}
                      >
                        <RefreshCw className="size-4" />
                        {isResendingInvite ? "Resending..." : "Resend invite"}
                      </DropdownMenuItem>
                    ) : null}
                    {canManageAccess &&
                    subject.accessState === "ActiveAccount" ? (
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          openEmployee(subject, "profile");
                        }}
                      >
                        <ShieldCheck className="size-4" />
                        Update access profile
                      </DropdownMenuItem>
                    ) : null}
                    {canManageAccess &&
                    subject.accessState === "NeedsReview" ? (
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          openEmployee(subject, "review");
                        }}
                      >
                        <CircleAlert className="size-4" />
                        Review issue
                      </DropdownMenuItem>
                    ) : null}
                    {hasOperationalMenuItem && canOpenEmployeeProfile ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {canOpenEmployeeProfile ? (
                      <DropdownMenuItem asChild>
                        <Link href={employeeProfileHref}>
                          <UserCircle2 className="size-4" />
                          Open employee profile
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
        enableSorting: false,
      }
    );

    return cols;
  }, [
    allResultsSelected,
    canManageAccess,
    canOpenEmployeeProfile,
    hasMorePages,
    pendingRowAction,
    tenantId,
    tenantSlug,
  ]);

  if (isLoading) {
    return (
      <CorePageLoadingState
        title="Access"
        description="Activate accounts and manage access for workforce users."
        message="Loading access workspace"
        variant="workspace"
      />
    );
  }

  if (!canViewAccess && canManageProfiles) {
    return (
      <CorePageLoadingState
        title="Access"
        description="Redirecting to access profiles in Settings."
        message="Opening settings"
        variant="redirect"
      />
    );
  }

  if (!canViewAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Access"
          description="Activate accounts and manage access for workforce users."
        />
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Access is restricted</AlertTitle>
          <AlertDescription>
            Your current access profile does not include the Access workspace.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Access"
          description="Activate accounts and manage access for workforce users."
          actions={
            canManageProfiles ? (
              <Button asChild variant="outline" size="sm">
                <Link href={profilesHref}>
                  <ShieldCheck className="size-4" />
                  Access profiles
                </Link>
              </Button>
            ) : null
          }
        />

        <section className="space-y-3">
          {isSummaryLoading ? <SummarySkeleton /> : null}

          {!isSummaryLoading && summary ? (
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard
                label="Not invited"
                count={summary.notInvitedCount}
                active={accessFilter === "NotInvited"}
                onClick={() =>
                  updateSearchParam({
                    access: accessFilter === "NotInvited" ? null : "NotInvited",
                    page: "1",
                  })
                }
              />
              <SummaryCard
                label="Invite pending"
                count={summary.invitePendingCount}
                active={accessFilter === "InvitePending"}
                onClick={() =>
                  updateSearchParam({
                    access:
                      accessFilter === "InvitePending" ? null : "InvitePending",
                    page: "1",
                  })
                }
              />
              <SummaryCard
                label="Active account"
                count={summary.activeAccountCount}
                active={accessFilter === "ActiveAccount"}
                onClick={() =>
                  updateSearchParam({
                    access:
                      accessFilter === "ActiveAccount" ? null : "ActiveAccount",
                    page: "1",
                  })
                }
              />
              <SummaryCard
                label="Needs review"
                count={summary.needsReviewCount}
                active={accessFilter === "NeedsReview"}
                onClick={() =>
                  updateSearchParam({
                    access:
                      accessFilter === "NeedsReview" ? null : "NeedsReview",
                    page: "1",
                  })
                }
              />
            </div>
          ) : null}

          {!isSummaryLoading && summaryError ? (
            <p className="text-sm text-muted-foreground">
              Summary unavailable. The people list is still available.
            </p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-4">
          <AccessToolbar
            search={searchText}
            onSearchChange={(value) => {
              setSearchText(value);
              updateSearchParam({
                search: value.trim() || null,
                page: "1",
              });
            }}
            accessFilter={accessFilter}
            onAccessFilterChange={(value) =>
              updateSearchParam({
                access: value === "all" ? null : value,
                page: "1",
              })
            }
            profileId={profileId}
            onProfileIdChange={(value) =>
              updateSearchParam({
                profileId: value,
                page: "1",
              })
            }
            employeeStatusFilter={employeeStatusFilter}
            onEmployeeStatusFilterChange={(value) =>
              updateSearchParam({
                employeeStatus: value === "all" ? null : value,
                page: "1",
              })
            }
            accessProfiles={accessProfiles}
            isProfilesLoading={isProfilesLoading}
            onClearFilters={clearFilters}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 min-h-12">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>
                {hasActiveFilters ? `${totalCount} ` : `${totalCount} people`}
              </span>
              {canManageAccess &&
              (selectedSubjects.length > 0 || allResultsSelected) ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  {allResultsSelected ? (
                    <span>All {totalCount} selected</span>
                  ) : (
                    <span>{selectedSubjects.length} selected</span>
                  )}
                  {!allResultsSelected &&
                  isAllVisibleSelected &&
                  hasMorePages ? (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <button
                        type="button"
                        className="cursor-pointer font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                        onClick={() => setAllResultsSelected(true)}
                      >
                        Select all {totalCount}
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2 min-h-9">
              {canManageAccess &&
              (selectedSubjects.length > 0 || allResultsSelected) ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => setIsBulkInviteOpen(true)}
                    disabled={
                      selectedSubjects.length === 0 || accessProfiles.length === 0
                    }
                  >
                    {`Send ${selectedSubjectCount} invite${selectedSubjectCount === 1 ? "" : "s"}`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRowSelection({});
                      setAllResultsSelected(false);
                    }}
                  >
                    Clear
                  </Button>
                </>
              ) : null}
              {isAccessLoading && accessPage ? (
                <Badge variant="secondary">Updating</Badge>
              ) : null}
            </div>
          </div>
        </section>

        {accessError ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Access information could not be loaded.</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>Refresh the page or try again in a moment.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetchAccess()}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <DataTable<WorkforceAccessSubjectSummaryDto>
          columns={columns}
          data={items}
          isLoading={isAccessLoading && !accessPage}
          isFetching={isAccessLoading && !!accessPage}
          sorting={[{ id: "Person", desc: false }]}
          onSortingChange={() => {}}
          getRowId={(row) => row.employeeId}
          enableRowSelection={canManageAccess}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          emptyIcon={Users}
          emptyTitle={
            hasActiveFilters
              ? "No people match these filters."
              : "No people available for access management."
          }
          emptyDescription={
            hasActiveFilters
              ? "Try changing your search or clearing filters."
              : "Add or import employees before activating access."
          }
          emptyContent={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />

        <DataTablePagination
          page={accessPage?.page ?? page}
          pageSize={accessPage?.pageSize ?? pageSize}
          totalCount={accessPage?.totalCount ?? 0}
          onPageChange={(nextPage) =>
            updateSearchParam({ page: String(nextPage) })
          }
          onPageSizeChange={(size) =>
            updateSearchParam({
              pageSize: String(size),
              page: "1",
            })
          }
        />
      </div>

      <BulkInviteDialog
        open={isBulkInviteOpen}
        onOpenChange={setIsBulkInviteOpen}
        subjects={selectedSubjects}
        accessProfiles={accessProfiles}
        isSubmitting={bulkProvisionInvites.isLoading}
        onConfirm={handleBulkInvite}
        onViewPendingInvites={viewPendingInvites}
        canManageProfiles={canManageProfiles}
        profilesHref={profilesHref}
        queryParams={queryParams}
        allResultsSelected={allResultsSelected}
        totalCount={totalCount}
      />

      <EmployeeAccessManagementSheet
        open={!!activeEmployee}
        onOpenChange={(open) => {
          if (!open) {
            setActiveEmployee(null);
            void refetchAccess();
          }
        }}
        employeeId={activeEmployee?.employeeId ?? ""}
        displayName={activeEmployee?.displayName ?? ""}
        email={activeEmployee?.workEmail ?? ""}
        firstName={activeEmployee?.firstName ?? ""}
        lastName={activeEmployee?.lastName ?? ""}
        directReportCount={activeEmployee?.directReportCount ?? 0}
        canManageAccess={canManageAccess}
        canManageProfiles={canManageProfiles}
        profilesHref={profilesHref}
        initialMode={activeEmployee?.initialMode}
      />
    </>
  );
}
