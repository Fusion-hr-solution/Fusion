"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FolderTree, Plus } from "lucide-react";
import type { DraftOrgUnitDto } from "@repo/api";
import { canAccessCoreSetup, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { useSetupState } from "../use-setup";
import { CreateDraftUnitDialog } from "./create-draft-unit-dialog";
import {
  DraftStructureTable,
  type DraftStructureSortField,
} from "./draft-structure-table";
import { DraftUnitSheet } from "./draft-unit-sheet";
import { useDraftStructureWorkspace } from "./use-draft-structure";

function formatTimestamp(value: string | null) {
  if (!value) return "No draft changes yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sortUnits(
  units: DraftOrgUnitDto[],
  sortBy: DraftStructureSortField,
  sortDirection: "asc" | "desc"
) {
  const sorted = [...units].sort((left, right) => {
    const direction = sortDirection === "asc" ? 1 : -1;

    if (sortBy === "updatedAt") {
      const leftValue = new Date(left.updatedAt ?? left.createdAt).getTime();
      const rightValue = new Date(right.updatedAt ?? right.createdAt).getTime();
      return (leftValue - rightValue) * direction;
    }

    const leftValue = (left[sortBy] ?? "") as string;
    const rightValue = (right[sortBy] ?? "") as string;
    return leftValue.localeCompare(rightValue, undefined, {
      sensitivity: "base",
    }) * direction;
  });

  return sorted;
}

export default function DraftStructurePage() {
  const router = useRouter();
  const { user } = useAuth();
  const canAccess = canAccessCoreSetup(user);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<DraftStructureSortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const {
    data: setupState,
    error: setupError,
    isLoading: isSetupLoading,
  } = useSetupState();

  const workspaceEnabled = canAccess && !!setupState && !setupState.canStartSetup;
  const {
    data: workspace,
    error: workspaceError,
    isLoading: isWorkspaceLoading,
    refetch,
  } = useDraftStructureWorkspace(workspaceEnabled);

  const filteredUnits = useMemo(() => {
    const allUnits = workspace?.units ?? [];
    const term = search.trim().toLowerCase();

    const visibleUnits = term
      ? allUnits.filter((unit) =>
          [unit.code, unit.name, unit.type, unit.parentName ?? "root"]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      : allUnits;

    return sortUnits(visibleUnits, sortBy, sortDirection);
  }, [search, sortBy, sortDirection, workspace?.units]);

  const selectedUnit =
    workspace?.units.find((unit) => unit.id === selectedUnitId) ?? null;

  const handleSortChange = (field: DraftStructureSortField) => {
    if (field === sortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(field);
    setSortDirection(field === "updatedAt" ? "desc" : "asc");
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Draft Structure"
          description="Draft structure is limited to HR administrators and platform operators in tenant context."
        />
        <EmptyState
          icon={FolderTree}
          title="Draft structure is not available for this role"
          description="Ask a tenant HR administrator or platform administrator to manage the draft workspace."
        />
      </div>
    );
  }

  if (isSetupLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Draft Structure"
          description="Loading setup state..."
        />
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Draft Structure"
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
          title="Draft Structure"
          description="Activate setup first, then continue into the nested draft workspace."
        />
        <EmptyState
          icon={FolderTree}
          title="Setup has not been activated"
          description="The draft workspace stays inside Setup and only opens after activation."
          action={{ label: "Go to Setup", onClick: () => router.push("/setup") }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Draft Structure"
        description="Prepare and correct draft units inside Setup while keeping the overall onboarding path import-led and the live organization untouched."
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={isWorkspaceLoading}>
            <Plus className="size-4" />
            Add Draft Unit
          </Button>
        }
      />

      {workspaceError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Draft workspace could not be loaded</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{workspaceError.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Workspace status</CardDescription>
            <CardTitle>
              {workspace?.workspaceStatus === "empty" ? "Empty" : "In Progress"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Workspace-level status only. Governance and publish semantics stay
            out of Slice 2.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Draft units</CardDescription>
            <CardTitle>{workspace?.unitCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Root units: {workspace?.rootUnitCount ?? 0}
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
            Manual edits here support preparation and later correction around
            import, not a separate manual-first onboarding path.
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Draft workspace</p>
            <p className="text-sm text-muted-foreground">
              Search and sort draft units before governance and publication are
              introduced in later slices.
            </p>
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, name, type, or parent"
            className="md:max-w-sm"
          />
        </div>
      </div>

      <DraftStructureTable
        data={filteredUnits}
        isLoading={isWorkspaceLoading}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onRowClick={(unit) => setSelectedUnitId(unit.id)}
      />

      <CreateDraftUnitDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          void refetch();
        }}
        allowedTypes={workspace?.allowedTypes ?? []}
        existingUnits={workspace?.units ?? []}
      />

      <DraftUnitSheet
        unit={selectedUnit}
        open={!!selectedUnit}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedUnitId(null);
          }
        }}
        onMutated={() => {
          void refetch();
        }}
        allowedTypes={workspace?.allowedTypes ?? []}
        existingUnits={workspace?.units ?? []}
      />
    </div>
  );
}