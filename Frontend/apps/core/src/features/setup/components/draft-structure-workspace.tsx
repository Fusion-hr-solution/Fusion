"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ApiError } from "@repo/api";
import { canAccessCoreSetup, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { toast } from "sonner";
import { useCoreSetupAccess } from "@/shell/setup-access";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSetupReadiness } from "@/features/setup/api/use-setup";
import { shouldAutoActivateSetup } from "@/features/setup/setup-entry-routing";
import { DraftUnitDialog } from "@/app/(pages)/setup/draft-structure/create-draft-unit-dialog";
import { DraftOrgUnitKindManager } from "@/app/(pages)/setup/draft-structure/draft-org-unit-kind-manager";
import { DraftStructureImportPanel } from "@/app/(pages)/setup/draft-structure/draft-structure-import-panel";
import {
  resolveDraftStructureSelectedUnitId,
  shouldShowDraftStructureBootstrap,
} from "@/app/(pages)/setup/draft-structure/draft-structure-page-state";
import { type DraftStructureSortField } from "@/app/(pages)/setup/draft-structure/draft-structure-table";
import {
  buildWorkspaceDraftTree,
  filterDraftTree,
  findDraftTreeNodeById,
} from "@/app/(pages)/setup/draft-structure/draft-structure-tree-utils";
import {
  useClearDraftStructure,
  useDeleteDraftOrgUnit,
  useDraftStructureTree,
  useDraftStructureWorkspace,
} from "@/app/(pages)/setup/draft-structure/use-draft-structure";
import {
  DRAFT_STRUCTURE_EXPORT_FILE_NAME,
  buildDraftStructureExportCsv,
  buildLeafFirstDeleteOrder,
  compareDraftUnits,
  downloadBlob,
  ExplorerView,
  filterDraftTreeByMatchedIds,
  flattenDraftTreeNodeIds,
  formatTimestamp,
  matchesDraftUnitSearch,
  DraftStructureReferenceEmptyState,
  DraftStructureWorkbench,
  DraftStructurePageSkeleton,
  getActionErrorMessage,
} from "./draft-structure-ui";

export default function DraftStructureWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialImportSessionId = searchParams.get("session");
  const initialImportOpen =
    searchParams.get("import") === "1" || !!initialImportSessionId;
  const { user } = useAuth();
  const canAccess = canAccessCoreSetup(user);
  const [setupEntryError, setSetupEntryError] = useState<string | null>(null);
  const [hasAttemptedSetupEntry, setHasAttemptedSetupEntry] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [kindManagerOpen, setKindManagerOpen] = useState(false);
  const [clearStructureOpen, setClearStructureOpen] = useState(false);
  const [clearDeleteProgress, setClearDeleteProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [explorerView, setExplorerView] = useState<ExplorerView>("tree");
  const [isImportOpen, setIsImportOpen] = useState(() => initialImportOpen);
  const [importSessionId, setImportSessionId] = useState<string | null>(
    () => initialImportSessionId
  );
  const [tableSortBy, setTableSortBy] =
    useState<DraftStructureSortField>("displayName");
  const [tableSortDirection, setTableSortDirection] = useState<"asc" | "desc">(
    "asc"
  );
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim();
  const isSearching = normalizedSearch.length > 0;

  const {
    setupState,
    setupError,
    isSetupStateLoading: isSetupLoading,
    setupTransitionKind,
    startSetup,
    publishSetup,
    reopenSetup,
    refreshSetupAccess,
  } = useCoreSetupAccess();
  const isSetupComplete = !!setupState?.hasPublishedStructure;
  const isDraftLocked = !setupState?.isDraftCycleActive;
  const canPublishFromDraft = !!setupState?.isDraftCycleActive;
  const canReopenFromDraft =
    !!setupState?.hasPublishedStructure && !setupState.isDraftCycleActive;
  const shouldStartSetupFromDraft = shouldAutoActivateSetup(
    setupState?.canStartSetup
  );
  const pageTitle = !isDraftLocked
    ? setupState?.requiresRepublish
      ? "Draft changes"
      : "Draft structure"
    : isSetupComplete
      ? "Live structure"
      : canReopenFromDraft
        ? "Live structure"
        : "Structure review";

  const workspaceEnabled =
    canAccess && !!setupState && !setupState.canStartSetup;
  const {
    data: readiness,
    error: readinessError,
    refetch: refetchReadiness,
  } = useSetupReadiness(workspaceEnabled && canPublishFromDraft);
  const {
    data: workspace,
    error: workspaceError,
    refetch,
  } = useDraftStructureWorkspace(workspaceEnabled);
  const {
    data: tree,
    error: treeError,
    refetch: refetchTree,
  } = useDraftStructureTree(workspaceEnabled);
  const clearStructure = useClearDraftStructure();
  const deleteDraftOrgUnit = useDeleteDraftOrgUnit();
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const isActivating = setupTransitionKind === "activating";
  const isPublishing = setupTransitionKind === "publishing";
  const isReopening = setupTransitionKind === "reopening";

  const draftTree = useMemo(() => buildWorkspaceDraftTree(tree ?? []), [tree]);
  const draftTreeNodeIds = useMemo(
    () => flattenDraftTreeNodeIds(draftTree),
    [draftTree]
  );
  const syncWorkspaceQueries = useCallback(
    async (options?: { includeSetupState?: boolean }) => {
      const refreshActions = [refetch(), refetchTree()];

      if (options?.includeSetupState) {
        refreshActions.push(refreshSetupAccess());
      }

      if (canPublishFromDraft) {
        refreshActions.push(refetchReadiness());
      }

      await Promise.allSettled(refreshActions);
    },
    [
      canPublishFromDraft,
      refetch,
      refetchReadiness,
      refetchTree,
      refreshSetupAccess,
    ]
  );
  const treeSearchResults = useMemo(
    () => filterDraftTree(draftTree, deferredSearch),
    [deferredSearch, draftTree]
  );
  const matchedSearchIds = useMemo(() => {
    if (!isSearching) {
      return null;
    }

    const nextMatchedIds = new Set(flattenDraftTreeNodeIds(treeSearchResults));

    for (const unit of workspace?.units ?? []) {
      if (matchesDraftUnitSearch(unit, deferredSearch)) {
        nextMatchedIds.add(unit.id);
      }
    }

    return nextMatchedIds;
  }, [deferredSearch, isSearching, treeSearchResults, workspace?.units]);
  const filteredTree = useMemo(
    () =>
      !isSearching || !matchedSearchIds
        ? draftTree
        : filterDraftTreeByMatchedIds(draftTree, matchedSearchIds),
    [draftTree, isSearching, matchedSearchIds]
  );
  const filteredUnits = useMemo(() => {
    const units = workspace?.units ?? [];

    if (!isSearching || !matchedSearchIds) {
      return units;
    }

    return units.filter((unit) => matchedSearchIds.has(unit.id));
  }, [isSearching, matchedSearchIds, workspace?.units]);
  const sortedFilteredUnits = useMemo(
    () =>
      [...filteredUnits].sort((left, right) =>
        compareDraftUnits(left, right, tableSortBy, tableSortDirection)
      ),
    [filteredUnits, tableSortBy, tableSortDirection]
  );
  const resolvedSelectedUnitId = useMemo(() => {
    return resolveDraftStructureSelectedUnitId({
      draftTree,
      filteredUnits,
      isSearching,
      selectedUnitId,
    });
  }, [draftTree, filteredUnits, isSearching, selectedUnitId]);

  useEffect(() => {
    if (selectedUnitId === resolvedSelectedUnitId) {
      return;
    }

    setSelectedUnitId(resolvedSelectedUnitId);
  }, [resolvedSelectedUnitId, selectedUnitId]);

  useEffect(() => {
    const isEmptyDraftWorkspace = (workspace?.units.length ?? 0) === 0;

    if (!isEmptyDraftWorkspace) {
      return;
    }

    setExplorerView("tree");
    setSearch("");
  }, [workspace?.units.length]);

  const effectiveSelectedUnitId = resolvedSelectedUnitId;
  const selectedUnit =
    workspace?.units.find((unit) => unit.id === effectiveSelectedUnitId) ??
    null;
  const selectedTreeNode = findDraftTreeNodeById(
    draftTree,
    effectiveSelectedUnitId
  );
  const hasImportSession = !!importSessionId;
  const isEmptyDraftWorkspace = (workspace?.units.length ?? 0) === 0;
  const unitCount = workspace?.unitCount ?? 0;
  const topLevelCount = workspace?.rootUnitCount ?? 0;
  const typeCount = workspace?.draftStructureSchema.orgUnitKinds.length ?? 0;
  const pageDescription = !isDraftLocked
    ? setupState?.requiresRepublish
      ? "Update the reopened draft while the current live structure stays active until republish."
      : "Build and review the organization hierarchy before publish."
    : canReopenFromDraft
      ? "Review the live organization hierarchy."
      : isSetupComplete
        ? "Review the live organization hierarchy."
        : "Review the organization hierarchy.";
  const importReadOnlyTitle = isSetupComplete
    ? "Import is unavailable on the live structure"
    : "Import is unavailable while the structure is read-only";
  const importReadOnlyMessage = canReopenFromDraft
    ? "Reopen the draft from Setup to import a file."
    : isSetupComplete
      ? "Use this page to review the live structure. Reopen the draft from Setup when changes are needed."
      : "Import returns when the draft is editable again.";
  const blockingIssueCount = readiness?.blockingIssueCount ?? 0;
  const warningCount = readiness?.warningCount ?? 0;
  const workbenchStatusLabel = !isDraftLocked
    ? isEmptyDraftWorkspace
      ? "Draft empty"
      : blockingIssueCount > 0
        ? "Needs fixes"
        : readiness?.isReadyForApproval
          ? setupState?.requiresRepublish
            ? "Ready to republish"
            : "Ready to publish"
          : setupState?.requiresRepublish
            ? "Draft changes pending"
            : "Draft active"
    : canReopenFromDraft
      ? "Live structure"
      : isSetupComplete
        ? "Live structure"
        : "Read only";
  const workbenchStatusVariant =
    !isDraftLocked && blockingIssueCount > 0
      ? "destructive"
      : !isDraftLocked &&
          !isEmptyDraftWorkspace &&
          readiness?.isReadyForApproval
        ? "secondary"
        : "outline";
  const workbenchSummary = isEmptyDraftWorkspace
    ? `${typeCount} type${typeCount === 1 ? "" : "s"} available`
    : `${unitCount} unit${unitCount === 1 ? "" : "s"} • ${topLevelCount} top-level • ${typeCount} type${typeCount === 1 ? "" : "s"}`;
  const workbenchIssueLabel =
    !isDraftLocked && !isEmptyDraftWorkspace
      ? blockingIssueCount > 0
        ? `${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"}`
        : warningCount > 0
          ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
          : readinessError
            ? "Readiness unavailable"
            : null
      : null;
  const workbenchIssueTone =
    blockingIssueCount > 0
      ? "danger"
      : warningCount > 0 || readinessError
        ? "warning"
        : "default";
  const isClearingStructureAction =
    clearStructure.isLoading ||
    deleteDraftOrgUnit.isLoading ||
    !!clearDeleteProgress;
  const isWorkspaceTransitionPending =
    shouldStartSetupFromDraft || isActivating || isReopening;
  const isInitialWorkspaceBootstrap = shouldShowDraftStructureBootstrap({
    workspaceEnabled,
    hasWorkspace: !!workspace,
    hasTree: !!tree,
    hasWorkspaceError: !!workspaceError,
    hasTreeError: !!treeError,
    isSetupTransitionPending: isWorkspaceTransitionPending,
  });
  const workbenchMeta = canReopenFromDraft
    ? setupState?.structurallyPublishedAt
      ? `Live since ${formatTimestamp(setupState.structurallyPublishedAt)}`
      : "Live structure"
    : setupState?.requiresRepublish && setupState?.structurallyPublishedAt
      ? `Live since ${formatTimestamp(setupState.structurallyPublishedAt)} · draft changes pending`
      : isSetupComplete && setupState?.structurallyPublishedAt
        ? `Live since ${formatTimestamp(setupState.structurallyPublishedAt)}`
        : null;
  const setupSummaryHref = "/setup";

  const startSetupEntry = useCallback(async () => {
    setSetupEntryError(null);

    try {
      await startSetup();
    } catch (error) {
      setSetupEntryError(getActionErrorMessage(error));
    }
  }, [startSetup]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hasImport = url.searchParams.get("import");
    const hasSession = url.searchParams.get("session");

    if (!hasImport && !hasSession) return;

    url.searchParams.delete("import");
    url.searchParams.delete("session");

    const query = url.searchParams.toString();
    window.history.replaceState(
      null,
      "",
      query ? `/setup/draft-structure?${query}` : "/setup/draft-structure"
    );
  }, []);

  useEffect(() => {
    if (!shouldStartSetupFromDraft) {
      setSetupEntryError(null);
      setHasAttemptedSetupEntry(false);
      return;
    }

    if (!canAccess || hasAttemptedSetupEntry || isActivating) {
      return;
    }

    setHasAttemptedSetupEntry(true);
    void startSetupEntry();
  }, [
    canAccess,
    hasAttemptedSetupEntry,
    isActivating,
    startSetupEntry,
    shouldStartSetupFromDraft,
  ]);

  useEffect(() => {
    if (!isDraftLocked) {
      return;
    }

    setCreateOpen(false);
    setEditorOpen(false);
  }, [isDraftLocked]);

  const resetWorkspaceChrome = () => {
    setCreateOpen(false);
    setCreateParentId(null);
    setEditorOpen(false);
    setSelectedUnitId(null);
    setSearch("");
    setExplorerView("tree");
  };

  const handleDownloadStructureCsv = () => {
    if (!workspace || workspace.units.length === 0) {
      toast.error("There are no planned units to export yet.");
      return;
    }

    try {
      const csv = buildDraftStructureExportCsv({
        units: workspace.units,
        schema: workspace.draftStructureSchema,
        orderedUnitIds: draftTreeNodeIds,
      });

      downloadBlob(
        new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
        DRAFT_STRUCTURE_EXPORT_FILE_NAME
      );
    } catch (error) {
      toast.error("The structure export failed.", {
        description:
          error instanceof Error
            ? error.message
            : "Try downloading the CSV again.",
      });
    }
  };

  const handleTableSortChange = (field: DraftStructureSortField) => {
    if (tableSortBy === field) {
      setTableSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc"
      );
      return;
    }

    setTableSortBy(field);
    setTableSortDirection("asc");
  };

  const handleRetrySetupEntry = async () => {
    await startSetupEntry();
  };

  const handleClearStructure = async () => {
    try {
      let requiresWorkspaceSync = false;

      try {
        await clearStructure.mutateAsync();
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          ![404, 405].includes(error.status)
        ) {
          throw error;
        }

        const orderedUnits = buildLeafFirstDeleteOrder(workspace?.units ?? []);
        requiresWorkspaceSync = true;

        setClearDeleteProgress({ current: 0, total: orderedUnits.length });

        let deletedUnitsCount = 0;

        for (const unit of orderedUnits) {
          deletedUnitsCount++;
          setClearDeleteProgress({
            current: deletedUnitsCount,
            total: orderedUnits.length,
          });
          await deleteDraftOrgUnit.mutateAsync({
            id: unit.id,
            version: unit.version,
            skipLifecycleRefresh: true,
          });
        }
      }

      resetWorkspaceChrome();
      setClearStructureOpen(false);
      setClearDeleteProgress(null);
      if (requiresWorkspaceSync) {
        await syncWorkspaceQueries({ includeSetupState: true });
      }
      router.refresh();
      toast.success("Draft structure cleared", {
        description: "All units removed.",
      });
    } catch (error) {
      setClearDeleteProgress(null);
      toast.error("The draft structure could not be cleared.", {
        description:
          error instanceof Error
            ? error.message
            : "Try deleting the draft structure again.",
      });
    }
  };

  const handlePublish = async () => {
    if (!setupState || setupState.version == null) {
      setPublishError(
        "The latest setup version is required before publishing."
      );
      return;
    }

    setPublishError(null);

    try {
      await publishSetup({
        expectedVersion: setupState.version,
      });
      setPublishDialogOpen(false);
      toast.success("Structure published", {
        description: setupState.requiresRepublish
          ? "The latest draft is now live across Core."
          : "The draft structure is now live across Core.",
      });
      router.replace(setupSummaryHref);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.errors.join(", ")
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while publishing the structure.";
      setPublishError(message);
    }
  };

  const handleReopen = async () => {
    if (!setupState || setupState.version == null) {
      toast.error("The latest setup version is required before reopening.");
      return;
    }

    try {
      await reopenSetup({
        expectedVersion: setupState.version,
      });
      toast.success("Draft reopened", {
        description:
          "The draft can be edited again while the live structure stays active.",
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.errors.join(", ")
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while reopening the draft.";
      toast.error(message);
    }
  };

  const handleImportOpenChange = (nextOpen: boolean) => {
    setIsImportOpen(nextOpen);
  };

  if (!canAccess) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          title={pageTitle}
          description="Organization structure is limited to tenant HR administrators."
        />
        <PagePermissionNotice
          title="Organization structure is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </PageContainer>
    );
  }

  if (isSetupLoading && !setupState) {
    return <DraftStructurePageSkeleton />;
  }

  if (setupError) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          title={pageTitle}
          description="Setup state is required to load the workspace."
        />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup state could not be loaded</AlertTitle>
          <AlertDescription>{setupError.message}</AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  if (!setupState) {
    return <DraftStructurePageSkeleton />;
  }

  if (shouldStartSetupFromDraft && setupEntryError) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          title="Draft structure"
          description="Setup could not be started automatically."
        />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Draft workspace could not be opened</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{setupEntryError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleRetrySetupEntry();
              }}
              disabled={isActivating}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  if (isInitialWorkspaceBootstrap) {
    return <DraftStructurePageSkeleton />;
  }

  const showReadOnlyEmptyState =
    !shouldStartSetupFromDraft && isDraftLocked && isEmptyDraftWorkspace;
  const emptyResultsDescription = `No units match "${normalizedSearch}". Try a different unit name, type, code, or detail.`;
  const treeEmptyTitle = isSearching
    ? "No matching units"
    : !isDraftLocked && isEmptyDraftWorkspace
      ? "Start the draft structure"
      : "No units yet";
  const treeEmptyDescription = isSearching
    ? emptyResultsDescription
    : isDraftLocked
      ? canReopenFromDraft
        ? "Reopen the draft from Setup to make changes."
        : "Use this page to review the published structure."
      : "Import a template or add the first top-level unit.";
  const listEmptyDescription = isSearching
    ? emptyResultsDescription
    : isDraftLocked
      ? canReopenFromDraft
        ? "Reopen the draft from Setup to make changes."
        : "Use this list to review the published structure."
      : "Import a template or add the first top-level unit.";

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canPublishFromDraft && readiness?.isReadyForApproval ? (
              <Button
                onClick={() => setPublishDialogOpen(true)}
                disabled={isPublishing}
              >
                {isPublishing ? <Spinner className="mr-1" /> : null}
                {isPublishing
                  ? "Publishing..."
                  : setupState?.requiresRepublish
                    ? "Publish changes"
                    : "Publish structure"}
              </Button>
            ) : null}

            {canReopenFromDraft ? (
              <Button
                onClick={() => void handleReopen()}
                disabled={isReopening}
              >
                {isReopening ? <Spinner className="mr-1" /> : null}
                {isReopening ? "Reopening..." : "Reopen draft"}
              </Button>
            ) : null}

            {isSetupComplete ? (
              <Button
                variant="outline"
                onClick={() => router.push(setupSummaryHref)}
              >
                Open setup
              </Button>
            ) : null}
          </div>
        }
      />

      {(workspaceError || treeError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Draft workspace could not be loaded</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{workspaceError?.message ?? treeError?.message}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void syncWorkspaceQueries();
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showReadOnlyEmptyState ? (
        <DraftStructureReferenceEmptyState isSetupComplete={isSetupComplete} />
      ) : (
        <DraftStructureWorkbench
          view={explorerView}
          onViewChange={(value) => setExplorerView(value)}
          search={search}
          onSearchChange={setSearch}
          isSearching={isSearching}
          statusLabel={workbenchStatusLabel}
          statusVariant={workbenchStatusVariant}
          summaryText={workbenchSummary}
          issueLabel={workbenchIssueLabel}
          issueTone={workbenchIssueTone}
          metaText={workbenchMeta}
          isEmptyDraft={isEmptyDraftWorkspace}
          resultCount={filteredUnits.length}
          isDraftLocked={isDraftLocked}
          isClearingStructure={isClearingStructureAction}
          schema={
            workspace?.draftStructureSchema ?? {
              orgUnitKinds: [],
              attributes: [],
            }
          }
          hasImportSession={hasImportSession}
          nodes={filteredTree}
          units={sortedFilteredUnits}
          selectedUnitId={effectiveSelectedUnitId}
          selectedUnit={selectedUnit}
          selectedTreeNode={selectedTreeNode}
          treeEmptyTitle={treeEmptyTitle}
          treeEmptyDescription={treeEmptyDescription}
          listEmptyDescription={listEmptyDescription}
          sortBy={tableSortBy}
          sortDirection={tableSortDirection}
          onSortChange={handleTableSortChange}
          onSelectUnit={(unitId) => setSelectedUnitId(unitId)}
          onDownloadCsv={handleDownloadStructureCsv}
          onManageTypes={() => setKindManagerOpen(true)}
          onClearStructure={() => setClearStructureOpen(true)}
          onImport={() => handleImportOpenChange(true)}
          onAddRoot={() => {
            setCreateParentId(null);
            setCreateOpen(true);
          }}
          onAddChild={(unitId) => {
            setSelectedUnitId(unitId);
            setCreateParentId(unitId);
            setCreateOpen(true);
          }}
          onEditSelected={() => setEditorOpen(true)}
        />
      )}

      <DraftOrgUnitKindManager
        open={kindManagerOpen}
        onOpenChange={setKindManagerOpen}
        hideTrigger
        schema={
          workspace?.draftStructureSchema ?? {
            orgUnitKinds: [],
            attributes: [],
          }
        }
        existingUnits={workspace?.units ?? []}
      />

      <DraftUnitDialog
        open={createOpen}
        onOpenChange={(nextOpen) => {
          setCreateOpen(nextOpen);
          if (!nextOpen) {
            setCreateParentId(null);
          }
        }}
        onMutated={() => {
          setCreateParentId(null);
          setSearch("");
        }}
        initialParentId={createParentId}
        readOnly={isDraftLocked}
        schema={
          workspace?.draftStructureSchema ?? {
            orgUnitKinds: [],
            attributes: [],
          }
        }
        existingUnits={workspace?.units ?? []}
      />

      <DraftUnitDialog
        unit={editorOpen ? selectedUnit : null}
        open={editorOpen && !!selectedUnit}
        onOpenChange={setEditorOpen}
        readOnly={isDraftLocked}
        schema={
          workspace?.draftStructureSchema ?? {
            orgUnitKinds: [],
            attributes: [],
          }
        }
        existingUnits={workspace?.units ?? []}
      />

      <DraftStructureImportPanel
        open={isImportOpen}
        onOpenChange={handleImportOpenChange}
        sessionId={importSessionId}
        onSessionIdChange={setImportSessionId}
        onApplied={async () => {
          setSelectedUnitId(null);
          setSearch("");
          setImportSessionId(null);
        }}
        readOnly={isDraftLocked}
        readOnlyTitle={importReadOnlyTitle}
        readOnlyMessage={importReadOnlyMessage}
      />

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish structure?</AlertDialogTitle>
            <AlertDialogDescription>
              {setupState?.requiresRepublish
                ? "Replaces the current live structure with the latest draft."
                : "Makes the current draft live across Core."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {publishError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Publishing failed</AlertTitle>
              <AlertDescription>{publishError}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handlePublish();
              }}
              disabled={isPublishing}
            >
              {isPublishing ? <Spinner className="mr-1" /> : null}
              {isPublishing
                ? "Publishing..."
                : setupState?.requiresRepublish
                  ? "Publish changes"
                  : "Publish structure"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={clearStructureOpen}
        onOpenChange={setClearStructureOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all draft units?</AlertDialogTitle>
            <AlertDialogDescription>
              {clearDeleteProgress
                ? `Deleting unit ${clearDeleteProgress.current} of ${clearDeleteProgress.total}...`
                : "Resets the draft to empty."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingStructureAction}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isClearingStructureAction}
              onClick={() => {
                void handleClearStructure();
              }}
            >
              {isClearingStructureAction ? <Spinner className="mr-1" /> : null}
              {clearDeleteProgress ? "Deleting..." : "Delete all units"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
