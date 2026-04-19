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
  type DraftSetupIssueDto,
  type DraftSetupReadinessDto,
} from "@repo/api";
import { canAccessCoreSetup, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
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
  useSetupState,
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
} from "./draft-structure-tree-utils";
import { DraftUnitSheet } from "./draft-unit-sheet";
import {
  useDraftStructureTree,
  useDraftStructureWorkspace,
} from "./use-draft-structure";

function formatTimestamp(value: string | null) {
  if (!value) return "No draft changes yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
    data: setupState,
    error: setupError,
    isLoading: isSetupLoading,
    refetch: refetchSetup,
  } = useSetupState(canAccess);
  const isDraftLocked = setupState?.currentPhase !== "activated";
  const canApproveFromDraft = setupState?.currentPhase === "activated";
  const canReopenFromDraft = setupState?.currentPhase === "structurallyGoverned";

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
  const approveStructure = useApproveStructure({
    onSuccess: () => {
      setActionError(null);
      void refetchSetup();
      void refetchReadiness();
      void refetch();
      void refetchTree();
    },
  });
  const reopenStructure = useReopenStructure({
    onSuccess: () => {
      setActionError(null);
      void refetchSetup();
      void refetch();
      void refetchTree();
    },
  });

  const draftTree = useMemo(() => buildWorkspaceDraftTree(tree ?? []), [tree]);
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

  const handleApprove = async () => {
    if (setupState?.version == null) {
      setActionError("The latest setup version is required before approval.");
      return;
    }

    setActionError(null);

    try {
      await approveStructure.mutateAsync({ expectedVersion: setupState.version });
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
      await reopenStructure.mutateAsync({ expectedVersion: setupState.version });
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
          title="Organization Structure"
          description="Organization structure is limited to tenant HR administrators."
        />
        <EmptyState
          icon={FolderTree}
          title="Organization structure is not available for this role"
          description="Ask a tenant HR administrator to manage the draft workspace."
        />
      </div>
    );
  }

  if (isSetupLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Organization Structure"
          description="Loading setup state..."
        />
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Organization Structure"
          description="Setup state must be available before the draft workspace can load."
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
          title="Organization Structure"
          description="Activate setup first, then continue into the organization structure area."
        />
        <EmptyState
          icon={FolderTree}
          title="Setup has not been activated"
          description="The organization structure area opens after setup is activated."
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
        title="Organization Structure"
        description={
          isDraftLocked
            ? "Review the locked draft here. Reopen it if more changes are needed."
            : "Build the draft here, then approve it when the first pass is ready."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleImportOpenChange(true)}
              disabled={isDraftLocked}
            >
              <FileSpreadsheet className="size-4" />
              {hasImportSession ? "Resume Import" : "Import from Template"}
            </Button>
            <Button
              onClick={() => {
                setCreateParentId(null);
                setCreateOpen(true);
              }}
              disabled={isWorkspaceLoading || isDraftLocked}
            >
              <Plus className="size-4" />
              Add Top-Level Unit
            </Button>
          </div>
        }
      />

      {(workspaceError || treeError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Draft workspace could not be loaded</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{workspaceError?.message ?? treeError?.message}</span>
            <Button variant="outline" size="sm" onClick={refreshWorkspaceAndReadiness}>
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

      {isDraftLocked ? (
        <Alert>
          <LockKeyhole className="h-4 w-4" />
          <AlertTitle>Draft is locked</AlertTitle>
          <AlertDescription>
            {canReopenFromDraft
              ? "Reopen the draft before adding units, editing details, changing unit types, or importing a new file."
              : "This draft is now read-only while later setup steps are in progress."}
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
        isApprovedInPlatformAssistMode={setupState.isApprovedInPlatformAssistMode}
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
              {isDraftLocked
                ? "Locked"
                : workspace?.workspaceStatus === "empty"
                  ? "Empty"
                  : "In Progress"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {isDraftLocked ? "Review only." : "Build and review the draft here."}
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
            Draft only.
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
            <DraftOrgUnitKindManager
              schema={
                workspace?.draftStructureSchema ?? {
                  orgUnitKinds: [],
                  attributes: [],
                }
              }
              existingUnits={workspace?.units ?? []}
              onSchemaUpdated={refreshWorkspaceAndReadiness}
              disabled={!workspace || isDraftLocked}
            />
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
                  {isDraftLocked
                    ? "Search and review the approved draft tree."
                    : "Search, review, and edit the draft tree."}
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
                emptyDescription="Add the first top-level unit or start with a template import to build the planned organization tree."
                readOnly={isDraftLocked}
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
                  {isDraftLocked
                    ? "Review the main fields here. Reopen the draft before making changes."
                    : "Review the main fields here, then edit or add a child."}
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
                        <Button variant="outline" onClick={() => router.push("/setup")}>
                          Open Setup
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={() => router.push("/setup")}>
                        Go to Setup
                      </Button>
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
                  {isDraftLocked
                    ? "Choose a unit from the tree to inspect the approved draft."
                    : "Choose a unit from the tree to inspect it, edit its details, or add a child underneath it."}
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
                      <Button variant="outline" onClick={() => router.push("/setup")}>
                        Open Setup
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => router.push("/setup")}>
                      Go to Setup
                    </Button>
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
          refreshWorkspaceAndReadiness();
        }}
        onSchemaUpdated={refreshWorkspaceAndReadiness}
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
        onApplied={() => {
          refreshWorkspaceAndReadiness();
        }}
        readOnly={isDraftLocked}
      />

      <DraftUnitSheet
        unit={selectedUnit}
        open={editorOpen && !!selectedUnit}
        onOpenChange={setEditorOpen}
        onMutated={() => {
          refreshWorkspaceAndReadiness();
        }}
        onSchemaUpdated={refreshWorkspaceAndReadiness}
        readOnly={isDraftLocked}
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

function formatRoleLabel(role: string | null | undefined, fallback = "Role not recorded") {
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
      return role?.trim()
        ? role.replace(/([a-z])([A-Z])/g, "$1 $2")
        : fallback;
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
                <CardTitle>Finish the draft here and lock it when ready</CardTitle>
                <CardDescription>
                  The same person can draft, check readiness, and approve from this flow. Use Setup when you want the broader milestone view.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onOpenSetup}>
                Open Setup
              </Button>
              <Button
                onClick={onApprove}
                disabled={isReadinessLoading || !isReadyForApproval || isApproving}
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
                  value={String(isDraftEmpty ? 0 : readiness.blockingIssueCount)}
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
                  Add the first unit or import the structure template to start the approval checks.
                </div>
              ) : readiness.blockingIssues.length === 0 &&
                readiness.warnings.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4" />
                    Draft is ready to approve
                  </div>
                  <p className="mt-2 text-emerald-800 dark:text-emerald-300">
                    Lock it when this first pass is ready to hand off to the publish step.
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
                  The draft is frozen after approval. Reopen it only if more changes are needed before publish.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onOpenSetup}>
                Open Setup
              </Button>
              <Button variant="outline" onClick={onReopen} disabled={isReopening}>
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
              <CardTitle>
                {phase === "structurallyPublished"
                  ? "Live structure published"
                  : "Setup is complete"}
              </CardTitle>
              <CardDescription>
                {phase === "structurallyPublished"
                  ? "This draft is now the locked record of what was published. Setup is treated as complete in this flow."
                  : "This draft stays available as a locked snapshot of what went live. Use Setup for the finished milestone view."}
              </CardDescription>
            </div>
          </div>

          <Button variant="outline" onClick={onOpenSetup}>
            Open Setup
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
          <div key={`${issue.code}-${issue.unitId ?? "global"}-${issue.field ?? "none"}`}>
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
            <div key={index} className="rounded-xl border bg-background p-3 space-y-2">
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
