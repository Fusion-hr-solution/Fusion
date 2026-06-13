"use client";

import {
  Ellipsis,
  FileSpreadsheet,
  FolderTree,
  Search,
  Settings2,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  DraftOrgUnitDto,
  DraftStructureSchemaDto,
} from "@repo/api";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getDraftFieldLabel } from "@/app/(pages)/setup/draft-structure/draft-structure-labels";
import type { DraftStructureSortField } from "@/app/(pages)/setup/draft-structure/draft-structure-table";
import { DraftStructureTable } from "@/app/(pages)/setup/draft-structure/draft-structure-table";
import { DraftStructureTree } from "@/app/(pages)/setup/draft-structure/draft-structure-tree";
import type { DraftStructureTreeNodeModel } from "@/app/(pages)/setup/draft-structure/draft-structure-tree-utils";

export const DRAFT_STRUCTURE_EXPORT_FILE_NAME = "draft-structure-export.csv";

export type ExplorerView = "tree" | "list";

export function formatTimestamp(value: string | null) {
  if (!value) return "No draft changes yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

export function buildDraftStructureExportFields(schema: DraftStructureSchemaDto) {
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

export function flattenDraftTreeNodeIds(
  nodes: DraftStructureTreeNodeModel[]
): string[] {
  return nodes.flatMap((node) => [
    node.id,
    ...flattenDraftTreeNodeIds(node.children),
  ]);
}

export function filterDraftTreeByMatchedIds(
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

export function buildLeafFirstDeleteOrder(
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

export function matchesDraftUnitSearch(unit: DraftOrgUnitDto, searchTerm: string) {
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

export function compareDraftUnits(
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

export function stringifyDraftStructureExportValue(value: unknown) {
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

export function getDraftStructureExportValue(unit: DraftOrgUnitDto, fieldKey: string) {
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

export function escapeCsvValue(value: string) {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

export function buildDraftStructureExportCsv({
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

// ── Sub-components ─────────────────────────────────────────────────────────

export function InspectorField({
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

export function DraftStructureReferenceEmptyState({
  isSetupComplete,
}: {
  isSetupComplete: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border bg-muted/10 text-muted-foreground">
          <FolderTree className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">
            {isSetupComplete ? "No live units" : "No units available"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isSetupComplete
              ? "The live structure does not contain any units yet."
              : "No units are available in this view yet."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface DraftStructureWorkbenchProps {
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
}

export function DraftStructureWorkbench({
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
}: DraftStructureWorkbenchProps) {
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
                    variant="destructive"
                    disabled={isEmptyDraft || isClearingStructure}
                    onSelect={onClearStructure}
                  >
                    <Trash2 className="size-4" />
                    Delete all units
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              className="m-0 flex min-h-0 min-w-0 flex-col overflow-hidden xl:h-full"
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
              className="m-0 flex min-h-0 min-w-0 flex-col overflow-hidden p-4 xl:h-full"
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

          <div className="min-h-0 overflow-hidden border-t xl:h-full xl:border-t-0">
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

export function DraftStructureInspectorPanel({
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
      ) : null}
    </div>
  );
}

export function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

export function formatAttributeValue(value: unknown): string {
  if (value == null) return "Not set";
  if (typeof value === "string" && !value.trim()) return "Not set";
  return String(value);
}

export function DraftStructurePageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-6 w-full max-w-2xl" />
      <DraftStructureWorkbenchSkeleton />
    </div>
  );
}

export function DraftStructureWorkbenchSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.9fr]">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[36rem] w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[36rem] w-full" />
        </div>
      </div>
    </div>
  );
}
