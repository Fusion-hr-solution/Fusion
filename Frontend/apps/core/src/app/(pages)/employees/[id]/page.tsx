"use client";

import { useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Mail,
  ShieldAlert,
  Star,
  User,
  Users,
} from "lucide-react";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
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
import { Separator } from "@/components/ui/separator";
import { useBreadcrumbLabel } from "@/components/breadcrumb-overrides";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
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
} from "../use-employees";
import type {
  EmployeeHierarchyNodeDto,
  EmployeeHierarchyStatus,
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
}): string {
  if (hasTextValue(profile.managerFullName)) return profile.managerFullName!;
  return profile.managerId ? "Manager record not found" : "No manager assigned";
}

function getManagerChainSummary(
  managerChain: EmployeeHierarchyNodeDto[]
): string {
  if (managerChain.length === 0) return "No manager chain available.";
  const direct = managerChain[0]?.employee;
  const top = managerChain[managerChain.length - 1]?.employee;
  if (!direct || !top) return "No manager chain available.";
  const directName = `${direct.firstName} ${direct.lastName}`;
  const topName = `${top.firstName} ${top.lastName}`;
  return managerChain.length === 1
    ? `Reports directly to ${directName}.`
    : `${managerChain.length} levels to ${topName}; direct manager is ${directName}.`;
}

function buildAttentionItems(profile: {
  hierarchyStatus: EmployeeHierarchyStatus;
  orgUnitId: string | null;
  jobTitle: string | null;
}): string[] {
  const issues: string[] = [];
  if (profile.hierarchyStatus === "NoManagerAssigned")
    issues.push("No manager is assigned.");
  if (profile.hierarchyStatus === "ManagerMissing")
    issues.push(
      "The manager reference no longer resolves to an active employee record."
    );
  if (profile.hierarchyStatus === "ManagerInactive")
    issues.push("The assigned manager is inactive and should be updated.");
  if (!profile.orgUnitId) issues.push("Organization unit is not assigned.");
  if (!hasTextValue(profile.jobTitle)) issues.push("Job title is missing.");
  return issues;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function EmployeeProfilePage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const employeeId =
    typeof params.id === "string" && params.id.trim().length > 0
      ? params.id
      : null;
  const canAccess = canAccessEmployeeRoster(user);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeWorkspaceSheet, setActiveWorkspaceSheet] = useState<
    "identity" | "employment" | "organization" | "status" | null
  >(null);

  const {
    data: profile,
    error,
    isLoading,
  } = useEmployeeProfile(canAccess && employeeId ? employeeId : null);

  const { data: reportingLines } = useEmployeeReportingLines(
    canAccess && employeeId ? employeeId : null
  );

  // Register employee name in the top breadcrumb (Core > Employees > Jane Smith)
  useBreadcrumbLabel(employeeId ?? "", profile?.fullName);

  const isInitialLoading =
    (isAuthLoading && !user) ||
    (!isAuthLoading && canAccess && isLoading && !profile && !error);

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

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <EmptyState
          icon={Users}
          title="Employee profile is not available for this role"
          description="Ask a tenant HR administrator to access employee profiles."
        />
      </div>
    );
  }

  if (error) {
    const isNotFound =
      "status" in error && (error as { status?: number }).status === 404;

    return (
      <div className="flex flex-col gap-6 p-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/employees")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to employees
        </Button>
        {isNotFound ? (
          <EmptyState
            icon={User}
            title="Employee not found"
            description="This employee may have been removed or is outside your current scope."
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

  const hireDate = formatDate(profile.hireDate);
  const tenure = getTenure(profile.hireDate);
  const email = hasTextValue(profile.email) ? profile.email : "Not set";
  const managerEmail = profile.managerEmail?.trim()
    ? profile.managerEmail
    : "Not set";
  const attentionItems = buildAttentionItems(profile);
  const managerChainSummary = getManagerChainSummary(
    reportingLines?.managerChain ?? []
  );
  const hierarchyIsHealthy = profile.hierarchyStatus === "Healthy";

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => router.push("/employees")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employees
      </Button>

      {/* ── Data quality alert — only when issues exist ──────────────────── */}
      {attentionItems.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Profile requires attention</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5 list-disc pl-5">
              {attentionItems.map((item) => (
                <li key={item}>{item}</li>
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

                <p className="text-sm text-muted-foreground">
                  {hasTextValue(profile.jobTitle) ? profile.jobTitle : (
                    <span className="italic">Job title not set</span>
                  )}
                </p>

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

            <Button
              variant="outline"
              className="shrink-0 self-start"
              onClick={() => setSheetOpen(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              Manage reporting relationship
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Snapshot strip — 4 quick-scan signals ────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ── Main record — two-column ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left */}
        <div className="flex flex-col gap-6">
          <Card className={WORKSPACE_CARD_CLASS_NAME}>
            <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
              <CardTitle className="text-base">Identity &amp; Contact</CardTitle>
              <CardDescription>
                Maintain the employee&apos;s primary identity fields used across
                Core.
              </CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveWorkspaceSheet("identity")}
                >
                  Edit
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
              <DetailRow
                icon={User}
                label="Full name"
                value={profile.fullName}
              />
              <Separator />
              <DetailRow icon={Mail} label="Work email" value={email} />
            </CardContent>
          </Card>

          <Card className={WORKSPACE_CARD_CLASS_NAME}>
            <CardHeader className={WORKSPACE_CARD_HEADER_CLASS_NAME}>
              <CardTitle className="text-base">Employment</CardTitle>
              <CardDescription>
                Keep core role, hire-date, and status details current from the
                profile.
              </CardDescription>
              <CardAction className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveWorkspaceSheet("employment")}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveWorkspaceSheet("status")}
                >
                  Manage status
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className={WORKSPACE_CARD_CONTENT_CLASS_NAME}>
              <DetailRow
                icon={Star}
                label="Job title"
                value={
                  hasTextValue(profile.jobTitle) ? profile.jobTitle : (
                    <span className="font-normal text-muted-foreground">
                      Not set
                    </span>
                  )
                }
              />
              <Separator />
              <DetailRow icon={Calendar} label="Hire date" value={hireDate} />
              <Separator />
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
              <CardTitle className="text-base">Organization</CardTitle>
              <CardDescription>
                Maintain the employee&apos;s org placement and manager context from
                one workspace.
              </CardDescription>
              <CardAction>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/org-chart?focusEmployeeId=${profile.id}`)}
                  >
                    View in org chart
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveWorkspaceSheet("organization")}
                  >
                    Edit
                  </Button>
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
                    <span className="block text-xs font-normal text-muted-foreground">
                      {managerEmail}
                    </span>
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
                    Update manager and inspect the reporting-line chain.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSheetOpen(true)}
                >
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EmployeeReportingLinesSheet
        employeeId={employeeId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <EmployeeIdentityEditSheet
        profile={profile}
        open={activeWorkspaceSheet === "identity"}
        onOpenChange={(open) =>
          setActiveWorkspaceSheet(open ? "identity" : null)
        }
      />

      <EmployeeEmploymentEditSheet
        profile={profile}
        open={activeWorkspaceSheet === "employment"}
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
        onManageReportingRelationship={() => setSheetOpen(true)}
      />
    </div>
  );
}
