"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Network, RefreshCcw } from "lucide-react";
import { canAccessCoreOrgChart, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { cn } from "@/lib/utils";
import { useEmployeeFieldVisibility } from "@/features/employees/shared/employee-field-visibility";
import { EmployeeReportingLinesDialog } from "@/app/(pages)/employees/employee-reporting-lines-sheet";
import {
  ManagerReassignDialog,
  type ManagerReassignProposal,
} from "@/app/(pages)/org-chart/manager-reassign-dialog";
import { OrgChartCanvas, type OrgChartCanvasApi } from "@/app/(pages)/org-chart/org-chart-canvas";
import {
  buildOrgChartSearchIndex,
  findEmployeePath,
  flattenOrgChart,
} from "@/app/(pages)/org-chart/org-chart-layout";
import { OrgChartPreviewPanel } from "@/app/(pages)/org-chart/org-chart-preview-panel";
import { OrgChartToolbar } from "@/app/(pages)/org-chart/org-chart-toolbar";
import { useOrgChart } from "@/app/(pages)/org-chart/use-org-chart";

const DEFAULT_MAX_DEPTH = 10;

export default function OrgChartWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-backed state — uses stable employee keys for navigation
  const rootEmployeeKey = searchParams.get("rootEmployeeKey");
  const focusEmployeeKey = searchParams.get("focusEmployeeKey");
  const orgUnitCode = searchParams.get("orgUnitCode");
  const includeInactive = searchParams.get("includeInactive") === "true";
  const maxDepth =
    Number(searchParams.get("maxDepth") ?? DEFAULT_MAX_DEPTH) ||
    DEFAULT_MAX_DEPTH;

  // Local UI state (not URL-backed)
  const { user } = useAuth();
  const { tenantId, tenantSlug } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const canAccess = canAccessCoreOrgChart(user) || isTenantContextReadOnly;
  const fieldVisibility = useEmployeeFieldVisibility(canAccess);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isReassignMode, setIsReassignMode] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | null>(
    null
  );
  const [sheetEmployeeKey, setSheetEmployeeKey] = useState<string | null>(null);
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
    rootEmployeeKey,
    focusEmployeeKey,
    orgUnitCode,
    includeInactive,
    maxDepth,
  });

  const roots = useMemo(() => data?.roots ?? [], [data?.roots]);
  const flattenedNodes = useMemo(() => flattenOrgChart(roots), [roots]);
  const searchIndex = useMemo(
    () => buildOrgChartSearchIndex(roots, fieldVisibility.showJobTitle),
    [fieldVisibility.showJobTitle, roots]
  );

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
  const employeeKeyById = useMemo(
    () => new Map(flattenedNodes.map((employee) => [employee.employeeId, employee.stableEmployeeKey])),
    [flattenedNodes]
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
    setIsCanvasReady(api !== null);
  }, []);

  const getEmployeeKey = useCallback(
    (employeeId: string | null) =>
      employeeId ? employeeKeyById.get(employeeId) ?? null : null,
    [employeeKeyById]
  );

  const requestFocus = useCallback(
    (employeeId: string) => {
      const employeeKey = getEmployeeKey(employeeId);
      if (!employeeKey) {
        return;
      }

      setIsNavigating(true);
      setFocusRequestKey((current) => current + 1);
      updateParams({ focusEmployeeKey: employeeKey });
    },
    [getEmployeeKey, updateParams]
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
      setPreviewEmployeeId(employeeId);
      setHighlightedEmployeeId(employeeId);
      requestFocus(employeeId);
    },
    [requestFocus, roots]
  );

  const handleFocusSelectedBranch = useCallback(() => {
    if (!selectedEmployeeId) return;
    const employeeKey = getEmployeeKey(selectedEmployeeId);
    if (!employeeKey) return;

    setIsNavigating(true);
    setCollapsedEmployeeIds(new Set());
    setHighlightedEmployeeId(selectedEmployeeId);
    updateParams({ rootEmployeeKey: employeeKey, focusEmployeeKey: null });
    setFocusRequestKey((k) => k + 1);
  }, [getEmployeeKey, selectedEmployeeId, updateParams]);

  const handleShowFullOrganization = useCallback(() => {
    setIsNavigating(true);
    setCollapsedEmployeeIds(new Set());
    updateParams({
      rootEmployeeKey: null,
      orgUnitCode: null,
      focusEmployeeKey: null,
    });
    if (selectedEmployeeId) {
      setFocusRequestKey((k) => k + 1);
    }
  }, [selectedEmployeeId, updateParams]);

  // Preview panel action handlers
  const handlePreviewOpenProfile = useCallback(
    (employeeId: string) => {
      const employeeKey = getEmployeeKey(employeeId);
      if (!employeeKey) {
        return;
      }

      router.push(
        buildTenantContextHref(`/employees/${employeeKey}`, tenantId, tenantSlug)
      );
    },
    [getEmployeeKey, router, tenantId, tenantSlug]
  );

  const handlePreviewManageReporting = useCallback(
    (employeeId: string) => {
      if (isTenantContextReadOnly) return;
      setSheetEmployeeKey(getEmployeeKey(employeeId));
    },
    [getEmployeeKey, isTenantContextReadOnly]
  );

  const handlePreviewFocusBranch = useCallback(
    (employeeId: string) => {
      const employeeKey = getEmployeeKey(employeeId);
      if (!employeeKey) {
        return;
      }

      setIsNavigating(true);
      setCollapsedEmployeeIds(new Set());
      updateParams({ rootEmployeeKey: employeeKey, focusEmployeeKey: null });
      setFocusRequestKey((k) => k + 1);
    },
    [getEmployeeKey, updateParams]
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
      setPreviewEmployeeId(managerId);
      setHighlightedEmployeeId(managerId);
      requestFocus(managerId);
    },
    [requestFocus, roots]
  );

  const handlePreviewViewDirectReports = useCallback(
    (employeeId: string) => {
      const employeeKey = getEmployeeKey(employeeId);
      if (!employeeKey) {
        return;
      }

      setIsNavigating(true);
      setCollapsedEmployeeIds(new Set());
      setSelectedEmployeeId(employeeId);
      setPreviewEmployeeId(employeeId);
      setHighlightedEmployeeId(employeeId);
      updateParams({ rootEmployeeKey: employeeKey, maxDepth: "4" });
      setFocusRequestKey((k) => k + 1);
    },
    [getEmployeeKey, updateParams]
  );

  const handleOrgUnitChange = useCallback(
    (nextOrgUnitCode: string | null) => {
      setIsNavigating(true);
      setSelectedEmployeeId(null);
      setPreviewEmployeeId(null);
      setHighlightedEmployeeId(null);
      updateParams({ orgUnitCode: nextOrgUnitCode });
    },
    [updateParams]
  );

  const handleMaxDepthChange = useCallback(
    (nextDepth: number) => {
      setIsNavigating(true);
      updateParams({ maxDepth: String(nextDepth) });
    },
    [updateParams]
  );

  const handleIncludeInactiveChange = useCallback(
    (include: boolean) => {
      setIsNavigating(true);
      updateParams({ includeInactive: include ? "true" : null });
    },
    [updateParams]
  );

  useEffect(() => {
    if (!isFetching) {
      setIsNavigating(false);
    }
  }, [isFetching]);

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
      sheetEmployeeKey &&
      !flattenedNodes.some((n) => n.stableEmployeeKey === sheetEmployeeKey)
    ) {
      setSheetEmployeeKey(null);
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
    sheetEmployeeKey,
  ]);

  const isInitialPageLoading = canAccess && isLoading && !data && !error;

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
          description="Org chart access is restricted."
        />
        <EmptyState
          icon={Network}
          title="Org chart is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Org Chart"
        description="Workforce structure and reporting lines."
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
        focusedRootEmployeeId={data?.requestedRootEmployeeId ?? null}
        focusEmployeeId={data?.focusedEmployeeId ?? null}
        maxDepth={maxDepth}
        totalVisibleNodeCount={data?.totalVisibleNodeCount ?? 0}
        isCanvasReady={isCanvasReady}
        isNavigating={isNavigating}
        isReassignMode={isReassignMode}
        isRefreshing={isFetching}
        includeInactive={includeInactive}
        selectedOrgUnitCode={orgUnitCode}
        issueCounts={data?.issueCounts ?? null}
        onMaxDepthChange={handleMaxDepthChange}
        onSelectSearchResult={handleSelectSearchResult}
        onFocusSelectedBranch={handleFocusSelectedBranch}
        onShowFullOrganization={handleShowFullOrganization}
        isTenantContextReadOnly={isTenantContextReadOnly}
        onToggleReassignMode={() => {
          if (isTenantContextReadOnly) return;
          setIsReassignMode((current) => !current);
        }}
        onFitToScreen={() => canvasApiRef.current?.fitToScreen()}
        onResetView={() => canvasApiRef.current?.resetView()}
        onIncludeInactiveChange={handleIncludeInactiveChange}
        onOrgUnitChange={handleOrgUnitChange}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load org chart</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Could not load org chart. Try again in a moment.</span>
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
            Increase depth or focus a branch to inspect more levels.
          </AlertDescription>
        </Alert>
      ) : null}

      {data && data.totalVisibleNodeCount === 0 ? (
        <EmptyState
          icon={Network}
          title="No visible reporting structure yet"
          description="Add employees and reporting lines to render the chart."
        />
      ) : (
        <div className="flex h-[70vh] overflow-hidden rounded-2xl border bg-card">
          <div className="min-w-0 flex-1">
            <OrgChartCanvas
              roots={roots}
              showJobTitle={fieldVisibility.showJobTitle}
              isReassignMode={isReassignMode}
              collapsedEmployeeIds={collapsedEmployeeIds}
              selectedEmployeeId={selectedEmployeeId}
              highlightedEmployeeId={highlightedEmployeeId}
              onSelectEmployee={handleNodeSelect}
              onToggleCollapse={handleToggleCollapse}
              focusEmployeeId={data?.focusedEmployeeId ?? null}
              focusRequestKey={focusRequestKey}
              fitViewKey={fitViewKey}
              isOverviewMode={rootEmployeeKey === null}
              onCanvasApiReady={handleCanvasApiReady}
              onReassignProposal={(proposal) => {
                if (isTenantContextReadOnly) return;
                setReassignProposal(proposal);
              }}
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
                showJobTitle={fieldVisibility.showJobTitle}
                onClose={() => setPreviewEmployeeId(null)}
                onOpenProfile={handlePreviewOpenProfile}
                isTenantContextReadOnly={isTenantContextReadOnly}
                onManageReportingRelationship={handlePreviewManageReporting}
                onFocusBranch={handlePreviewFocusBranch}
                onViewManager={handlePreviewViewManager}
                onViewDirectReports={handlePreviewViewDirectReports}
              />
            ) : null}
          </div>
        </div>
      )}

      <EmployeeReportingLinesDialog
        employeeKey={sheetEmployeeKey}
        open={sheetEmployeeKey !== null}
        showJobTitle={fieldVisibility.showJobTitle}
        onOpenChange={(open) => {
          if (!open) setSheetEmployeeKey(null);
        }}
      />

      <ManagerReassignDialog
        proposal={reassignProposal}
        showJobTitle={fieldVisibility.showJobTitle}
        onClose={() => setReassignProposal(null)}
      />
    </div>
  );
}
