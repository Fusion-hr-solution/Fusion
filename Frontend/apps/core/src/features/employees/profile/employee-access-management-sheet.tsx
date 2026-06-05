"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useApiQueryClient } from "@repo/api/query";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { employeeRosterQueryKeys } from "@/app/(pages)/employees/employee-query-keys";
import { EmployeeConfirmDialog } from "@/app/(pages)/employees/employee-confirm-dialog";
import type { WorkforceAccountStatusDto } from "@/app/(pages)/employees/employee-roster.types";
import {
  useDeactivateWorkforceAccount,
  useProvisionWorkforceAccountInvite,
  useReactivateWorkforceAccount,
  useResendWorkforceAccountInvite,
  useWorkforceAccountStatus,
} from "@/app/(pages)/employees/use-workforce-accounts";
import {
  useAccessProfiles,
  useSetUserAccessProfiles,
} from "@/features/access/api/use-core-access";
import {
  getAccessBadgeTone,
  getAccessDisplayState,
  getInvitationEligibility,
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
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "Not set";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not set";
  }

  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();

  return normalizedLeft.every(
    (value, index) => value === normalizedRight[index]
  );
}

function toggleProfileSelection(ids: string[], profileId: string): string[] {
  return ids.includes(profileId)
    ? ids.filter((id) => id !== profileId)
    : [...ids, profileId];
}

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "An unexpected error occurred.";
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

function getSecondaryState(
  account: WorkforceAccountStatusDto | null
): string | null {
  if (!account) {
    return null;
  }

  switch (account.provisioningState) {
    case "InvitePending":
      return account.deliveryStatus === "Failed"
        ? "Email failed"
        : "Awaiting activation";
    case "InviteExpired":
      return "Invite expired";
    case "InviteRevoked":
      return "Invite revoked";
    case "InviteAccepted":
      return "Invite accepted";
    case "Inactive":
      return "Account linked";
    case "Conflict":
      return account.conflict?.message ?? "Conflict detected";
    default:
      return null;
  }
}

function getDeliveryLabel(
  deliveryStatus: WorkforceAccountStatusDto["deliveryStatus"]
): string {
  switch (deliveryStatus) {
    case "Failed":
      return "Email failed";
    case "Sent":
      return "Email sent";
    default:
      return "Not attempted";
  }
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

function ProfileBadges({
  profiles,
}: {
  profiles: Array<{ id: string; name: string }>;
}) {
  if (profiles.length === 0) {
    return (
      <span className="font-normal text-muted-foreground">Not assigned</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {profiles.map((profile) => (
        <Badge key={profile.id} variant="secondary">
          {profile.name}
        </Badge>
      ))}
    </div>
  );
}

function AccessSheetSkeleton({
  open,
  onOpenChange,
}: Pick<EmployeeAccessManagementSheetProps, "open" | "onOpenChange">) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Manage access</SheetTitle>
          <SheetDescription>Loading access details.</SheetDescription>
        </SheetHeader>
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
      </SheetContent>
    </Sheet>
  );
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
  const provisionInvite = useProvisionWorkforceAccountInvite();
  const resendInvite = useResendWorkforceAccountInvite();
  const reactivateAccount = useReactivateWorkforceAccount();
  const deactivateAccount = useDeactivateWorkforceAccount();
  const [selectedInviteProfileId, setSelectedInviteProfileId] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActionError(null);
    setSelectedProfileIds(
      account?.accessProfiles.map((profile) => profile.id) ?? []
    );
    setSelectedInviteProfileId(
      getSuggestedAccessProfileId(
        accessProfiles,
        directReportCount,
        account?.accessProfiles[0]?.id
      ) ?? ""
    );
  }, [accessProfiles, account?.accessProfiles, directReportCount, open]);

  const eligibility = getInvitationEligibility(account ?? null);
  const accessState =
    error && !account
      ? "Access unavailable"
      : getAccessDisplayState(account ?? null);
  const stateTone =
    error && !account ? "outline" : getAccessBadgeTone(accessState);
  const currentProfileIds = useMemo(
    () => account?.accessProfiles.map((profile) => profile.id) ?? [],
    [account?.accessProfiles]
  );
  const hasProfileChanges =
    !!account?.userId &&
    !areStringArraysEqual(selectedProfileIds, currentProfileIds);
  const canInviteWithEmail = email.trim().length > 0;

  async function handleInvite() {
    if (!selectedInviteProfileId) {
      setActionError("Select an access profile before sending the invitation.");
      return;
    }

    setActionError(null);

    try {
      await provisionInvite.mutateAsync({
        employeeId,
        email,
        firstName,
        lastName,
        accessProfileId: selectedInviteProfileId,
      });
      toast.success("Invite sent.");
    } catch (inviteError) {
      setActionError(getActionErrorMessage(inviteError));
    }
  }

  async function handleResend() {
    setActionError(null);

    try {
      await resendInvite.mutateAsync({ employeeId });
      toast.success("Invite resent.");
    } catch (resendError) {
      setActionError(getActionErrorMessage(resendError));
    }
  }

  async function handleSaveProfiles() {
    if (!account?.userId) {
      setActionError(
        "A linked account is required before changing access profiles."
      );
      return;
    }

    setActionError(null);

    try {
      await setUserAccessProfiles.mutateAsync({
        userId: account.userId,
        input: { accessProfileIds: selectedProfileIds },
      });
      toast.success("Access profiles updated.");
    } catch (profileError) {
      setActionError(getActionErrorMessage(profileError));
    }
  }

  async function handleReactivate() {
    setActionError(null);

    try {
      await reactivateAccount.mutateAsync({ employeeId });
      toast.success("Account reactivated.");
    } catch (reactivateError) {
      setActionError(getActionErrorMessage(reactivateError));
    }
  }

  async function handleDeactivate() {
    setActionError(null);

    try {
      await deactivateAccount.mutateAsync({ employeeId });
      toast.success("Account deactivated.");
      setShowDeactivateConfirm(false);
    } catch (deactivateError) {
      setActionError(getActionErrorMessage(deactivateError));
    }
  }

  if (open && isLoading && !account && !error) {
    return <AccessSheetSkeleton open={open} onOpenChange={onOpenChange} />;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b px-6 pb-4 pt-6 pr-14">
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-2">
                <SheetTitle className="min-w-0 text-lg">
                  Manage access
                </SheetTitle>
                <Badge variant={stateTone}>{accessState}</Badge>
              </div>
              <SheetDescription className="space-y-1">
                <span className="block font-medium text-foreground">
                  {displayName}
                </span>
                <span className="block break-all">{email}</span>
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>
                    Access details couldn&apos;t be loaded
                  </AlertTitle>
                  <AlertDescription>
                    Something went wrong. Try again in a moment.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-3 md:grid-cols-3">
                <DetailFact
                  label="Account state"
                  value={<Badge variant={stateTone}>{accessState}</Badge>}
                  supporting={getSecondaryState(account ?? null)}
                />
                <DetailFact
                  label="Assigned profiles"
                  value={
                    <ProfileBadges profiles={account?.accessProfiles ?? []} />
                  }
                />
                <DetailFact
                  label="Last sign-in"
                  value={formatTimestamp(account?.lastLoginAt)}
                />
              </div>

              {account?.conflict ? (
                <Alert
                  variant={
                    account.conflict.blocking ? "destructive" : "default"
                  }
                >
                  <AlertTitle>
                    {account.conflict.blocking
                      ? "Account conflict"
                      : "Account warning"}
                  </AlertTitle>
                  <AlertDescription>
                    <p>{account.conflict.message}</p>
                    {account.conflict.suggestedAction ? (
                      <p className="mt-1">{account.conflict.suggestedAction}</p>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              {actionError ? (
                <Alert variant="destructive">
                  <AlertTitle>Access action failed</AlertTitle>
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              ) : null}

              {eligibility.canInvite ? (
                <section className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Send invite</h2>
                    {!canInviteWithEmail ? (
                      <p className="text-sm text-muted-foreground">
                        Add a work email before an invite can be sent.
                      </p>
                    ) : null}
                  </div>

                  {canInviteWithEmail ? (
                    <>
                      {isProfilesLoading ? (
                        <Skeleton className="h-10 w-full rounded-lg" />
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

                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void handleInvite()}
                          disabled={
                            !canInviteWithEmail ||
                            !selectedInviteProfileId ||
                            accessProfiles.length === 0 ||
                            provisionInvite.isLoading
                          }
                        >
                          {provisionInvite.isLoading
                            ? "Sending..."
                            : "Send invite"}
                        </Button>
                      </div>
                    </>
                  ) : null}
                </section>
              ) : null}

              {eligibility.canResend ? (
                <section className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Invitation status</h2>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <DetailFact
                      label="Invite created"
                      value={formatTimestamp(account?.inviteCreatedAt)}
                    />
                    <DetailFact
                      label="Invite expires"
                      value={formatTimestamp(account?.inviteExpiresAt)}
                    />
                    <DetailFact
                      label="Delivery"
                      value={getDeliveryLabel(account?.deliveryStatus ?? null)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleResend()}
                      disabled={resendInvite.isLoading}
                    >
                      {resendInvite.isLoading
                        ? "Resending..."
                        : "Resend invite"}
                    </Button>
                  </div>
                </section>
              ) : null}

              {account?.userId &&
              account?.provisioningState !== "InvitePending" ? (
                <section className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Access profiles</h2>
                  </div>

                  {isProfilesLoading ? (
                    <Skeleton className="h-24 w-full rounded-lg" />
                  ) : accessProfiles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {accessProfiles.map((profile) => {
                        const isSelected = selectedProfileIds.includes(
                          profile.id
                        );

                        return (
                          <Button
                            key={profile.id}
                            type="button"
                            size="sm"
                            variant={isSelected ? "secondary" : "outline"}
                            onClick={() =>
                              setSelectedProfileIds((current) =>
                                toggleProfileSelection(current, profile.id)
                              )
                            }
                          >
                            {profile.name}
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No access profiles are available right now.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void handleSaveProfiles()}
                      disabled={
                        !hasProfileChanges || setUserAccessProfiles.isLoading
                      }
                    >
                      {setUserAccessProfiles.isLoading
                        ? "Saving..."
                        : "Save profiles"}
                    </Button>
                  </div>
                </section>
              ) : null}

              {eligibility.canReactivate || eligibility.canDeactivate ? (
                <section className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Account actions</h2>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {eligibility.canReactivate ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleReactivate()}
                        disabled={reactivateAccount.isLoading}
                      >
                        {reactivateAccount.isLoading
                          ? "Reactivating..."
                          : "Reactivate account"}
                      </Button>
                    ) : null}
                    {eligibility.canDeactivate ? (
                      <Button
                        variant="outline"
                        onClick={() => setShowDeactivateConfirm(true)}
                        disabled={deactivateAccount.isLoading}
                      >
                        {deactivateAccount.isLoading
                          ? "Deactivating..."
                          : "Deactivate account"}
                      </Button>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EmployeeConfirmDialog
        open={showDeactivateConfirm}
        onOpenChange={setShowDeactivateConfirm}
        title="Deactivate account?"
        description="This blocks sign-in until the account is reactivated."
        confirmLabel="Deactivate account"
        confirmVariant="destructive"
        loading={deactivateAccount.isLoading}
        loadingLabel="Deactivating..."
        onConfirm={() => void handleDeactivate()}
      />
    </>
  );
}
