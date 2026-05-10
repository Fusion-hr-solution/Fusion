"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Network, RefreshCcw } from "lucide-react";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import { cn } from "@/lib/utils";
import { EmployeeReportingLinesSheet } from "../employees/employee-reporting-lines-sheet";
import {
  ManagerReassignDialog,
  type ManagerReassignProposal,
} from "./manager-reassign-dialog";
import { OrgChartCanvas, type OrgChartCanvasApi } from "./org-chart-canvas";
import {
  buildOrgChartSearchIndex,
  findEmployeePath,
  flattenOrgChart,
} from "./org-chart-layout";
import { OrgChartPreviewPanel } from "./org-chart-preview-panel";
import { OrgChartToolbar } from "./org-chart-toolbar";
import { useOrgChart } from "./use-org-chart";

const DEFAULT_MAX_DEPTH = 10;

export default function OrgChartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-backed state
  const rootEmployeeId = searchParams.get("rootEmployeeId");
  const focusEmployeeId = searchParams.get("focusEmployeeId");
  const orgUnitId = searchParams.get("orgUnitId");
  const includeInactive = searchParams.get("includeInactive") === "true";
  const maxDepth =
    Number(searchParams.get("maxDepth") ?? DEFAULT_MAX_DEPTH) ||
    DEFAULT_MAX_DEPTH;

  // Local UI state (not URL-backed)
  const { user, isLoading: isAuthLoading } = useAuth();
  const canAccess = canAccessEmployeeRoster(user);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | null>(
    null
  );
  const [sheetEmployeeId, setSheetEmployeeId] = useState<string | null>(null);
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<
    string | null
  >(null);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [collapsedEmployeeIds, setCollapsedEmployeeIds] = useState<Set<string>>(
    new Set()
  );
  const canvasApiRef = useRef<OrgChartCanvasApi | null>(null);
  const [reassignProposal, setReassignProposal] =
    useState<ManagerReassignProposal | null>(null);

  // Helper: update URL params without pushing a new history entry
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      router.replace(`?${next.toString()}`);
    },
    [router, searchParams]
  );

  const { data, error, isLoading, isFetching, refetch } = useOrgChart({
    rootEmployeeId,
    focusEmployeeId,
    orgUnitId,
    includeInactive,
    maxDepth,
  });

  const roots = useMemo(() => data?.roots ?? [], [data?.roots]);
  const flattenedNodes = useMemo(() => flattenOrgChart(roots), [roots]);
  const searchIndex = useMemo(() => buildOrgChartSearchIndex(roots), [roots]);

  const selectedEmployee = useMemo(
    () =>
      flattenedNodes.find((e) => e.employeeId === selectedEmployeeId) ?? null,
    [flattenedNodes, selectedEmployeeId]
  );

  const previewEmployee = useMemo(
    () =>
      flattenedNodes.find((e) => e.employeeId === previewEmployeeId) ?? null,
    [flattenedNodes, previewEmployeeId]
  );

  const fitViewKey = useMemo(
    () =>
      `${data?.requestedRootEmployeeId ?? "all"}:${data?.maxDepthApplied ?? maxDepth}:${data?.totalVisibleNodeCount ?? 0}`,
    [
      data?.maxDepthApplied,
      data?.requestedRootEmployeeId,
      data?.totalVisibleNodeCount,
      maxDepth,
    ]
  );

  const handleCanvasApiReady = useCallback((api: OrgChartCanvasApi | null) => {
    canvasApiRef.current = api;
  }, []);

  const requestFocus = useCallback(
    (employeeId: string) => {
      setFocusRequestKey((current) => current + 1);
      updateParams({ focusEmployeeId: employeeId });
    },
    [updateParams]
  );

  const handleNodeSelect = useCallback((employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setPreviewEmployeeId(employeeId);
    setHighlightedEmployeeId(employeeId);
  }, []);

  const handleToggleCollapse = useCallback((employeeId: string) => {
    setCollapsedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  }, []);

  const handleSelectSearchResult = useCallback(
    (employeeId: string) => {
      const path = findEmployeePath(roots, employeeId);
      setCollapsedEmployeeIds((current) => {
        const next = new Set(current);
        path.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedEmployeeId(employeeId);
      setHighlightedEmployeeId(employeeId);
      requestFocus(employeeId);
    },
    [requestFocus, roots]
  );

  const handleFocusSelectedBranch = useCallback(() => {
    if (!selectedEmployeeId) return;
    setCollapsedEmployeeIds(new Set());
    setHighlightedEmployeeId(selectedEmployeeId);
    updateParams({ rootEmployeeId: selectedEmployeeId, focusEmployeeId: null });
    setFocusRequestKey((k) => k + 1);
  }, [selectedEmployeeId, updateParams]);

  const handleShowFullOrganization = useCallback(() => {
    setCollapsedEmployeeIds(new Set());
    updateParams({
      rootEmployeeId: null,
      orgUnitId: null,
      focusEmployeeId: null,
    });
    if (selectedEmployeeId) {
      setFocusRequestKey((k) => k + 1);
    }
  }, [selectedEmployeeId, updateParams]);

  // Preview panel action handlers
  const handlePreviewOpenProfile = useCallback(
    (employeeId: string) => {
      router.push(`/employees/${employeeId}`);
    },
    [router]
  );

  const handlePreviewManageReporting = useCallback((employeeId: string) => {
    setSheetEmployeeId(employeeId);
  }, []);

  const handlePreviewFocusBranch = useCallback(
    (employeeId: string) => {
      setCollapsedEmployeeIds(new Set());
      updateParams({ rootEmployeeId: employeeId, focusEmployeeId: null });
      setFocusRequestKey((k) => k + 1);
    },
    [updateParams]
  );

  const handlePreviewViewManager = useCallback(
    (managerId: string) => {
      const path = findEmployeePath(roots, managerId);
      setCollapsedEmployeeIds((current) => {
        const next = new Set(current);
        path.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedEmployeeId(managerId);
      setHighlightedEmployeeId(managerId);
      requestFocus(managerId);
    },
    [requestFocus, roots]
  );

  const handlePreviewViewDirectReports = useCallback(
    (employeeId: string) => {
      setCollapsedEmployeeIds(new Set());
      updateParams({ rootEmployeeId: employeeId, maxDepth: "2" });
      setFocusRequestKey((k) => k + 1);
    },
    [updateParams]
  );

  // Clear selection when nodes are no longer visible in the chart
  useEffect(() => {
    if (
      selectedEmployeeId &&
      !flattenedNodes.some((n) => n.employeeId === selectedEmployeeId)
    ) {
      setSelectedEmployeeId(null);
    }
    if (
      previewEmployeeId &&
      !flattenedNodes.some((n) => n.employeeId === previewEmployeeId)
    ) {
      setPreviewEmployeeId(null);
    }
    if (
      sheetEmployeeId &&
      !flattenedNodes.some((n) => n.employeeId === sheetEmployeeId)
    ) {
      setSheetEmployeeId(null);
    }
    if (
      highlightedEmployeeId &&
      !flattenedNodes.some((n) => n.employeeId === highlightedEmployeeId)
    ) {
      setHighlightedEmployeeId(null);
    }
  }, [
    flattenedNodes,
    highlightedEmployeeId,
    previewEmployeeId,
    selectedEmployeeId,
    sheetEmployeeId,
  ]);

  const isInitialPageLoading =
    (isAuthLoading && !user) ||
    (!isAuthLoading && canAccess && isLoading && !data && !error);

  if (isInitialPageLoading) {
    return (
      <div className="flex min-h-full flex-col gap-6 p-6">
        {/* PageHeader skeleton */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-32 shrink-0" />
        </div>
        {/* Toolbar skeleton — mirrors the rounded-2xl border bg-card p-3 wrapper */}
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-3">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        {/* Canvas skeleton */}
        <Skeleton className="h-[70vh] rounded-2xl" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Org Chart"
          description="The organization chart is available only to tenant HR administrators."
        />
        <EmptyState
          icon={Network}
          title="Org chart is not available for this role"
          description="Ask a tenant HR administrator to review the governed reporting structure."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Org Chart"
        description="Inspect the governed workforce structure, focus on any branch, and drill into reporting relationships without leaving the chart."
        actions={
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCcw />
            Refresh chart
          </Button>
        }
      />

      <OrgChartToolbar
        searchIndex={searchIndex}
        selectedEmployee={selectedEmployee}
        focusedRootEmployeeId={rootEmployeeId}
        maxDepth={maxDepth}
        totalVisibleNodeCount={data?.totalVisibleNodeCount ?? 0}
        isRefreshing={isFetching}
        includeInactive={includeInactive}
        selectedOrgUnitId={orgUnitId}
        issueCounts={data?.issueCounts ?? null}
        onMaxDepthChange={(d) => updateParams({ maxDepth: String(d) })}
        onSelectSearchResult={handleSelectSearchResult}
        onFocusSelectedBranch={handleFocusSelectedBranch}
        onShowFullOrganization={handleShowFullOrganization}
        onFitToScreen={() => canvasApiRef.current?.fitToScreen()}
        onResetView={() => canvasApiRef.current?.resetView()}
        onIncludeInactiveChange={(v) =>
          updateParams({ includeInactive: v ? "true" : null })
        }
        onOrgUnitChange={(id) => updateParams({ orgUnitId: id })}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load org chart</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error.message || "An unexpected error occurred."}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {data?.isTruncated ? (
        <Alert>
          <AlertTitle>Chart depth is capped for this view</AlertTitle>
          <AlertDescription>
            Increase the depth or focus a specific branch if you need to inspect
            deeper levels.
          </AlertDescription>
        </Alert>
      ) : null}

      {data && rootEmployeeId === null && data.totalVisibleNodeCount > 80 ? (
        <Alert>
          <AlertTitle>Large organization overview</AlertTitle>
          <AlertDescription>
            This chart opens at the top of the structure so reporting lines stay
            readable. Use Find person, click a leader card, or focus a selected
            branch to inspect a specific team.
          </AlertDescription>
        </Alert>
      ) : null}

      {data && data.totalVisibleNodeCount === 0 ? (
        <EmptyState
          icon={Network}
          title="No visible reporting structure yet"
          description="Add governed employees and reporting relationships to visualize the workforce structure here."
        />
      ) : (
        <div className="flex h-[70vh] overflow-hidden rounded-2xl border bg-card">
          <div className="min-w-0 flex-1">
            <OrgChartCanvas
              roots={roots}
              collapsedEmployeeIds={collapsedEmployeeIds}
              selectedEmployeeId={selectedEmployeeId}
              highlightedEmployeeId={highlightedEmployeeId}
              onSelectEmployee={handleNodeSelect}
              onToggleCollapse={handleToggleCollapse}
              focusEmployeeId={focusEmployeeId}
              focusRequestKey={focusRequestKey}
              fitViewKey={fitViewKey}
              isOverviewMode={rootEmployeeId === null}
              onCanvasApiReady={handleCanvasApiReady}
              onReassignProposal={setReassignProposal}
            />
          </div>

          <div
            className={cn(
              "shrink-0 overflow-hidden border-l transition-[width] duration-200 ease-out",
              previewEmployee ? "w-80" : "w-0 border-transparent"
            )}
          >
            {previewEmployee ? (
              <OrgChartPreviewPanel
                employee={previewEmployee}
                onClose={() => setPreviewEmployeeId(null)}
                onOpenProfile={handlePreviewOpenProfile}
                onManageReportingRelationship={handlePreviewManageReporting}
                onFocusBranch={handlePreviewFocusBranch}
                onViewManager={handlePreviewViewManager}
                onViewDirectReports={handlePreviewViewDirectReports}
              />
            ) : null}
          </div>
        </div>
      )}

      <EmployeeReportingLinesSheet
        employeeId={sheetEmployeeId}
        open={sheetEmployeeId !== null}
        onOpenChange={(open) => {
          if (!open) setSheetEmployeeId(null);
        }}
      />

      <ManagerReassignDialog
        proposal={reassignProposal}
        onClose={() => setReassignProposal(null)}
      />
    </div>
  );
}
