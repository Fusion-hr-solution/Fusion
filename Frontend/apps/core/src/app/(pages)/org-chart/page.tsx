"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Network, RefreshCcw } from "lucide-react";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import { EmployeeReportingLinesSheet } from "../employees/employee-reporting-lines-sheet";
import { OrgChartCanvas, type OrgChartCanvasApi } from "./org-chart-canvas";
import {
  buildOrgChartSearchIndex,
  findEmployeePath,
  flattenOrgChart,
} from "./org-chart-layout";
import { OrgChartToolbar } from "./org-chart-toolbar";
import { useOrgChart } from "./use-org-chart";

const DEFAULT_MAX_DEPTH = 10;

export default function OrgChartPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canAccess = canAccessEmployeeRoster(user);
  const [rootEmployeeId, setRootEmployeeId] = useState<string | null>(null);
  const [maxDepth, setMaxDepth] = useState(DEFAULT_MAX_DEPTH);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const [sheetEmployeeId, setSheetEmployeeId] = useState<string | null>(null);
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<
    string | null
  >(null);
  const [focusEmployeeId, setFocusEmployeeId] = useState<string | null>(null);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [collapsedEmployeeIds, setCollapsedEmployeeIds] = useState<Set<string>>(
    new Set()
  );
  const [canvasApi, setCanvasApi] = useState<OrgChartCanvasApi | null>(null);

  const { data, error, isLoading, isFetching, refetch } = useOrgChart({
    rootEmployeeId,
    maxDepth,
  });

  const roots = useMemo(() => data?.roots ?? [], [data?.roots]);
  const flattenedNodes = useMemo(() => flattenOrgChart(roots), [roots]);
  const searchIndex = useMemo(() => buildOrgChartSearchIndex(roots), [roots]);
  const selectedEmployee = useMemo(
    () =>
      flattenedNodes.find((employee) => employee.employeeId === selectedEmployeeId) ??
      null,
    [flattenedNodes, selectedEmployeeId]
  );
  const fitViewKey = useMemo(
    () =>
      `${data?.requestedRootEmployeeId ?? "all"}:${data?.maxDepthApplied ?? maxDepth}:${data?.totalVisibleNodeCount ?? 0}`,
    [data?.maxDepthApplied, data?.requestedRootEmployeeId, data?.totalVisibleNodeCount, maxDepth]
  );

  const requestFocus = useCallback((employeeId: string) => {
    setFocusEmployeeId(employeeId);
    setFocusRequestKey((current) => current + 1);
  }, []);

  const handleNodeSelect = useCallback((employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setSheetEmployeeId(employeeId);
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
    if (!selectedEmployeeId) {
      return;
    }

    setRootEmployeeId(selectedEmployeeId);
    setCollapsedEmployeeIds(new Set());
    setHighlightedEmployeeId(selectedEmployeeId);
    requestFocus(selectedEmployeeId);
  }, [requestFocus, selectedEmployeeId]);

  const handleShowFullOrganization = useCallback(() => {
    setRootEmployeeId(null);
    setCollapsedEmployeeIds(new Set());

    if (selectedEmployeeId) {
      requestFocus(selectedEmployeeId);
    }
  }, [requestFocus, selectedEmployeeId]);

  useEffect(() => {
    if (selectedEmployeeId && !flattenedNodes.some((node) => node.employeeId === selectedEmployeeId)) {
      setSelectedEmployeeId(null);
    }

    if (sheetEmployeeId && !flattenedNodes.some((node) => node.employeeId === sheetEmployeeId)) {
      setSheetEmployeeId(null);
    }

    if (
      highlightedEmployeeId &&
      !flattenedNodes.some((node) => node.employeeId === highlightedEmployeeId)
    ) {
      setHighlightedEmployeeId(null);
    }
  }, [flattenedNodes, highlightedEmployeeId, selectedEmployeeId, sheetEmployeeId]);

  const isInitialPageLoading =
    (isAuthLoading && !user) ||
    (!isAuthLoading && canAccess && isLoading && !data && !error);

  if (isInitialPageLoading) {
    return (
      <CorePageLoadingState
        title="Org Chart"
        description="The organization chart is available only to tenant HR administrators."
        message="Loading org chart..."
        variant="workspace"
      />
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
        onMaxDepthChange={setMaxDepth}
        onSelectSearchResult={handleSelectSearchResult}
        onFocusSelectedBranch={handleFocusSelectedBranch}
        onShowFullOrganization={handleShowFullOrganization}
        onFitToScreen={() => canvasApi?.fitToScreen()}
        onResetView={() => canvasApi?.resetView()}
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
            Increase the depth or focus a specific branch if you need to inspect deeper levels.
          </AlertDescription>
        </Alert>
      ) : null}

      {data && rootEmployeeId === null && data.totalVisibleNodeCount > 80 ? (
        <Alert>
          <AlertTitle>Large organization overview</AlertTitle>
          <AlertDescription>
            This chart opens at the top of the structure so reporting lines stay readable.
            Use Find person, click a leader card, or focus a selected branch to inspect a
            specific team.
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
        <div className="h-[70vh] overflow-hidden rounded-2xl border bg-card">
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
            onCanvasApiReady={setCanvasApi}
          />
        </div>
      )}

      <EmployeeReportingLinesSheet
        employeeId={sheetEmployeeId}
        open={sheetEmployeeId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSheetEmployeeId(null);
          }
        }}
      />
    </div>
  );
}