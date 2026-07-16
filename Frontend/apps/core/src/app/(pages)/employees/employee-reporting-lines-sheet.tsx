"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Search, X } from "lucide-react";
import type { ApiError } from "@repo/api";
import { toast } from "sonner";
import {
  useChangeEmployeeManager,
  useEmployeeManagerOptions,
  useEmployeeReportingLines,
} from "./use-employees";
import type {
  EmployeeReportingLinesDto,
  EmployeeRosterItem,
  EmployeeHierarchyStatus,
} from "./employee-roster.types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

const MIN_SEARCH_LENGTH = 1;

interface EmployeeReportingLinesDialogProps {
  employeeKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showJobTitle?: boolean;
}

export function EmployeeReportingLinesDialog({
  employeeKey,
  open,
  onOpenChange,
  showJobTitle = true,
}: EmployeeReportingLinesDialogProps) {
  const { data, error, isLoading, refetch } = useEmployeeReportingLines(
    open ? employeeKey : null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 sm:max-w-xl"
        aria-describedby={undefined}
      >
        {isLoading ? (
          <DetailSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => void refetch()} />
        ) : data ? (
          <ManagerChangeSection
            data={data}
            onDone={() => onOpenChange(false)}
            showJobTitle={showJobTitle}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <>
      <DialogHeader className="border-b px-6 pb-4 pt-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-36 mt-1" />
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-6 pt-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-full" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t px-6 py-4">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
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
    <>
      <DialogHeader className="border-b px-6 pb-4 pt-6">
        <DialogTitle>Reporting relationship</DialogTitle>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Couldn&apos;t load reporting relationship</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              Reporting details couldn&apos;t be loaded. Try again.
            </span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    </>
  );
}

// ── ManagerChangeSection (tab content) ──────────────────────────────────────

export function ManagerChangeSection({
  data,
  onDone,
  showJobTitle,
  embedded,
  hideFooter,
  controllerRef,
  onButtonStateChange,
}: {
  data: EmployeeReportingLinesDto;
  onDone?: () => void;
  showJobTitle: boolean;
  embedded?: boolean;
  hideFooter?: boolean;
  controllerRef?: React.MutableRefObject<
    { save: () => void; remove: () => void } | undefined
  >;
  onButtonStateChange?: (state: {
    canSave: boolean;
    isSaving: boolean;
  }) => void;
}) {
  const emp = data.employee;
  const firstName = emp.firstName;
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedManager, setSelectedManager] =
    useState<EmployeeRosterItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const changeManager = useChangeEmployeeManager();

  const managerOptionsQuery = useEmployeeManagerOptions({
    employeeId: emp.id,
    search: deferredSearch,
  });

  const blockedManagerIds = useMemo(
    () => new Set([emp.id, ...data.downline.map((node) => node.employee.id)]),
    [data.downline, emp.id]
  );

  const managerOptions = useMemo(
    () =>
      (managerOptionsQuery.data?.items ?? []).filter(
        (candidate) => !blockedManagerIds.has(candidate.id)
      ),
    [blockedManagerIds, managerOptionsQuery.data]
  );

  const canSearch = deferredSearch.trim().length >= MIN_SEARCH_LENGTH;
  const status = emp.hierarchyStatus;
  const hasActiveManager =
    emp.managerId !== null && status !== "ManagerMissing" && status !== "Root";
  const canSave =
    selectedManager !== null && selectedManager.id !== emp.managerId;
  const isSaving = changeManager.isLoading;
  const hasDirectReports = data.directReportCount > 0;

  const currentManagerNode = data.managerChain[0] ?? null;
  const currentManager = currentManagerNode?.employee ?? null;

  useEffect(() => {
    setSearch("");
    setSelectedManager(null);
    setActionError(null);
  }, [emp.id, emp.version]);

  function getMutationError(error: unknown) {
    const apiErr = error as ApiError | undefined;
    if (apiErr?.status === 409 || apiErr?.status === 412) {
      return "Changes could not be saved. Try again.";
    }
    const msg = apiErr?.errors?.[0] ?? apiErr?.message ?? "";
    const lower = msg.toLowerCase();
    if (
      lower.includes("cannot report to themselves") ||
      lower.includes("self")
    ) {
      return "This person cannot report to themselves.";
    }
    if (lower.includes("cycle")) {
      return "This would create a reporting loop. Pick someone else.";
    }
    if (lower.includes("inactive")) {
      return "That person is currently inactive.";
    }
    if (lower.includes("permission") || lower.includes("not authorized")) {
      return "You don't have permission to change who this person reports to.";
    }
    return msg || "Changes could not be saved. Try again.";
  }

  async function handleSave() {
    if (!selectedManager) return;
    setActionError(null);
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await changeManager.mutateAsync({
        employeeId: emp.id,
        expectedVersion: emp.version,
        managerId: selectedManager.id,
        effectiveDate: today.toISOString(),
      });
      toast.success("Manager updated.");
      onDone?.();
    } catch (error) {
      setActionError(getMutationError(error));
    }
  }

  const futureChain = useMemo(() => {
    if (!selectedManager || selectedManager.id === emp.managerId) {
      return null;
    }
    const chain = [selectedManager];
    const seen = new Set([selectedManager.id]);
    for (const node of data.managerChain) {
      if (!seen.has(node.employee.id)) {
        chain.push(node.employee);
        seen.add(node.employee.id);
      }
    }
    return chain;
  }, [selectedManager, emp.managerId, data.managerChain]);

  useEffect(() => {
    onButtonStateChange?.({ canSave, isSaving });
  }, [canSave, isSaving, onButtonStateChange]);

  useEffect(() => {
    if (controllerRef) {
      controllerRef.current = {
        save: () => void handleSave(),
        remove: () => void handleSave(),
      };
    }
  });

  return (
    <>
      {embedded ? null : (
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle>Choose who {firstName} reports to</DialogTitle>
        </DialogHeader>
      )}
      <div
        className={
          embedded
            ? "flex-1 overflow-y-auto overflow-x-hidden"
            : "flex-1 overflow-y-auto px-6 pb-6"
        }
      >
        <div className={embedded ? "space-y-4" : "space-y-6 pt-6"}>
          {/* ── Currently reports to ── */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Currently reports to</h3>
            <CurrentManagerCard
              employee={emp}
              currentManager={currentManager}
              showJobTitle={showJobTitle}
            />
            {hasDirectReports ? (
              <p className="text-sm text-muted-foreground mt-2">
                {data.directReportCount} person
                {data.directReportCount === 1 ? "" : "s"} report
                {data.directReportCount === 1 ? "s" : ""} to {firstName}.
              </p>
            ) : null}
          </section>

          {/* ── New manager ── */}
          <section>
            <h3 className="text-sm font-semibold mb-3">New manager</h3>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActionError(null);
                  }}
                  placeholder="Search by name or email..."
                  className="pl-8 pr-8"
                  disabled={changeManager.isLoading}
                />
                {search ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearch("")}
                    tabIndex={-1}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              {selectedManager ? (
                <SelectedManagerCard
                  manager={selectedManager}
                  showJobTitle={showJobTitle}
                />
              ) : null}
              {canSearch && !selectedManager ? (
                <ManagerSearchResults
                  isLoading={managerOptionsQuery.isLoading}
                  error={managerOptionsQuery.error ?? null}
                  options={managerOptions}
                  currentManagerId={emp.managerId}
                  onSelect={(m) => {
                    setSelectedManager(m);
                    setSearch("");
                    setActionError(null);
                  }}
                />
              ) : null}
            </div>
          </section>

          {/* ── Change preview ── */}
          {selectedManager && selectedManager.id !== emp.managerId ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                <span className="font-medium">{firstName}</span> will report to{" "}
                <span className="font-medium">
                  {selectedManager.firstName} {selectedManager.lastName}
                </span>
                .
              </p>
              {data.directReportCount > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {data.directReportCount} direct report
                  {data.directReportCount === 1 ? "" : "s"} stay
                  {data.directReportCount === 1 ? "s" : ""} with {firstName}.
                </p>
              ) : null}
              {futureChain ? <ChainBreadcrumb items={futureChain} /> : null}
            </div>
          ) : data.managerChain.length > 0 ? (
            <ChainBreadcrumb items={data.managerChain.map((n) => n.employee)} />
          ) : null}

          {actionError ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Could not update</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      {hideFooter ? null : (
        <>
          {/* ── Footer ── */}
          <div
            className={
              embedded
                ? "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 shrink-0 border-t pt-4"
                : "flex items-center justify-end gap-2 border-t px-6 py-4"
            }
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!changeManager.isLoading) onDone?.();
              }}
              disabled={changeManager.isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave || changeManager.isLoading}
            >
              {changeManager.isLoading ? (
                <>
                  <Spinner className="mr-1.5 size-4" />
                  Saving...
                </>
              ) : emp.managerId ? (
                "Change manager"
              ) : (
                "Assign manager"
              )}
            </Button>
          </div>
        </>
      )}

    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isTopLevel(status: EmployeeHierarchyStatus) {
  return status === "Root";
}

function getStatusBadge(status: EmployeeHierarchyStatus): {
  label: string;
  variant: "secondary" | "outline" | "destructive";
} {
  switch (status) {
    case "Healthy":
      return { label: "Manager assigned", variant: "secondary" };
    case "Root":
      return { label: "Top-level leader", variant: "secondary" };
    case "NoManagerAssigned":
      return { label: "Not assigned", variant: "outline" };
    case "ManagerInactive":
      return { label: "Manager inactive", variant: "destructive" };
    case "ManagerMissing":
      return { label: "Manager missing", variant: "destructive" };
  }
}

// ── Current manager card ───────────────────────────────────────────────────

function CurrentManagerCard({
  employee,
  currentManager,
  showJobTitle,
}: {
  employee: EmployeeRosterItem;
  currentManager: EmployeeRosterItem | null;
  showJobTitle: boolean;
}) {
  const status = employee.hierarchyStatus;
  const badge = getStatusBadge(status);

  if (status === "Root") {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">Top-level leader</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          No manager needed for this role.
        </p>
      </div>
    );
  }

  if (
    status === "NoManagerAssigned" ||
    (!employee.managerName &&
      status !== "ManagerInactive" &&
      status !== "ManagerMissing")
  ) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            Not assigned to anyone yet
          </span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>
    );
  }

  if (currentManager) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback className="text-xs">
              {getInitials(currentManager.firstName, currentManager.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">
                {currentManager.firstName} {currentManager.lastName}
              </span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            {currentManager.email ? (
              <p className="text-sm text-muted-foreground truncate">
                {currentManager.email}
              </p>
            ) : null}
            {showJobTitle && currentManager.jobTitle ? (
              <p className="text-sm text-muted-foreground">
                {currentManager.jobTitle}
              </p>
            ) : null}
          </div>
        </div>
        {status === "ManagerInactive" ? (
          <p className="text-destructive text-xs mt-2">
            They&apos;re currently inactive. Choose a new manager or make{" "}
            {employee.firstName} a top-level leader.
          </p>
        ) : null}
        {status === "ManagerMissing" ? (
          <p className="text-destructive text-xs mt-2">
            Manager record no longer exists. Set a new manager or make{" "}
            {employee.firstName} a top-level leader.
          </p>
        ) : null}
      </div>
    );
  }

  // Fallback: has manager name but no chain data
  return (
    <div className="rounded-xl border bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{employee.managerName}</span>
        {isTopLevel(status) ? null : (
          <Badge variant={badge.variant}>{badge.label}</Badge>
        )}
      </div>
      {status === "ManagerInactive" ? (
        <p className="text-destructive text-xs mt-1">
          They&apos;re currently inactive.
        </p>
      ) : null}
      {status === "ManagerMissing" ? (
        <p className="text-destructive text-xs mt-1">
          Manager record no longer exists.
        </p>
      ) : null}
    </div>
  );
}

// ── Search results ─────────────────────────────────────────────────────────

function ManagerSearchResults({
  isLoading,
  error,
  options,
  currentManagerId,
  onSelect,
}: {
  isLoading: boolean;
  error: Error | null;
  options: EmployeeRosterItem[];
  currentManagerId: string | null;
  onSelect: (manager: EmployeeRosterItem) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Searching...
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load results. Try again.
      </p>
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No one found with that name.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="divide-y">
        {options.map((manager) => (
          <button
            key={manager.id}
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors"
            onClick={() => onSelect(manager)}
          >
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="text-xs">
                {getInitials(manager.firstName, manager.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {manager.firstName} {manager.lastName}
                </span>
                {currentManagerId === manager.id ? (
                  <Badge variant="outline" className="text-[10px]">
                    Current
                  </Badge>
                ) : null}
                {manager.status !== "Active" ? (
                  <Badge variant="outline" className="text-[10px]">
                    Inactive
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {manager.email}
              </p>
              {manager.jobTitle || manager.orgUnitName ? (
                <p className="text-xs text-muted-foreground truncate">
                  {[manager.jobTitle, manager.orgUnitName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Selected manager card ──────────────────────────────────────────────────

function SelectedManagerCard({
  manager,
  showJobTitle,
}: {
  manager: EmployeeRosterItem;
  showJobTitle: boolean;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1">
      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          <AvatarFallback className="text-xs">
            {getInitials(manager.firstName, manager.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm">
              {manager.firstName} {manager.lastName}
            </span>
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {manager.email}
          </p>
          {showJobTitle && manager.jobTitle ? (
            <p className="text-sm text-muted-foreground">{manager.jobTitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Chain breadcrumb ───────────────────────────────────────────────────────

function ChainBreadcrumb({ items }: { items: EmployeeRosterItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      {items.map((item, index) => (
        <span key={item.id} className="flex items-center gap-1">
          {index > 0 ? (
            <span className="text-muted-foreground mx-1">›</span>
          ) : null}
          <span className="text-muted-foreground">
            {item.firstName} {item.lastName}
          </span>
        </span>
      ))}
    </div>
  );
}
