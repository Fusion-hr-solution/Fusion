"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useApiQueryClient } from "@repo/api/query";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { employeeRosterQueryKeys } from "@/app/(pages)/employees/employee-query-keys";
import {
  useProvisionWorkforceAccountInvite,
  useResendWorkforceAccountInvite,
  useSetPendingInviteAccessProfiles,
  useWorkforceAccountStatus,
} from "@/app/(pages)/employees/use-workforce-accounts";
import {
  useAccessProfiles,
  useSetUserAccessProfiles,
} from "@/features/access/api/use-core-access";
import {
  getAccessActionErrorMessage,
  getInviteSuccessMessage,
  getNeedsReviewNextStep,
  getNeedsReviewReason,
  getResendSuccessMessage,
  resolveSheetModeForAccount,
  type EmployeeAccessSheetMode,
} from "@/features/access/components/access-action-helpers";
import {
  getAccessBadgeTone,
  getAccessDisplayState,
  getPrimaryAccessProfile,
  getSuggestedInviteRole,
} from "@/features/access/shared/employee-access";

interface EmployeeAccessManagementSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  directReportCount: number;
  canManageAccess?: boolean;
  canManageProfiles?: boolean;
  profilesHref?: string;
  initialMode?: EmployeeAccessSheetMode;
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

function DetailFact({
  label,
  value,
  supporting,
}: {
  label: string;
  value: ReactNode;
  supporting?: string | null;
}) {
  return (
    <div className="rounded-lg border bg-muted/15 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium">{value}</div>
      {supporting ? (
        <p className="mt-1 text-xs text-muted-foreground">{supporting}</p>
      ) : null}
    </div>
  );
}

function ProfileValue({
  profile,
  emptyLabel = "Not set",
}: {
  profile: { id: string; name: string } | null | undefined;
  emptyLabel?: string;
}) {
  if (!profile) {
    return (
      <span className="font-normal text-muted-foreground">{emptyLabel}</span>
    );
  }

  return <span>{profile.name}</span>;
}

function AccessDialogLoadingState({
  open,
  onOpenChange,
  title,
}: Pick<EmployeeAccessManagementSheetProps, "open" | "onOpenChange"> & {
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Loading access details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 p-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-44 rounded-lg" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getSheetTitle(
  mode: EmployeeAccessSheetMode,
  canManageAccess: boolean
): string {
  if (!canManageAccess) {
    return "View access";
  }

  switch (mode) {
    case "invite":
      return "Send invite";
    case "profile":
    case "pending":
      return "Update access profile";
    default:
      return "Needs review";
  }
}

function getSheetSubtitle(
  mode: EmployeeAccessSheetMode,
  canManageAccess: boolean
): string {
  if (!canManageAccess) {
    return "Review current access details for this person.";
  }

  switch (mode) {
    case "invite":
      return "This will create an activation invitation for this person.";
    case "profile":
    case "pending":
      return "This changes what the user can access in Core.";
    default:
      return "Review the issue before continuing.";
  }
}

export function EmployeeAccessManagementSheet({
  open,
  onOpenChange,
  employeeId,
  displayName,
  email,
  firstName,
  lastName,
  directReportCount,
  canManageAccess = true,
  canManageProfiles = false,
  profilesHref = "",
  initialMode,
}: EmployeeAccessManagementSheetProps) {
  const queryClient = useApiQueryClient();
  const {
    data: account,
    error,
    isLoading,
  } = useWorkforceAccountStatus({
    employeeId,
    email,
    firstName,
    lastName,
  });
  const { data: accessProfiles = [], isLoading: isProfilesLoading } =
    useAccessProfiles(open);
  const setUserAccessProfiles = useSetUserAccessProfiles({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: employeeRosterQueryKeys.workforceAccount(employeeId),
        exact: true,
      });
    },
  });
  const setPendingInviteAccessProfiles = useSetPendingInviteAccessProfiles();
  const provisionInvite = useProvisionWorkforceAccountInvite();
  const resendInvite = useResendWorkforceAccountInvite();
  const [selectedInviteProfileId, setSelectedInviteProfileId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const currentPrimaryProfile = getPrimaryAccessProfile(
      account?.accessProfiles ?? []
    );

    setActionError(null);
    setSelectedProfileId(
      currentPrimaryProfile?.id ??
        getSuggestedAccessProfileId(accessProfiles, directReportCount) ??
        ""
    );
    setSelectedInviteProfileId(
      getSuggestedAccessProfileId(
        accessProfiles,
        directReportCount,
        currentPrimaryProfile?.id
      ) ?? ""
    );
  }, [accessProfiles, account?.accessProfiles, directReportCount, open]);

  const hasBlockingLoadError = !!error && !account;
  const isInitialLoading = open && isLoading && !account && !error;
  const accessState =
    hasBlockingLoadError
      ? "Access unavailable"
      : getAccessDisplayState(account ?? null);
  const stateTone =
    hasBlockingLoadError ? "outline" : getAccessBadgeTone(accessState);
  const mode =
    isInitialLoading && initialMode
      ? initialMode
      : resolveSheetModeForAccount(
          account ?? null,
          initialMode,
          hasBlockingLoadError
        );
  const sheetTitle = getSheetTitle(mode, canManageAccess);
  const sheetSubtitle = getSheetSubtitle(mode, canManageAccess);
  const currentPrimaryProfile = useMemo(
    () => getPrimaryAccessProfile(account?.accessProfiles ?? []),
    [account?.accessProfiles]
  );
  const currentProfileId = currentPrimaryProfile?.id ?? "";
  const isPendingAccount = account?.provisioningState === "InvitePending";
  const hasProfileChanges =
    !!selectedProfileId &&
    selectedProfileId !== currentProfileId;
  const canInviteWithEmail = email.trim().length > 0;

  async function handleInvite() {
    if (!selectedInviteProfileId) {
      setActionError("Select an access profile before continuing.");
      return;
    }

    setActionError(null);

    try {
      const nextAccount = await provisionInvite.mutateAsync({
        employeeId,
        email,
        firstName,
        lastName,
        accessProfileId: selectedInviteProfileId,
      });
      toast.success(getInviteSuccessMessage(nextAccount));
      onOpenChange(false);
    } catch (inviteError) {
      setActionError(getAccessActionErrorMessage("sendInvite", inviteError));
    }
  }

  async function handleResend() {
    setActionError(null);

    try {
      const nextAccount = await resendInvite.mutateAsync({ employeeId });
      toast.success(getResendSuccessMessage(nextAccount));
    } catch (resendError) {
      setActionError(getAccessActionErrorMessage("resendInvite", resendError));
    }
  }

  async function handleSaveProfiles() {
    if (!selectedProfileId) {
      setActionError("Select an access profile before continuing.");
      return;
    }

    setActionError(null);

    try {
      if (isPendingAccount) {
        await setPendingInviteAccessProfiles.mutateAsync({
          employeeId,
          accessProfileIds: [selectedProfileId],
        });
      } else if (account?.userId) {
        await setUserAccessProfiles.mutateAsync({
          userId: account.userId,
          input: { accessProfileIds: [selectedProfileId] },
        });
      } else {
        setActionError("A linked account is required before changing access profiles.");
        return;
      }
      toast.success("Access profile updated");
      onOpenChange(false);
    } catch (profileError) {
      setActionError(
        getAccessActionErrorMessage("updateAccessProfile", profileError)
      );
    }
  }

  async function handleCopyInviteLink() {
    if (!account?.inviteLink) {
      setActionError("Invite link could not be copied.");
      return;
    }

    setActionError(null);

    try {
      await navigator.clipboard.writeText(account.inviteLink);
      toast.success("Invite link copied");
    } catch (copyError) {
      setActionError(
        getAccessActionErrorMessage("copyInviteLink", copyError)
      );
    }
  }

  if (isInitialLoading) {
    const loadingTitle = initialMode
      ? getSheetTitle(initialMode, canManageAccess)
      : canManageAccess
        ? "Manage access"
        : "View access";

    return (
      <AccessDialogLoadingState
        open={open}
        onOpenChange={onOpenChange}
        title={loadingTitle}
      />
    );
  }

  const reviewNextStep = getNeedsReviewNextStep(account ?? null);

  if (mode === "invite" && canManageAccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send invite</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block font-medium text-foreground">
                {displayName}
              </span>
              <span className="block break-all">{email}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionError ? (
              <Alert variant="destructive">
                <AlertTitle>Invitation could not be created</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
              <p className="text-sm font-medium">Access profile</p>

              {isProfilesLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : accessProfiles.length > 0 ? (
                <Select
                  value={selectedInviteProfileId}
                  onValueChange={setSelectedInviteProfileId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Access profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No access profiles are available right now.
                </p>
              )}

              {canManageProfiles && profilesHref ? (
                <Link
                  href={profilesHref}
                  className="block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Manage access profiles
                </Link>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={provisionInvite.isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleInvite()}
              disabled={
                !canInviteWithEmail ||
                !selectedInviteProfileId ||
                accessProfiles.length === 0 ||
                provisionInvite.isLoading
              }
            >
              {provisionInvite.isLoading ? "Sending..." : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if ((mode === "profile" || mode === "pending") && canManageAccess) {
    const isSaving = isPendingAccount
      ? setPendingInviteAccessProfiles.isLoading
      : setUserAccessProfiles.isLoading;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update access profile</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block font-medium text-foreground">
                {displayName}
              </span>
              <span className="block break-all">{email}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionError ? (
              <Alert variant="destructive">
                <AlertTitle>Access profile could not be updated</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}

            <DetailFact
              label="Current access profile"
              value={
                <ProfileValue
                  profile={currentPrimaryProfile}
                  emptyLabel="Not set"
                />
              }
            />

            <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
              <p className="text-sm font-medium">New access profile</p>

              {isProfilesLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : accessProfiles.length > 0 ? (
                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Access profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No access profiles are available right now.
                </p>
              )}

              {canManageProfiles && profilesHref ? (
                <Link
                  href={profilesHref}
                  className="block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Manage access profiles
                </Link>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveProfiles()}
              disabled={
                !hasProfileChanges ||
                accessProfiles.length === 0 ||
                !selectedProfileId ||
                isSaving
              }
            >
              {isSaving ? "Saving..." : "Update access profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-start gap-2">
              <DialogTitle className="min-w-0 text-lg">
                {sheetTitle}
              </DialogTitle>
              <Badge variant={stateTone}>{accessState}</Badge>
            </div>
            <DialogDescription className="space-y-1">
              <span className="block font-medium text-foreground">
                {displayName}
              </span>
              <span className="block break-all">{email}</span>
              <span className="block">{sheetSubtitle}</span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {hasBlockingLoadError ? (
            <Alert variant="destructive">
              <AlertTitle>Access details couldn&apos;t be loaded</AlertTitle>
              <AlertDescription>
                Something went wrong. Try again in a moment.
              </AlertDescription>
            </Alert>
          ) : null}

          {actionError ? (
            <Alert variant="destructive">
              <AlertTitle>Access action failed</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          {!hasBlockingLoadError ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <DetailFact
                  label="Account state"
                  value={<Badge variant={stateTone}>{accessState}</Badge>}
                />
                <DetailFact
                  label="Access profile"
                  value={<ProfileValue profile={currentPrimaryProfile} />}
                />
                <DetailFact
                  label="Latest activity"
                  value={
                    account?.lastLoginAt
                      ? new Date(account.lastLoginAt).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )
                      : "—"
                  }
                />
              </div>

              {mode === "review" ? (
                <section className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Needs review</h2>
                    <p className="text-sm text-muted-foreground">
                      Review the issue before taking the next step.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailFact
                      label="Issue"
                      value={getNeedsReviewReason(account ?? null)}
                    />
                    <DetailFact label="Next step" value={reviewNextStep} />
                  </div>
                </section>
              ) : null}

              {canManageAccess &&
              (account?.inviteLink ||
                account?.provisioningState === "InvitePending") ? (
                <section className="space-y-4 rounded-lg border bg-muted/10 p-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Available actions</h2>
                    <p className="text-sm text-muted-foreground">
                      Use the safest next step available for this access issue.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {account?.inviteLink ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleCopyInviteLink()}
                      >
                        Copy invite link
                      </Button>
                    ) : null}
                    {account?.provisioningState === "InvitePending" ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleResend()}
                        disabled={resendInvite.isLoading}
                      >
                        {resendInvite.isLoading
                          ? "Resending..."
                          : "Resend invite"}
                      </Button>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
