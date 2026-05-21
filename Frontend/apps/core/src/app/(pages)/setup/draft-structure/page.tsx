"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Ellipsis,
  FileSpreadsheet,
  FolderTree,
  Search,
  Settings2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ApiError,
  type DraftOrgUnitDto,
  type DraftStructureSchemaDto,
} from "@repo/api";
import { canAccessCoreSetup, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { toast } from "sonner";
import { useCoreSetupAccess } from "@/components/core-setup-access";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { useActivateSetup, useSetupReadiness } from "../use-setup";
import { shouldAutoActivateSetup } from "../setup-entry-routing";
import { DraftUnitDialog } from "./create-draft-unit-dialog";
import { DraftOrgUnitKindManager } from "./draft-org-unit-kind-manager";
import { DraftStructureImportPanel } from "./draft-structure-import-panel";
import { getDraftFieldLabel } from "./draft-structure-labels";
import {
  DraftStructureTable,
  type DraftStructureSortField,
} from "./draft-structure-table";
import { DraftStructureTree } from "./draft-structure-tree";
import {
  buildWorkspaceDraftTree,
  filterDraftTree,
  findDraftTreeNodeById,
  getFirstDraftTreeNodeId,
  type DraftStructureTreeNodeModel,
} from "./draft-structure-tree-utils";
import {
  useClearDraftStructure,
  useDeleteDraftOrgUnit,
  useDraftStructureTree,
  useDraftStructureWorkspace,
} from "./use-draft-structure";

const DRAFT_STRUCTURE_EXPORT_FILE_NAME = "draft-structure-export.csv";

type ExplorerView = "tree" | "list";

function formatTimestamp(value: string | null) {
  if (!value) return "No draft changes yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Defer revocation to avoid cancelling download before navigation starts.
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

function buildDraftStructureExportFields(schema: DraftStructureSchemaDto) {
  return [
    { key: "referenceKey", label: "Unit Code" },
    { key: "displayName", label: "Unit Name" },
    { key: "orgUnitKindKey", label: "Unit Type" },
    { key: "parentReferenceKey", label: "Parent Unit Code" },
    { key: "location", label: "Location" },
    { key: "description", label: "Description" },
    ...schema.attributes
      .slice()
      .sort((left, right) =>
        left.displayLabel.localeCompare(right.displayLabel, undefined, {
          sensitivity: "base",
        })
      )
      .map((attribute) => ({
        key: `attributes.${attribute.key}`,
        label: attribute.displayLabel,
      })),
  ];
}

function flattenDraftTreeNodeIds(
  nodes: DraftStructureTreeNodeModel[]
): string[] {
  return nodes.flatMap((node) => [
    node.id,
    ...flattenDraftTreeNodeIds(node.children),
  ]);
}

function filterDraftTreeByMatchedIds(
  nodes: DraftStructureTreeNodeModel[],
  matchedIds: Set<string>
): DraftStructureTreeNodeModel[] {
  return nodes.flatMap((node) => {
    const filteredChildren = filterDraftTreeByMatchedIds(
      node.children,
      matchedIds
    );

    if (!matchedIds.has(node.id) && filteredChildren.length === 0) {
      return [];
    }

    return [
      {
        ...node,
        children: filteredChildren,
      },
    ];
  });
}

function buildLeafFirstDeleteOrder(
  units: DraftOrgUnitDto[]
): DraftOrgUnitDto[] {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const childCounts = new Map(units.map((unit) => [unit.id, 0]));

  for (const unit of units) {
    if (!unit.parentId || !unitsById.has(unit.parentId)) {
      continue;
    }

    childCounts.set(unit.parentId, (childCounts.get(unit.parentId) ?? 0) + 1);
  }

  const stack = units.filter((unit) => (childCounts.get(unit.id) ?? 0) === 0);
  const queuedIds = new Set(stack.map((unit) => unit.id));
  const orderedUnits: DraftOrgUnitDto[] = [];

  while (stack.length > 0) {
    const unit = stack.pop();
    if (!unit) {
      continue;
    }

    orderedUnits.push(unit);

    if (!unit.parentId || !unitsById.has(unit.parentId)) {
      continue;
    }

    const nextChildCount = (childCounts.get(unit.parentId) ?? 0) - 1;
    childCounts.set(unit.parentId, nextChildCount);

    if (nextChildCount === 0) {
      const parent = unitsById.get(unit.parentId);
      if (parent && !queuedIds.has(parent.id)) {
        stack.push(parent);
        queuedIds.add(parent.id);
      }
    }
  }

  if (orderedUnits.length === units.length) {
    return orderedUnits;
  }

  return [...orderedUnits, ...units.filter((unit) => !queuedIds.has(unit.id))];
}

function matchesDraftUnitSearch(unit: DraftOrgUnitDto, searchTerm: string) {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return true;
  }

  return [
    unit.referenceKey,
    unit.displayName,
    unit.orgUnitKindLabel,
    unit.parentDisplayName ?? "",
    unit.location ?? "",
    unit.description ?? "",
    ...Object.values(unit.attributes).map((value) =>
      stringifyDraftStructureExportValue(value)
    ),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedSearchTerm);
}

function compareDraftUnits(
  left: DraftOrgUnitDto,
  right: DraftOrgUnitDto,
  sortBy: DraftStructureSortField,
  sortDirection: "asc" | "desc"
) {
  const direction = sortDirection === "asc" ? 1 : -1;

  if (sortBy === "updatedAt") {
    const leftTimestamp = new Date(left.updatedAt ?? left.createdAt).getTime();
    const rightTimestamp = new Date(
      right.updatedAt ?? right.createdAt
    ).getTime();

    if (leftTimestamp !== rightTimestamp) {
      return (leftTimestamp - rightTimestamp) * direction;
    }
  }

  const getValue = (unit: DraftOrgUnitDto) => {
    switch (sortBy) {
      case "referenceKey":
        return unit.referenceKey;
      case "displayName":
        return unit.displayName;
      case "orgUnitKindLabel":
        return unit.orgUnitKindLabel;
      case "parentDisplayName":
        return unit.parentDisplayName ?? "Organization root";
      case "location":
        return unit.location ?? "";
      case "updatedAt":
        return formatTimestamp(unit.updatedAt ?? unit.createdAt);
      default:
        return "";
    }
  };

  const leftValue = getValue(left);
  const rightValue = getValue(right);
  const result = leftValue.localeCompare(rightValue, undefined, {
    sensitivity: "base",
  });

  if (result !== 0) {
    return result * direction;
  }

  return left.referenceKey.localeCompare(right.referenceKey, undefined, {
    sensitivity: "base",
  });
}

function stringifyDraftStructureExportValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function getDraftStructureExportValue(unit: DraftOrgUnitDto, fieldKey: string) {
  switch (fieldKey) {
    case "referenceKey":
      return unit.referenceKey;
    case "displayName":
      return unit.displayName;
    case "orgUnitKindKey":
      return unit.orgUnitKindLabel;
    case "parentReferenceKey":
      return unit.parentReferenceKey ?? "";
    case "location":
      return unit.location ?? "";
    case "description":
      return unit.description ?? "";
    default:
      if (fieldKey.startsWith("attributes.")) {
        return stringifyDraftStructureExportValue(
          unit.attributes[fieldKey.slice("attributes.".length)]
        );
      }

      return "";
  }
}

function escapeCsvValue(value: string) {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function buildDraftStructureExportCsv({
  units,
  schema,
  orderedUnitIds,
}: {
  units: DraftOrgUnitDto[];
  schema: DraftStructureSchemaDto;
  orderedUnitIds: string[];
}) {
  const exportFields = buildDraftStructureExportFields(schema);
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const seenIds = new Set<string>();
  const orderedUnits: DraftOrgUnitDto[] = [];

  for (const unitId of orderedUnitIds) {
    const unit = unitsById.get(unitId);
    if (!unit || seenIds.has(unitId)) {
      continue;
    }

    orderedUnits.push(unit);
    seenIds.add(unitId);
  }

  const remainingUnits = units
    .filter((unit) => !seenIds.has(unit.id))
    .sort((left, right) => {
      const displayNameResult = left.displayName.localeCompare(
        right.displayName,
        undefined,
        { sensitivity: "base" }
      );

      if (displayNameResult !== 0) {
        return displayNameResult;
      }

      return left.referenceKey.localeCompare(right.referenceKey, undefined, {
        sensitivity: "base",
      });
    });

  const rows = [
    exportFields.map((field) => escapeCsvValue(field.label)).join(","),
    ...[...orderedUnits, ...remainingUnits].map((unit) =>
      exportFields
        .map((field) =>
          escapeCsvValue(getDraftStructureExportValue(unit, field.key))
        )
        .join(",")
    ),
  ];

  return rows.join("\r\n");
}

export default function DraftStructurePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const canAccess = canAccessCoreSetup(user);
  const [setupEntryError, setSetupEntryError] = useState<string | null>(null);
  const [hasAttemptedSetupEntry, setHasAttemptedSetupEntry] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [kindManagerOpen, setKindManagerOpen] = useState(false);
  const [clearStructureOpen, setClearStructureOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [explorerView, setExplorerView] = useState<ExplorerView>("tree");
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
    refreshSetupAccess,
  } = useCoreSetupAccess();
  const isSetupComplete =
    setupState?.currentPhase === "structurallyPublished" ||
    setupState?.currentPhase === "operational";
  const isDraftLocked = setupState?.currentPhase !== "activated";
  const canApproveFromDraft = setupState?.currentPhase === "activated";
  const canReopenFromDraft =
    setupState?.currentPhase === "structurallyGoverned";
  const shouldStartSetupFromDraft = shouldAutoActivateSetup(
    setupState?.canStartSetup
  );
  const pageTitle = !isDraftLocked
    ? "Draft structure"
    : isSetupComplete
      ? "Published structure"
      : canReopenFromDraft
        ? "Approved structure"
        : "Structure review";

  const workspaceEnabled =
    canAccess && !!setupState && !setupState.canStartSetup;
  const {
    data: readiness,
    error: readinessError,
    refetch: refetchReadiness,
  } = useSetupReadiness(workspaceEnabled && canApproveFromDraft);
  const {
    data: workspace,
    error: workspaceError,
    isLoading: isWorkspaceLoading,
    refetch,
  } = useDraftStructureWorkspace(workspaceEnabled);
  const {
    data: tree,
    error: treeError,
    isLoading: isTreeLoading,
    refetch: refetchTree,
  } = useDraftStructureTree(workspaceEnabled);
  const activateSetup = useActivateSetup();
  const clearStructure = useClearDraftStructure();
  const deleteDraftOrgUnit = useDeleteDraftOrgUnit();

  const draftTree = useMemo(() => buildWorkspaceDraftTree(tree ?? []), [tree]);
  const draftTreeNodeIds = useMemo(
    () => flattenDraftTreeNodeIds(draftTree),
    [draftTree]
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

  useEffect(() => {
    if (selectedUnitId) {
      return;
    }

    const firstNodeId = getFirstDraftTreeNodeId(draftTree);
    if (firstNodeId) {
      setSelectedUnitId(firstNodeId);
    }
  }, [draftTree, selectedUnitId]);

  useEffect(() => {
    if (!selectedUnitId) {
      return;
    }

    if (findDraftTreeNodeById(draftTree, selectedUnitId)) {
      return;
    }

    setSelectedUnitId(getFirstDraftTreeNodeId(draftTree));
  }, [draftTree, selectedUnitId]);

  useEffect(() => {
    if (!isSearching) {
      return;
    }

    if (filteredUnits.some((unit) => unit.id === selectedUnitId)) {
      return;
    }

    setSelectedUnitId(filteredUnits[0]?.id ?? null);
  }, [filteredUnits, isSearching, selectedUnitId]);

  useEffect(() => {
    const isEmptyDraftWorkspace = (workspace?.units.length ?? 0) === 0;

    if (!isEmptyDraftWorkspace) {
      return;
    }

    setExplorerView("tree");
    setSearch("");
  }, [workspace?.units.length]);

  const hasVisibleSelection =
    !isSearching || filteredUnits.some((unit) => unit.id === selectedUnitId);
  const effectiveSelectedUnitId = hasVisibleSelection ? selectedUnitId : null;
  const selectedUnit =
    workspace?.units.find((unit) => unit.id === effectiveSelectedUnitId) ??
    null;
  const selectedTreeNode = findDraftTreeNodeById(
    draftTree,
    effectiveSelectedUnitId
  );
  const isImportOpen = searchParams.get("import") === "1";
  const hasImportSession = !!searchParams.get("session");
  const isEmptyDraftWorkspace = (workspace?.units.length ?? 0) === 0;
  const unitCount = workspace?.unitCount ?? 0;
  const topLevelCount = workspace?.rootUnitCount ?? 0;
  const typeCount = workspace?.draftStructureSchema.orgUnitKinds.length ?? 0;
  const pageDescription = !isDraftLocked
    ? "Build and review the organization hierarchy before approval."
    : canReopenFromDraft
      ? "Review the approved organization hierarchy."
      : isSetupComplete
        ? "Reference the published organization hierarchy."
        : "Review the organization hierarchy.";
  const importReadOnlyTitle = isSetupComplete
    ? "Import is unavailable on the published structure"
    : "Import is unavailable while the structure is locked";
  const importReadOnlyMessage = canReopenFromDraft
    ? "Reopen the draft from Setup to import a file."
    : isSetupComplete
      ? "Use this page to review the published structure. Start a new setup cycle to change it."
      : "Import returns when the draft is editable again.";
  const blockingIssueCount = readiness?.blockingIssueCount ?? 0;
  const warningCount = readiness?.warningCount ?? 0;
  const workbenchStatusLabel = !isDraftLocked
    ? isEmptyDraftWorkspace
      ? "Draft empty"
      : blockingIssueCount > 0
        ? "Needs fixes"
        : readiness?.isReadyForApproval
          ? "Ready to approve"
          : "Draft active"
    : canReopenFromDraft
      ? "Approved structure"
      : isSetupComplete
        ? "Published structure"
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
    clearStructure.isLoading || deleteDraftOrgUnit.isLoading;
  const workbenchMeta = canReopenFromDraft
    ? setupState?.approvedAt
      ? `Approved ${formatTimestamp(setupState.approvedAt)}${setupState.approvedByFullName ? ` by ${setupState.approvedByFullName}` : ""}`
      : "Approved"
    : isSetupComplete && workspace?.lastModifiedAt
      ? `Published ${formatTimestamp(workspace.lastModifiedAt)}`
      : null;

  const startSetupEntry = async () => {
    setSetupEntryError(null);

    try {
      await activateSetup.mutateAsync();
      await refreshSetupAccess();
      router.refresh();
    } catch (error) {
      setSetupEntryError(getActionErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!shouldStartSetupFromDraft) {
      setSetupEntryError(null);
      setHasAttemptedSetupEntry(false);
      return;
    }

    if (!canAccess || hasAttemptedSetupEntry || activateSetup.isLoading) {
      return;
    }

    setHasAttemptedSetupEntry(true);
    void startSetupEntry();
  }, [
    activateSetup,
    canAccess,
    hasAttemptedSetupEntry,
    router,
    refreshSetupAccess,
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

  const refreshWorkspaceAndReadiness = async (options?: {
    refreshRoute?: boolean;
  }) => {
    const refreshActions = [refetch(), refetchTree(), refreshSetupAccess()];

    if (canApproveFromDraft) {
      refreshActions.push(refetchReadiness());
    }

    await Promise.allSettled(refreshActions);

    if (options?.refreshRoute) {
      router.refresh();
    }
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
      try {
        await clearStructure.mutateAsync();
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          ![404, 405].includes(error.status)
        ) {
          throw error;
        }

        for (const unit of buildLeafFirstDeleteOrder(workspace?.units ?? [])) {
          await deleteDraftOrgUnit.mutateAsync({
            id: unit.id,
            version: unit.version,
          });
        }
      }

      resetWorkspaceChrome();
      setClearStructureOpen(false);
      await refreshWorkspaceAndReadiness({ refreshRoute: true });
      toast.success("Draft structure cleared", {
        description: "All units removed.",
      });
    } catch (error) {
      toast.error("The draft structure could not be cleared.", {
        description:
          error instanceof Error
            ? error.message
            : "Try deleting the draft structure again.",
      });
    }
  };

  const handleImportOpenChange = (nextOpen: boolean) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextOpen) {
      params.set("import", "1");
    } else {
      params.delete("import");
    }

    const query = params.toString();
    router.replace(
      query ? `/setup/draft-structure?${query}` : "/setup/draft-structure"
    );
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title={pageTitle}
          description="Organization structure is limited to tenant HR administrators."
        />
        <EmptyState
          icon={FolderTree}
          title="Organization structure is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </div>
    );
  }

  if (isSetupLoading && !setupState) {
    return <DraftStructurePageSkeleton />;
  }

  if (setupError) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title={pageTitle}
          description="Setup state is required to load the workspace."
        />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup state could not be loaded</AlertTitle>
          <AlertDescription>{setupError.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!setupState) {
    return <DraftStructurePageSkeleton />;
  }

  if (shouldStartSetupFromDraft && setupEntryError) {
    return (
      <div className="flex flex-col gap-6 p-6">
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
              disabled={activateSetup.isLoading}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (shouldStartSetupFromDraft) {
    return (
      <CorePageLoadingState
        title="Draft structure"
        description="Starting setup and opening the draft workspace."
        message="Opening draft workspace..."
        variant="workspace"
      />
    );
  }

  if (workspaceEnabled && isWorkspaceLoading && !workspace && !workspaceError) {
    return <DraftStructurePageSkeleton />;
  }

  const showTreeSkeleton = isTreeLoading && !tree;
  const showReadOnlyEmptyState =
    !showTreeSkeleton && isDraftLocked && isEmptyDraftWorkspace;
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
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-6">
      <PageHeader title={pageTitle} description={pageDescription} />

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
                void refreshWorkspaceAndReadiness();
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showReadOnlyEmptyState ? (
        <DraftStructureReferenceEmptyState
          isSetupComplete={isSetupComplete}
          canReopenFromDraft={canReopenFromDraft}
        />
      ) : showTreeSkeleton ? (
        <DraftStructureWorkbenchSkeleton />
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
        onSchemaUpdated={() => {
          void refreshWorkspaceAndReadiness();
        }}
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
          void refreshWorkspaceAndReadiness();
        }}
        onSchemaUpdated={() => {
          void refreshWorkspaceAndReadiness();
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
        onMutated={() => {
          void refreshWorkspaceAndReadiness();
        }}
        onSchemaUpdated={() => {
          void refreshWorkspaceAndReadiness();
        }}
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
        onApplied={async () => {
          setSelectedUnitId(null);
          setSearch("");
          await refreshWorkspaceAndReadiness();
        }}
        readOnly={isDraftLocked}
        readOnlyTitle={importReadOnlyTitle}
        readOnlyMessage={importReadOnlyMessage}
      />

      <AlertDialog
        open={clearStructureOpen}
        onOpenChange={setClearStructureOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all draft units?</AlertDialogTitle>
            <AlertDialogDescription>
              Resets the draft to empty.
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
              Delete all units
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InspectorField({
  label,
  value,
  mono = false,
  muted = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-sm leading-6 text-foreground",
          mono ? "font-mono" : "",
          muted ? "text-muted-foreground" : ""
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DraftStructureReferenceEmptyState({
  isSetupComplete,
  canReopenFromDraft,
}: {
  isSetupComplete: boolean;
  canReopenFromDraft: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border bg-muted/10 text-muted-foreground">
          <FolderTree className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">
            {isSetupComplete ? "No published units" : "No approved units"}
          </p>
          <p className="text-sm text-muted-foreground">
            {canReopenFromDraft
              ? "The approved structure does not contain any units yet."
              : "The published structure does not contain any units yet."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DraftStructureWorkbench({
  view,
  onViewChange,
  search,
  onSearchChange,
  isSearching,
  statusLabel,
  statusVariant,
  summaryText,
  issueLabel,
  issueTone,
  metaText,
  isEmptyDraft,
  resultCount,
  isDraftLocked,
  isClearingStructure,
  schema,
  hasImportSession,
  nodes,
  units,
  selectedUnitId,
  selectedUnit,
  selectedTreeNode,
  treeEmptyTitle,
  treeEmptyDescription,
  listEmptyDescription,
  sortBy,
  sortDirection,
  onSortChange,
  onSelectUnit,
  onDownloadCsv,
  onManageTypes,
  onClearStructure,
  onImport,
  onAddRoot,
  onAddChild,
  onEditSelected,
}: {
  view: ExplorerView;
  onViewChange: (view: ExplorerView) => void;
  search: string;
  onSearchChange: (value: string) => void;
  isSearching: boolean;
  statusLabel: string;
  statusVariant: "secondary" | "destructive" | "outline";
  summaryText: string;
  issueLabel: string | null;
  issueTone: "default" | "warning" | "danger";
  metaText: string | null;
  isEmptyDraft: boolean;
  resultCount: number;
  isDraftLocked: boolean;
  isClearingStructure: boolean;
  schema: DraftStructureSchemaDto;
  hasImportSession: boolean;
  nodes: DraftStructureTreeNodeModel[];
  units: DraftOrgUnitDto[];
  selectedUnitId: string | null;
  selectedUnit: DraftOrgUnitDto | null;
  selectedTreeNode: DraftStructureTreeNodeModel | null;
  treeEmptyTitle: string;
  treeEmptyDescription: string;
  listEmptyDescription: string;
  sortBy: DraftStructureSortField;
  sortDirection: "asc" | "desc";
  onSortChange: (field: DraftStructureSortField) => void;
  onSelectUnit: (unitId: string) => void;
  onDownloadCsv: () => void;
  onManageTypes: () => void;
  onClearStructure: () => void;
  onImport: () => void;
  onAddRoot: () => void;
  onAddChild: (unitId: string) => void;
  onEditSelected: () => void;
}) {
  const primaryAddLabel = isEmptyDraft
    ? "Add first unit"
    : "Add top-level unit";
  const issueTextClass =
    issueTone === "danger"
      ? "font-medium text-destructive"
      : issueTone === "warning"
        ? "font-medium text-amber-700 dark:text-amber-400"
        : "font-medium text-foreground";
  const searchSummary = isSearching
    ? `${resultCount} matching unit${resultCount === 1 ? "" : "s"}`
    : null;

  return (
    <Tabs
      value={view}
      onValueChange={(value) => onViewChange(value as ExplorerView)}
      className="min-h-0 gap-0"
    >
      <Card className="min-h-0 overflow-hidden">
        <CardContent className="space-y-3 border-b p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search unit name, type, code, or details"
                  className="pl-9"
                  disabled={isEmptyDraft}
                />
              </div>

              <TabsList className="grid w-full grid-cols-2 sm:w-[180px]">
                <TabsTrigger value="tree">Tree</TabsTrigger>
                <TabsTrigger value="list" disabled={isEmptyDraft}>
                  List
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isDraftLocked ? (
                <>
                  <Button onClick={onImport}>
                    <FileSpreadsheet className="size-4" />
                    {hasImportSession ? "Resume import" : "Import template"}
                  </Button>
                  <Button variant="outline" onClick={onAddRoot}>
                    <Plus className="size-4" />
                    {primaryAddLabel}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon-sm">
                        <Ellipsis className="size-4" />
                        <span className="sr-only">Open structure options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={onManageTypes}>
                        <Settings2 className="size-4" />
                        Manage types
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={isEmptyDraft}
                        onSelect={onDownloadCsv}
                      >
                        <FileSpreadsheet className="size-4" />
                        Download CSV
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={isEmptyDraft || isClearingStructure}
                        onSelect={onClearStructure}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 text-destructive focus:text-destructive" />
                        Delete all units
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              <span>{summaryText}</span>
              {issueLabel ? (
                <span className={issueTextClass}>{issueLabel}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {searchSummary ? <span>{searchSummary}</span> : null}
              {metaText ? <span>{metaText}</span> : null}
            </div>
          </div>
        </CardContent>

        <div className="grid min-h-0 overflow-hidden xl:h-[clamp(36rem,calc(100vh-18rem),48rem)] xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.9fr)]">
          <div className="min-h-0 min-w-0 overflow-hidden xl:border-r">
            <TabsContent
              value="tree"
              className="m-0 flex h-[min(52vh,34rem)] min-h-0 min-w-0 flex-col overflow-hidden xl:h-full"
            >
              <DraftStructureTree
                embedded
                nodes={nodes}
                selectedId={selectedUnitId}
                onSelect={(node) => onSelectUnit(node.id)}
                emptyTitle={treeEmptyTitle}
                emptyDescription={treeEmptyDescription}
                readOnly={isDraftLocked}
              />
            </TabsContent>

            <TabsContent
              value="list"
              className="m-0 flex h-[min(52vh,34rem)] min-h-0 min-w-0 flex-col overflow-hidden p-4 xl:h-full"
            >
              <DraftStructureTable
                embedded
                data={units}
                isLoading={false}
                selectedUnitId={selectedUnitId}
                emptyTitle={treeEmptyTitle}
                emptyDescription={listEmptyDescription}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                onRowClick={(unit) => onSelectUnit(unit.id)}
              />
            </TabsContent>
          </div>

          <div className="min-h-0 overflow-hidden h-[min(42vh,28rem)] border-t xl:h-full xl:border-t-0">
            <DraftStructureInspectorPanel
              unit={selectedUnit}
              treeNode={selectedTreeNode}
              schema={schema}
              isDraftLocked={isDraftLocked}
              isEmptyDraft={isEmptyDraft}
              onEdit={onEditSelected}
              onAddChild={() => {
                if (selectedUnit) {
                  onAddChild(selectedUnit.id);
                }
              }}
            />
          </div>
        </div>
      </Card>
    </Tabs>
  );
}

function DraftStructureInspectorPanel({
  unit,
  treeNode,
  schema,
  isDraftLocked,
  isEmptyDraft,
  onEdit,
  onAddChild,
}: {
  unit: DraftOrgUnitDto | null;
  treeNode: DraftStructureTreeNodeModel | null;
  schema: DraftStructureSchemaDto;
  isDraftLocked: boolean;
  isEmptyDraft: boolean;
  onEdit: () => void;
  onAddChild: () => void;
}) {
  if (!unit || !treeNode) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/5 p-5">
        <div className="w-full max-w-sm rounded-xl border border-dashed bg-background p-5 text-center">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {isEmptyDraft ? "No units yet" : "No unit selected"}
            </p>
            <p>
              {isEmptyDraft
                ? "Import a template or add the first top-level unit to start the structure."
                : "Select a unit from the tree or list to review details."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const locationValue = unit.location?.trim() || "Not set";
  const descriptionValue = unit.description?.trim() || "Not set";

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/5">
      <div className="shrink-0 space-y-3 border-b p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{unit.orgUnitKindLabel}</Badge>
          {treeNode.isOrphaned ? (
            <Badge variant="outline">Parent missing</Badge>
          ) : null}
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {unit.displayName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Review the selected unit.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-3">
          <InspectorField label="Unit code" value={unit.referenceKey} mono />
          <InspectorField
            label="Parent unit"
            value={unit.parentDisplayName ?? "Top-level"}
          />
          <InspectorField
            label="Location"
            value={locationValue}
            muted={locationValue === "Not set"}
          />
          <InspectorField
            label="Description"
            value={descriptionValue}
            muted={descriptionValue === "Not set"}
          />
        </div>

        {Object.keys(unit.attributes).length > 0 ? (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Additional fields
            </p>
            <div className="space-y-3 rounded-xl border bg-background p-4">
              {Object.entries(unit.attributes).map(([key, value]) => (
                <InspectorField
                  key={key}
                  label={getDraftFieldLabel(key, schema)}
                  value={formatAttributeValue(value)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Last updated {formatTimestamp(unit.updatedAt ?? unit.createdAt)}
        </p>
      </div>

      {!isDraftLocked ? (
        <div className="shrink-0 border-t bg-background/80 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onEdit}>Edit unit</Button>
            <Button variant="outline" onClick={onAddChild}>
              <Plus className="size-4" />
              Add child unit
            </Button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t bg-background/80 px-4 py-3 text-sm text-muted-foreground backdrop-blur">
          Read-only details.
        </div>
      )}
    </div>
  );
}

function getActionErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.errors.join(", ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

function formatAttributeValue(value: unknown): string {
  if (value == null) {
    return "Not set";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function DraftStructurePageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-6">
      <PageHeader
        title="Draft structure"
        description="Build and review the organization hierarchy before approval."
      />

      <DraftStructureWorkbenchSkeleton />
    </div>
  );
}

function DraftStructureWorkbenchSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 border-b p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-10 flex-1 sm:max-w-md" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>

      <div className="grid xl:h-[clamp(36rem,calc(100vh-18rem),48rem)] xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.9fr)]">
        <div className="space-y-3 p-4 xl:border-r">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton
              key={index}
              className={`h-12 ${index % 3 === 0 ? "w-11/12" : index % 3 === 1 ? "w-10/12" : "w-full"}`}
            />
          ))}
        </div>
        <div className="flex flex-col border-t p-4 xl:border-t-0">
          <div className="space-y-3 border-b pb-4">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="flex-1 space-y-4 py-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="space-y-2 border-b pb-3 last:border-b-0"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t pt-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </Card>
  );
}
