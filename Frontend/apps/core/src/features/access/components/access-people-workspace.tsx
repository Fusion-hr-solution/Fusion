"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Copy,
  KeyRound,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  UserCog,
  Users,
} from "lucide-react";
import {
  type AccessProfileAssignmentSummaryDto,
  type WorkforceAccessRosterSummaryDto,
  type WorkforceAccessSubjectSummaryDto,
} from "@repo/api";
import {
  canAccessCoreAccess,
  canManageCoreAccess,
  canManageCoreAccessProfiles,
  useAuth,
} from "@repo/auth";
import { DEFAULT_PAGE_SIZE, type PageSize } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import {
  getInvitationEligibility,
  isProvisionableInBulk,
  matchesEmployeeAccessFilter,
  parseEmployeeAccessFilter,
} from "@/features/access/shared/employee-access";
import { PaginationBar } from "@/app/(pages)/employees/pagination-bar";
import type {
  EmployeeAccessFilter,
  WorkforceAccountBulkProvisionResultDto,
  WorkforceAccountStatusDto,
  WorkforceAccountSubject,
  WorkforceInvitationDeliveryState,
} from "@/app/(pages)/employees/employee-roster.types";
import {
  useBulkProvisionWorkforceAccountInvites,
  useDeactivateWorkforceAccount,
  useProvisionWorkforceAccountInvite,
  useReactivateWorkforceAccount,
  useResendWorkforceAccountInvite,
  useWorkforceAccountStatuses,
  useWorkforceAccountSummary,
} from "@/app/(pages)/employees/use-workforce-accounts";
import {
  useAccessProfiles,
  useBulkSetUserAccessProfiles,
  useSetUserAccessProfiles,
} from "@/features/access/api/use-core-access";
import { AccessWorkspaceNav } from "@/app/(pages)/access/access-workspace-nav";
import { useAccessSubjectSummary, useAccessSubjects } from "@/app/(pages)/access/use-access-subjects";

type AccessRow = WorkforceAccessSubjectSummaryDto & {
  workforceAccount: WorkforceAccountStatusDto | null;
};

type BadgeTone = "default" | "secondary" | "destructive" | "outline";
type ProductAccessState = "Not invited" | "Invite pending" | "Active" | "Inactive" | "Needs review";
type RowActionType = "open" | "resend" | "reactivate";

interface RowPrimaryAction {
  label: string;
  type: RowActionType;
}

const ALL_FILTER = "__all__";
const SUMMARY_UNAVAILABLE_MESSAGE =
  "Summary unavailable. The people list is still available.";
const ACCESS_FILTER_OPTIONS: Array<{
  value: EmployeeAccessFilter;
  label: string;
}> = [
  { value: "NotInvited", label: "Not invited" },
  { value: "Invited", label: "Invite pending" },
  { value: "AccountActive", label: "Active" },
  { value: "NeedsReview", label: "Needs review" },
];

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
    return error.message.trim();
  }

  return "An unexpected error occurred.";
}

function getProductErrorMessage(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized === "not found" ||
    normalized.includes("request failed") ||
    normalized.includes("internal server error") ||
    normalized.includes("failed to fetch")
  ) {
    return fallback;
  }

  return message;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-GB");
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatShortDateTime(value: string | null | undefined): string {
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

function getAccessState(
  account: WorkforceAccountStatusDto | null
): { label: ProductAccessState; tone: BadgeTone } {
  if (!account || account.provisioningState === "Unprovisioned") {
    return { label: "Not invited", tone: "outline" };
  }

  switch (account.provisioningState) {
    case "InvitePending":
      return { label: "Invite pending", tone: "secondary" };
    case "Active":
      return { label: "Active", tone: "default" };
    case "Inactive":
      return { label: "Inactive", tone: "destructive" };
    case "InviteAccepted":
    case "InviteExpired":
    case "InviteRevoked":
    case "Conflict":
    default:
      return { label: "Needs review", tone: "destructive" };
  }
}

function getDeliveryStateLabel(
  deliveryState: WorkforceInvitationDeliveryState | null | undefined
): string | null {
  switch (deliveryState) {
    case "Sent":
      return "Email sent";
    case "Failed":
      return "Email failed";
    default:
      return null;
  }
}

function getAccessSecondaryLabel(
  account: WorkforceAccountStatusDto | null
): string | null {
  if (!account || account.provisioningState === "Unprovisioned") {
    return null;
  }

  switch (account.provisioningState) {
    case "InvitePending":
      return getDeliveryStateLabel(account.deliveryStatus) ?? "Awaiting activation";
    case "InviteExpired":
      return "Invite expired";
    case "InviteRevoked":
      return "Invite revoked";
    case "InviteAccepted":
      return "Invite accepted";
    case "Inactive":
      return "Account linked";
    case "Conflict":
      return "Conflict detected";
    case "Active":
    default:
      return null;
  }
}

function getLastActivityLabel(account: WorkforceAccountStatusDto | null): string {
  if (!account || account.provisioningState === "Unprovisioned") {
    return "No activity";
  }

  switch (account.provisioningState) {
    case "InvitePending":
    case "InviteExpired":
    case "InviteRevoked":
      if (account.deliveryStatus === "Failed") {
        return "Email failed";
      }

      return account.inviteCreatedAt
        ? `Invite sent ${formatShortDate(account.inviteCreatedAt)}`
        : "Invite created";
    case "InviteAccepted":
      return "Invite accepted";
    case "Active":
    case "Inactive":
      return account.lastLoginAt
        ? `Last sign-in ${formatShortDate(account.lastLoginAt)}`
        : account.provisioningState === "Inactive"
          ? "Account inactive"
          : "No activity";
    case "Conflict":
    default:
      return "Needs review";
  }
}

function getDetailedLastActivityLabel(
  account: WorkforceAccountStatusDto | null
): string {
  if (!account || account.provisioningState === "Unprovisioned") {
    return "No activity";
  }

  switch (account.provisioningState) {
    case "InvitePending":
    case "InviteExpired":
    case "InviteRevoked":
      return account.inviteCreatedAt
        ? `Invite sent ${formatShortDateTime(account.inviteCreatedAt)}`
        : "Invite created";
    case "InviteAccepted":
      return "Invite accepted";
    case "Active":
    case "Inactive":
      return account.lastLoginAt
        ? `Last sign-in ${formatShortDateTime(account.lastLoginAt)}`
        : account.provisioningState === "Inactive"
          ? "Account inactive"
          : "No activity";
    case "Conflict":
    default:
      return "Needs review";
  }
}

function getReviewIssue(
  account: WorkforceAccountStatusDto | null
): { title: string; nextStep: string } | null {
  if (!account) {
    return null;
  }

  switch (account.provisioningState) {
    case "Conflict":
      return {
        title: "Conflict",
        nextStep:
          account.conflict?.suggestedAction ??
          "Review the linked account or invitation before continuing.",
      };
    case "InviteExpired":
      return {
        title: "Invite expired",
        nextStep: "Send a fresh invite if this person still needs access.",
      };
    case "InviteRevoked":
      return {
        title: "Invite revoked",
        nextStep: "Send a new invite if access should be restored.",
      };
    case "InviteAccepted":
      return {
        title: "Invite accepted",
        nextStep: "Review the account state and assigned access profiles.",
      };
    case "Inactive":
      return {
        title: "Inactive account",
        nextStep: "Reactivate the account or confirm access should stay disabled.",
      };
    default:
      return null;
  }
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

function matchesAccessFilter(
  row: AccessRow,
  filter: EmployeeAccessFilter | typeof ALL_FILTER
): boolean {
  if (filter === ALL_FILTER) {
    return true;
  }

  return matchesEmployeeAccessFilter(row.workforceAccount, filter);
}

function matchesProfileFilter(row: AccessRow, profileId: string): boolean {
  if (profileId === ALL_FILTER) {
    return true;
  }

  return (
    row.workforceAccount?.accessProfiles.some((profile) => profile.id === profileId) ??
    false
  );
}

function getCommonAssignedProfileIds(rows: AccessRow[]): string[] {
  if (rows.length === 0) {
    return [];
  }

  const commonProfileIds = new Set(
    rows[0]?.workforceAccount?.accessProfiles.map((profile) => profile.id) ?? []
  );

  rows.slice(1).forEach((row) => {
    const rowProfileIds = new Set(
      row.workforceAccount?.accessProfiles.map((profile) => profile.id) ?? []
    );

    for (const profileId of [...commonProfileIds]) {
      if (!rowProfileIds.has(profileId)) {
        commonProfileIds.delete(profileId);
      }
    }
  });

  return [...commonProfileIds];
}

function formatBulkProvisionSummary(
  results: WorkforceAccountBulkProvisionResultDto[]
): string {
  const counts = results.reduce(
    (summary, result) => {
      summary[result.outcome] += 1;
      return summary;
    },
    {
      Created: 0,
      Pending: 0,
      Active: 0,
      Inactive: 0,
      Conflict: 0,
    }
  );

  return [
    counts.Created ? `${counts.Created} sent` : null,
    counts.Pending ? `${counts.Pending} already pending` : null,
    counts.Active ? `${counts.Active} already active` : null,
    counts.Inactive ? `${counts.Inactive} inactive` : null,
    counts.Conflict ? `${counts.Conflict} need review` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatSelectionPreview(rows: AccessRow[], limit = 4): string {
  const names = rows.slice(0, limit).map((row) => row.displayName);
  const remainder = rows.length - names.length;

  if (remainder > 0) {
    return `${names.join(", ")} and ${remainder} more`;
  }

  return names.join(", ");
}

function getSummaryMetrics(
  rosterSummary: WorkforceAccessRosterSummaryDto,
  accountSummary: {
    activeAccountCount: number;
    pendingInviteCount: number;
    trackedEmployeeCount: number;
    attentionQueueCount: number;
  }
) {
  const notInvitedCount = Math.max(
    0,
    rosterSummary.totalCount - accountSummary.trackedEmployeeCount
  );

  return [
    { label: "Not invited", value: notInvitedCount },
    { label: "Pending invites", value: accountSummary.pendingInviteCount },
    { label: "Active accounts", value: accountSummary.activeAccountCount },
    { label: "Needs review", value: accountSummary.attentionQueueCount },
  ];
}

function getSelectionCounts(rows: AccessRow[]) {
  let pendingCount = 0;
  let needsReviewCount = 0;
  let copyableCount = 0;

  rows.forEach((row) => {
    const eligibility = getInvitationEligibility(row.workforceAccount);
    const accessState = getAccessState(row.workforceAccount).label;

    if (eligibility.hasPendingInvite) {
      pendingCount += 1;
    }

    if (eligibility.canCopyInviteLink) {
      copyableCount += 1;
    }

    if (accessState === "Inactive" || accessState === "Needs review") {
      needsReviewCount += 1;
    }
  });

  return {
    pendingCount,
    needsReviewCount,
    copyableCount,
  };
}

function getRowPrimaryAction(
  row: AccessRow,
  canManageAccess: boolean
): RowPrimaryAction {
  const eligibility = getInvitationEligibility(row.workforceAccount);

  if (!canManageAccess) {
    return { label: "View", type: "open" };
  }

  if (eligibility.canInvite) {
    return { label: "Send invite", type: "open" };
  }

  if (eligibility.canResend) {
    return { label: "Resend", type: "resend" };
  }

  if (eligibility.canReactivate) {
    return { label: "Reactivate", type: "reactivate" };
  }

  if (row.workforceAccount?.userId) {
    return { label: "Manage", type: "open" };
  }

  return { label: "Review", type: "open" };
}

function ProfileBadges({
  profiles,
  emptyLabel = "No profile",
  limit = 2,
}: {
  profiles: AccessProfileAssignmentSummaryDto[];
  emptyLabel?: string;
  limit?: number;
}) {
  if (profiles.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyLabel}</span>;
  }

  const visibleProfiles = profiles.slice(0, limit);
  const hiddenCount = profiles.length - visibleProfiles.length;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {visibleProfiles.map((profile) => (
        <Badge key={profile.id} variant="outline" className="max-w-full truncate" title={profile.name}>
          {profile.name}
        </Badge>
      ))}
      {hiddenCount > 0 ? <Badge variant="outline">+{hiddenCount}</Badge> : null}
    </div>
  );
}

function SummaryMetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function SummaryStripSkeleton() {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-card px-4 py-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

function TableLoadingSkeleton({
  showSelection,
}: {
  showSelection: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {showSelection ? <TableHead className="w-12" /> : null}
            <TableHead>Person</TableHead>
            <TableHead>Access</TableHead>
            <TableHead>Profiles</TableHead>
            <TableHead>Last activity</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index}>
              {showSelection ? (
                <TableCell className="w-12 py-3">
                  <Skeleton className="size-4 rounded-sm" />
                </TableCell>
              ) : null}
              <TableCell className="py-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3.5 w-44" />
                </div>
              </TableCell>
              <TableCell className="py-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              </TableCell>
              <TableCell className="py-3">
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </TableCell>
              <TableCell className="py-3">
                <Skeleton className="h-3.5 w-28" />
              </TableCell>
              <TableCell className="py-3 text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-7 w-24 rounded-lg" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="text-base font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PeopleListErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border px-6 py-10 text-center">
      <p className="text-base font-medium">Couldn&apos;t load people</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Try again. The list could not be loaded right now.
      </p>
      <div className="mt-4 flex justify-center">
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

function AccessProfileChecklist({
  profiles,
  selectedProfileIds,
  onToggleProfile,
  disabled,
  isLoading,
}: {
  profiles: AccessProfileAssignmentSummaryDto[];
  selectedProfileIds: string[];
  onToggleProfile: (profileId: string, checked: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border px-3 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-3.5 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border px-3 py-4 text-sm text-muted-foreground">
        No access profiles are available.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {profiles.map((profile) => {
        const checked = selectedProfileIds.includes(profile.id);
        return (
          <label
            key={profile.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              checked ? "border-primary/30 bg-primary/5" : "bg-background"
            )}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value) =>
                onToggleProfile(profile.id, value === true)
              }
            />
            <span className="space-y-0.5">
              <span className="font-medium">{profile.name}</span>
              <span className="block text-xs text-muted-foreground">
                {profile.type === "SystemSeeded" ? "System profile" : "Custom profile"}
              </span>
            </span>
          </label>
        );
      })}
    </div>
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

function AccessPersonSheet({
  open,
  onOpenChange,
  row,
  canManageAccess,
  accessProfiles,
  isProfilesLoading,
  selectedProfileIds,
  onToggleProfile,
  inviteProfileId,
  onInviteProfileChange,
  onInvite,
  onResend,
  onCopyInviteLink,
  onSaveProfiles,
  onReactivate,
  onDeactivate,
  isMutating,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AccessRow | null;
  canManageAccess: boolean;
  accessProfiles: AccessProfileAssignmentSummaryDto[];
  isProfilesLoading: boolean;
  selectedProfileIds: string[];
  onToggleProfile: (profileId: string, checked: boolean) => void;
  inviteProfileId: string;
  onInviteProfileChange: (value: string) => void;
  onInvite: () => Promise<void>;
  onResend: () => Promise<void>;
  onCopyInviteLink: (account: WorkforceAccountStatusDto | null) => Promise<void>;
  onSaveProfiles: () => Promise<void>;
  onReactivate: () => Promise<void>;
  onDeactivate: () => Promise<void>;
  isMutating: boolean;
  errorMessage: string | null;
}) {
  if (!open && !row) {
    return null;
  }

  if (!row) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Access details</SheetTitle>
            <SheetDescription>Loading access details.</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-40 rounded-lg" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const accessState = getAccessState(row.workforceAccount);
  const secondaryLabel = getAccessSecondaryLabel(row.workforceAccount);
  const lastActivity = getDetailedLastActivityLabel(row.workforceAccount);
  const eligibility = getInvitationEligibility(row.workforceAccount);
  const reviewIssue = getReviewIssue(row.workforceAccount);
  const canEditProfiles = canManageAccess && !!row.workforceAccount?.userId;
  const currentProfiles = row.workforceAccount?.accessProfiles ?? [];
  const deliveryState = getDeliveryStateLabel(row.workforceAccount?.deliveryStatus);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 pb-4 pt-6 pr-14">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start gap-2">
              <SheetTitle className="min-w-0 text-lg">{row.displayName}</SheetTitle>
              <Badge variant={accessState.tone}>{accessState.label}</Badge>
            </div>
            <SheetDescription className="space-y-1">
              <span className="block break-all" title={row.workEmail}>
                {row.workEmail}
              </span>
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailFact
                label="Employee status"
                value={
                  <Badge variant={row.isActive ? "secondary" : "outline"}>
                    {row.isActive ? "Active employee" : "Inactive employee"}
                  </Badge>
                }
              />
              <DetailFact
                label="Account state"
                value={<Badge variant={accessState.tone}>{accessState.label}</Badge>}
                supporting={secondaryLabel}
              />
              <DetailFact
                label="Current profiles"
                value={<ProfileBadges profiles={currentProfiles} />}
              />
              <DetailFact label="Last activity" value={lastActivity} />
            </div>

            {reviewIssue ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3">
                <p className="text-sm font-medium text-destructive">{reviewIssue.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.workforceAccount?.conflict?.message ?? reviewIssue.nextStep}
                </p>
                {row.workforceAccount?.conflict?.message ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reviewIssue.nextStep}
                  </p>
                ) : null}
              </div>
            ) : null}

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>Action couldn&apos;t be completed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            {eligibility.canInvite ? (
              <section className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">Send invite</h2>
                  <p className="text-sm text-muted-foreground">
                    Choose the access profile to attach to this invite.
                  </p>
                </div>

                {isProfilesLoading ? (
                  <Skeleton className="h-10 w-full rounded-lg" />
                ) : (
                  <Select value={inviteProfileId} onValueChange={onInviteProfileChange}>
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
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={onInvite} disabled={!inviteProfileId || isMutating}>
                    {isMutating ? <Spinner className="size-4" /> : <Send className="size-4" />}
                    Send invite
                  </Button>
                </div>
              </section>
            ) : null}

            {row.workforceAccount?.provisioningState === "InvitePending" ? (
              <section className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">Invite pending</h2>
                  <p className="text-sm text-muted-foreground">
                    Track delivery or resend the invite.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DetailFact
                    label="Assigned profile"
                    value={<ProfileBadges profiles={currentProfiles} />}
                  />
                  <DetailFact
                    label="Delivery"
                    value={deliveryState ?? "Unavailable"}
                    supporting={row.workforceAccount.deliveryRecordedAt ? formatShortDateTime(row.workforceAccount.deliveryRecordedAt) : null}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {canManageAccess ? (
                    <Button variant="outline" onClick={onResend} disabled={isMutating}>
                      {isMutating ? (
                        <Spinner className="size-4" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Resend invite
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {(canEditProfiles || row.workforceAccount?.userId) &&
            row.workforceAccount?.provisioningState !== "InvitePending" ? (
              <section className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">Manage access profiles</h2>
                  <p className="text-sm text-muted-foreground">
                    Profile changes apply to the linked account.
                  </p>
                </div>

                {canEditProfiles ? (
                  <AccessProfileChecklist
                    profiles={accessProfiles}
                    selectedProfileIds={selectedProfileIds}
                    onToggleProfile={onToggleProfile}
                    disabled={isMutating}
                    isLoading={isProfilesLoading}
                  />
                ) : (
                  <ProfileBadges profiles={currentProfiles} />
                )}

                {canEditProfiles ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={onSaveProfiles} disabled={isMutating}>
                      {isMutating ? (
                        <Spinner className="size-4" />
                      ) : (
                        <UserCog className="size-4" />
                      )}
                      Save profiles
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {canManageAccess && (eligibility.canReactivate || eligibility.canDeactivate) ? (
              <section className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">Account actions</h2>
                  <p className="text-sm text-muted-foreground">
                    Use these actions when the account state needs direct intervention.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {eligibility.canReactivate ? (
                    <Button variant="outline" onClick={onReactivate} disabled={isMutating}>
                      {isMutating ? (
                        <Spinner className="size-4" />
                      ) : (
                        <KeyRound className="size-4" />
                      )}
                      Reactivate account
                    </Button>
                  ) : null}
                  {eligibility.canDeactivate ? (
                    <Button variant="outline" onClick={onDeactivate} disabled={isMutating}>
                      {isMutating ? (
                        <Spinner className="size-4" />
                      ) : (
                        <ShieldAlert className="size-4" />
                      )}
                      Deactivate account
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {!canManageAccess ? (
              <div className="rounded-lg border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                You can review access state here. Access changes require access management permission.
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BulkInviteDialog({
  open,
  onOpenChange,
  selectedRows,
  inviteCandidates,
  accessProfiles,
  inviteProfileId,
  onInviteProfileChange,
  onSubmit,
  isLoading,
  isProfilesLoading,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRows: AccessRow[];
  inviteCandidates: AccessRow[];
  accessProfiles: AccessProfileAssignmentSummaryDto[];
  inviteProfileId: string;
  onInviteProfileChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  isLoading: boolean;
  isProfilesLoading: boolean;
  errorMessage: string | null;
}) {
  const skippedCount = selectedRows.length - inviteCandidates.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send invites</DialogTitle>
          <DialogDescription>
            Choose the access profile to apply to the selected people.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Bulk invite couldn&apos;t be completed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <DetailFact label="Selected" value={selectedRows.length} />
            <DetailFact label="Ready to invite" value={inviteCandidates.length} />
            <DetailFact label="Skipped" value={skippedCount} />
          </div>

          {inviteCandidates.length === 0 ? (
            <EmptyState
              title="All selected people already have access."
              description="Choose people who are ready for a new invite or resend."
            />
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Access profile
                </p>
                {isProfilesLoading ? (
                  <Skeleton className="h-10 w-full rounded-lg" />
                ) : (
                  <Select value={inviteProfileId} onValueChange={onInviteProfileChange}>
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
                )}
              </div>

              <div className="rounded-lg border px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Ready to invite
                </p>
                <p className="mt-2 text-sm">{formatSelectionPreview(inviteCandidates)}</p>
              </div>
            </>
          )}

          {skippedCount > 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {skippedCount} selected {skippedCount === 1 ? "person will" : "people will"} be skipped because they already have access, have a pending invite, or need review.
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={inviteCandidates.length === 0 || !inviteProfileId || isLoading}
          >
            {isLoading ? <Spinner className="size-4" /> : <Send className="size-4" />}
            Send invites
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkAssignDialog({
  open,
  onOpenChange,
  selectedRows,
  assignableRows,
  accessProfiles,
  selectedProfileIds,
  onToggleProfile,
  onSubmit,
  isLoading,
  isProfilesLoading,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRows: AccessRow[];
  assignableRows: AccessRow[];
  accessProfiles: AccessProfileAssignmentSummaryDto[];
  selectedProfileIds: string[];
  onToggleProfile: (profileId: string, checked: boolean) => void;
  onSubmit: () => Promise<void>;
  isLoading: boolean;
  isProfilesLoading: boolean;
  errorMessage: string | null;
}) {
  const skippedCount = selectedRows.length - assignableRows.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign access profiles</DialogTitle>
          <DialogDescription>
            Update the linked accounts in the current selection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Profile update couldn&apos;t be completed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <DetailFact label="Selected" value={selectedRows.length} />
            <DetailFact label="Linked accounts" value={assignableRows.length} />
            <DetailFact label="Skipped" value={skippedCount} />
          </div>

          {assignableRows.length === 0 ? (
            <EmptyState
              title="No linked accounts selected"
              description="Select people with linked accounts to change access profiles."
            />
          ) : (
            <AccessProfileChecklist
              profiles={accessProfiles}
              selectedProfileIds={selectedProfileIds}
              onToggleProfile={onToggleProfile}
              disabled={isLoading}
              isLoading={isProfilesLoading}
            />
          )}

          {skippedCount > 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {skippedCount} selected {skippedCount === 1 ? "person does" : "people do"} not have a linked account and will be skipped.
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={assignableRows.length === 0 || isLoading}>
            {isLoading ? <Spinner className="size-4" /> : <UserCog className="size-4" />}
            Save profiles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AccessPeopleWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const { tenantId, tenantSlug } = useTenantContext();
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [accessFilter, setAccessFilter] = useState<
    EmployeeAccessFilter | typeof ALL_FILTER
  >(() => parseEmployeeAccessFilter(searchParams.get("access")) ?? ALL_FILTER);
  const [profileFilter, setProfileFilter] = useState(ALL_FILTER);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [inviteProfileId, setInviteProfileId] = useState("");
  const [bulkProfileIds, setBulkProfileIds] = useState<string[]>([]);
  const [bulkInviteProfileId, setBulkInviteProfileId] = useState("");
  const [isBulkInviteOpen, setIsBulkInviteOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [bulkInviteError, setBulkInviteError] = useState<string | null>(null);
  const [bulkAssignError, setBulkAssignError] = useState<string | null>(null);
  const [pendingRowActionKey, setPendingRowActionKey] = useState<string | null>(
    null
  );

  const canViewAccess = canAccessCoreAccess(user);
  const canManageAccess = canManageCoreAccess(user);
  const canManageProfiles = canManageCoreAccessProfiles(user);
  const profilesHref = buildTenantContextHref(
    "/access/profiles",
    tenantId,
    tenantSlug
  );
  const showSelection = canManageAccess;

  useEffect(() => {
    if (!canViewAccess && canManageProfiles) {
      router.replace(profilesHref);
    }
  }, [canManageProfiles, canViewAccess, profilesHref, router]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    setAccessFilter(
      parseEmployeeAccessFilter(searchParams.get("access")) ?? ALL_FILTER
    );
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    setSelectedEmployeeIds([]);
  }, [page, pageSize, deferredSearch, accessFilter, profileFilter]);

  useEffect(() => {
    setDetailError(null);
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (!isBulkInviteOpen) {
      setBulkInviteError(null);
    }
  }, [isBulkInviteOpen]);

  useEffect(() => {
    if (!isBulkAssignOpen) {
      setBulkAssignError(null);
    }
  }, [isBulkAssignOpen]);

  const { data: accessProfiles = [], isLoading: isProfilesLoading } =
    useAccessProfiles(canViewAccess || canManageAccess || canManageProfiles);
  const accessSummaryQuery = useAccessSubjectSummary(canViewAccess);
  const accountSummaryQuery = useWorkforceAccountSummary(canViewAccess);
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
  const areStatusesReady =
    statusSubjects.length === 0 || (statusQuery.data?.length ?? 0) === statusSubjects.length;
  const rows = useMemo(
    () =>
      areStatusesReady
        ? mergeRows(accessSubjectsQuery.data?.items ?? [], statusQuery.data ?? [])
        : [],
    [accessSubjectsQuery.data?.items, areStatusesReady, statusQuery.data]
  );

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
    if (selectedEmployeeId && accessSubjectsQuery.data && areStatusesReady && !selectedRow) {
      setSelectedEmployeeId(null);
    }
  }, [
    accessSubjectsQuery.data,
    areStatusesReady,
    selectedEmployeeId,
    selectedRow,
  ]);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }

    setSelectedProfileIds(
      selectedRow.workforceAccount?.accessProfiles.map((profile) => profile.id) ?? []
    );
    setInviteProfileId(
      getSelectedInviteProfileId(
        accessProfiles,
        selectedRow.workforceAccount?.accessProfiles[0]?.id
      )
    );
  }, [accessProfiles, selectedRow]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedEmployeeIds.includes(row.employeeId)),
    [rows, selectedEmployeeIds]
  );
  const inviteCandidates = useMemo(
    () =>
      selectedRows.filter((row) =>
        isProvisionableInBulk(getInvitationEligibility(row.workforceAccount).cohort)
      ),
    [selectedRows]
  );
  const assignableRows = useMemo(
    () => selectedRows.filter((row) => !!row.workforceAccount?.userId),
    [selectedRows]
  );
  const selectionCounts = useMemo(
    () => getSelectionCounts(selectedRows),
    [selectedRows]
  );

  const visibleEmployeeIds = useMemo(
    () => filteredRows.map((row) => row.employeeId),
    [filteredRows]
  );
  const allVisibleSelected =
    visibleEmployeeIds.length > 0 &&
    visibleEmployeeIds.every((employeeId) =>
      selectedEmployeeIds.includes(employeeId)
    );
  const someVisibleSelected =
    !allVisibleSelected &&
    visibleEmployeeIds.some((employeeId) =>
      selectedEmployeeIds.includes(employeeId)
    );

  const summaryMetrics = useMemo(() => {
    if (!accessSummaryQuery.data || !accountSummaryQuery.data) {
      return null;
    }

    return getSummaryMetrics(accessSummaryQuery.data, accountSummaryQuery.data);
  }, [accessSummaryQuery.data, accountSummaryQuery.data]);

  const provisionInvite = useProvisionWorkforceAccountInvite();
  const bulkProvisionInvites = useBulkProvisionWorkforceAccountInvites();
  const resendInvite = useResendWorkforceAccountInvite();
  const reactivateAccount = useReactivateWorkforceAccount();
  const deactivateAccount = useDeactivateWorkforceAccount();
  const setUserAccessProfiles = useSetUserAccessProfiles();
  const bulkSetUserAccessProfiles = useBulkSetUserAccessProfiles();

  const isPersonMutating =
    provisionInvite.isLoading ||
    resendInvite.isLoading ||
    reactivateAccount.isLoading ||
    deactivateAccount.isLoading ||
    setUserAccessProfiles.isLoading;

  const hasActiveFilters =
    searchInput.trim().length > 0 ||
    accessFilter !== ALL_FILTER ||
    profileFilter !== ALL_FILTER;
  const tableError = accessSubjectsQuery.error ?? statusQuery.error;
  const summaryError = accessSummaryQuery.error ?? accountSummaryQuery.error;
  const isSummaryLoading =
    !summaryError && (!accessSummaryQuery.data || !accountSummaryQuery.data);
  const isTableLoading =
    !tableError && (!accessSubjectsQuery.data || !areStatusesReady);
  const showTableFooter = !tableError && !isTableLoading;

  const openPerson = (employeeId: string) => {
    setDetailError(null);
    setSelectedEmployeeId(employeeId);
  };

  const resetFilters = () => {
    setSearchInput("");
    setAccessFilter(ALL_FILTER);
    setProfileFilter(ALL_FILTER);
    setPage(1);
  };

  const handleInvite = async () => {
    if (!selectedRow || !inviteProfileId) {
      return;
    }

    setDetailError(null);

    try {
      await provisionInvite.mutateAsync({
        employeeId: selectedRow.employeeId,
        email: selectedRow.workEmail,
        firstName: selectedRow.firstName,
        lastName: selectedRow.lastName,
        accessProfileId: inviteProfileId,
      });
      toast({
        title: "Invite sent",
        description: `${selectedRow.displayName} now has a pending invite.`,
      });
    } catch (error) {
      setDetailError(
        getProductErrorMessage(error, "The invite could not be sent. Try again.")
      );
    }
  };

  const handleResend = async () => {
    if (!selectedRow) {
      return;
    }

    setDetailError(null);

    try {
      await resendInvite.mutateAsync({ employeeId: selectedRow.employeeId });
      toast({
        title: "Invite resent",
        description: `${selectedRow.displayName}'s invite has been refreshed.`,
      });
    } catch (error) {
      setDetailError(
        getProductErrorMessage(error, "The invite could not be resent. Try again.")
      );
    }
  };

  const handleReactivate = async () => {
    if (!selectedRow) {
      return;
    }

    setDetailError(null);

    try {
      await reactivateAccount.mutateAsync({ employeeId: selectedRow.employeeId });
      toast({
        title: "Account reactivated",
        description: `${selectedRow.displayName} can sign in again.`,
      });
    } catch (error) {
      setDetailError(
        getProductErrorMessage(error, "The account could not be reactivated. Try again.")
      );
    }
  };

  const handleDeactivate = async () => {
    if (!selectedRow) {
      return;
    }

    setDetailError(null);

    try {
      await deactivateAccount.mutateAsync({ employeeId: selectedRow.employeeId });
      toast({
        title: "Account deactivated",
        description: `${selectedRow.displayName}'s sign-in has been disabled.`,
      });
    } catch (error) {
      setDetailError(
        getProductErrorMessage(error, "The account could not be deactivated. Try again.")
      );
    }
  };

  const handleSaveProfiles = async () => {
    if (!selectedRow?.workforceAccount?.userId) {
      return;
    }

    setDetailError(null);

    try {
      await setUserAccessProfiles.mutateAsync({
        userId: selectedRow.workforceAccount.userId,
        input: { accessProfileIds: selectedProfileIds },
      });
      toast({
        title: "Profiles updated",
        description: `${selectedRow.displayName}'s access profiles were saved.`,
      });
    } catch (error) {
      setDetailError(
        getProductErrorMessage(error, "The profile changes could not be saved. Try again.")
      );
    }
  };

  const handleBulkInvite = async () => {
    if (inviteCandidates.length === 0 || !bulkInviteProfileId) {
      return;
    }

    setBulkInviteError(null);

    try {
      const results = await bulkProvisionInvites.mutateAsync({
        items: inviteCandidates.map((row) => ({
          employeeId: row.employeeId,
          email: row.workEmail,
          firstName: row.firstName,
          lastName: row.lastName,
          accessProfileId: bulkInviteProfileId,
        })),
      });

      toast({
        title: "Bulk invite completed",
        description: formatBulkProvisionSummary(results),
      });
      setIsBulkInviteOpen(false);
      setSelectedEmployeeIds([]);
    } catch (error) {
      setBulkInviteError(
        getProductErrorMessage(error, "The bulk invite could not be completed. Try again.")
      );
    }
  };

  const handleBulkAssign = async () => {
    if (assignableRows.length === 0) {
      return;
    }

    setBulkAssignError(null);

    try {
      await bulkSetUserAccessProfiles.mutateAsync({
        userIds: assignableRows
          .map((row) => row.workforceAccount?.userId)
          .filter((userId): userId is string => !!userId),
        accessProfileIds: bulkProfileIds,
      });
      toast({
        title: "Profiles updated",
        description: `${assignableRows.length} ${assignableRows.length === 1 ? "account" : "accounts"} updated.`,
      });
      setIsBulkAssignOpen(false);
      setSelectedEmployeeIds([]);
    } catch (error) {
      setBulkAssignError(
        getProductErrorMessage(error, "The bulk profile update could not be completed. Try again.")
      );
    }
  };

  const runRowAction = async (actionKey: string, action: () => Promise<void>) => {
    setPendingRowActionKey(actionKey);

    try {
      await action();
    } finally {
      setPendingRowActionKey(null);
    }
  };

  const handleRowResend = async (row: AccessRow) => {
    await runRowAction(`${row.employeeId}:resend`, async () => {
      try {
        await resendInvite.mutateAsync({ employeeId: row.employeeId });
        toast({
          title: "Invite resent",
          description: `${row.displayName}'s invite has been refreshed.`,
        });
      } catch (error) {
        toast({
          title: "Resend failed",
          description: getProductErrorMessage(
            error,
            "The invite could not be resent. Try again."
          ),
          variant: "destructive",
        });
      }
    });
  };

  const handleRowReactivate = async (row: AccessRow) => {
    await runRowAction(`${row.employeeId}:reactivate`, async () => {
      try {
        await reactivateAccount.mutateAsync({ employeeId: row.employeeId });
        toast({
          title: "Account reactivated",
          description: `${row.displayName} can sign in again.`,
        });
      } catch (error) {
        toast({
          title: "Reactivate failed",
          description: getProductErrorMessage(
            error,
            "The account could not be reactivated. Try again."
          ),
          variant: "destructive",
        });
      }
    });
  };

  const handleRowPrimaryAction = async (row: AccessRow) => {
    const primaryAction = getRowPrimaryAction(row, canManageAccess);

    switch (primaryAction.type) {
      case "resend":
        await handleRowResend(row);
        return;
      case "reactivate":
        await handleRowReactivate(row);
        return;
      case "open":
      default:
        openPerson(row.employeeId);
        return;
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

  const toggleBulkProfile = (profileId: string, checked: boolean) => {
    setBulkProfileIds((current) => {
      if (checked) {
        return current.includes(profileId) ? current : [...current, profileId];
      }

      return current.filter((item) => item !== profileId);
    });
  };

  const toggleSelection = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      if (checked) {
        return current.includes(employeeId) ? current : [...current, employeeId];
      }

      return current.filter((item) => item !== employeeId);
    });
  };

  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);

      if (checked) {
        visibleEmployeeIds.forEach((employeeId) => next.add(employeeId));
      } else {
        visibleEmployeeIds.forEach((employeeId) => next.delete(employeeId));
      }

      return [...next];
    });
  };

  const openBulkInvite = () => {
    setBulkInviteError(null);
    setBulkInviteProfileId(getSelectedInviteProfileId(accessProfiles, undefined));
    setIsBulkInviteOpen(true);
  };

  const openBulkAssign = () => {
    setBulkAssignError(null);
    setBulkProfileIds(getCommonAssignedProfileIds(assignableRows));
    setIsBulkAssignOpen(true);
  };

  if (isLoading) {
    return (
      <CorePageLoadingState
        title="Access"
        description="Manage account activation, access profiles, and invitation status."
        message="Loading access workspace"
        variant="workspace"
      />
    );
  }

  if (!canViewAccess && canManageProfiles) {
    return (
      <CorePageLoadingState
        title="Access"
        description="Redirecting to access profiles."
        message="Opening access profiles"
        variant="redirect"
      />
    );
  }

  if (!canViewAccess && !canManageProfiles) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Access"
          description="Manage account activation, access profiles, and invitation status."
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
        description="Manage account activation, access profiles, and invitation status."
      />

      <AccessWorkspaceNav
        active="people"
        showPeople={canViewAccess}
        showProfiles={canManageProfiles}
      />
    </div>
  );
}
