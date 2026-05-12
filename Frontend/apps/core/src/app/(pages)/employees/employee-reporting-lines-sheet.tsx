"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  useEmployeeManagerOptions,
  useEmployeeReportingLines,
  useUpdateEmployeeManager,
} from "./use-employees";
import type {
  EmployeeHierarchyNodeDto,
  EmployeeHierarchyStatus,
  EmployeeReportingLinesDto,
  EmployeeRosterItem,
} from "./employee-roster.types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

const MIN_MANAGER_SEARCH_LENGTH = 2;

interface EmployeeReportingLinesSheetProps {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showJobTitle?: boolean;
}

export function EmployeeReportingLinesSheet({
  employeeId,
  open,
  onOpenChange,
  showJobTitle = true,
}: EmployeeReportingLinesSheetProps) {
  const { data, error, isLoading, refetch } = useEmployeeReportingLines(
    open ? employeeId : null
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
        {isLoading ? (
          <DetailSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : data ? (
          <DetailContent data={data} showJobTitle={showJobTitle} />
        ) : (
          <EmptyState />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSkeleton() {
  return (
    <>
      <SheetHeader className="sr-only">
        <SheetTitle>Reporting relationship</SheetTitle>
        <SheetDescription>
          Loading reporting relationship details.
        </SheetDescription>
      </SheetHeader>
      {/* Mirrors SheetHeader className="border-b px-6 pt-6" */}
      <div className="border-b px-6 pb-5 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="mt-1.5 h-4 w-52" />
      </div>
      {/* Mirrors flex-1 overflow-y-auto px-6 pb-6 > space-y-6 pt-6 */}
      <div className="space-y-6 px-6 py-6">
        {/* Manager assignment section */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <div className="space-y-4 rounded-xl border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
            <div className="space-y-3 border-t pt-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-full rounded-md" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-32 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            </div>
          </div>
        </div>
        {/* Direct reports section */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <div className="divide-y overflow-hidden rounded-xl border">
            <Skeleton className="h-18 rounded-none" />
            <Skeleton className="h-18 rounded-none" />
          </div>
        </div>
        {/* Reporting chain section */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <div className="divide-y overflow-hidden rounded-xl border">
            <Skeleton className="h-18 rounded-none" />
            <Skeleton className="h-18 rounded-none" />
            <Skeleton className="h-18 rounded-none" />
          </div>
        </div>
      </div>
    </>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-6 p-6 pt-10">
      <SheetHeader>
        <SheetTitle>Reporting relationship</SheetTitle>
        <SheetDescription>
          Manager relationship details could not be loaded for this employee.
        </SheetDescription>
      </SheetHeader>

      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Failed to load reporting relationship</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>{message || "An unexpected error occurred."}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="space-y-4 p-6 pt-10">
      <SheetHeader>
        <SheetTitle>Reporting relationship</SheetTitle>
        <SheetDescription>
          Select an employee to review the current manager relationship.
        </SheetDescription>
      </SheetHeader>
    </div>
  );
}

function DetailContent({
  data,
  showJobTitle,
}: {
  data: EmployeeReportingLinesDto;
  showJobTitle: boolean;
}) {
  const statusMeta = getRelationshipStatusMeta(data.employee.hierarchyStatus);
  const managerSummary = getCurrentManagerValue(data.employee);
  const [managerSearch, setManagerSearch] = useState("");
  const deferredManagerSearch = useDeferredValue(managerSearch);
  const [selectedManager, setSelectedManager] =
    useState<EmployeeRosterItem | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | "clear" | null>(
    null
  );
  const [confirmAction, setConfirmAction] = useState<"save" | "clear" | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const updateManager = useUpdateEmployeeManager();
  const managerOptionsQuery = useEmployeeManagerOptions({
    employeeId: data.employee.id,
    search: deferredManagerSearch,
  });
  const managerPreview = data.managerChain[0] ?? null;
  const issueMessage = getRelationshipIssueMessage(
    data.employee.hierarchyStatus
  );

  useEffect(() => {
    setManagerSearch("");
    setSelectedManager(null);
    setPendingAction(null);
    setActionError(null);
  }, [data.employee.id, data.employee.version]);

  const blockedManagerIds = useMemo(
    () =>
      new Set([
        data.employee.id,
        ...data.downline.map((node) => node.employee.id),
      ]),
    [data.downline, data.employee.id]
  );

  const managerOptions = useMemo(
    () =>
      (managerOptionsQuery.data?.items ?? []).filter(
        (candidate) => !blockedManagerIds.has(candidate.id)
      ),
    [blockedManagerIds, managerOptionsQuery.data]
  );

  const canSearchManagers =
    deferredManagerSearch.trim().length >= MIN_MANAGER_SEARCH_LENGTH;
  const canSaveSelectedManager =
    selectedManager !== null && selectedManager.id !== data.employee.managerId;
  const canClearManager =
    data.employee.managerId !== null ||
    data.employee.hierarchyStatus === "ManagerMissing";
  const shouldConfirmSave =
    canSaveSelectedManager && data.directReportCount > 0;
  const confirmationCopy = getConfirmationCopy({
    action: confirmAction,
    employee: data.employee,
    selectedManager,
  });

  async function handleSaveManager() {
    if (!selectedManager) {
      return;
    }

    setActionError(null);
    setPendingAction("save");

    try {
      await updateManager.mutateAsync({
        employeeId: data.employee.id,
        expectedVersion: data.employee.version,
        managerId: selectedManager.id,
      });
      setManagerSearch("");
      setSelectedManager(null);
      setConfirmAction(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleClearManager() {
    if (!canClearManager) {
      return;
    }

    setActionError(null);
    setPendingAction("clear");

    try {
      await updateManager.mutateAsync({
        employeeId: data.employee.id,
        expectedVersion: data.employee.version,
        managerId: null,
      });
      setManagerSearch("");
      setSelectedManager(null);
      setConfirmAction(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <SheetHeader className="border-b px-6 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle>{getEmployeeName(data.employee)}</SheetTitle>
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        </div>
        <SheetDescription>
          Assign, change, or clear the manager.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-6 pt-6">
          <section className="space-y-3">
            <SectionHeader title="Manager assignment" />
            <div className="space-y-4 rounded-xl border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryItem
                  label="Manager"
                  value={managerSummary}
                  supportingText={getCurrentManagerSupportingText(
                    data.employee
                  )}
                  muted={!data.employee.managerName}
                />
                <SummaryItem
                  label="Direct reports"
                  value={formatDirectReportsValue(data.directReportCount)}
                />
              </div>

              {issueMessage ? <IssueMessage message={issueMessage} /> : null}

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">Update assignment</h3>
                  {updateManager.isLoading ? (
                    <Spinner className="size-4" />
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Find manager
                  </label>
                  <Input
                    value={managerSearch}
                    onChange={(event) => {
                      setManagerSearch(event.target.value);
                      setActionError(null);
                    }}
                    placeholder="Search by name or email"
                    disabled={updateManager.isLoading}
                  />
                </div>

                {selectedManager ? (
                  <SelectedManagerCard
                    manager={selectedManager}
                    directReportCount={data.directReportCount}
                  />
                ) : null}

                {canSearchManagers ? (
                  managerOptionsQuery.isLoading ? (
                    <InlineStatus>
                      <Spinner className="size-4" />
                      Searching managers...
                    </InlineStatus>
                  ) : managerOptionsQuery.error ? (
                    <p className="text-sm text-destructive">
                      {managerOptionsQuery.error.message ||
                        "Manager search could not be loaded."}
                    </p>
                  ) : managerOptions.length === 0 ? (
                    <InlineStatus>No active managers found.</InlineStatus>
                  ) : (
                    <ManagerOptionsList
                      currentManagerId={data.employee.managerId}
                      options={managerOptions}
                      selectedManagerId={selectedManager?.id ?? null}
                      onSelect={(manager) => {
                        setSelectedManager(manager);
                        setManagerSearch("");
                        setActionError(null);
                      }}
                    />
                  )
                ) : selectedManager ? null : (
                  <InlineStatus>Type 2+ characters to search.</InlineStatus>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      if (shouldConfirmSave) {
                        setConfirmAction("save");
                        return;
                      }

                      void handleSaveManager();
                    }}
                    disabled={
                      !canSaveSelectedManager || updateManager.isLoading
                    }
                  >
                    {pendingAction === "save" ? (
                      <Spinner className="mr-1" />
                    ) : null}
                    {data.employee.managerId
                      ? "Change manager"
                      : "Assign manager"}
                  </Button>
                  {canClearManager ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmAction("clear")}
                      disabled={updateManager.isLoading}
                    >
                      {pendingAction === "clear" ? (
                        <Spinner className="mr-1" />
                      ) : null}
                      Clear manager
                    </Button>
                  ) : null}
                </div>

                {actionError ? (
                  <p className="text-sm text-destructive">{actionError}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader title="Direct reports" />
            {data.directReportCount > 0 ? (
              <InlineStatus>
                These employees stay assigned to{" "}
                {getEmployeeName(data.employee)}. Changing this manager updates
                the reporting chain above them.
              </InlineStatus>
            ) : null}
            <RelationshipList
              items={data.directReports}
              emptyMessage="No immediate reports are linked to this employee."
              showJobTitle={showJobTitle}
            />
          </section>

          {managerPreview ? (
            <section className="space-y-3">
              <SectionHeader title="Reporting chain" />
              <RelationshipList
                items={data.managerChain}
                emptyMessage="No manager assigned."
                showJobTitle={showJobTitle}
              />
            </section>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <AlertTriangle className="size-5 text-amber-700" />
            </AlertDialogMedia>
            <AlertDialogTitle>{confirmationCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationCopy.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateManager.isLoading}>
              Keep current setup
            </AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction === "clear" ? "destructive" : "default"}
              disabled={updateManager.isLoading}
              onClick={() => {
                if (confirmAction === "clear") {
                  void handleClearManager();
                  return;
                }

                void handleSaveManager();
              }}
            >
              {confirmAction === "clear"
                ? "Clear manager"
                : data.employee.managerId
                  ? "Change manager"
                  : "Assign manager"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryItem({
  label,
  value,
  supportingText,
  muted = false,
}: {
  label: string;
  value: string;
  supportingText?: string;
  muted?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          muted ? "text-sm text-muted-foreground" : "text-sm font-medium"
        }
      >
        {value}
      </p>
      {supportingText ? (
        <p className="text-sm text-muted-foreground">{supportingText}</p>
      ) : null}
    </div>
  );
}

function IssueMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

function SelectedManagerCard({
  manager,
  directReportCount,
}: {
  manager: EmployeeRosterItem;
  directReportCount: number;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Selected manager
      </p>
      <p className="mt-1 text-sm font-medium">{getEmployeeName(manager)}</p>
      <p className="text-sm text-muted-foreground">{manager.email}</p>
      {directReportCount > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          This updates the reporting chain for{" "}
          {formatDirectReportsValue(directReportCount).toLowerCase()}.
        </p>
      ) : null}
    </div>
  );
}

function InlineStatus({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ManagerOptionsList({
  currentManagerId,
  options,
  selectedManagerId,
  onSelect,
}: {
  currentManagerId: string | null;
  options: EmployeeRosterItem[];
  selectedManagerId: string | null;
  onSelect: (manager: EmployeeRosterItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="divide-y">
        {options.map((manager) => {
          const isSelected = selectedManagerId === manager.id;
          const isCurrentManager = currentManagerId === manager.id;

          return (
            <button
              key={manager.id}
              type="button"
              className={
                isSelected
                  ? "flex w-full items-start justify-between gap-3 bg-muted/40 px-4 py-3 text-left"
                  : "flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"
              }
              onClick={() => onSelect(manager)}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {getEmployeeName(manager)}
                  </span>
                  {isCurrentManager ? (
                    <Badge variant="outline">Current</Badge>
                  ) : null}
                  {isSelected ? (
                    <Badge variant="secondary">Selected</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{manager.email}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{title}</h3>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function RelationshipList({
  items,
  emptyMessage,
  showJobTitle,
}: {
  items: EmployeeHierarchyNodeDto[];
  emptyMessage: string;
  showJobTitle: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="divide-y">
        {items.map((node) => (
          <div key={node.employee.id} className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {getEmployeeName(node.employee)}
                  </p>
                  {node.employee.status !== "Active" ? (
                    <Badge variant="outline">Inactive</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {node.employee.email}
                </p>
              </div>
            </div>
            {(showJobTitle && node.employee.jobTitle) ||
            node.employee.orgUnitName ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {showJobTitle && node.employee.jobTitle ? (
                  <span>{node.employee.jobTitle}</span>
                ) : null}
                {node.employee.orgUnitName ? (
                  <span>{node.employee.orgUnitName}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function getEmployeeName(employee: EmployeeRosterItem) {
  return `${employee.firstName} ${employee.lastName}`;
}

function getRelationshipStatusMeta(status: EmployeeHierarchyStatus): {
  label: string;
  variant: "secondary" | "outline" | "destructive";
} {
  switch (status) {
    case "Healthy":
      return { label: "Manager assigned", variant: "secondary" };
    case "Root":
      return { label: "Top-level leader", variant: "secondary" };
    case "NoManagerAssigned":
      return { label: "No manager assigned", variant: "outline" };
    case "ManagerInactive":
      return { label: "Needs reassignment", variant: "destructive" };
    case "ManagerMissing":
      return { label: "Needs attention", variant: "destructive" };
  }
}

function getCurrentManagerValue(employee: EmployeeRosterItem) {
  if (employee.hierarchyStatus === "Root") {
    return "Top-level leader";
  }

  if (employee.hierarchyStatus === "NoManagerAssigned") {
    return "No manager assigned";
  }

  return employee.managerName ?? "Needs attention";
}

function getCurrentManagerSupportingText(employee: EmployeeRosterItem) {
  switch (employee.hierarchyStatus) {
    case "Root":
      return "No manager assignment needed.";
    case "NoManagerAssigned":
      return "Assign a manager to place this employee in the hierarchy.";
  }
}

function formatDirectReportsValue(directReportCount: number) {
  if (directReportCount === 0) {
    return "None";
  }

  if (directReportCount === 1) {
    return "1 employee";
  }

  return `${directReportCount} employees`;
}

function getRelationshipIssueMessage(status: EmployeeHierarchyStatus) {
  switch (status) {
    case "ManagerInactive":
      return "Current manager is inactive. Choose a new manager or clear the relationship.";
    case "ManagerMissing":
      return "Manager reference no longer resolves. Set a manager again or clear the relationship.";
  }
}

function getConfirmationCopy({
  action,
  employee,
  selectedManager,
}: {
  action: "save" | "clear" | null;
  employee: EmployeeRosterItem;
  selectedManager: EmployeeRosterItem | null;
}) {
  const employeeName = getEmployeeName(employee);
  const directReportsValue = formatDirectReportsValue(
    employee.directReportCount
  ).toLowerCase();

  if (action === "clear") {
    return {
      title: `Clear manager for ${employeeName}?`,
      description:
        employee.directReportCount > 0
          ? `${employeeName} will become top-level. ${directReportsValue} stay assigned to ${employee.firstName} ${employee.lastName}.`
          : `${employeeName} will no longer have a manager until one is assigned.`,
    };
  }

  if (action === "save" && selectedManager) {
    const managerName = getEmployeeName(selectedManager);
    return {
      title: employee.managerId
        ? `Change manager for ${employeeName}?`
        : `Assign manager to ${employeeName}?`,
      description:
        employee.directReportCount > 0
          ? `${employeeName} will report to ${managerName}. ${directReportsValue} stay assigned to ${employee.firstName} ${employee.lastName} and inherit the updated reporting chain.`
          : `${employeeName} will report to ${managerName}.`,
    };
  }

  return {
    title: "Confirm manager change",
    description: "Review this manager update before continuing.",
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The manager relationship could not be updated.";
}
