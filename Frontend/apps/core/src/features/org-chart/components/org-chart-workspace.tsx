"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Network, RefreshCcw } from "lucide-react";
import { canAccessCoreOrgChart, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PageEmpty,
  PageError,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { cn } from "@/lib/utils";
import { useEmployeeFieldVisibility } from "@/features/employees/shared/employee-field-visibility";
import { useWorkforceMe } from "@/features/overview/api/use-workforce-me";
import { EmployeeReportingLinesDialog } from "@/app/(pages)/employees/employee-reporting-lines-sheet";
import {
  ManagerReassignDialog,
  type ManagerReassignProposal,
} from "@/app/(pages)/org-chart/manager-reassign-dialog";
import {
  OrgChartCanvas,
  type OrgChartCanvasApi,
} from "@/app/(pages)/org-chart/org-chart-canvas";
import { OrgUnitCanvas } from "@/app/(pages)/org-chart/org-unit-canvas";
import {
  buildOrgChartSearchIndex,
  buildOrgUnitSearchIndex,
  findEmployeePath,
  findUnitPath,
  flattenOrgChart,
  flattenOrgUnitTree,
} from "@/app/(pages)/org-chart/org-chart-layout";
import { OrgChartCommandBar } from "@/app/(pages)/org-chart/org-chart-command-bar";
import { OrgChartPreviewPanel } from "@/app/(pages)/org-chart/org-chart-preview-panel";
import { OrgUnitPreviewPanel } from "@/app/(pages)/org-chart/org-unit-preview-panel";
import {
  OrgChartOutlinePanel,
  type OutlineNode,
} from "@/app/(pages)/org-chart/org-chart-outline-panel";
import {
  downloadDataUrl,
  printDataUrl,
} from "@/app/(pages)/org-chart/org-chart-export";
import { useOrgChart } from "@/app/(pages)/org-chart/use-org-chart";
import { useOrgUnitTree } from "@/app/(pages)/org-chart/use-org-unit-tree";
import type {
  EmployeeOrgChartNodeDto,
  OrgChartLens,
  OrgUnitTreeNodeDto,
} from "@/app/(pages)/org-chart/org-chart.types";

const DEFAULT_MAX_DEPTH = 10;

export default function OrgChartWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-backed state (shareable). Lens + scope params for both lenses live here.
  const lens: OrgChartLens =
    searchParams.get("lens") === "structure" ? "structure" : "people";
  const rootEmployeeKey = searchParams.get("rootEmployeeKey");
  const focusEmployeeKey = searchParams.get("focusEmployeeKey");
  const orgUnitCode = searchParams.get("orgUnitCode");
  const includeInactive = searchParams.get("includeInactive") === "true";
  const maxDepth =
    Number(searchParams.get("maxDepth") ?? DEFAULT_MAX_DEPTH) ||
    DEFAULT_MAX_DEPTH;
  const rootUnitId = searchParams.get("rootUnitId");

  const { user } = useAuth();
  const { tenantId, tenantSlug } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const canAccess = canAccessCoreOrgChart(user) || isTenantContextReadOnly;
  const fieldVisibility = useEmployeeFieldVisibility(canAccess);
  const isPeople = lens === "people";

  // Local UI state
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isReassignMode, setIsReassignMode] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const canvasApiRef = useRef<OrgChartCanvasApi | null>(null);

  // People-lens local state
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
  const [collapsedEmployeeIds, setCollapsedEmployeeIds] = useState<Set<string>>(
    new Set()
  );
  const [reassignProposal, setReassignProposal] =
    useState<ManagerReassignProposal | null>(null);
  const [pendingSelectEmployeeId, setPendingSelectEmployeeId] = useState<
    string | null
  >(null);

  // Structure-lens local state
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [highlightedUnitId, setHighlightedUnitId] = useState<string | null>(
    null
  );
  const [collapsedUnitIds, setCollapsedUnitIds] = useState<Set<string>>(
    new Set()
  );
  const [focusUnitId, setFocusUnitId] = useState<string | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.replace(`?${next.toString()}`);
    },
    [router, searchParams]
  );

  // ---- Data ----
  const {
    data: peopleData,
    error: peopleError,
    isLoading: peopleLoading,
    isFetching: peopleFetching,
    refetch: refetchPeople,
  } = useOrgChart(
    { rootEmployeeKey, focusEmployeeKey, orgUnitCode, includeInactive, maxDepth },
    isPeople
  );

  const {
    data: unitData,
    error: unitError,
    isLoading: unitLoading,
    isFetching: unitFetching,
    refetch: refetchUnits,
  } = useOrgUnitTree({ rootId: rootUnitId, maxDepth, includeInactive }, !isPeople);

  const me = useWorkforceMe(canAccess);
  const meEmployeeId = me.data?.employee?.employeeId ?? null;
  const meEmployeeKey = me.data?.employee?.stableEmployeeKey ?? null;

  const peopleRoots = useMemo(
    () => peopleData?.roots ?? [],
    [peopleData?.roots]
  );
  const unitRoots = useMemo(() => unitData ?? [], [unitData]);

  const flattenedEmployees = useMemo(
    () => flattenOrgChart(peopleRoots),
    [peopleRoots]
  );
  const flattenedUnits = useMemo(
    () => flattenOrgUnitTree(unitRoots),
    [unitRoots]
  );

  const peopleSearchIndex = useMemo(
    () => buildOrgChartSearchIndex(peopleRoots, fieldVisibility.showJobTitle),
    [fieldVisibility.showJobTitle, peopleRoots]
  );
  const unitSearchIndex = useMemo(
    () => buildOrgUnitSearchIndex(unitRoots),
    [unitRoots]
  );

  const selectedEmployee = useMemo(
    () =>
      flattenedEmployees.find((e) => e.employeeId === selectedEmployeeId) ??
      null,
    [flattenedEmployees, selectedEmployeeId]
  );
  const previewEmployee = useMemo(
    () =>
      flattenedEmployees.find((e) => e.employeeId === previewEmployeeId) ?? null,
    [flattenedEmployees, previewEmployeeId]
  );
  const selectedUnit = useMemo(
    () => flattenedUnits.find((u) => u.id === selectedUnitId) ?? null,
    [flattenedUnits, selectedUnitId]
  );
  const employeeKeyById = useMemo(
    () =>
      new Map(
        flattenedEmployees.map((e) => [e.employeeId, e.stableEmployeeKey])
      ),
    [flattenedEmployees]
  );

  const totalVisibleNodeCount = isPeople
    ? peopleData?.totalVisibleNodeCount ?? 0
    : flattenedUnits.length;

  const error = isPeople ? peopleError : unitError;
  const isFetching = isPeople ? peopleFetching : unitFetching;
  const isLoading = isPeople ? peopleLoading : unitLoading;
  const isBusy = isNavigating || isFetching;

  const fitViewKey = useMemo(
    () =>
      isPeople
        ? `people:${peopleData?.requestedRootEmployeeId ?? "all"}:${peopleData?.maxDepthApplied ?? maxDepth}:${peopleData?.totalVisibleNodeCount ?? 0}`
        : `structure:${rootUnitId ?? "all"}:${flattenedUnits.length}`,
    [
      flattenedUnits.length,
      isPeople,
      maxDepth,
      peopleData?.maxDepthApplied,
      peopleData?.requestedRootEmployeeId,
      peopleData?.totalVisibleNodeCount,
      rootUnitId,
    ]
  );

  const getEmployeeKey = useCallback(
    (employeeId: string | null) =>
      employeeId ? employeeKeyById.get(employeeId) ?? null : null,
    [employeeKeyById]
  );

  const handleCanvasApiReady = useCallback((api: OrgChartCanvasApi | null) => {
    canvasApiRef.current = api;
    setIsCanvasReady(api !== null);
  }, []);

  // ---- People interactions ----
  const requestEmployeeFocus = useCallback(
    (employeeId: string) => {
      const employeeKey = getEmployeeKey(employeeId);
      if (!employeeKey) return;
      setIsNavigating(true);
      setFocusRequestKey((k) => k + 1);
      updateParams({ focusEmployeeKey: employeeKey });
    },
    [getEmployeeKey, updateParams]
  );

  const selectEmployee = useCallback((employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setPreviewEmployeeId(employeeId);
    setHighlightedEmployeeId(employeeId);
  }, []);

  const revealAndSelectEmployee = useCallback(
    (employeeId: string) => {
      const path = findEmployeePath(peopleRoots, employeeId);
      setCollapsedEmployeeIds((current) => {
        const next = new Set(current);
        path.forEach((id) => next.delete(id));
        return next;
      });
      selectEmployee(employeeId);
      requestEmployeeFocus(employeeId);
    },
    [peopleRoots, requestEmployeeFocus, selectEmployee]
  );

  const handleToggleEmployeeCollapse = useCallback((employeeId: string) => {
    setCollapsedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }, []);

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

  const handlePreviewOpenProfile = useCallback(
    (employeeId: string) => {
      const employeeKey = getEmployeeKey(employeeId);
      if (!employeeKey) return;
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
      if (!employeeKey) return;
      setIsNavigating(true);
      setCollapsedEmployeeIds(new Set());
      updateParams({ rootEmployeeKey: employeeKey, focusEmployeeKey: null });
      setFocusRequestKey((k) => k + 1);
    },
    [getEmployeeKey, updateParams]
  );

  const handlePreviewViewDirectReports = useCallback(
    (employeeId: string) => {
      const employeeKey = getEmployeeKey(employeeId);
      if (!employeeKey) return;
      setIsNavigating(true);
      setCollapsedEmployeeIds(new Set());
      selectEmployee(employeeId);
      updateParams({ rootEmployeeKey: employeeKey, maxDepth: "4" });
      setFocusRequestKey((k) => k + 1);
    },
    [getEmployeeKey, selectEmployee, updateParams]
  );

  // ---- Structure interactions ----
  const selectUnit = useCallback((unitId: string) => {
    setSelectedUnitId(unitId);
    setHighlightedUnitId(unitId);
    setFocusUnitId(unitId);
    setFocusRequestKey((k) => k + 1);
  }, []);

  const revealAndSelectUnit = useCallback(
    (unitId: string) => {
      const path = findUnitPath(unitRoots, unitId);
      setCollapsedUnitIds((current) => {
        const next = new Set(current);
        path.forEach((id) => next.delete(id));
        return next;
      });
      selectUnit(unitId);
    },
    [selectUnit, unitRoots]
  );

  const handleToggleUnitCollapse = useCallback((unitId: string) => {
    setCollapsedUnitIds((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }, []);

  const handleUnitFocusBranch = useCallback(
    (unitId: string) => {
      setIsNavigating(true);
      setCollapsedUnitIds(new Set());
      updateParams({ rootUnitId: unitId });
      setFocusRequestKey((k) => k + 1);
    },
    [updateParams]
  );

  const handleViewPeopleInUnit = useCallback(
    (unitCode: string) => {
      setIsNavigating(true);
      setSelectedUnitId(null);
      updateParams({
        lens: "people",
        orgUnitCode: unitCode,
        rootEmployeeKey: null,
        focusEmployeeKey: null,
        rootUnitId: null,
      });
    },
    [updateParams]
  );

  // ---- Shared / cross-lens ----
  const handleLensChange = useCallback(
    (nextLens: OrgChartLens) => {
      if (nextLens === lens) return;
      setIsNavigating(true);
      setIsReassignMode(false);
      updateParams({ lens: nextLens === "people" ? null : "structure" });
    },
    [lens, updateParams]
  );

  const handleShowFullOrganization = useCallback(() => {
    setIsNavigating(true);
    if (isPeople) {
      setCollapsedEmployeeIds(new Set());
      updateParams({
        rootEmployeeKey: null,
        orgUnitCode: null,
        focusEmployeeKey: null,
      });
    } else {
      setCollapsedUnitIds(new Set());
      updateParams({ rootUnitId: null });
    }
    setFocusRequestKey((k) => k + 1);
  }, [isPeople, updateParams]);

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

  const handleJumpToMe = useCallback(() => {
    if (!meEmployeeId) return;
    setPendingSelectEmployeeId(meEmployeeId);
    setIsNavigating(true);
    setCollapsedEmployeeIds(new Set());
    updateParams({
      lens: null,
      rootEmployeeKey: null,
      orgUnitCode: null,
      focusEmployeeKey: meEmployeeKey,
    });
  }, [meEmployeeId, meEmployeeKey, updateParams]);

  const handleExportPng = useCallback(async () => {
    if (!canvasApiRef.current) return;
    setIsExporting(true);
    try {
      const url = await canvasApiRef.current.exportToPng();
      if (url) downloadDataUrl(url, `org-chart-${lens}.png`);
    } finally {
      setIsExporting(false);
    }
  }, [lens]);

  const handlePrint = useCallback(async () => {
    if (!canvasApiRef.current) return;
    setIsExporting(true);
    try {
      const url = await canvasApiRef.current.exportToPng();
      if (url) printDataUrl(url, "Org chart");
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Outline data + handlers for the active lens
  const outlineRoots = useMemo<OutlineNode[]>(() => {
    if (isPeople) {
      const map = (node: EmployeeOrgChartNodeDto): OutlineNode => ({
        id: node.employeeId,
        label: node.fullName,
        sublabel: fieldVisibility.showJobTitle
          ? node.jobTitle ?? node.orgUnitName
          : node.orgUnitName,
        children: node.children.map(map),
      });
      return peopleRoots.map(map);
    }
    const map = (node: OrgUnitTreeNodeDto): OutlineNode => ({
      id: node.id,
      label: node.name,
      sublabel: node.type,
      children: node.children.map(map),
    });
    return unitRoots.map(map);
  }, [fieldVisibility.showJobTitle, isPeople, peopleRoots, unitRoots]);

  // ---- Effects ----
  useEffect(() => {
    if (!isFetching) setIsNavigating(false);
  }, [isFetching]);

  // Resolve a pending "jump to" once the target appears in the loaded chart.
  useEffect(() => {
    if (!pendingSelectEmployeeId) return;
    if (flattenedEmployees.some((e) => e.employeeId === pendingSelectEmployeeId)) {
      revealAndSelectEmployee(pendingSelectEmployeeId);
      setPendingSelectEmployeeId(null);
    }
  }, [flattenedEmployees, pendingSelectEmployeeId, revealAndSelectEmployee]);

  // Clear people selection when nodes leave the visible chart.
  useEffect(() => {
    if (
      selectedEmployeeId &&
      !flattenedEmployees.some((n) => n.employeeId === selectedEmployeeId)
    ) {
      setSelectedEmployeeId(null);
    }
    if (
      previewEmployeeId &&
      !flattenedEmployees.some((n) => n.employeeId === previewEmployeeId)
    ) {
      setPreviewEmployeeId(null);
    }
    if (
      highlightedEmployeeId &&
      !flattenedEmployees.some((n) => n.employeeId === highlightedEmployeeId)
    ) {
      setHighlightedEmployeeId(null);
    }
    if (
      sheetEmployeeKey &&
      !flattenedEmployees.some((n) => n.stableEmployeeKey === sheetEmployeeKey)
    ) {
      setSheetEmployeeKey(null);
    }
  }, [
    flattenedEmployees,
    highlightedEmployeeId,
    previewEmployeeId,
    selectedEmployeeId,
    sheetEmployeeKey,
  ]);

  // Clear unit selection when units leave the visible tree.
  useEffect(() => {
    if (selectedUnitId && !flattenedUnits.some((u) => u.id === selectedUnitId)) {
      setSelectedUnitId(null);
    }
  }, [flattenedUnits, selectedUnitId]);

  const isInitialPageLoading = canAccess && isLoading && !error && (
    isPeople ? !peopleData : !unitData
  );

  if (isInitialPageLoading) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          title="Org Chart"
          description="Workforce structure and reporting lines."
          actions={<Skeleton className="h-9 w-32 shrink-0" />}
        />
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-3">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-[70vh] rounded-2xl" />
      </PageContainer>
    );
  }

  if (!canAccess) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader title="Org Chart" description="Org chart access is restricted." />
        <PagePermissionNotice
          title="Org chart is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </PageContainer>
    );
  }

  const hasActiveScope = isPeople
    ? rootEmployeeKey !== null ||
      orgUnitCode !== null ||
      focusEmployeeKey !== null
    : rootUnitId !== null;

  const isEmpty = totalVisibleNodeCount === 0 && !!(isPeople ? peopleData : unitData);

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Org Chart"
        description="Workforce structure and reporting lines."
        actions={
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => (isPeople ? refetchPeople() : refetchUnits())}
          >
            <RefreshCcw className={isFetching ? "animate-spin" : undefined} />
            Refresh chart
          </Button>
        }
      />

      <OrgChartCommandBar
        lens={lens}
        onLensChange={handleLensChange}
        peopleSearchIndex={peopleSearchIndex}
        unitSearchIndex={unitSearchIndex}
        onSelectPerson={revealAndSelectEmployee}
        onSelectUnit={revealAndSelectUnit}
        selectedEmployee={selectedEmployee}
        focusedRootEmployeeId={peopleData?.requestedRootEmployeeId ?? null}
        hasActiveScope={hasActiveScope}
        onFocusSelectedBranch={handleFocusSelectedBranch}
        onShowFullOrganization={handleShowFullOrganization}
        canJumpToMe={!!meEmployeeId}
        onJumpToMe={handleJumpToMe}
        totalVisibleNodeCount={totalVisibleNodeCount}
        issueCounts={peopleData?.issueCounts ?? null}
        isBusy={isBusy}
        isCanvasReady={isCanvasReady}
        selectedOrgUnitCode={orgUnitCode}
        onOrgUnitChange={handleOrgUnitChange}
        maxDepth={maxDepth}
        onMaxDepthChange={handleMaxDepthChange}
        includeInactive={includeInactive}
        onIncludeInactiveChange={handleIncludeInactiveChange}
        isOutlineOpen={isOutlineOpen}
        onToggleOutline={() => setIsOutlineOpen((v) => !v)}
        onFitToScreen={() => canvasApiRef.current?.fitToScreen()}
        onResetView={() => canvasApiRef.current?.resetView()}
        onExportPng={handleExportPng}
        onPrint={handlePrint}
        isExporting={isExporting}
        isReassignMode={isReassignMode}
        onToggleReassignMode={() => {
          if (isTenantContextReadOnly) return;
          setIsReassignMode((v) => !v);
        }}
        isTenantContextReadOnly={isTenantContextReadOnly}
      />

      {error ? (
        <PageError
          title="Failed to load org chart"
          description="Could not load the org chart. Try again in a moment."
          onRetry={() => (isPeople ? refetchPeople() : refetchUnits())}
        />
      ) : null}

      {isPeople && peopleData?.isTruncated ? (
        <Alert>
          <AlertTitle>Chart depth is capped for this view</AlertTitle>
          <AlertDescription>
            Increase depth or focus a branch to inspect more levels.
          </AlertDescription>
        </Alert>
      ) : null}

      {isEmpty ? (
        <PageEmpty
          icon={Network}
          title={
            isPeople
              ? "No visible reporting structure yet"
              : "No org units to show"
          }
          description={
            isPeople
              ? "Add employees and reporting lines to render the chart."
              : "Publish an organization structure to render the structure view."
          }
        />
      ) : (
        <div className="flex h-[70vh] overflow-hidden rounded-2xl border bg-card">
          {isOutlineOpen ? (
            <OrgChartOutlinePanel
              title={isPeople ? "People" : "Org units"}
              roots={outlineRoots}
              selectedId={isPeople ? selectedEmployeeId : selectedUnitId}
              collapsedIds={isPeople ? collapsedEmployeeIds : collapsedUnitIds}
              onSelect={isPeople ? revealAndSelectEmployee : revealAndSelectUnit}
              onToggleCollapse={
                isPeople ? handleToggleEmployeeCollapse : handleToggleUnitCollapse
              }
              onClose={() => setIsOutlineOpen(false)}
            />
          ) : null}

          <div className="min-w-0 flex-1">
            {isPeople ? (
              <OrgChartCanvas
                roots={peopleRoots}
                showJobTitle={fieldVisibility.showJobTitle}
                isReassignMode={isReassignMode}
                collapsedEmployeeIds={collapsedEmployeeIds}
                selectedEmployeeId={selectedEmployeeId}
                highlightedEmployeeId={highlightedEmployeeId}
                onSelectEmployee={selectEmployee}
                onToggleCollapse={handleToggleEmployeeCollapse}
                focusEmployeeId={peopleData?.focusedEmployeeId ?? null}
                focusRequestKey={focusRequestKey}
                fitViewKey={fitViewKey}
                isOverviewMode={rootEmployeeKey === null}
                onCanvasApiReady={handleCanvasApiReady}
                onReassignProposal={(proposal) => {
                  if (isTenantContextReadOnly) return;
                  setReassignProposal(proposal);
                }}
              />
            ) : (
              <OrgUnitCanvas
                roots={unitRoots}
                collapsedUnitIds={collapsedUnitIds}
                selectedUnitId={selectedUnitId}
                highlightedUnitId={highlightedUnitId}
                onSelectUnit={selectUnit}
                onToggleCollapse={handleToggleUnitCollapse}
                focusUnitId={focusUnitId}
                focusRequestKey={focusRequestKey}
                fitViewKey={fitViewKey}
                isOverviewMode={rootUnitId === null}
                onCanvasApiReady={handleCanvasApiReady}
              />
            )}
          </div>

          <div
            className={cn(
              "shrink-0 overflow-hidden border-l transition-[width] duration-200 ease-out",
              (isPeople ? previewEmployee : selectedUnit)
                ? "w-80"
                : "w-0 border-transparent"
            )}
          >
            {isPeople && previewEmployee ? (
              <OrgChartPreviewPanel
                employee={previewEmployee}
                showJobTitle={fieldVisibility.showJobTitle}
                onClose={() => setPreviewEmployeeId(null)}
                onOpenProfile={handlePreviewOpenProfile}
                isTenantContextReadOnly={isTenantContextReadOnly}
                onManageReportingRelationship={handlePreviewManageReporting}
                onFocusBranch={handlePreviewFocusBranch}
                onViewManager={revealAndSelectEmployee}
                onViewDirectReports={handlePreviewViewDirectReports}
              />
            ) : null}
            {!isPeople && selectedUnit ? (
              <OrgUnitPreviewPanel
                unit={selectedUnit}
                onClose={() => setSelectedUnitId(null)}
                onFocusBranch={handleUnitFocusBranch}
                onViewPeopleInUnit={handleViewPeopleInUnit}
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
    </PageContainer>
  );
}
