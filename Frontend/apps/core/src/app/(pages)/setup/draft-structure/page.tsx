"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, FileSpreadsheet, FolderTree, Plus } from "lucide-react";
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
import { useSetupState } from "../use-setup";
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
  } = useSetupState();

  const workspaceEnabled =
    canAccess && !!setupState && !setupState.canStartSetup;
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

  const refreshWorkspace = () => {
    void refetch();
    void refetchTree();
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
          description="Organization structure is limited to HR administrators and platform operators in tenant context."
        />
        <EmptyState
          icon={FolderTree}
          title="Organization structure is not available for this role"
          description="Ask a tenant HR administrator or platform administrator to manage the draft workspace."
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
        description="Build the draft tree here or import it from the template."
        actions={
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
        }
      />

      {(workspaceError || treeError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Draft workspace could not be loaded</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{workspaceError?.message ?? treeError?.message}</span>
            <Button variant="outline" size="sm" onClick={refreshWorkspace}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Planning status</CardDescription>
            <CardTitle>
              {workspace?.workspaceStatus === "empty" ? "Empty" : "In Progress"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Build and review the draft here.
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
              onSchemaUpdated={refreshWorkspace}
              disabled={!workspace}
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
                  Search, review, and edit the draft tree.
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
                  Review the main fields here, then edit or add a child.
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
                  Choose a unit from the tree to inspect it, edit its details,
                  or add a child underneath it.
                </p>
              </div>
              <div className="flex justify-center">
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
          refreshWorkspace();
        }}
        onSchemaUpdated={refreshWorkspace}
        initialParentId={createParentId}
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
          refreshWorkspace();
        }}
      />

      <DraftUnitSheet
        unit={selectedUnit}
        open={editorOpen && !!selectedUnit}
        onOpenChange={setEditorOpen}
        onMutated={() => {
          refreshWorkspace();
        }}
        onSchemaUpdated={refreshWorkspace}
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
