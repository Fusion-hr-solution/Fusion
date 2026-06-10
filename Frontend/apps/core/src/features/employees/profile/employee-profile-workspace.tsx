"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Mail,
  MoreHorizontal,
  Pencil,
  User,
} from "lucide-react";
import {
  canAccessCorePeople,
  canAccessCoreTeam,
  canManageCoreAccessProfiles,
  type AuthUser,
} from "@repo/auth";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import type { EmployeeFieldPolicyState } from "@/features/employees/shared/employee-field-visibility";
import {
  getEmployeeFixSheet,
  getEmployeeReadinessBadgeLabel,
  getEmployeeReadinessBadgeVariant,
  getEmployeeReadinessIssues,
} from "@/app/(pages)/employees/employee-readiness";
import {
  getAccessBadgeTone,
  getAccessDisplayState,
} from "@/features/access/shared/employee-access";
import { EmployeeConfirmDialog } from "@/app/(pages)/employees/employee-confirm-dialog";
import { EmployeeEditDialog } from "@/app/(pages)/employees/[id]/employee-profile-workspace-sheets";
import { EmployeeAccessManagementSheet } from "./employee-access-management-sheet";
import {
  useUpdateMyProfile,
  useDeactivateEmployee,
  useReactivateEmployee,
} from "@/app/(pages)/employees/use-employees";
import { useWorkforceAccountStatus } from "@/app/(pages)/employees/use-workforce-accounts";
import type {
  EmployeeHierarchyNodeDto,
  EmployeeHierarchyStatus,
  EmployeeProfileDto,
  EmployeeReadinessIssueDto,
  EmployeeReportingLinesDto,
  WorkforceAccountStatusDto,
} from "@/app/(pages)/employees/employee-roster.types";

// ── Props ─────────────────────────────────────────────────────────────────

export interface EmployeeProfileWorkspaceProps {
  profile: EmployeeProfileDto;
  reportingLines?: EmployeeReportingLinesDto;
  fieldPolicy: EmployeeFieldPolicyState;
  user: AuthUser | null;
  isTenantContextReadOnly: boolean;
  canManageEmployee: boolean;
  canManageReporting: boolean;
  canViewAccess: boolean;
  canManageAccess: boolean;
  canUseOrgChart: boolean;
  canEditOwnPreferredName: boolean;
  canEditOwnPhone: boolean;
}

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

const WORKSPACE_CARD_CLASS_NAME = "gap-0 py-0";
const WORKSPACE_CARD_HEADER_CLASS_NAME = "px-5 pb-4 pt-5";
const WORKSPACE_CARD_CONTENT_CLASS_NAME = "space-y-4 px-5 pb-5";

type DefinitionItem = {
  label: string;
  value: ReactNode;
  hidden?: boolean;
};

function SummaryStripItem({
  label,
  value,
  supportingText,
  href,
  onClick,
}: {
  label: string;
  value: ReactNode;
  supportingText?: ReactNode;
  href?: string | null;
  onClick?: (() => void) | null;
}) {
  const baseClassName =
    "flex min-h-24 min-w-0 flex-col justify-between gap-3 bg-background/95 px-4 py-4 text-left";
  const content = (
    <>
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <div className="min-w-0 text-sm font-semibold leading-snug text-foreground">
          {value}
        </div>
      </div>
      {supportingText ? (
        <div className="truncate text-xs text-muted-foreground">
          {supportingText}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClassName} transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={`${baseClassName} transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClassName}>{content}</div>;
}

function DefinitionGrid({
  items,
  columns = 2,
}: {
  items: DefinitionItem[];
  columns?: 1 | 2;
}) {
  const visibleItems = items.filter((item) => !item.hidden);
  const columnsClassName = columns === 2 ? "sm:grid-cols-2" : "";

  return (
    <dl className={`grid gap-x-6 gap-y-4 ${columnsClassName}`}>
      {visibleItems.map((item) => (
        <div key={item.label} className="space-y-1">
          <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {item.label}
          </dt>
          <dd className="text-sm font-medium text-foreground/95">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RelationshipCard({
  eyebrow,
  title,
  supportingText,
  href,
  badge,
}: {
  eyebrow: string;
  title: ReactNode;
  supportingText?: ReactNode;
  href?: string | null;
  badge?: ReactNode;
}) {
  const className =
    "flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-muted/10 p-4 text-left";
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
          <div className="min-w-0 text-sm font-semibold leading-5 text-foreground">
            {title}
          </div>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {supportingText ? (
        <div className="min-w-0 text-xs leading-5 text-muted-foreground">
          {supportingText}
        </div>
      ) : null}
    </>
  );

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link
      href={href}
      className={`${className} transition-colors hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {content}
    </Link>
  );
}

function PersonSummaryCard({
  name,
  secondary,
  tertiary,
  href,
  badge,
}: {
  name: string;
  secondary?: ReactNode;
  tertiary?: ReactNode;
  href?: string | null;
  badge?: ReactNode;
}) {
  const content = (
    <div className="min-w-0 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {secondary ? (
        <div className="truncate text-sm text-muted-foreground">
          {secondary}
        </div>
      ) : null}
      {tertiary ? (
        <div className="truncate text-xs text-muted-foreground">{tertiary}</div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-border/70 bg-background px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/10"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
      {content}
    </div>
  );
}

function ManagerChainBreadcrumb({
  managerChain,
  hierarchyStatus,
  tenantId,
  tenantSlug,
  canOpenProfiles,
}: {
  managerChain: EmployeeHierarchyNodeDto[];
  hierarchyStatus: EmployeeHierarchyStatus;
  tenantId: string | null;
  tenantSlug: string | null;
  canOpenProfiles: boolean;
}) {
  if (managerChain.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        {hierarchyStatus === "Root"
          ? "Top-level leader"
          : "No manager chain available"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      {managerChain.map((node, index) => {
        const employee = node.employee;
        const name =
          employee.displayName?.trim() ||
          employee.fullName?.trim() ||
          `${employee.firstName} ${employee.lastName}`;
        const href =
          canOpenProfiles && employee.stableEmployeeKey
            ? buildTenantContextHref(`/employees/${employee.stableEmployeeKey}`, tenantId, tenantSlug)
            : null;

        return (
          <span key={employee.id} className="inline-flex items-center gap-1.5">
            {href ? (
              <Link
                href={href}
                className="text-foreground/90 underline underline-offset-2 decoration-muted-foreground/20 transition-colors hover:text-primary hover:decoration-primary/50"
              >
                {name}
              </Link>
            ) : (
              <span className="text-foreground/90">{name}</span>
            )}
            {index < managerChain.length - 1 ? (
              <ChevronRight className="size-3.5 text-muted-foreground/70" />
            ) : null}
          </span>
        );
      })}
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

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getProfileDisplayName(
  profile: Pick<
    EmployeeProfileDto,
    "displayName" | "preferredName" | "lastName" | "fullName"
  >
): string {
  if (hasTextValue(profile.displayName)) {
    return profile.displayName;
  }

  if (hasTextValue(profile.preferredName)) {
    return `${profile.preferredName} ${profile.lastName}`;
  }

  return profile.fullName;
}

function getRecordBadgeVariant(
  issues: EmployeeReadinessIssueDto[]
): "secondary" | "outline" | "destructive" {
  if (issues.length === 0) {
    return "secondary";
  }

  return issues.some((issue) => issue.severity === "Blocker")
    ? "destructive"
    : "outline";
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

function EmployeeAccessSummaryBadge({
  employeeId,
  email,
  firstName,
  lastName,
}: {
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
}) {
  const { data, error, isLoading } = useWorkforceAccountStatus({
    employeeId,
    email,
    firstName,
    lastName,
  });

  if (error) {
    return <Badge variant="outline">Access unavailable</Badge>;
  }

  if (isLoading) {
    return <Badge variant="outline">Access</Badge>;
  }

  return <WorkforceAccountStateBadge account={data ?? null} />;
}

function getWorkforceDeliveryBadgeVariant(
  deliveryStatus: WorkforceAccountStatusDto["deliveryStatus"]
): "secondary" | "destructive" {
  switch (deliveryStatus) {
    case "Failed":
      return "destructive";
    default:
      return "secondary";
  }
}

function getWorkforceDeliveryBadgeLabel(
  deliveryStatus: WorkforceAccountStatusDto["deliveryStatus"]
): string {
  switch (deliveryStatus) {
    case "Suppressed":
      return "Link ready";
    case "Failed":
      return "Delivery issue";
    default:
      return "Sent";
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

// ── SelfProfileDetailsDialog ───────────────────────────────────────────────

function SelfProfileDetailsDialog({
  open,
  onOpenChange,
  employeeId,
  phone,
  showPhone,
  preferredName,
  expectedVersion,
  canEditPreferredName,
  canEditPhone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  phone: string | null;
  showPhone: boolean;
  preferredName: string | null;
  expectedVersion: number;
  canEditPreferredName: boolean;
  canEditPhone: boolean;
}) {
  const updateMyProfile = useUpdateMyProfile();
  const [draftPreferredName, setDraftPreferredName] = useState(
    preferredName ?? ""
  );
  const [draftPhone, setDraftPhone] = useState(phone ?? "");
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const wasOpenRef = useRef(false);
  const canEditAnyField = canEditPreferredName || (showPhone && canEditPhone);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!justOpened) {
      return;
    }

    setDraftPreferredName(preferredName ?? "");
    setDraftPhone(phone ?? "");
    setActionError(null);
    setShowDiscardConfirm(false);
  }, [employeeId, expectedVersion, open, phone, preferredName]);

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
      toast.success("Details updated.");
      setShowDiscardConfirm(false);
      onOpenChange(false);
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    }
  }

  function handleOpenStateChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (updateMyProfile.isLoading) {
      return;
    }

    if (hasChanges) {
      setShowDiscardConfirm(true);
      return;
    }

    onOpenChange(false);
  }

  if (!canEditAnyField) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenStateChange}>
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit my details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {canEditPreferredName ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Preferred name</p>
                <Input
                  value={draftPreferredName}
                  maxLength={100}
                  placeholder="Preferred name"
                  onChange={(event) =>
                    setDraftPreferredName(event.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Shown across the product in place of your first name where
                  supported.
                </p>
              </div>
            ) : null}

            {showPhone && canEditPhone ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Phone</p>
                <Input
                  value={draftPhone}
                  maxLength={50}
                  placeholder="Phone"
                  onChange={(event) => setDraftPhone(event.target.value)}
                />
              </div>
            ) : null}

            {actionError ? (
              <Alert variant="destructive">
                <AlertTitle>Changes could not be saved</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenStateChange(false)}
                disabled={updateMyProfile.isLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={!hasChanges || updateMyProfile.isLoading}
              >
                {updateMyProfile.isLoading ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <EmployeeConfirmDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        title="Discard changes?"
        description="Your unsaved edits will be lost."
        confirmLabel="Discard changes"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

// ── WorkforceAccountCard ────────────────────────────────────────────────────

function WorkforceAccountCard({
  employeeId,
  firstName,
  lastName,
  email,
  canManageAccess,
  onManageAccess,
}: {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  canManageAccess: boolean;
  onManageAccess?: () => void;
}) {
  const { data, error, isLoading } = useWorkforceAccountStatus({
    employeeId,
    email,
    firstName,
    lastName,
  });
  const conflict = data?.conflict ?? null;
  const hasLinkedAccount = !!data?.userId;
  const hasInvite = !!data?.inviteId;
  const showInviteDetails = hasInvite && !hasLinkedAccount;
  const effectiveEmail = data?.email || email || "Not set";
  const effectiveAccessProfiles = data?.accessProfiles ?? [];
  const emailLabel = hasLinkedAccount
    ? "Account email"
    : hasInvite
      ? "Invite email"
      : "Access email";
  const showNotInvitedState = !hasLinkedAccount && !hasInvite;
  const showAccessProfileDetail =
    hasLinkedAccount || hasInvite || showNotInvitedState;
  const showLastSignIn = hasLinkedAccount;
  const showInviteCreated = showInviteDetails && !!data?.inviteCreatedAt;
  const showDeliveryStatus = showInviteDetails && !!data?.deliveryStatus;
  const showInviteExpiry = showInviteDetails && !!data?.inviteExpiresAt;
  const accessFacts: DefinitionItem[] = [
    {
      label: emailLabel,
      value: effectiveEmail,
    },
    {
      label: "Assigned profiles",
      hidden: !showAccessProfileDetail,
      value:
        effectiveAccessProfiles.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {effectiveAccessProfiles.map((profile) => (
              <Badge key={profile.id} variant="secondary">
                {profile.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="font-normal text-muted-foreground">
            Not assigned
          </span>
        ),
    },
    {
      label: "Last sign-in",
      hidden: !showLastSignIn,
      value: data?.lastLoginAt ? (
        formatTimestamp(data.lastLoginAt)
      ) : (
        <span className="font-normal text-muted-foreground">
          No sign-in recorded
        </span>
      ),
    },
    {
      label: "Delivery",
      hidden: !showDeliveryStatus,
      value: (
        <Badge
          variant={getWorkforceDeliveryBadgeVariant(
            data?.deliveryStatus ?? null
          )}
        >
          {getWorkforceDeliveryBadgeLabel(data?.deliveryStatus ?? null)}
        </Badge>
      ),
    },
    {
      label: "Invite created",
      hidden: !showInviteCreated,
      value: formatTimestamp(data?.inviteCreatedAt),
    },
    {
      label: "Invite expires",
      hidden: !showInviteExpiry,
      value: formatTimestamp(data?.inviteExpiresAt),
    },
  ];

  return (
    <Card className={WORKSPACE_CARD_CLASS_NAME}>
      <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
        <CardTitle className="text-base">Access</CardTitle>
        <CardAction>
          {error ? (
            <Badge variant="outline">Access unavailable</Badge>
          ) : isLoading ? (
            <Badge variant="outline">Access</Badge>
          ) : (
            <WorkforceAccountStateBadge account={data ?? null} />
          )}
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
              Could not load account information. Try again in a moment.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5">
            <DefinitionGrid items={accessFacts} />

            {showNotInvitedState ? (
              <p className="text-sm text-muted-foreground">No invite sent.</p>
            ) : null}

            {conflict ? (
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
            ) : null}

            {canManageAccess && onManageAccess ? (
              <div className="border-t pt-5">
                <Button size="sm" variant="outline" onClick={onManageAccess}>
                  Manage access
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main workspace ─────────────────────────────────────────────────────────

export function EmployeeProfileWorkspace({
  profile,
  reportingLines,
  fieldPolicy,
  user,
  isTenantContextReadOnly,
  canManageEmployee,
  canManageReporting,
  canViewAccess,
  canManageAccess,
  canUseOrgChart,
  canEditOwnPreferredName,
  canEditOwnPhone,
}: EmployeeProfileWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId, tenantSlug } = useTenantContext();
  const accessSectionRef = useRef<HTMLDivElement | null>(null);
  const reportingSectionRef = useRef<HTMLDivElement | null>(null);
  const directReportsSectionRef = useRef<HTMLDivElement | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogTab, setEditDialogTab] = useState<string>("personal");
  const [selfProfileSheetOpen, setSelfProfileSheetOpen] = useState(false);
  const [accessSheetOpen, setAccessSheetOpen] = useState(false);
  const [showDeactivateEmployeeConfirm, setShowDeactivateEmployeeConfirm] =
    useState(false);
  const lastHandledSheetRef = useRef<string | null>(null);

  const isOwnProfile = user?.employeeId === profile.id;
  const canManageProfiles = canManageCoreAccessProfiles(user);
  const profilesHref = buildTenantContextHref(
    "/settings?tab=access-profiles",
    tenantId,
    tenantSlug
  );
  const hireDate = formatDate(profile.hireDate);
  const tenure = getTenure(profile.hireDate);
  const displayName = getProfileDisplayName(profile);
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
  const canEditOwnDetails =
    isOwnProfile &&
    !isTenantContextReadOnly &&
    (canEditOwnPreferredName || (showPhone && canEditOwnPhone));
  const requestedSheet = searchParams.get("sheet");

  useEffect(() => {
    if (!profile || !requestedSheet) {
      lastHandledSheetRef.current = null;
      return;
    }

    if (lastHandledSheetRef.current === requestedSheet) {
      return;
    }

    const sheetToTab: Record<string, string> = {
      identity: "personal",
      employment: "work",
      reporting: "manager",
      organization: "organization",
    };
    const isSelfDetailsRequest =
      requestedSheet === "identity" && !canManageEmployee && canEditOwnDetails;

    if (isSelfDetailsRequest) {
      setSelfProfileSheetOpen(true);
    } else if (canManageEmployee && requestedSheet in sheetToTab) {
      setEditDialogTab(sheetToTab[requestedSheet] ?? "personal");
      setEditDialogOpen(true);
    } else if (canManageReporting && requestedSheet === "reporting") {
      setEditDialogTab("manager");
      setEditDialogOpen(true);
    } else {
      lastHandledSheetRef.current = requestedSheet;
      return;
    }

    lastHandledSheetRef.current = requestedSheet;

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("sheet");
    const nextSearch = nextSearchParams.toString();
    const nextPath = window.location.pathname;
    const nextUrl = nextSearch ? `${nextPath}?${nextSearch}` : nextPath;

    window.history.replaceState(window.history.state, "", nextUrl);
  }, [
    canEditOwnDetails,
    canManageEmployee,
    canManageReporting,
    profile,
    requestedSheet,
    searchParams,
  ]);

  const email = hasTextValue(profile.email) ? profile.email : "Not set";
  const managerEmail = hasTextValue(profile.managerEmail)
    ? profile.managerEmail
    : null;
  const managerDisplayName = getManagerDisplay(profile);
  const managerNode = reportingLines?.managerChain[0]?.employee ?? null;
  const directReports = reportingLines?.directReports ?? [];
  const activeDirectReportCount = directReports.filter(
    ({ employee }) => employee.status === "Active"
  ).length;
  const profileReadinessIssues = Array.from(
    new Map(
      getEmployeeReadinessIssues(profile.readiness).map((issue) => [
        `${issue.code}:${issue.fieldKey ?? "none"}`,
        issue,
      ])
    ).values()
  );
  const recordIssues = profileReadinessIssues.filter(
    (issue) => issue.code !== "DeactivationBlocked"
  );
  const isRecordComplete = recordIssues.length === 0;
  const recordBadgeVariant = getRecordBadgeVariant(recordIssues);
  const heroRecordBadgeLabel = !isRecordComplete
    ? recordIssues.length === 1
      ? getEmployeeReadinessBadgeLabel(recordIssues[0]!)
      : `${recordIssues.length} issues`
    : null;
  const hierarchyIsHealthy = profile.hierarchyStatus === "Healthy";
  const primaryActionLabel = canManageEmployee
    ? "Edit record"
    : "Edit my details";
  const canOpenManagerProfile =
    !!profile.managerId &&
    (isTenantContextReadOnly ||
      canAccessCorePeople(user) ||
      canManageEmployee ||
      canManageReporting);
  const canOpenDirectReportProfiles =
    isTenantContextReadOnly ||
    canAccessCorePeople(user) ||
    canAccessCoreTeam(user) ||
    canManageEmployee ||
    canManageReporting;
  const managerProfileHref =
    canOpenManagerProfile && managerNode?.stableEmployeeKey
      ? buildTenantContextHref(
          `/employees/${managerNode.stableEmployeeKey}`,
          tenantId,
          tenantSlug
        )
      : null;
  const managerSupportingText = managerNode?.jobTitle ? (
    <div className="min-w-0 space-y-0.5">
      <span className="block truncate">{managerNode.jobTitle}</span>
      {managerEmail ? (
        <span className="block truncate">{managerEmail}</span>
      ) : null}
    </div>
  ) : (
    (managerEmail ??
    (profile.hierarchyStatus === "Root" ? "Top-level leader" : undefined))
  );
  const personalDetails: DefinitionItem[] = [
    {
      label: "Employee number",
      value: hasTextValue(profile.employeeNumber) ? (
        profile.employeeNumber
      ) : (
        <span className="font-normal text-muted-foreground">Not set</span>
      ),
    },
    {
      label: "First name",
      value: profile.firstName,
    },
    {
      label: "Last name",
      value: profile.lastName,
    },
    {
      label: "Preferred name",
      value: hasTextValue(profile.preferredName) ? (
        profile.preferredName
      ) : (
        <span className="font-normal text-muted-foreground">Not set</span>
      ),
    },
    {
      label: "Work email",
      value: email,
    },
    {
      label: "Phone",
      hidden: !showPhone,
      value: hasTextValue(profile.phone) ? (
        profile.phone
      ) : (
        <span className="font-normal text-muted-foreground">Not set</span>
      ),
    },
  ];
  const workDetails: DefinitionItem[] = [
    {
      label: "Job title",
      hidden: !showJobTitle,
      value: hasTextValue(profile.jobTitle) ? (
        profile.jobTitle
      ) : (
        <span className="font-normal text-muted-foreground">Not set</span>
      ),
    },
    {
      label: "Hire date",
      hidden: !showHireDate,
      value: hireDate,
    },
    {
      label: "Tenure",
      hidden: !showHireDate,
      value: tenure,
    },
    {
      label: "Employment type",
      hidden: !showEmploymentType,
      value: hasTextValue(profile.employmentType) ? (
        profile.employmentType
      ) : (
        <span className="font-normal text-muted-foreground">Not set</span>
      ),
    },
    {
      label: "Work location",
      hidden: !showWorkLocation,
      value: hasTextValue(profile.workLocation) ? (
        profile.workLocation
      ) : (
        <span className="font-normal text-muted-foreground">Not set</span>
      ),
    },
    {
      label: "Employment status",
      value: <StatusBadge status={profile.status} />,
    },
  ];
  const createdAtLabel = formatTimestamp(profile.createdAt);
  const updatedAtLabel =
    profile.updatedAt && profile.updatedAt !== profile.createdAt
      ? formatTimestamp(profile.updatedAt)
      : null;

  const handleOpenReadinessIssue = (issue: EmployeeReadinessIssueDto) => {
    const sheet = getEmployeeFixSheet(issue);

    const sheetToTab: Record<string, string> = {
      identity: "personal",
      employment: "work",
      reporting: "manager",
      organization: "organization",
    };

    const tab = sheet ? sheetToTab[sheet] : null;

    if (tab === "manager") {
      if (canManageReporting) {
        setEditDialogTab("manager");
        setEditDialogOpen(true);
      }
      return;
    }

    if (tab && canManageEmployee) {
      setEditDialogTab(tab);
      setEditDialogOpen(true);
    }
  };

  const openPrimaryEdit = () => {
    if (canManageEmployee) {
      setEditDialogTab("personal");
      setEditDialogOpen(true);
      return;
    }

    if (canEditOwnDetails) {
      setSelfProfileSheetOpen(true);
    }
  };

  const openAccessManagement = () => {
    setAccessSheetOpen(true);
  };

  const deactivateEmployeeMutation = useDeactivateEmployee();
  const reactivateEmployeeMutation = useReactivateEmployee();

  async function handleDeactivateEmployee() {
    try {
      await deactivateEmployeeMutation.mutateAsync({
        employeeId: profile.id,
        expectedVersion: profile.version,
      });
      toast.success("Employee deactivated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to deactivate employee."
      );
    } finally {
      setShowDeactivateEmployeeConfirm(false);
    }
  }

  async function handleReactivateEmployee() {
    try {
      await reactivateEmployeeMutation.mutateAsync({
        employeeId: profile.id,
        expectedVersion: profile.version,
      });
      toast.success("Employee reactivated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to reactivate employee."
      );
    }
  }

  const scrollToAccessSection = () => {
    accessSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToReportingSection = () => {
    reportingSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToDirectReportsSection = () => {
    directReportsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const focusInOrgChart = () => {
    router.push(
      buildTenantContextHref(
        `/org-chart?focusEmployeeKey=${profile.stableEmployeeKey}`,
        tenantId,
        tenantSlug
      )
    );
  };

  return (
    <div className="flex flex-col gap-8 p-6">
      <Card className="overflow-hidden border-border/70 bg-linear-to-br from-background via-background to-muted/30 py-0">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 shrink-0 ring-1 ring-border/70">
                <AvatarFallback className="text-base font-semibold">
                  {getInitials(profile.firstName, profile.lastName)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {displayName}
                  </h1>
                  <StatusBadge status={profile.status} />
                  {canViewAccess ? (
                    <EmployeeAccessSummaryBadge
                      employeeId={profile.id}
                      email={profile.email}
                      firstName={profile.firstName}
                      lastName={profile.lastName}
                    />
                  ) : null}
                  {heroRecordBadgeLabel ? (
                    <Badge variant={recordBadgeVariant}>
                      {heroRecordBadgeLabel}
                    </Badge>
                  ) : null}
                </div>

                {displayName !== profile.fullName ? (
                  <p className="text-sm text-muted-foreground">
                    Official name: {profile.fullName}
                  </p>
                ) : null}

                {showJobTitle ? (
                  hasTextValue(profile.jobTitle) ? (
                    <p className="text-base text-foreground/90">
                      {profile.jobTitle}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Job title not set
                    </p>
                  )
                ) : null}

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {hasTextValue(profile.email) ? (
                    <a
                      href={`mailto:${profile.email}`}
                      className="inline-flex items-center gap-1.5 underline underline-offset-2 decoration-muted-foreground/20 transition-colors hover:text-primary hover:decoration-primary/50"
                    >
                      <Mail className="h-4 w-4 shrink-0" />
                      {email}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-4 w-4 shrink-0" />
                      {email}
                    </span>
                  )}
                  {canUseOrgChart && profile.orgUnitName ? (
                    <button
                      type="button"
                      onClick={focusInOrgChart}
                      className="inline-flex items-center gap-1.5 underline underline-offset-2 decoration-muted-foreground/20 transition-colors hover:text-primary hover:decoration-primary/50"
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      {profile.orgUnitName}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 shrink-0" />
                      {profile.orgUnitName ?? "No organization unit assigned"}
                    </span>
                  )}
                  {managerProfileHref ? (
                    <Link
                      href={managerProfileHref}
                      className="inline-flex items-center gap-1.5 underline underline-offset-2 decoration-muted-foreground/20 transition-colors hover:text-primary hover:decoration-primary/50"
                    >
                      <User className="h-4 w-4 shrink-0" />
                      {managerDisplayName}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-4 w-4 shrink-0" />
                      {managerDisplayName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              {canManageEmployee || canEditOwnDetails ? (
                <Button size="sm" onClick={openPrimaryEdit}>
                  {primaryActionLabel}
                </Button>
              ) : null}
              {canManageAccess || canManageReporting || canManageEmployee ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label="Profile actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canManageAccess ? (
                      <DropdownMenuItem onClick={openAccessManagement}>
                        Manage access
                      </DropdownMenuItem>
                    ) : null}
                    {canManageReporting ? (
                      <DropdownMenuItem
                        onClick={() => {
                          setEditDialogTab("manager");
                          setEditDialogOpen(true);
                        }}
                      >
                        Change manager
                      </DropdownMenuItem>
                    ) : null}
                    {canManageEmployee ? (
                      <DropdownMenuItem
                        onClick={() => {
                          setEditDialogTab("organization");
                          setEditDialogOpen(true);
                        }}
                      >
                        Change organization
                      </DropdownMenuItem>
                    ) : null}
                    {(canManageAccess || canManageReporting) &&
                    canManageEmployee ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {canManageEmployee ? (
                      <DropdownMenuItem
                        variant={
                          profile.status === "Active"
                            ? "destructive"
                            : "default"
                        }
                        disabled={
                          deactivateEmployeeMutation.isLoading ||
                          reactivateEmployeeMutation.isLoading
                        }
                        onClick={() => {
                          if (profile.status === "Active") {
                            if (activeDirectReportCount > 0) {
                              toast.error(
                                `This employee can't be deactivated while ${activeDirectReportCount} active direct report${activeDirectReportCount === 1 ? " still reports" : "s still report"} to them. Reassign or deactivate those reports first.`
                              );
                              return;
                            }
                            setShowDeactivateEmployeeConfirm(true);
                          } else {
                            void handleReactivateEmployee();
                          }
                        }}
                      >
                        {profile.status === "Active"
                          ? "Deactivate employee"
                          : "Reactivate employee"}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-border/60">
            <div className="grid gap-px bg-border/70 sm:grid-cols-2 xl:grid-flow-col xl:auto-cols-fr">
              {showHireDate ? (
                <SummaryStripItem
                  label="Hire date"
                  value={hireDate}
                  supportingText={tenure}
                />
              ) : null}
              <SummaryStripItem
                label="Organization unit"
                value={profile.orgUnitName ?? "Not assigned"}
                supportingText={profile.orgUnitType ?? undefined}
                onClick={canUseOrgChart ? focusInOrgChart : null}
              />
              <SummaryStripItem
                label="Manager"
                value={managerDisplayName}
                supportingText={
                  managerEmail ??
                  (!hierarchyIsHealthy ? profile.hierarchyStatus : undefined)
                }
                href={managerProfileHref}
                onClick={!managerProfileHref ? scrollToReportingSection : null}
              />
              <SummaryStripItem
                label="Direct reports"
                value={formatDirectReportsCount(profile.directReportCount)}
                supportingText={
                  profile.directReportCount > 0
                    ? "View reporting"
                    : "No direct reports"
                }
                onClick={
                  profile.directReportCount > 0
                    ? scrollToDirectReportsSection
                    : null
                }
              />
              {canViewAccess ? (
                <SummaryStripItem
                  label="Access state"
                  value={
                    <EmployeeAccessSummaryBadge
                      employeeId={profile.id}
                      email={profile.email}
                      firstName={profile.firstName}
                      lastName={profile.lastName}
                    />
                  }
                  supportingText={canManageAccess ? "Manage access" : undefined}
                  onClick={
                    canManageAccess
                      ? openAccessManagement
                      : scrollToAccessSection
                  }
                />
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Created {createdAtLabel}</span>
            {updatedAtLabel ? <span>Updated {updatedAtLabel}</span> : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="flex flex-col gap-6">
          <Card className={WORKSPACE_CARD_CLASS_NAME}>
            <CardHeader className="px-6 pb-4 pt-5">
              <CardTitle className="text-base">Profile details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <section className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Personal details
                    </h2>
                    {canManageEmployee ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="size-7"
                        onClick={() => {
                          setEditDialogTab("personal");
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit personal details</span>
                      </Button>
                    ) : null}
                  </div>
                  <DefinitionGrid items={personalDetails} columns={1} />
                </section>
                <section className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Work details
                    </h2>
                    {canEditEmploymentDetails ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="size-7"
                        onClick={() => {
                          setEditDialogTab("work");
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit work details</span>
                      </Button>
                    ) : null}
                  </div>
                  <DefinitionGrid items={workDetails} columns={1} />
                </section>
              </div>
            </CardContent>
          </Card>

          <div ref={reportingSectionRef}>
            <Card className={WORKSPACE_CARD_CLASS_NAME}>
              <CardHeader className="px-6 pb-4 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    Organization &amp; reporting
                  </CardTitle>
                  {canManageReporting ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="size-7"
                      onClick={() => {
                        setEditDialogTab("manager");
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      <span className="sr-only">Edit reporting</span>
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-6 px-6 pb-6">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Organization unit
                    </p>
                    <div className="text-sm font-semibold text-foreground">
                      {profile.orgUnitName ?? "Not assigned"}
                    </div>
                    {hasTextValue(profile.orgUnitType) ? (
                      <p className="text-xs text-muted-foreground">
                        {profile.orgUnitType}
                      </p>
                    ) : null}
                  </div>

                  <RelationshipCard
                    eyebrow="Manager"
                    title={managerDisplayName}
                    supportingText={managerSupportingText}
                    href={managerProfileHref ?? undefined}
                    badge={
                      !hierarchyIsHealthy ? (
                        <HierarchyBadge status={profile.hierarchyStatus} />
                      ) : undefined
                    }
                  />

                  <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Direct reports
                    </p>
                    <div className="text-sm font-semibold text-foreground">
                      {formatDirectReportsCount(profile.directReportCount)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {profile.directReportCount > 0
                        ? "Listed below"
                        : "No direct reports"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Manager chain
                  </p>
                  <ManagerChainBreadcrumb
                    managerChain={reportingLines?.managerChain ?? []}
                    hierarchyStatus={profile.hierarchyStatus}
                    tenantId={tenantId}
                    tenantSlug={tenantSlug}
                    canOpenProfiles={
                      isTenantContextReadOnly ||
                      canAccessCorePeople(user) ||
                      canManageEmployee ||
                      canManageReporting
                    }
                  />
                </div>

                <div ref={directReportsSectionRef} className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    Direct reports
                  </h2>

                  {directReports.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {directReports.map(({ employee }) => {
                        const directReportName =
                          employee.displayName?.trim() ||
                          employee.fullName?.trim() ||
                          `${employee.firstName} ${employee.lastName}`;
                        const href = canOpenDirectReportProfiles
                          ? buildTenantContextHref(
                              `/employees/${employee.stableEmployeeKey}`,
                              tenantId,
                              tenantSlug
                            )
                          : null;
                        const tertiary = employee.jobTitle ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{employee.jobTitle}</span>
                            {employee.status === "Inactive" ? (
                              <Badge variant="outline">Inactive</Badge>
                            ) : null}
                          </div>
                        ) : employee.status === "Inactive" ? (
                          <Badge variant="outline">Inactive</Badge>
                        ) : null;

                        return (
                          <PersonSummaryCard
                            key={employee.id}
                            name={directReportName}
                            secondary={employee.email}
                            tertiary={tertiary}
                            href={href}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No direct reports.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {canViewAccess ? (
            <div ref={accessSectionRef}>
              <WorkforceAccountCard
                employeeId={profile.id}
                firstName={profile.firstName}
                lastName={profile.lastName}
                email={profile.email}
                canManageAccess={canManageAccess}
                onManageAccess={
                  canManageAccess ? openAccessManagement : undefined
                }
              />
            </div>
          ) : null}

          {!isRecordComplete ? (
            <Card className={WORKSPACE_CARD_CLASS_NAME}>
              <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
                <CardTitle className="text-base">Record completeness</CardTitle>
                <CardAction>
                  <Badge variant={recordBadgeVariant}>Incomplete record</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
                <div className="space-y-3">
                  {recordIssues.map((issue) => {
                    const fixSheet = getEmployeeFixSheet(issue);
                    const canOpenIssue =
                      fixSheet === "reporting"
                        ? canManageReporting
                        : !!fixSheet && canManageEmployee;

                    return (
                      <div
                        key={`${issue.code}:${issue.fieldKey ?? "none"}`}
                        className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-4 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{issue.label}</p>
                            <Badge
                              variant={getEmployeeReadinessBadgeVariant(issue)}
                            >
                              {issue.severity === "Blocker"
                                ? "Blocker"
                                : "Action"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {getEmployeeReadinessBadgeLabel(issue)}
                          </p>
                        </div>
                        {canOpenIssue ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenReadinessIssue(issue)}
                          >
                            Open fix
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {canManageAccess ? (
        <EmployeeAccessManagementSheet
          open={accessSheetOpen}
          onOpenChange={setAccessSheetOpen}
          employeeId={profile.id}
          displayName={displayName}
          email={profile.email}
          firstName={profile.firstName}
          lastName={profile.lastName}
          directReportCount={profile.directReportCount}
          canManageProfiles={canManageProfiles}
          profilesHref={profilesHref}
        />
      ) : null}

      <SelfProfileDetailsDialog
        open={selfProfileSheetOpen}
        onOpenChange={setSelfProfileSheetOpen}
        employeeId={profile.id}
        phone={profile.phone}
        showPhone={showPhone}
        preferredName={profile.preferredName}
        expectedVersion={profile.version}
        canEditPreferredName={canEditOwnPreferredName}
        canEditPhone={canEditOwnPhone}
      />

      <EmployeeEditDialog
        profile={profile}
        employeeKey={profile.stableEmployeeKey}
        defaultTab={editDialogTab}
        showPhone={showPhone}
        requirePhone={requirePhone}
        showJobTitle={showJobTitle}
        showHireDate={showHireDate}
        showWorkLocation={showWorkLocation}
        showEmploymentType={showEmploymentType}
        requireJobTitle={requireJobTitle}
        requireHireDate={requireHireDate}
        requireWorkLocation={requireWorkLocation}
        requireEmploymentType={requireEmploymentType}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <EmployeeConfirmDialog
        open={showDeactivateEmployeeConfirm}
        onOpenChange={setShowDeactivateEmployeeConfirm}
        title="Deactivate employee?"
        description="This employee will no longer appear as active."
        confirmLabel="Deactivate employee"
        confirmVariant="destructive"
        loading={deactivateEmployeeMutation.isLoading}
        loadingLabel="Deactivating..."
        onConfirm={() => void handleDeactivateEmployee()}
      />
    </div>
  );
}
