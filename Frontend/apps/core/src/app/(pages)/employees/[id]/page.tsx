"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Hash,
  Mail,
  Phone,
  ShieldAlert,
  Star,
  User,
  Users,
} from "lucide-react";
import {
  canAccessCoreAccess,
  canManageCoreEmployees,
  useAuth,
} from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { useTenantContext } from "@/components/core-tenant-context-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useBreadcrumbLabel } from "@/components/breadcrumb-overrides";
import {
  canAccessEmployeeProfile,
  canAccessEmployeeRoster,
} from "@/lib/employee-roster-access";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { useTenantSettings } from "../../setup/draft-structure/use-tenant-settings";
import { useEmployeeFieldPolicy } from "../employee-field-visibility";
import {
  getEmployeeActionIssues,
  getEmployeeFixSheet,
} from "../employee-readiness";
import {
  getAccessBadgeTone,
  getAccessDisplayState,
  getInvitationEligibility,
  getSuggestedInviteRole,
} from "../employee-access";
import {
  EmployeeEmploymentEditSheet,
  EmployeeIdentityEditSheet,
  EmployeeOrganizationEditSheet,
  EmployeeStatusSheet,
} from "./employee-profile-workspace-sheets";
import { EmployeeReportingLinesSheet } from "../employee-reporting-lines-sheet";
import {
  useEmployeeProfile,
  useEmployeeReportingLines,
  useUpdateMyProfile,
} from "../use-employees";
import {
  useDeactivateWorkforceAccount,
  useProvisionWorkforceAccountInvite,
  useReactivateWorkforceAccount,
  useResendWorkforceAccountInvite,
  useWorkforceAccountStatus,
} from "../use-workforce-accounts";
import { useAccessProfiles } from "../../settings/use-core-access";
import { useApiQueryClient } from "@repo/api/query";
import { employeeRosterQueryKeys } from "../employee-query-keys";
import type {
  EmployeeHierarchyNodeDto,
  EmployeeHierarchyStatus,
  EmployeeProfileDto,
  WorkforceAccountStatusDto,
} from "../employee-roster.types";

// ── Small display helpers ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: "Active" | "Inactive" }) {
  return (
    <Badge variant={status === "Active" ? "default" : "secondary"}>
      {status}
    </Badge>
  );
}

function HierarchyBadge({ status }: { status: EmployeeHierarchyStatus }) {
  switch (status) {
    case "ManagerInactive":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Manager inactive
        </Badge>
      );
    case "ManagerMissing":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Manager missing
        </Badge>
      );
    case "NoManagerAssigned":
      return <Badge variant="outline">No manager assigned</Badge>;
    default:
      return null;
  }
}

function ChecklistStatusBadge({ status }: { status: "Complete" | "Pending" }) {
  return (
    <Badge variant={status === "Complete" ? "secondary" : "outline"}>
      {status}
    </Badge>
  );
}

const WORKSPACE_CARD_CLASS_NAME = "gap-0 py-0";
const WORKSPACE_CARD_HEADER_CLASS_NAME = "px-5 pb-4 pt-5";
const WORKSPACE_CARD_CONTENT_CLASS_NAME = "space-y-4 px-5 pb-5";

function SnapshotCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className={WORKSPACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="text-sm font-semibold leading-snug">{value}</div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

// ── Pure helpers ───────────────────────────────────────────────────────────

function formatDate(value: string): string {
  if (!value?.trim()) {
    return "Not set";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not set";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getTenure(hireDateIso: string): string {
  if (!hireDateIso?.trim()) return "Not set";

  const hire = new Date(hireDateIso);
  if (Number.isNaN(hire.getTime())) return "Not set";

  const now = new Date();
  const totalMonths =
    (now.getFullYear() - hire.getFullYear()) * 12 +
    (now.getMonth() - hire.getMonth());
  if (totalMonths < 1) return "Less than 1 month";
  if (totalMonths < 12)
    return `${totalMonths} month${totalMonths === 1 ? "" : "s"}`;
  const y = Math.floor(totalMonths / 12);
  return `${y} year${y === 1 ? "" : "s"}`;
}

function formatDirectReportsCount(count: number): string {
  if (count === 0) return "0 direct reports";
  if (count === 1) return "1 direct report";
  return `${count} direct reports`;
}

function hasTextValue(value: string | null | undefined): boolean {
  return !!value?.trim();
}

function getManagerDisplay(profile: {
  managerFullName: string | null;
  managerId: string | null;
  hierarchyStatus: EmployeeHierarchyStatus;
}): string {
  if (hasTextValue(profile.managerFullName)) return profile.managerFullName!;
  if (profile.hierarchyStatus === "Root") return "Top-level leader";
  return profile.managerId ? "Manager record not found" : "No manager assigned";
}

function getManagerChainSummary(
  managerChain: EmployeeHierarchyNodeDto[],
  hierarchyStatus: EmployeeHierarchyStatus
): string {
  if (managerChain.length === 0) {
    return hierarchyStatus === "Root"
      ? "Top-level leader."
      : "No manager chain available.";
  }

  const direct = managerChain[0]?.employee;
  const top = managerChain[managerChain.length - 1]?.employee;
  if (!direct || !top) return "No manager chain available.";
  const directName = `${direct.firstName} ${direct.lastName}`;
  const topName = `${top.firstName} ${top.lastName}`;
  return managerChain.length === 1
    ? `Reports directly to ${directName}.`
    : `${managerChain.length} levels to ${topName}; direct manager is ${directName}.`;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getEmployeeFileChecklist({
  profile,
  showPhone,
}: {
  profile: EmployeeProfileDto;
  showPhone: boolean;
}) {
  const hireDate = new Date(profile.hireDate);
  const hasFutureHireDate =
    !Number.isNaN(hireDate.getTime()) && hireDate.getTime() > Date.now();
  const identityComplete =
    hasTextValue(profile.email) && (!showPhone || hasTextValue(profile.phone));
  const orgAssignmentComplete =
    !!profile.orgUnitId &&
    (profile.hierarchyStatus === "Healthy" ||
      profile.hierarchyStatus === "Root");
  const readinessComplete =
    !profile.readiness.hasEmployeeStateIssues &&
    !profile.readiness.hasBlockingIssues;

  return [
    {
      key: "contract",
      label: "Contract packet",
      detail: hasFutureHireDate
        ? "Start-date paperwork still needs final confirmation."
        : "Core hire date is set and the employment record is live.",
      status: hasFutureHireDate ? "Pending" : "Complete",
    },
    {
      key: "identity",
      label: "Identity verification",
      detail: identityComplete
        ? "Primary contact details are present on the employee file."
        : "Add the remaining contact information to complete the employee file.",
      status: identityComplete ? "Complete" : "Pending",
    },
    {
      key: "organization",
      label: "Organization assignment",
      detail: orgAssignmentComplete
        ? "Org unit and reporting placement are ready for workforce operations."
        : "Assign the employee to an org unit and valid reporting line.",
      status: orgAssignmentComplete ? "Complete" : "Pending",
    },
    {
      key: "readiness",
      label: "Start readiness",
      detail: readinessComplete
        ? "No current record issues are blocking this employee."
        : "Resolve readiness issues before treating this employee as fully operational.",
      status: readinessComplete ? "Complete" : "Pending",
    },
  ] as const;
}

function WorkforceAccountStateBadge({
  account,
}: {
  account: WorkforceAccountStatusDto | null;
}) {
  const displayState = getAccessDisplayState(account);

  return (
    <Badge variant={getAccessBadgeTone(displayState)}>{displayState}</Badge>
  );
}

function getWorkforceDeliveryBadgeVariant(
  deliveryStatus: WorkforceAccountStatusDto["deliveryStatus"]
): "secondary" | "outline" | "destructive" {
  switch (deliveryStatus) {
    case "Failed":
      return "destructive";
    case "Suppressed":
    case "Skipped":
    case "NotAttempted":
      return "outline";
    default:
      return "secondary";
  }
}

function getWorkforceDeliveryBadgeLabel(
  deliveryStatus: WorkforceAccountStatusDto["deliveryStatus"]
): string {
  switch (deliveryStatus) {
    case "Failed":
      return "Email failed";
    case "Suppressed":
    case "Skipped":
      return "Fallback link available";
    case "NotAttempted":
      return "Email not attempted";
    default:
      return "Email sent";
  }
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

function PersonalProfileCard({
  employeeId,
  fullName,
  workEmail,
  phone,
  showPhone,
  preferredName,
  expectedVersion,
  canEditPreferredName,
  canEditPhone,
}: {
  employeeId: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  showPhone: boolean;
  preferredName: string | null;
  expectedVersion: number;
  canEditPreferredName: boolean;
  canEditPhone: boolean;
}) {
  const { tenantId } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const updateMyProfile = useUpdateMyProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [draftPreferredName, setDraftPreferredName] = useState(
    preferredName ?? ""
  );
  const [draftPhone, setDraftPhone] = useState(phone ?? "");
  const [actionError, setActionError] = useState<string | null>(null);
  const canEditAnyField = canEditPreferredName || (showPhone && canEditPhone);

  useEffect(() => {
    setDraftPreferredName(preferredName ?? "");
    setDraftPhone(phone ?? "");
  }, [employeeId, expectedVersion, phone, preferredName]);

  const normalizedDraftPreferredName = draftPreferredName.trim() || null;
  const normalizedDraftPhone = draftPhone.trim() || null;
  const hasPreferredNameChanges =
    canEditPreferredName &&
    (preferredName ?? "") !== (normalizedDraftPreferredName ?? "");
  const hasPhoneChanges =
    showPhone && canEditPhone && (phone ?? "") !== (normalizedDraftPhone ?? "");
  const hasChanges = hasPreferredNameChanges || hasPhoneChanges;

  async function handleSave() {
    setActionError(null);

    try {
      await updateMyProfile.mutateAsync({
        employeeId,
        expectedVersion,
        preferredName: canEditPreferredName
          ? normalizedDraftPreferredName
          : undefined,
        phone: showPhone && canEditPhone ? normalizedDraftPhone : undefined,
      });
      setIsEditing(false);
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    }
  }

  return (
    <Card className={WORKSPACE_CARD_CLASS_NAME}>
      <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
        <CardTitle className="text-base">Personal profile</CardTitle>
        <CardDescription>
          Review your Core profile details and choose the preferred name shown
          in daily use.
        </CardDescription>
        <CardAction>
          {!isEditing && !isTenantContextReadOnly && canEditAnyField ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
        <DetailRow icon={User} label="Full name" value={fullName} />
        <Separator />
        <DetailRow icon={Mail} label="Work email" value={workEmail} />
        {showPhone ? <Separator /> : null}
        {showPhone ? (
          <DetailRow
            icon={Phone}
            label="Phone"
            value={
              phone ? (
                phone
              ) : (
                <span className="font-normal text-muted-foreground">
                  Not set
                </span>
              )
            }
          />
        ) : null}
        <Separator />
        {!isEditing ? (
          <DetailRow
            icon={User}
            label="Preferred name"
            value={
              preferredName ? (
                preferredName
              ) : (
                <span className="font-normal text-muted-foreground">
                  Not set
                </span>
              )
            }
          />
        ) : (
          <div className="space-y-3 rounded-xl border bg-muted/10 p-4">
            {canEditPreferredName ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Preferred name</p>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to clear your preferred name. Legal name and
                    work email remain HR-managed.
                  </p>
                </div>
                <Input
                  value={draftPreferredName}
                  maxLength={100}
                  placeholder="Preferred name"
                  onChange={(event) =>
                    setDraftPreferredName(event.target.value)
                  }
                />
              </div>
            ) : null}
            {showPhone && canEditPhone ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-xs text-muted-foreground">
                    Keep your preferred contact number up to date for HR and
                    manager visibility.
                  </p>
                </div>
                <Input
                  value={draftPhone}
                  maxLength={50}
                  placeholder="Phone"
                  onChange={(event) => setDraftPhone(event.target.value)}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={!hasChanges || updateMyProfile.isLoading}
              >
                {updateMyProfile.isLoading ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraftPreferredName(preferredName ?? "");
                  setDraftPhone(phone ?? "");
                  setActionError(null);
                  setIsEditing(false);
                }}
                disabled={updateMyProfile.isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {actionError ? (
          <Alert variant="destructive">
            <AlertTitle>Preferred name update failed</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WorkforceAccountCard({
  employeeId,
  firstName,
  lastName,
  email,
  directReportCount,
  canManageAccess,
}: {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  directReportCount: number;
  canManageAccess: boolean;
}) {
  const { tenantId } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const { data: accessProfiles = [] } = useAccessProfiles(
    canManageAccess && !isTenantContextReadOnly
  );
  const { data, error, isLoading } = useWorkforceAccountStatus({
    employeeId,
    email,
    firstName,
    lastName,
  });
  const deactivateAccount = useDeactivateWorkforceAccount();
  const provisionInvite = useProvisionWorkforceAccountInvite();
  const reactivateAccount = useReactivateWorkforceAccount();
  const resendInvite = useResendWorkforceAccountInvite();
  const queryClient = useApiQueryClient();
  const [selectedAccessProfileId, setSelectedAccessProfileId] = useState<
    string | null
  >(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidateAccount = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: employeeRosterQueryKeys.workforceAccount(employeeId),
    });
  }, [employeeId, queryClient]);

  useEffect(() => {
    const currentProfileId = data?.accessProfiles?.[0]?.id ?? null;
    const suggestedProfileId = getSuggestedAccessProfileId(
      accessProfiles,
      directReportCount,
      currentProfileId
    );

    if (suggestedProfileId) {
      setSelectedAccessProfileId(suggestedProfileId);
      return;
    }

    setSelectedAccessProfileId(null);
  }, [accessProfiles, data?.accessProfiles, directReportCount, employeeId]);

  const eligibility = getInvitationEligibility(data ?? null);
  const conflict = data?.conflict ?? null;
  const hasConflict = !!data?.conflict;
  const hasLinkedAccount = !!data?.userId;
  const hasInvite = !!data?.inviteId;
  const canInviteWithEmail = hasTextValue(email);
  const canSendInvite = canInviteWithEmail && eligibility.canInvite;
  const canResendInvite = eligibility.canResend;
  const canDeactivate = eligibility.canDeactivate;
  const canReactivate = eligibility.canReactivate;
  const showInviteDetails = hasInvite && !hasLinkedAccount;
  const actionMessage =
    copyMessage ??
    (showInviteDetails && data?.deliveryStatus !== "Sent"
      ? (data?.deliveryMessage ?? null)
      : null);
  const effectiveEmail = data?.email || email || "Not set";
  const effectiveAccessProfiles = data?.accessProfiles ?? [];
  const selectedAccessProfile = accessProfiles.find(
    (profile) => profile.id === selectedAccessProfileId
  );
  const emailLabel = hasLinkedAccount
    ? "Account email"
    : hasInvite
      ? "Invitation email"
      : "Work email for access";
  const accessProfileLabel = hasLinkedAccount
    ? "Assigned access profiles"
    : "Selected access profile";
  const showAccessProfileDetail = hasLinkedAccount || hasInvite;
  const showLastSignIn = hasLinkedAccount;
  const showInviteCreated = showInviteDetails && !!data?.inviteCreatedAt;
  const showDeliveryStatus = showInviteDetails && !!data?.deliveryStatus;

  async function handleSendInvite() {
    setCopyMessage(null);
    setActionError(null);

    if (!selectedAccessProfileId) {
      setActionError("Select an access profile before sending the invitation.");
      return;
    }

    try {
      await provisionInvite.mutateAsync({
        employeeId,
        email,
        firstName,
        lastName,
        accessProfileId: selectedAccessProfileId,
      });
      invalidateAccount();
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    }
  }

  async function handleResendInvite() {
    setCopyMessage(null);
    setActionError(null);

    try {
      await resendInvite.mutateAsync({ employeeId });
      invalidateAccount();
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    }
  }

  async function handleCopyInviteLink() {
    if (!data?.inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(data.inviteLink);
      setActionError(null);
      setCopyMessage("Invite link copied.");
    } catch {
      setCopyMessage("Invite link could not be copied from this browser.");
    }
  }

  async function handleDeactivate() {
    setCopyMessage(null);
    setActionError(null);

    try {
      await deactivateAccount.mutateAsync({ employeeId });
      invalidateAccount();
      setCopyMessage("Account deactivated.");
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    }
  }

  async function handleReactivate() {
    setCopyMessage(null);
    setActionError(null);

    try {
      await reactivateAccount.mutateAsync({ employeeId });
      invalidateAccount();
      setCopyMessage("Account reactivated.");
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    }
  }

  return (
    <Card className={WORKSPACE_CARD_CLASS_NAME}>
      <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
        <CardTitle className="text-base">Access &amp; account</CardTitle>
        <CardDescription>Manage access and invitation status.</CardDescription>
        <CardAction>
          <WorkforceAccountStateBadge account={data ?? null} />
        </CardAction>
      </CardHeader>
      <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-10 rounded-xl border bg-muted/20" />
            <div className="h-10 rounded-xl border bg-muted/20" />
            <div className="h-10 rounded-xl border bg-muted/20" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Failed to load account status</AlertTitle>
            <AlertDescription>
              {error.message || "An unexpected error occurred."}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <DetailRow icon={Mail} label={emailLabel} value={effectiveEmail} />
            {showAccessProfileDetail ? (
              <>
                <Separator />
                <DetailRow
                  icon={User}
                  label={accessProfileLabel}
                  value={
                    effectiveAccessProfiles.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {effectiveAccessProfiles.map((profile) => (
                          <Badge key={profile.id} variant="secondary">
                            {profile.name}
                          </Badge>
                        ))}
                      </div>
                    ) : selectedAccessProfile ? (
                      <Badge variant="outline">{selectedAccessProfile.name}</Badge>
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        Not assigned
                      </span>
                    )
                  }
                />
              </>
            ) : null}
            {showLastSignIn ? (
              <>
                <Separator />
                <DetailRow
                  icon={Calendar}
                  label="Last sign-in"
                  value={
                    data?.lastLoginAt ? (
                      formatTimestamp(data.lastLoginAt)
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        No sign-in recorded
                      </span>
                    )
                  }
                />
              </>
            ) : null}
            {showDeliveryStatus ? (
              <>
                <Separator />
                <DetailRow
                  icon={Mail}
                  label="Invitation delivery"
                  value={
                    <Badge
                      variant={getWorkforceDeliveryBadgeVariant(
                        data?.deliveryStatus ?? null
                      )}
                    >
                      {getWorkforceDeliveryBadgeLabel(
                        data?.deliveryStatus ?? null
                      )}
                    </Badge>
                  }
                />
              </>
            ) : null}

            {showInviteCreated ? (
              <>
                <Separator />
                <DetailRow
                  icon={Calendar}
                  label="Invite created"
                  value={formatTimestamp(data?.inviteCreatedAt)}
                />
              </>
            ) : null}

            {!hasLinkedAccount && !hasInvite && canInviteWithEmail ? (
              <>
                <Separator />
                <div className="rounded-xl border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  No access has been provisioned yet.
                </div>
              </>
            ) : null}

            {conflict ? (
              <>
                <Separator />
                <Alert variant={conflict.blocking ? "destructive" : "default"}>
                  <AlertTitle>
                    {conflict.blocking ? "Account conflict" : "Account warning"}
                  </AlertTitle>
                  <AlertDescription>
                    <p>{conflict.message}</p>
                    {conflict.suggestedAction ? (
                      <p className="mt-1">{conflict.suggestedAction}</p>
                    ) : null}
                  </AlertDescription>
                </Alert>
              </>
            ) : null}

            {!hasLinkedAccount && !hasInvite && !canInviteWithEmail ? (
              <>
                <Separator />
                <div className="rounded-xl border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  Add a work email in the identity details before sending an
                  invite.
                </div>
              </>
            ) : null}

            {!isTenantContextReadOnly &&
            canManageAccess &&
            (canDeactivate || canReactivate) ? (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {canDeactivate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDeactivate()}
                      disabled={deactivateAccount.isLoading}
                    >
                      {deactivateAccount.isLoading
                        ? "Deactivating..."
                        : "Deactivate account"}
                    </Button>
                  ) : null}
                  {canReactivate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleReactivate()}
                      disabled={reactivateAccount.isLoading}
                    >
                      {reactivateAccount.isLoading
                        ? "Reactivating..."
                        : "Reactivate account"}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}

            {!isTenantContextReadOnly && canManageAccess && canSendInvite ? (
              <>
                <Separator />
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Send access invitation</p>
                  <p className="text-sm text-muted-foreground">
                    Choose the access profile this account should receive.
                  </p>
                  {directReportCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Suggested: Manager access profile.
                    </p>
                  ) : null}
                  <Select
                    value={selectedAccessProfileId ?? ""}
                    onValueChange={setSelectedAccessProfileId}
                  >
                    <SelectTrigger>
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
                  <Button
                    size="sm"
                    onClick={() => void handleSendInvite()}
                    disabled={
                      provisionInvite.isLoading || accessProfiles.length === 0
                    }
                  >
                    {provisionInvite.isLoading
                      ? "Sending invite..."
                      : "Send invite"}
                  </Button>
                </div>
              </>
            ) : null}

            {!isTenantContextReadOnly && canManageAccess && canResendInvite ? (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleResendInvite()}
                    disabled={resendInvite.isLoading}
                  >
                    {resendInvite.isLoading ? "Resending..." : "Resend invite"}
                  </Button>
                  {data?.inviteLink ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleCopyInviteLink()}
                    >
                      Copy invite link
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}

            {showInviteDetails && data?.inviteExpiresAt ? (
              <>
                <Separator />
                <DetailRow
                  icon={Calendar}
                  label="Invite expires"
                  value={formatTimestamp(data.inviteExpiresAt)}
                />
              </>
            ) : null}

            {actionMessage ? (
              <div className="rounded-xl border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                {actionMessage}
              </div>
            ) : null}

            {actionError ? (
              <Alert variant="destructive">
                <AlertTitle>Invite action failed</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const canManageEmployee =
    canManageCoreEmployees(user) && !isTenantContextReadOnly;
  const canManageAccess = canAccessCoreAccess(user) && !isTenantContextReadOnly;
  const canViewProfile = canAccessEmployeeProfile(user);
  const requestedSheet = searchParams.get("sheet");
  const params = useParams<{ id: string }>();
  const employeeId =
    typeof params.id === "string" && params.id.trim().length > 0
      ? params.id
      : null;
  const isOwnProfile = !!employeeId && user?.employeeId === employeeId;
  const fieldAudience =
    canManageEmployee || isTenantContextReadOnly
      ? "hrAdmin"
      : isOwnProfile
        ? "employee"
        : "manager";
  const fieldPolicy = useEmployeeFieldPolicy(
    canViewProfile || isTenantContextReadOnly,
    fieldAudience
  );
  const { data: settings } = useTenantSettings(
    canViewProfile || isTenantContextReadOnly
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeWorkspaceSheet, setActiveWorkspaceSheet] = useState<
    "identity" | "employment" | "organization" | "status" | null
  >(null);
  const lastHandledSheetRef = useRef<string | null>(null);

  const effectiveEmployeeId =
    (canViewProfile || isTenantContextReadOnly) && employeeId
      ? employeeId
      : null;

  const {
    data: profile,
    error,
    isLoading,
  } = useEmployeeProfile(effectiveEmployeeId);

  const { data: reportingLines } =
    useEmployeeReportingLines(effectiveEmployeeId);

  // Register employee name in the top breadcrumb (Core > Employees > Jane Smith)
  useBreadcrumbLabel(employeeId ?? "", profile?.fullName);

  useEffect(() => {
    if (!profile || !requestedSheet) {
      lastHandledSheetRef.current = null;
      return;
    }

    if (lastHandledSheetRef.current === requestedSheet) {
      return;
    }

    const isReportingSheetRequest = requestedSheet === "reporting";
    const isWorkspaceSheetRequest =
      requestedSheet === "identity" ||
      requestedSheet === "employment" ||
      requestedSheet === "organization" ||
      requestedSheet === "status";

    if (
      !canManageEmployee &&
      (isReportingSheetRequest || isWorkspaceSheetRequest)
    ) {
      lastHandledSheetRef.current = requestedSheet;
    } else if (isReportingSheetRequest) {
      setSheetOpen(true);
    } else if (isWorkspaceSheetRequest) {
      setActiveWorkspaceSheet(requestedSheet);
    } else {
      return;
    }

    lastHandledSheetRef.current = requestedSheet;

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("sheet");
    const nextSearch = nextSearchParams.toString();
    const nextPath = window.location.pathname;
    const nextUrl = nextSearch ? `${nextPath}?${nextSearch}` : nextPath;

    window.history.replaceState(window.history.state, "", nextUrl);
  }, [canManageEmployee, profile, requestedSheet, searchParams]);

  const isInitialLoading =
    (canViewProfile || isTenantContextReadOnly) &&
    isLoading &&
    !profile &&
    !error;

  if (isInitialLoading) {
    return (
      <CorePageLoadingState
        title="Employee Profile"
        description="Loading employee details..."
        message="Loading employee profile..."
        variant="summary-list"
      />
    );
  }

  const isViewable = canViewProfile || isTenantContextReadOnly;

  if (!isViewable) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <EmptyState
          icon={Users}
          title="Employee profile is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </div>
    );
  }

  if (error) {
    const isNotFound =
      "status" in error && (error as { status?: number }).status === 404;
    const isForbidden =
      "status" in error && (error as { status?: number }).status === 403;

    return (
      <div className="flex flex-col gap-6 p-6">
        {isNotFound || isForbidden ? (
          <EmptyState
            icon={User}
            title={
              isForbidden
                ? "Employee is outside your scope"
                : "Employee not found"
            }
            description={
              isForbidden
                ? "This employee is not available in your current Core access scope."
                : "This employee may have been removed or is outside your current scope."
            }
          />
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Failed to load employee profile</AlertTitle>
            <AlertDescription>
              {error.message || "An unexpected error occurred."}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  if (!profile) return null;

  const canEditOwnPreferredName =
    user?.employeeId === profile.id &&
    settings?.selfService.canEditPreferredName !== false;
  const canEditOwnPhone =
    user?.employeeId === profile.id &&
    settings?.selfService.canEditPhone !== false;
  const hireDate = formatDate(profile.hireDate);
  const tenure = getTenure(profile.hireDate);
  const showHireDate = fieldPolicy.showHireDate;
  const showJobTitle = fieldPolicy.showJobTitle;
  const showPhone = fieldPolicy.showPhone;
  const showWorkLocation = fieldPolicy.showWorkLocation;
  const showEmploymentType = fieldPolicy.showEmploymentType;
  const requireHireDate = fieldPolicy.requireHireDate;
  const requireJobTitle = fieldPolicy.requireJobTitle;
  const requirePhone = fieldPolicy.requirePhone;
  const requireWorkLocation = fieldPolicy.requireWorkLocation;
  const requireEmploymentType = fieldPolicy.requireEmploymentType;
  const canEditEmploymentDetails =
    canManageEmployee &&
    (showHireDate || showJobTitle || showWorkLocation || showEmploymentType);
  const email = hasTextValue(profile.email) ? profile.email : "Not set";
  const managerSupportingText =
    profile.hierarchyStatus === "Root"
      ? null
      : profile.managerEmail?.trim()
        ? profile.managerEmail
        : "Not set";
  const attentionItems = getEmployeeActionIssues(profile.readiness);
  const managerChainSummary = getManagerChainSummary(
    reportingLines?.managerChain ?? [],
    profile.hierarchyStatus
  );
  const hierarchyIsHealthy = profile.hierarchyStatus === "Healthy";
  const fileChecklist = getEmployeeFileChecklist({
    profile,
    showPhone,
  });

  const handleOpenReadinessIssue = (issue: (typeof attentionItems)[number]) => {
    if (!canManageEmployee) {
      return;
    }

    const sheet = getEmployeeFixSheet(issue);

    if (sheet === "reporting") {
      setSheetOpen(true);
      return;
    }

    if (sheet) {
      setActiveWorkspaceSheet(sheet);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Data quality alert — only when issues exist ──────────────────── */}
      {attentionItems.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Profile needs attention</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5 list-disc pl-5">
              {attentionItems.map((item) => (
                <li key={`${item.code}:${item.fieldKey ?? "none"}`}>
                  {item.label}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Profile hero ─────────────────────────────────────────────────── */}
      <Card className={WORKSPACE_CARD_CLASS_NAME}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarFallback className="text-base font-semibold">
                  {getInitials(profile.firstName, profile.lastName)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {profile.fullName}
                  </h1>
                  <StatusBadge status={profile.status} />
                  {/* Hierarchy badge only when there is an issue */}
                  <HierarchyBadge status={profile.hierarchyStatus} />
                </div>

                {showJobTitle && hasTextValue(profile.jobTitle) ? (
                  <p className="text-sm text-muted-foreground">
                    {profile.jobTitle}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  {profile.orgUnitName && (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 shrink-0" />
                      {profile.orgUnitName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-4 w-4 shrink-0" />
                    {getManagerDisplay(profile)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-4 w-4 shrink-0" />
                    {email}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Snapshot strip — 4 quick-scan signals ────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {showHireDate ? (
          <SnapshotCard
            label="Tenure"
            value={
              <>
                {tenure}
                <span className="block text-xs font-normal text-muted-foreground">
                  Hired {hireDate}
                </span>
              </>
            }
          />
        ) : null}
        <SnapshotCard
          label="Reporting"
          value={
            hierarchyIsHealthy ? (
              <span className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Manager assigned
              </span>
            ) : (
              <HierarchyBadge status={profile.hierarchyStatus} />
            )
          }
        />
        <SnapshotCard
          label="Direct reports"
          value={formatDirectReportsCount(profile.directReportCount)}
        />
        <SnapshotCard
          label="Org unit"
          value={
            profile.orgUnitName ?? (
              <span className="font-normal text-muted-foreground">
                Not assigned
              </span>
            )
          }
        />
      </div>

      {user?.employeeId === profile.id ? (
        <PersonalProfileCard
          employeeId={profile.id}
          fullName={profile.fullName}
          workEmail={email}
          phone={profile.phone}
          showPhone={showPhone}
          preferredName={profile.preferredName}
          expectedVersion={profile.version}
          canEditPreferredName={canEditOwnPreferredName}
          canEditPhone={canEditOwnPhone}
        />
      ) : null}

      {/* ── Main record — two-column ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left */}
        <div className="flex flex-col gap-6">
          <Card className={WORKSPACE_CARD_CLASS_NAME}>
            <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
              <CardTitle className="text-base">
                Identity &amp; Contact
              </CardTitle>
              <CardDescription>
                Maintain the employee&apos;s primary identity fields.
              </CardDescription>
              <CardAction>
                {!isTenantContextReadOnly ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveWorkspaceSheet("identity")}
                  >
                    Edit
                  </Button>
                ) : null}
              </CardAction>
            </CardHeader>
            <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
              <DetailRow
                icon={User}
                label="Full name"
                value={profile.fullName}
              />
              <Separator />
              <DetailRow
                icon={Hash}
                label="Employee number"
                value={
                  hasTextValue(profile.employeeNumber) ? (
                    profile.employeeNumber
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      Not set
                    </span>
                  )
                }
              />
              <Separator />
              <DetailRow icon={Mail} label="Work email" value={email} />
              {showPhone ? <Separator /> : null}
              {showPhone ? (
                <DetailRow
                  icon={Phone}
                  label="Phone"
                  value={
                    hasTextValue(profile.phone) ? (
                      profile.phone
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        Not set
                      </span>
                    )
                  }
                />
              ) : null}
            </CardContent>
          </Card>

          <Card className={WORKSPACE_CARD_CLASS_NAME}>
            <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
              <CardTitle className="text-base">Employment</CardTitle>
              <CardDescription>
                Keep role, hire date, and status details current.
              </CardDescription>
              <CardAction className="flex flex-wrap gap-2">
                {canEditEmploymentDetails ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveWorkspaceSheet("employment")}
                  >
                    Edit
                  </Button>
                ) : null}
                {canManageEmployee ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveWorkspaceSheet("status")}
                  >
                    Manage status
                  </Button>
                ) : null}
              </CardAction>
            </CardHeader>
            <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
              {showJobTitle ? (
                <DetailRow
                  icon={Star}
                  label="Job title"
                  value={
                    hasTextValue(profile.jobTitle) ? (
                      profile.jobTitle
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        Not set
                      </span>
                    )
                  }
                />
              ) : null}
              {showJobTitle &&
              (showHireDate || showWorkLocation || showEmploymentType) ? (
                <Separator />
              ) : null}
              {showHireDate ? (
                <DetailRow icon={Calendar} label="Hire date" value={hireDate} />
              ) : null}
              {showHireDate && (showWorkLocation || showEmploymentType) ? (
                <Separator />
              ) : null}
              {showWorkLocation ? (
                <>
                  <DetailRow
                    icon={Building2}
                    label="Work location"
                    value={
                      hasTextValue(profile.workLocation) ? (
                        profile.workLocation
                      ) : (
                        <span className="font-normal text-muted-foreground">
                          Not set
                        </span>
                      )
                    }
                  />
                  {showEmploymentType ? <Separator /> : null}
                </>
              ) : null}
              {showEmploymentType ? (
                <DetailRow
                  icon={Star}
                  label="Employment type"
                  value={
                    hasTextValue(profile.employmentType) ? (
                      profile.employmentType
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        Not set
                      </span>
                    )
                  }
                />
              ) : null}
              {showJobTitle ||
              showHireDate ||
              showWorkLocation ||
              showEmploymentType ? (
                <Separator />
              ) : null}
              <DetailRow
                icon={User}
                label="Employment status"
                value={<StatusBadge status={profile.status} />}
              />
              <Separator />
              <DetailRow
                icon={Building2}
                label="Workforce context"
                value="Core HR record"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-6">
          <Card className={WORKSPACE_CARD_CLASS_NAME}>
            <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
              <CardTitle className="text-base">
                {attentionItems.length > 0
                  ? "Needs attention"
                  : "Record health"}
              </CardTitle>
              <CardDescription>
                {attentionItems.length > 0
                  ? "Resolve the current workforce record issues from the linked workspace."
                  : "No current workforce record issues are blocking this profile."}
              </CardDescription>
            </CardHeader>
            <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
              {attentionItems.length > 0 ? (
                <div className="space-y-3">
                  {attentionItems.map((issue) => (
                    <div
                      key={`${issue.code}:${issue.fieldKey ?? "none"}`}
                      className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{issue.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {issue.severity === "Blocker"
                            ? "Resolve this blocker from the linked workforce surface."
                            : "Open the linked workforce surface to fix this issue."}
                        </p>
                      </div>
                      {canManageEmployee ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReadinessIssue(issue)}
                        >
                          Open fix
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Ready for Core operations
                  </p>
                  <p className="mt-1">
                    No current record issues need action on this employee.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {canManageEmployee || canManageAccess ? (
            <WorkforceAccountCard
              employeeId={profile.id}
              firstName={profile.firstName}
              lastName={profile.lastName}
              email={profile.email}
              directReportCount={profile.directReportCount}
              canManageAccess={canManageAccess}
            />
          ) : null}

          <Card className={WORKSPACE_CARD_CLASS_NAME}>
            <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
              <CardTitle className="text-base">
                Employee file &amp; readiness
              </CardTitle>
              <CardDescription>
                Lightweight employee file checkpoints for a cleaner Core demo
                story.
              </CardDescription>
            </CardHeader>
            <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
              <div className="space-y-3">
                {fileChecklist.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col gap-2 rounded-xl border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                    <ChecklistStatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={WORKSPACE_CARD_CLASS_NAME}>
            <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
              <CardTitle className="text-base">Organization</CardTitle>
              <CardDescription>
                Maintain org placement and manager context from one workspace.
              </CardDescription>
              <CardAction>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      router.push(
                        buildTenantContextHref(
                          `/org-chart?focusEmployeeId=${profile.id}`,
                          tenantId
                        )
                      )
                    }
                  >
                    View in org chart
                  </Button>
                  {canManageEmployee ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveWorkspaceSheet("organization")}
                    >
                      Edit
                    </Button>
                  ) : null}
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
              <DetailRow
                icon={Building2}
                label="Org unit"
                value={
                  profile.orgUnitName ?? (
                    <span className="font-normal text-muted-foreground">
                      Not assigned
                    </span>
                  )
                }
              />
              <Separator />
              <DetailRow
                icon={User}
                label="Manager"
                value={
                  <>
                    {getManagerDisplay(profile)}
                    {managerSupportingText ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {managerSupportingText}
                      </span>
                    ) : null}
                  </>
                }
              />
              {/* Show hierarchy row only when there is a problem */}
              {!hierarchyIsHealthy && (
                <>
                  <Separator />
                  <DetailRow
                    icon={AlertTriangle}
                    label="Hierarchy issue"
                    value={<HierarchyBadge status={profile.hierarchyStatus} />}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card className={WORKSPACE_CARD_CLASS_NAME}>
            <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
              <CardTitle className="text-base">Reporting</CardTitle>
            </CardHeader>
            <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
              <DetailRow
                icon={Users}
                label="Direct reports"
                value={formatDirectReportsCount(profile.directReportCount)}
              />
              <Separator />
              <DetailRow
                icon={ChevronRight}
                label="Manager chain"
                value={
                  <span className="font-normal text-muted-foreground">
                    {managerChainSummary}
                  </span>
                }
              />
              <Separator />
              <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Reporting relationship</p>
                  <p className="text-xs text-muted-foreground">
                    Update the manager and review the chain.
                  </p>
                </div>
                {canManageEmployee ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSheetOpen(true)}
                  >
                    Open
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EmployeeReportingLinesSheet
        employeeId={employeeId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        showJobTitle={showJobTitle}
      />

      <EmployeeIdentityEditSheet
        profile={profile}
        showPhone={showPhone}
        requirePhone={requirePhone}
        open={activeWorkspaceSheet === "identity"}
        onOpenChange={(open) =>
          setActiveWorkspaceSheet(open ? "identity" : null)
        }
      />

      <EmployeeEmploymentEditSheet
        profile={profile}
        open={activeWorkspaceSheet === "employment"}
        showJobTitle={showJobTitle}
        showHireDate={showHireDate}
        showWorkLocation={showWorkLocation}
        showEmploymentType={showEmploymentType}
        requireJobTitle={requireJobTitle}
        requireHireDate={requireHireDate}
        requireWorkLocation={requireWorkLocation}
        requireEmploymentType={requireEmploymentType}
        onOpenChange={(open) =>
          setActiveWorkspaceSheet(open ? "employment" : null)
        }
      />

      <EmployeeOrganizationEditSheet
        profile={profile}
        open={activeWorkspaceSheet === "organization"}
        onOpenChange={(open) =>
          setActiveWorkspaceSheet(open ? "organization" : null)
        }
      />

      <EmployeeStatusSheet
        profile={profile}
        open={activeWorkspaceSheet === "status"}
        onOpenChange={(open) => setActiveWorkspaceSheet(open ? "status" : null)}
        onManageReportingRelationship={() => {
          if (canManageEmployee) {
            setSheetOpen(true);
          }
        }}
      />
    </div>
  );
}
