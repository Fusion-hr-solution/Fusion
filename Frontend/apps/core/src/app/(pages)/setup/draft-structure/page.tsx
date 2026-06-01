"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FolderTree,
  LockKeyhole,
  Plus,
} from "lucide-react";
import {
  ApiError,
  type CoreSetupPhase,
  type DraftOrgUnitDto,
  type DraftSetupIssueDto,
  type DraftSetupReadinessDto,
  type DraftStructureSchemaDto,
} from "@repo/api";
import { canAccessCoreSetup, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { toast } from "sonner";
import { useCoreSetupAccess } from "@/components/core-setup-access";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SetupStatusBadge } from "../setup-status-badge";
import {
  useApproveStructure,
  useReopenStructure,
  useSetupReadiness,
} from "../use-setup";
import { CreateDraftUnitDialog } from "./create-draft-unit-dialog";
import { DraftOrgUnitKindManager } from "./draft-org-unit-kind-manager";
import { DraftStructureImportPanel } from "./draft-structure-import-panel";
import { getDraftFieldLabel } from "./draft-structure-labels";
import { DraftStructureTree } from "./draft-structure-tree";
import {
  buildWorkspaceDraftTree,
  filterDraftTree,
  findDraftTreeNodeById,
  getFirstDraftTreeNodeId,
  type DraftStructureTreeNodeModel,
} from "./draft-structure-tree-utils";
import { DraftUnitSheet } from "./draft-unit-sheet";
import {
  useDraftStructureTree,
  useDraftStructureWorkspace,
} from "./use-draft-structure";

const DRAFT_STRUCTURE_EXPORT_FILE_NAME = "draft-structure-export.csv";

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const {
    setupState,
    setupError,
    isSetupStateLoading: isSetupLoading,
  } = useCoreSetupAccess();
  const isSetupComplete =
    setupState?.currentPhase === "structurallyPublished" ||
    setupState?.currentPhase === "operational";
  const isDraftLocked = setupState?.currentPhase !== "activated";
  const canApproveFromDraft = setupState?.currentPhase === "activated";
  const canReopenFromDraft =
    setupState?.currentPhase === "structurallyGoverned";
  const pageTitle = !isDraftLocked
    ? "Draft structure"
    : isSetupComplete
      ? "Published structure"
      : "Organization structure";

  const workspaceEnabled =
    canAccess && !!setupState && !setupState.canStartSetup;
  const {
    data: readiness,
    error: readinessError,
    isLoading: isReadinessLoading,
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
  const approveStructure = useApproveStructure();
  const reopenStructure = useReopenStructure();

  const draftTree = useMemo(() => buildWorkspaceDraftTree(tree ?? []), [tree]);
  const draftTreeNodeIds = useMemo(
    () => flattenDraftTreeNodeIds(draftTree),
    [draftTree]
  );
  const filteredTree = useMemo(
    () => filterDraftTree(draftTree, deferredSearch),
    [deferredSearch, draftTree]
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

  const selectedUnit =
    workspace?.units.find((unit) => unit.id === selectedUnitId) ?? null;
  const selectedTreeNode = findDraftTreeNodeById(draftTree, selectedUnitId);
  const isImportOpen = searchParams.get("import") === "1";
  const hasImportSession = !!searchParams.get("session");
  const visibleUnitTypes =
    workspace?.draftStructureSchema.orgUnitKinds.slice(0, 3) ?? [];
  const remainingUnitTypeCount = Math.max(
    (workspace?.draftStructureSchema.orgUnitKinds.length ?? 0) -
      visibleUnitTypes.length,
    0
  );
  const pageDescription = !isDraftLocked
    ? "Build the structure draft here, review readiness, and approve when it is ready."
    : canReopenFromDraft
      ? "This approved draft is ready for review. Reopen it from Setup if another round of changes is needed."
      : isSetupComplete
        ? "Use this page as the published structure reference while Setup holds the summary and history."
        : "Review the structure here while editing is unavailable in the current setup phase.";
  const importReadOnlyTitle = isSetupComplete
    ? "Import is unavailable on the published structure"
    : "Import is unavailable while the structure is locked";
  const importReadOnlyMessage = canReopenFromDraft
    ? "Reopen the draft from Setup to upload, validate, or apply a structure file."
    : isSetupComplete
      ? "Use this page to review the published structure. Start a new setup cycle for structural changes."
      : "Import becomes available again when the draft returns to an editable state.";
  const unitReadOnlyDescription = canReopenFromDraft
    ? "Approved unit. Reopen the draft from Setup to make structural changes."
    : isSetupComplete
      ? "Published unit. Use this page as the live structure reference."
      : "Review this unit while structural editing is unavailable.";
  const unitReadOnlyNotice = canReopenFromDraft
    ? "Structural editing is paused on the approved draft. Reopen it from Setup before editing or deleting units."
    : isSetupComplete
      ? "This view shows the live structure for reference."
      : "Structural editing is unavailable during the current setup phase.";

  useEffect(() => {
    if (!isDraftLocked) {
      return;
    }

    setCreateOpen(false);
    setEditorOpen(false);
  }, [isDraftLocked]);

  const refreshWorkspaceAndReadiness = () => {
    void refetch();
    void refetchTree();

    if (canApproveFromDraft) {
      void refetchReadiness();
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

  const handleApprove = async () => {
    if (setupState?.version == null) {
      setActionError("The latest setup version is required before approval.");
      return;
    }

    setActionError(null);

    try {
      await approveStructure.mutateAsync({
        expectedVersion: setupState.version,
      });
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    }
  };

  const handleReopen = async () => {
    if (setupState?.version == null) {
      setActionError("The latest setup version is required before reopening.");
      return;
    }

    setActionError(null);

    try {
      await reopenStructure.mutateAsync({
        expectedVersion: setupState.version,
      });
    } catch (error) {
      setActionError(getActionErrorMessage(error));
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
    return <DraftStructurePageSkeleton hasImportSession={hasImportSession} />;
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
    return <DraftStructurePageSkeleton hasImportSession={hasImportSession} />;
  }

  if (setupState?.canStartSetup) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title={pageTitle}
          description="Activate setup to access organization structure."
        />
        <EmptyState
          icon={FolderTree}
          title="Setup has not been activated"
          description="Organization structure opens after setup is activated."
          action={{
            label: "Go to Setup",
            onClick: () => router.push("/setup"),
          }}
        />
      </div>
    );
  }

  if (workspaceEnabled && isWorkspaceLoading && !workspace && !workspaceError) {
    return <DraftStructurePageSkeleton hasImportSession={hasImportSession} />;
  }

  const showTreeSkeleton = isTreeLoading && !tree;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        actions={
          !isDraftLocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleImportOpenChange(true)}
              >
                <FileSpreadsheet className="size-4" />
                {hasImportSession ? "Resume Import" : "Import from Template"}
              </Button>
              <Button
                onClick={() => {
                  setCreateParentId(null);
                  setCreateOpen(true);
                }}
                disabled={isWorkspaceLoading}
              >
                <Plus className="size-4" />
                Add Top-Level Unit
              </Button>
            </div>
          ) : isSetupComplete ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => router.push("/setup")}>
                Open Setup Summary
              </Button>
              <Button variant="outline" onClick={() => router.push("/")}>
                Open Dashboard
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => router.push("/setup")}>
              Open Setup
            </Button>
          )
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
              onClick={refreshWorkspaceAndReadiness}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {actionError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Draft flow could not be updated</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {isDraftLocked && !isSetupComplete ? (
        <Alert>
          <LockKeyhole className="h-4 w-4" />
          <AlertTitle>Draft is locked</AlertTitle>
          <AlertDescription>
            {canReopenFromDraft
              ? "Reopen the draft from Setup to add, edit, or import units."
              : "This structure is locked during the current setup phase."}
          </AlertDescription>
        </Alert>
      ) : null}

      <DraftGovernanceCard
        phase={setupState.currentPhase}
        readiness={readiness}
        readinessError={readinessError?.message ?? null}
        isReadinessLoading={isReadinessLoading}
        approvedAt={setupState.approvedAt}
        approvedByFullName={setupState.approvedByFullName}
        approvedByRole={setupState.approvedByRole}
        isApprovedInPlatformAssistMode={
          setupState.isApprovedInPlatformAssistMode
        }
        onApprove={() => {
          void handleApprove();
        }}
        onReopen={() => {
          void handleReopen();
        }}
        onOpenSetup={() => router.push("/setup")}
        onRetryReadiness={() => {
          void refetchReadiness();
        }}
        isApproving={approveStructure.isLoading}
        isReopening={reopenStructure.isLoading}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Planning status</CardDescription>
            <CardTitle>
              {isSetupComplete
                ? "Complete"
                : isDraftLocked
                  ? "Locked"
                  : workspace?.workspaceStatus === "empty"
                    ? "Empty"
                    : "In Progress"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {isSetupComplete
              ? "Published structure."
              : isDraftLocked
                ? "Review only."
                : "Build and review the draft here."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Units planned</CardDescription>
            <CardTitle>{workspace?.unitCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Top-level units: {workspace?.rootUnitCount ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Last modified</CardDescription>
            <CardTitle className="text-base font-medium">
              {formatTimestamp(workspace?.lastModifiedAt ?? null)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {isSetupComplete ? "Snapshot from completed setup." : "Draft only."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Unit types available</CardDescription>
            <CardTitle>
              {workspace?.draftStructureSchema.orgUnitKinds.length ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Attributes:{" "}
              {workspace?.draftStructureSchema.attributes.length ?? 0}
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleUnitTypes.map((kind) => (
                <Badge key={kind.key} variant="secondary">
                  {kind.displayLabel}
                </Badge>
              ))}
              {remainingUnitTypeCount > 0 ? (
                <Badge variant="outline">+{remainingUnitTypeCount} more</Badge>
              ) : null}
            </div>
            {!isDraftLocked ? (
              <DraftOrgUnitKindManager
                schema={
                  workspace?.draftStructureSchema ?? {
                    orgUnitKinds: [],
                    attributes: [],
                  }
                }
                existingUnits={workspace?.units ?? []}
                disabled={!workspace}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] xl:items-start">
        <div className="grid gap-4 xl:min-h-184 xl:grid-rows-[auto_minmax(0,1fr)]">
          <div className="rounded-xl border p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">Structure tree</p>
                <p className="text-sm text-muted-foreground">
                  {!isDraftLocked
                    ? "Search, review, and edit the draft tree."
                    : canReopenFromDraft
                      ? "Search and review the approved draft tree."
                      : "Search and review the published structure."}
                </p>
              </div>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search unit name, type, code, or details"
                className="md:max-w-sm"
              />
            </div>
          </div>

          {showTreeSkeleton ? (
            <DraftStructureTreeSkeleton />
          ) : (
            <div className="min-h-0">
              <DraftStructureTree
                nodes={filteredTree}
                selectedId={selectedUnitId}
                onSelect={(node) => setSelectedUnitId(node.id)}
                emptyTitle="No draft units yet"
                emptyDescription={
                  isDraftLocked
                    ? canReopenFromDraft
                      ? "The approved structure is locked. Reopen it from Setup if organizational changes are needed."
                      : "This page keeps the published structure available for read-only review."
                    : "Add the first top-level unit or start with a template import to build the planned organization tree."
                }
                readOnly={isDraftLocked}
                onDownloadCsv={handleDownloadStructureCsv}
                isDownloadDisabled={(workspace?.units.length ?? 0) === 0}
                onAddRoot={() => {
                  setCreateParentId(null);
                  setCreateOpen(true);
                }}
                onAddChild={(node) => {
                  setSelectedUnitId(node.id);
                  setCreateParentId(node.id);
                  setCreateOpen(true);
                }}
              />
            </div>
          )}
        </div>

        <Card className="overflow-hidden xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)]">
          {showTreeSkeleton ? (
            <DraftStructureDetailSkeleton />
          ) : selectedUnit && selectedTreeNode ? (
            <div className="flex min-h-136 flex-col xl:min-h-0 xl:h-full">
              <CardHeader className="shrink-0 border-b">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {selectedUnit.orgUnitKindLabel}
                  </Badge>
                  {selectedTreeNode.isOrphaned ? (
                    <Badge variant="outline">Parent missing</Badge>
                  ) : null}
                </div>
                <CardTitle className="mt-2">
                  {selectedUnit.displayName}
                </CardTitle>
                <CardDescription>
                  {!isDraftLocked
                    ? "Review the main fields here, then edit or add a child."
                    : canReopenFromDraft
                      ? "Review the unit here. Reopen the draft from Setup before making structural changes."
                      : "Review the fields here as part of the live structure reference."}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryField
                    label="Unit Name"
                    value={selectedUnit.displayName}
                  />
                  <SummaryField
                    label="Unit Type"
                    value={selectedUnit.orgUnitKindLabel}
                  />
                  <SummaryField
                    label="Unit Code"
                    value={selectedUnit.referenceKey}
                    mono
                  />
                  <SummaryField
                    label="Parent Unit"
                    value={
                      selectedUnit.parentDisplayName ?? "Organization root"
                    }
                  />
                </div>

                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Optional details</p>
                    <p className="text-sm text-muted-foreground">
                      Keep these secondary unless they are useful for the first
                      pass.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <SummaryField
                      label="Location"
                      value={selectedUnit.location ?? "Not set"}
                    />
                    <SummaryField
                      label="Description"
                      value={selectedUnit.description ?? "Not set"}
                    />
                  </div>
                </div>

                {Object.keys(selectedUnit.attributes).length > 0 ? (
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Additional fields</p>
                    <div className="mt-4 grid gap-3">
                      {Object.entries(selectedUnit.attributes).map(
                        ([key, value]) => (
                          <SummaryField
                            key={key}
                            label={getDraftFieldLabel(
                              key,
                              workspace?.draftStructureSchema
                            )}
                            value={formatAttributeValue(value)}
                          />
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="text-xs text-muted-foreground">
                  Last updated{" "}
                  {formatTimestamp(
                    selectedUnit.updatedAt ?? selectedUnit.createdAt
                  )}
                </div>
              </CardContent>
              <div className="shrink-0 border-t bg-background/95 p-4 pb-0 supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Actions
                  </p>
                  {isDraftLocked ? (
                    canReopenFromDraft ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            void handleReopen();
                          }}
                          disabled={reopenStructure.isLoading}
                        >
                          Reopen draft
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => router.push("/setup")}
                        >
                          Open Setup
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => router.push("/setup")}>
                          Open Setup Summary
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => router.push("/")}
                        >
                          Open Dashboard
                        </Button>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setEditorOpen(true)}>
                        Edit unit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCreateParentId(selectedUnit.id);
                          setCreateOpen(true);
                        }}
                      >
                        <Plus className="size-4" />
                        Add child unit
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-136 flex-col justify-center gap-4 p-8 text-center xl:min-h-0 xl:h-full">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FolderTree className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Select a unit</p>
                <p className="text-sm text-muted-foreground">
                  {!isDraftLocked
                    ? "Choose a unit from the tree to inspect it, edit its details, or add a child underneath it."
                    : canReopenFromDraft
                      ? "Choose a unit from the tree to inspect the approved draft."
                      : "Choose a unit from the tree to inspect the published structure."}
                </p>
              </div>
              <div className="flex justify-center">
                {isDraftLocked ? (
                  canReopenFromDraft ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          void handleReopen();
                        }}
                        disabled={reopenStructure.isLoading}
                      >
                        Reopen draft
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => router.push("/setup")}
                      >
                        Open Setup
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => router.push("/setup")}>
                        Open Setup Summary
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => router.push("/")}
                      >
                        Open Dashboard
                      </Button>
                    </div>
                  )
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateParentId(null);
                      setCreateOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Add top-level unit
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <CreateDraftUnitDialog
        open={createOpen}
        onOpenChange={(nextOpen) => {
          setCreateOpen(nextOpen);
          if (!nextOpen) {
            setCreateParentId(null);
          }
        }}
        onCreated={() => {
          setCreateParentId(null);
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

      <DraftStructureImportPanel
        open={isImportOpen}
        onOpenChange={handleImportOpenChange}
        readOnly={isDraftLocked}
        readOnlyTitle={importReadOnlyTitle}
        readOnlyMessage={importReadOnlyMessage}
      />

      <DraftUnitSheet
        unit={selectedUnit}
        open={editorOpen && !!selectedUnit}
        onOpenChange={setEditorOpen}
        readOnly={isDraftLocked}
        readOnlyDescription={unitReadOnlyDescription}
        readOnlyNotice={unitReadOnlyNotice}
        schema={
          workspace?.draftStructureSchema ?? {
            orgUnitKinds: [],
            attributes: [],
          }
        }
        existingUnits={workspace?.units ?? []}
      />
    </div>
  );
}

function SummaryField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className={mono ? "mt-1 font-mono text-sm" : "mt-1 text-sm"}>
        {value}
      </p>
    </div>
  );
}

function formatRoleLabel(
  role: string | null | undefined,
  fallback = "Role not recorded"
) {
  switch (role) {
    case "HRAdmin":
      return "HR administrator";
    case "PlatformAdmin":
      return "Platform administrator";
    case "Manager":
      return "Manager";
    case "Employee":
      return "Employee";
    default:
      return role?.trim() ? role.replace(/([a-z])([A-Z])/g, "$1 $2") : fallback;
  }
}

function DraftGovernanceCard({
  phase,
  readiness,
  readinessError,
  isReadinessLoading,
  approvedAt,
  approvedByFullName,
  approvedByRole,
  isApprovedInPlatformAssistMode,
  onApprove,
  onReopen,
  onOpenSetup,
  onRetryReadiness,
  isApproving,
  isReopening,
}: {
  phase: CoreSetupPhase;
  readiness: DraftSetupReadinessDto | undefined;
  readinessError: string | null;
  isReadinessLoading: boolean;
  approvedAt: string | null;
  approvedByFullName: string | null;
  approvedByRole: string | null;
  isApprovedInPlatformAssistMode: boolean;
  onApprove: () => void;
  onReopen: () => void;
  onOpenSetup: () => void;
  onRetryReadiness: () => void;
  isApproving: boolean;
  isReopening: boolean;
}) {
  if (phase === "activated") {
    const isReadyForApproval = readiness?.isReadyForApproval ?? false;
    const isDraftEmpty = (readiness?.totalUnitCount ?? 0) === 0;

    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <SetupStatusBadge status="activated" />
              <div className="space-y-1">
                <CardTitle>
                  Finish the draft here and lock it when ready
                </CardTitle>
                <CardDescription>
                  The same person can draft, check readiness, and approve from
                  this flow. Use Setup when you want the broader milestone view.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onOpenSetup}>
                Open Setup
              </Button>
              <Button
                onClick={onApprove}
                disabled={
                  isReadinessLoading || !isReadyForApproval || isApproving
                }
              >
                Approve and lock draft
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-6">
          {isReadinessLoading && !readiness ? (
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-3 h-7 w-16" />
                  <Skeleton className="mt-2 h-4 w-full" />
                </div>
              ))}
            </div>
          ) : null}

          {readinessError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Readiness could not be checked</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{readinessError}</span>
                <Button variant="outline" size="sm" onClick={onRetryReadiness}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {readiness ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <ReadinessStat
                  label="Units planned"
                  value={String(readiness.totalUnitCount)}
                  hint={`${readiness.rootUnitCount} top-level units`}
                />
                <ReadinessStat
                  label="Blocking issues"
                  value={String(
                    isDraftEmpty ? 0 : readiness.blockingIssueCount
                  )}
                  hint={
                    isDraftEmpty
                      ? "Shown after the draft takes shape"
                      : readiness.blockingIssueCount === 0
                        ? "Ready to approve"
                        : "Clear these first"
                  }
                />
                <ReadinessStat
                  label="Warnings"
                  value={String(isDraftEmpty ? 0 : readiness.warningCount)}
                  hint={
                    isDraftEmpty
                      ? "Shown after the draft takes shape"
                      : readiness.warningCount === 0
                        ? "No open warnings"
                        : "Review before approval"
                  }
                />
              </div>

              {isDraftEmpty ? (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Add the first unit or import the structure template to start
                  the approval checks.
                </div>
              ) : readiness.blockingIssues.length === 0 &&
                readiness.warnings.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4" />
                    Draft is ready to approve
                  </div>
                  <p className="mt-2 text-emerald-800 dark:text-emerald-300">
                    Lock it when this first pass is ready to hand off to the
                    publish step.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-2">
                {readiness.blockingIssues.length > 0 ? (
                  <IssuePreviewList
                    title="Blocking issues"
                    issues={readiness.blockingIssues}
                    tone="blocking"
                  />
                ) : null}

                {readiness.warnings.length > 0 ? (
                  <IssuePreviewList
                    title="Warnings"
                    issues={readiness.warnings}
                    tone="warning"
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (phase === "structurallyGoverned") {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <SetupStatusBadge status="structurallyGoverned" />
              <div className="space-y-1">
                <CardTitle>Draft approved and locked</CardTitle>
                <CardDescription>
                  The draft is frozen after approval. Reopen it only if more
                  changes are needed before publish.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onOpenSetup}>
                Open Setup
              </Button>
              <Button
                variant="outline"
                onClick={onReopen}
                disabled={isReopening}
              >
                Reopen draft
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 p-6 md:grid-cols-3">
          <ReadinessStat
            label="Approved"
            value={formatTimestamp(approvedAt)}
            hint="Current approval time"
          />
          <ReadinessStat
            label="Approved by"
            value={approvedByFullName ?? "Not recorded"}
            hint={formatRoleLabel(approvedByRole)}
          />
          <ReadinessStat
            label="Approval mode"
            value={isApprovedInPlatformAssistMode ? "Assisted" : "Standard"}
            hint="Reopen if the draft needs changes"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <SetupStatusBadge status={phase} />
            <div className="space-y-1">
              <CardTitle>Published structure</CardTitle>
              <CardDescription>
                This page keeps the live structure available for reference.
                Use Setup for the completion summary and history.
              </CardDescription>
            </div>
          </div>

          <Button variant="outline" onClick={onOpenSetup}>
            Open Setup Summary
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function ReadinessStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold leading-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function IssuePreviewList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: DraftSetupIssueDto[];
  tone: "blocking" | "warning";
}) {
  const previewItems = issues.slice(0, 3);
  const containerClass =
    tone === "blocking"
      ? "border-destructive/25 bg-destructive/5"
      : "border-border bg-muted/20";

  return (
    <div className={`rounded-xl border p-4 ${containerClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <Badge variant="outline">{issues.length}</Badge>
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {previewItems.map((issue) => (
          <div
            key={`${issue.code}-${issue.unitId ?? "global"}-${issue.field ?? "none"}`}
          >
            {issue.message}
          </div>
        ))}
        {issues.length > previewItems.length ? (
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            +{issues.length - previewItems.length} more on Setup
          </div>
        ) : null}
      </div>
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

function DraftStructurePageSkeleton({
  hasImportSession,
}: {
  hasImportSession: boolean;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Organization Structure"
        description="Build the draft tree here or import it from the template."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled>
              <FileSpreadsheet className="size-4" />
              {hasImportSession ? "Resume Import" : "Import from Template"}
            </Button>
            <Button disabled>
              <Plus className="size-4" />
              Add Top-Level Unit
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] xl:items-start">
        <div className="grid gap-4 xl:min-h-184 xl:grid-rows-[auto_minmax(0,1fr)]">
          <div className="rounded-xl border p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-44" />
              </div>
              <Skeleton className="h-10 w-full md:max-w-sm" />
            </div>
          </div>

          <DraftStructureTreeSkeleton />
        </div>

        <Card className="overflow-hidden xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)]">
          <DraftStructureDetailSkeleton />
        </Card>
      </div>
    </div>
  );
}

function DraftStructureTreeSkeleton() {
  return (
    <Card className="xl:h-full">
      <CardContent className="space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton
            key={index}
            className={`h-10 ${index % 3 === 0 ? "w-11/12" : index % 3 === 1 ? "w-10/12" : "w-full"}`}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function DraftStructureDetailSkeleton() {
  return (
    <div className="flex min-h-136 flex-col xl:min-h-0 xl:h-full">
      <CardHeader className="shrink-0 border-b space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border bg-background p-3 space-y-2"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="grid gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </CardContent>
      <div className="shrink-0 border-t bg-background/95 p-4 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-16" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
