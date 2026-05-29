"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Copy,
  KeyRound,
  Mail,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import {
  coreAccessQueryKeys,
  coreWorkforceQueryKeys,
  type AccessProfileAssignmentSummaryDto,
  type WorkforceAccessSubjectSummaryDto,
} from "@repo/api";
import { useApiQueryClient } from "@repo/api/query";
import {
  canAccessCoreAccess,
  canManageCoreAccess,
  canManageCoreAccessProfiles,
  useAuth,
} from "@repo/auth";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  EMPLOYEE_ACCESS_FILTER_OPTIONS,
  getAccessBadgeTone,
  getAccessDisplayState,
  getInvitationEligibility,
} from "../employees/employee-access";
import type {
  EmployeeAccessFilter,
  WorkforceAccountStatusDto,
  WorkforceAccountSubject,
} from "../employees/employee-roster.types";
import { PaginationBar } from "../employees/pagination-bar";
import { employeeRosterQueryKeys } from "../employees/employee-query-keys";
import {
  useDeactivateWorkforceAccount,
  useProvisionWorkforceAccountInvite,
  useReactivateWorkforceAccount,
  useResendWorkforceAccountInvite,
  useWorkforceAccountStatuses,
} from "../employees/use-workforce-accounts";
import {
  useAccessProfiles,
  useSetUserAccessProfiles,
} from "../settings/use-core-access";
import { useAccessSubjects } from "./use-access-subjects";

type AccessRow = WorkforceAccessSubjectSummaryDto & {
  workforceAccount: WorkforceAccountStatusDto | null;
};

const ALL_FILTER = "__all__";

function buildStatusSubject(
  subject: WorkforceAccessSubjectSummaryDto
): WorkforceAccountSubject {
  return {
    employeeId: subject.employeeId,
    email: subject.workEmail,
    firstName: subject.firstName,
    lastName: subject.lastName,
  };
}

function mergeRows(
  subjects: WorkforceAccessSubjectSummaryDto[],
  accounts: WorkforceAccountStatusDto[]
): AccessRow[] {
  const accountByEmployeeId = new Map(
    accounts.map((account) => [account.employeeId, account])
  );

  return subjects.map((subject) => ({
    ...subject,
    workforceAccount: accountByEmployeeId.get(subject.employeeId) ?? null,
  }));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRowActivityLabel(account: WorkforceAccountStatusDto | null): string {
  if (!account) {
    return "No invitation sent";
  }

  if (account.lastLoginAt) {
    return `Last sign-in ${formatDateTime(account.lastLoginAt)}`;
  }

  if (account.inviteCreatedAt) {
    return `Invitation created ${formatDateTime(account.inviteCreatedAt)}`;
  }

  return "No recent activity";
}

function getSelectedInviteProfileId(
  profiles: AccessProfileAssignmentSummaryDto[],
  currentInviteProfileId: string | null | undefined
): string {
  if (
    currentInviteProfileId &&
    profiles.some((profile) => profile.id === currentInviteProfileId)
  ) {
    return currentInviteProfileId;
  }

  return (
    profiles.find((profile) => profile.name === "Employee")?.id ??
    profiles[0]?.id ??
    ""
  );
}

function getOverviewCounts(rows: AccessRow[]) {
  return rows.reduce(
    (summary, row) => {
      const state = getAccessDisplayState(row.workforceAccount);
      if (state === "Not invited") {
        summary.notInvited += 1;
      } else if (state === "Invited") {
        summary.invited += 1;
      } else if (state === "Account active") {
        summary.active += 1;
      } else {
        summary.needsReview += 1;
      }

      return summary;
    },
    {
      notInvited: 0,
      invited: 0,
      active: 0,
      needsReview: 0,
    }
  );
}

function matchesAccessFilter(
  row: AccessRow,
  filter: EmployeeAccessFilter | typeof ALL_FILTER
): boolean {
  if (filter === ALL_FILTER) {
    return true;
  }

  const state = getAccessDisplayState(row.workforceAccount);
  if (filter === "NotInvited") {
    return state === "Not invited";
  }

  if (filter === "Invited") {
    return state === "Invited";
  }

  if (filter === "AccountActive") {
    return state === "Account active";
  }

  return state === "Needs review";
}

function matchesProfileFilter(row: AccessRow, profileId: string): boolean {
  if (profileId === ALL_FILTER) {
    return true;
  }

  return (
    row.workforceAccount?.accessProfiles.some(
      (profile: AccessProfileAssignmentSummaryDto) => profile.id === profileId
    ) ??
    false
  );
}

function AccessOverviewCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 py-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function AccessPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useApiQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [accessFilter, setAccessFilter] = useState<
    EmployeeAccessFilter | typeof ALL_FILTER
  >(ALL_FILTER);
  const [profileFilter, setProfileFilter] = useState(ALL_FILTER);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [inviteProfileId, setInviteProfileId] = useState("");

  const canViewAccess = canAccessCoreAccess(user);
  const canManageAccess = canManageCoreAccess(user);
  const canManageProfiles = canManageCoreAccessProfiles(user);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch]);

  const {
    data: accessProfiles = [],
    isLoading: isProfilesLoading,
  } = useAccessProfiles(canViewAccess || canManageAccess || canManageProfiles);

  const accessSubjectsQuery = useAccessSubjects(
    {
      search: deferredSearch,
      page,
      pageSize,
    },
    canViewAccess
  );

  const statusSubjects = useMemo(
    () => (accessSubjectsQuery.data?.items ?? []).map(buildStatusSubject),
    [accessSubjectsQuery.data?.items]
  );

  const statusQuery = useWorkforceAccountStatuses(statusSubjects);
  const statuses = statusQuery.data ?? [];

  const rows = useMemo(
    () => mergeRows(accessSubjectsQuery.data?.items ?? [], statuses),
    [accessSubjectsQuery.data?.items, statuses]
  );

  const overview = useMemo(() => getOverviewCounts(rows), [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          matchesAccessFilter(row, accessFilter) &&
          matchesProfileFilter(row, profileFilter)
      ),
    [accessFilter, profileFilter, rows]
  );

  const selectedRow = useMemo(
    () => rows.find((row) => row.employeeId === selectedEmployeeId) ?? null,
    [rows, selectedEmployeeId]
  );

  useEffect(() => {
    if (!selectedRow) {
      return;
    }

    setSelectedProfileIds(
      selectedRow.workforceAccount?.accessProfiles.map(
        (profile: AccessProfileAssignmentSummaryDto) => profile.id
      ) ??
        []
    );
    setInviteProfileId(
      getSelectedInviteProfileId(
        accessProfiles,
        selectedRow.workforceAccount?.accessProfiles[0]?.id
      )
    );
  }, [accessProfiles, selectedRow]);

  const provisionInvite = useProvisionWorkforceAccountInvite();
  const resendInvite = useResendWorkforceAccountInvite();
  const reactivateAccount = useReactivateWorkforceAccount();
  const deactivateAccount = useDeactivateWorkforceAccount();
  const setUserAccessProfiles = useSetUserAccessProfiles();

  const isMutating =
    provisionInvite.isLoading ||
    resendInvite.isLoading ||
    reactivateAccount.isLoading ||
    deactivateAccount.isLoading ||
    setUserAccessProfiles.isLoading;

  const refreshWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: coreWorkforceQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: employeeRosterQueryKeys.workforceAccounts() }),
      queryClient.invalidateQueries({ queryKey: coreAccessQueryKeys.profiles() }),
    ]);
  };

  const copyInviteLink = async (account: WorkforceAccountStatusDto | null) => {
    if (!account?.inviteLink) {
      toast({
        title: "Invite link unavailable",
        description: "This person does not have a pending invite link to copy.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(account.inviteLink);
      toast({
        title: "Invite link copied",
        description: "The invite link is now on your clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access is not available in this browser session.",
        variant: "destructive",
      });
    }
  };

  const handleInvite = async () => {
    if (!selectedRow || !inviteProfileId) {
      return;
    }

    try {
      await provisionInvite.mutateAsync({
        employeeId: selectedRow.employeeId,
        email: selectedRow.workEmail,
        firstName: selectedRow.firstName,
        lastName: selectedRow.lastName,
        accessProfileId: inviteProfileId,
      });
      await refreshWorkspace();
      toast({
        title: "Invitation sent",
        description: `${selectedRow.displayName} now has an access invitation.`,
      });
    } catch (error) {
      toast({
        title: "Invitation failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleResend = async () => {
    if (!selectedRow) {
      return;
    }

    try {
      await resendInvite.mutateAsync({ employeeId: selectedRow.employeeId });
      await refreshWorkspace();
      toast({
        title: "Invitation updated",
        description: `${selectedRow.displayName}'s invitation was refreshed.`,
      });
    } catch (error) {
      toast({
        title: "Resend failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleReactivate = async () => {
    if (!selectedRow) {
      return;
    }

    try {
      await reactivateAccount.mutateAsync({ employeeId: selectedRow.employeeId });
      await refreshWorkspace();
      toast({
        title: "Account reactivated",
        description: `${selectedRow.displayName}'s account is active again.`,
      });
    } catch (error) {
      toast({
        title: "Reactivate failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDeactivate = async () => {
    if (!selectedRow) {
      return;
    }

    try {
      await deactivateAccount.mutateAsync({ employeeId: selectedRow.employeeId });
      await refreshWorkspace();
      toast({
        title: "Account deactivated",
        description: `${selectedRow.displayName}'s sign-in has been disabled.`,
      });
    } catch (error) {
      toast({
        title: "Deactivate failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleSaveProfiles = async () => {
    if (!selectedRow?.workforceAccount?.userId) {
      return;
    }

    try {
      await setUserAccessProfiles.mutateAsync({
        userId: selectedRow.workforceAccount.userId,
        input: { accessProfileIds: selectedProfileIds },
      });
      await refreshWorkspace();
      toast({
        title: "Profiles updated",
        description: `${selectedRow.displayName}'s access profiles were saved.`,
      });
    } catch (error) {
      toast({
        title: "Profile update failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const toggleProfile = (profileId: string, checked: boolean) => {
    setSelectedProfileIds((current) => {
      if (checked) {
        return current.includes(profileId) ? current : [...current, profileId];
      }

      return current.filter((item) => item !== profileId);
    });
  };

  if (isLoading || (canViewAccess && accessSubjectsQuery.isLoading)) {
    return (
      <CorePageLoadingState
        title="Access"
        description="Manage account activation and access profiles for linked workforce records."
        message="Loading access workspace"
        variant="workspace"
      />
    );
  }

  if (!canViewAccess && !canManageProfiles) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Access"
          description="Manage account activation and access profiles for linked workforce records."
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
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Access"
        description="Manage account activation and access profiles for linked workforce records."
        actions={
          canManageProfiles ? (
            <Button asChild variant="outline">
              <Link href="/settings?tab=access-profiles">
                <Settings2 className="size-4" />
                Access profiles
              </Link>
            </Button>
          ) : null
        }
      />

      {canManageProfiles ? (
        <Card>
          <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Profile definition stays in Settings</p>
              <p className="text-sm text-muted-foreground">
                Use this workspace for day-to-day access operations and Settings for profile design.
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/settings?tab=access-profiles">
                <ShieldCheck className="size-4" />
                Open access profiles
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canViewAccess ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AccessOverviewCard
              title="Not invited"
              value={overview.notInvited}
              description="Current search results with no account invite yet."
            />
            <AccessOverviewCard
              title="Invite pending"
              value={overview.invited}
              description="Pending access invitations on the current page."
            />
            <AccessOverviewCard
              title="Active accounts"
              value={overview.active}
              description="People with an active linked sign-in account."
            />
            <AccessOverviewCard
              title="Needs review"
              value={overview.needsReview}
              description="Expired, inactive, conflicting, or follow-up states."
            />
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="w-full lg:max-w-sm">
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by name, email, or employee number"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select
                  value={accessFilter}
                  onValueChange={(value) =>
                    setAccessFilter(value as EmployeeAccessFilter | typeof ALL_FILTER)
                  }
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Access state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All access states</SelectItem>
                    {EMPLOYEE_ACCESS_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={profileFilter} onValueChange={setProfileFilter}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Access profile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All access profiles</SelectItem>
                    {accessProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {accessSubjectsQuery.error ? (
            <Alert variant="destructive">
              <AlertTitle>Failed to load access subjects</AlertTitle>
              <AlertDescription>
                {accessSubjectsQuery.error.message || "An unexpected error occurred."}
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>People access list</CardTitle>
                <CardDescription>
                  Search current workforce records, review account state, and manage access actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Employee status</TableHead>
                      <TableHead>Access state</TableHead>
                      <TableHead>Profiles</TableHead>
                      <TableHead>Last activity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusQuery.isFetching && rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Spinner className="size-4" />
                            Loading account status
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No people matched the current search and filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((row) => {
                        const accessState = getAccessDisplayState(row.workforceAccount);
                        return (
                          <TableRow key={row.employeeId}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{row.displayName}</p>
                                <p className="text-xs text-muted-foreground">{row.workEmail}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.isActive ? "secondary" : "outline"}>
                                {row.employmentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getAccessBadgeTone(accessState)}>
                                {accessState}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {row.workforceAccount?.accessProfiles.length ? (
                                  row.workforceAccount.accessProfiles.map((profile) => (
                                    <Badge key={profile.id} variant="outline">
                                      {profile.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">None assigned</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {getRowActivityLabel(row.workforceAccount)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedEmployeeId(row.employeeId)}
                              >
                                Manage
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  totalCount={accessSubjectsQuery.data?.totalCount ?? 0}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Operational access is restricted</AlertTitle>
          <AlertDescription>
            You can manage access profile definitions, but this workspace does not include invitation or account operations.
          </AlertDescription>
        </Alert>
      )}

      <Sheet
        open={!!selectedEmployeeId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEmployeeId(null);
          }
        }}
      >
        <SheetContent className="sm:max-w-xl">
          {selectedRow ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedRow.displayName}</SheetTitle>
                <SheetDescription>
                  Review account activation, invitation state, and access profile assignment.
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 px-4 pb-4">
                <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Work email</p>
                    <p className="mt-1 text-sm font-medium">{selectedRow.workEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Employee status</p>
                    <p className="mt-1 text-sm font-medium">{selectedRow.employmentStatus}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Access state</p>
                    <p className="mt-1 text-sm font-medium">
                      {getAccessDisplayState(selectedRow.workforceAccount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest activity</p>
                    <p className="mt-1 text-sm font-medium">
                      {getRowActivityLabel(selectedRow.workforceAccount)}
                    </p>
                  </div>
                </div>

                {selectedRow.workforceAccount?.userId && canManageAccess ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Assigned access profiles</CardTitle>
                      <CardDescription>
                        Effective access combines all assigned profiles.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {accessProfiles.map((profile) => {
                        const checked = selectedProfileIds.includes(profile.id);
                        return (
                          <label
                            key={profile.id}
                            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleProfile(profile.id, value === true)
                              }
                            />
                            <span className="space-y-1">
                              <span className="font-medium">{profile.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {profile.type === "SystemSeeded" ? "System" : "Custom"}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </CardContent>
                  </Card>
                ) : null}

                {!selectedRow.workforceAccount?.userId && canManageAccess ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Invitation profile</CardTitle>
                      <CardDescription>
                        Choose the initial access profile to apply when this invitation is accepted.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Select value={inviteProfileId} onValueChange={setInviteProfileId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an access profile" />
                        </SelectTrigger>
                        <SelectContent>
                          {accessProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ) : null}

                {selectedRow.workforceAccount?.conflict ? (
                  <Alert variant="destructive">
                    <AlertTitle>Needs review</AlertTitle>
                    <AlertDescription>
                      {selectedRow.workforceAccount.conflict.message}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <SheetFooter>
                <div className="flex flex-wrap gap-2">
                  {canManageAccess && !selectedRow.workforceAccount?.userId ? (
                    <Button
                      onClick={handleInvite}
                      disabled={!inviteProfileId || isMutating}
                    >
                      {provisionInvite.isLoading ? (
                        <Spinner className="size-4" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Send invite
                    </Button>
                  ) : null}

                  {canManageAccess &&
                  getInvitationEligibility(selectedRow.workforceAccount).canResend ? (
                    <Button
                      variant="outline"
                      onClick={handleResend}
                      disabled={isMutating}
                    >
                      {resendInvite.isLoading ? (
                        <Spinner className="size-4" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Resend invite
                    </Button>
                  ) : null}

                  {getInvitationEligibility(selectedRow.workforceAccount).canCopyInviteLink ? (
                    <Button
                      variant="outline"
                      onClick={() => copyInviteLink(selectedRow.workforceAccount)}
                    >
                      <Copy className="size-4" />
                      Copy invite link
                    </Button>
                  ) : null}

                  {canManageAccess && selectedRow.workforceAccount?.userId ? (
                    <Button
                      variant="secondary"
                      onClick={handleSaveProfiles}
                      disabled={isMutating}
                    >
                      {setUserAccessProfiles.isLoading ? (
                        <Spinner className="size-4" />
                      ) : (
                        <UserCog className="size-4" />
                      )}
                      Save profiles
                    </Button>
                  ) : null}

                  {canManageAccess && getInvitationEligibility(selectedRow.workforceAccount).canReactivate ? (
                    <Button variant="outline" onClick={handleReactivate} disabled={isMutating}>
                      {reactivateAccount.isLoading ? (
                        <Spinner className="size-4" />
                      ) : (
                        <KeyRound className="size-4" />
                      )}
                      Reactivate
                    </Button>
                  ) : null}

                  {canManageAccess && getInvitationEligibility(selectedRow.workforceAccount).canDeactivate ? (
                    <Button variant="outline" onClick={handleDeactivate} disabled={isMutating}>
                      {deactivateAccount.isLoading ? (
                        <Spinner className="size-4" />
                      ) : (
                        <Mail className="size-4" />
                      )}
                      Deactivate
                    </Button>
                  ) : null}
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}