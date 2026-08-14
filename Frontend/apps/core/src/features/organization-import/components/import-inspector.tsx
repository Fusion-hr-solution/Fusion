"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Info,
  Pencil,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Separator,
  cn,
} from "@repo/ds";
import type {
  OrganizationImportDecisions,
  OrganizationImportReview,
  OrganizationImportReviewNode,
  OrganizationImportSessionDto,
} from "@repo/api";
import { formatHumanDate } from "../model/format";
import {
  findProposalNode,
  type ReviewIssue,
  type ReviewSelection,
} from "../model/import-review-model";

interface ImportInspectorProps {
  selection: Exclude<ReviewSelection, { kind: "none" }>;
  session: OrganizationImportSessionDto;
  review: OrganizationImportReview;
  issues: ReviewIssue[];
  saving: boolean;
  onSelect: (selection: ReviewSelection) => void;
  onSave: (decisions: OrganizationImportDecisions) => void;
  onExcludeNode: (nodeId: string) => void;
  onClose: () => void;
}

export function ImportInspector(props: ImportInspectorProps) {
  const { selection, review, issues } = props;

  if (selection.kind === "issues")
    return <IssueIndex {...props} />;

  if (selection.kind === "issue") {
    const issue = issues.find((candidate) => candidate.key === selection.key);
    if (!issue) return <EmptyInspector onClose={props.onClose} />;
    return <IssueResolver {...props} issue={issue} />;
  }

  const node = findProposalNode(review, selection.nodeId);
  if (!node) return <ExistingUnitInspector {...props} nodeId={selection.nodeId} />;
  return <UnitInspector {...props} node={node} />;
}

// --- shell ---------------------------------------------------------------

function InspectorShell({
  title,
  status,
  tone = "muted",
  onBack,
  onClose,
  footer,
  children,
}: {
  title: string;
  status?: string;
  tone?: "muted" | "primary" | "destructive" | "warning";
  onBack?: () => void;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          ) : null}
          <p className="truncate text-base font-semibold">{title}</p>
          {status ? (
            <p
              className={cn(
                "mt-0.5 text-xs font-medium",
                tone === "primary" && "text-primary",
                tone === "destructive" && "text-destructive",
                tone === "warning" && "text-warning",
                tone === "muted" && "text-muted-foreground"
              )}
            >
              {status}
            </p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? <div className="flex items-center justify-end gap-2 border-t px-5 py-3">{footer}</div> : null}
    </div>
  );
}

function EmptyInspector({ onClose }: { onClose: () => void }) {
  return (
    <InspectorShell title="Nothing selected" onClose={onClose}>
      <p className="text-sm text-muted-foreground">This item is no longer part of the review.</p>
    </InspectorShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-medium">{children}</span>
    </div>
  );
}

function severityTone(severity: ReviewIssue["severity"]) {
  return severity === "Blocker" ? "destructive" : severity === "Warning" ? "warning" : "muted";
}

function SeverityIcon({ severity, className }: { severity: ReviewIssue["severity"]; className?: string }) {
  if (severity === "Blocker")
    return <AlertCircle className={cn("text-destructive", className)} />;
  if (severity === "Warning")
    return <TriangleAlert className={cn("text-warning", className)} />;
  return <Info className={cn("text-muted-foreground", className)} />;
}

// --- issue index ---------------------------------------------------------

function IssueIndex({ issues, onSelect, onClose }: ImportInspectorProps) {
  return (
    <InspectorShell
      title="Needs attention"
      status={issues.length === 1 ? "1 thing to sort out" : `${issues.length} things to sort out`}
      tone={issues.some((issue) => issue.severity === "Blocker") ? "destructive" : "warning"}
      onClose={onClose}
    >
      <div className="-mx-1 space-y-1">
        {issues.map((issue) => (
          <button
            key={issue.key}
            type="button"
            onClick={() => onSelect(issueTarget(issue))}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SeverityIcon severity={issue.severity} className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{issue.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{issue.detail}</span>
            </span>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </InspectorShell>
  );
}

export function issueTarget(issue: ReviewIssue): ReviewSelection {
  if (
    (issue.kind === "identity" ||
      issue.kind === "descriptive" ||
      issue.kind === "difference" ||
      issue.kind === "unit") &&
    issue.anchorNodeId
  )
    return { kind: "unit", nodeId: issue.anchorNodeId };
  return { kind: "issue", key: issue.key };
}

// --- issue resolvers -----------------------------------------------------

function IssueResolver(props: ImportInspectorProps & { issue: ReviewIssue }) {
  const { issue } = props;
  if (issue.kind === "root") return <RootResolver {...props} issue={issue} />;
  if (issue.kind === "type") return <TypeResolver {...props} issue={issue} />;
  if (issue.kind === "parent") return <ParentResolver {...props} issue={issue} />;
  if (issue.kind === "sourceMapping") return <SourceMappingResolver {...props} />;
  return <GenericIssue {...props} issue={issue} />;
}

function backToIssues(props: ImportInspectorProps) {
  return props.issues.length > 1 ? () => props.onSelect({ kind: "issues" }) : undefined;
}

function RootResolver(props: ImportInspectorProps & { issue: ReviewIssue }) {
  const { issue, session, saving, onSave, onClose } = props;
  const [name, setName] = useState(session.decisions.introducedRoot?.name ?? "");
  const [code, setCode] = useState(session.decisions.introducedRoot?.businessCode ?? "");
  const ready = name.trim().length > 0 && code.trim().length > 0;
  return (
    <InspectorShell
      title="Organization root"
      status="Required"
      tone="destructive"
      onBack={backToIssues(props)}
      onClose={onClose}
      footer={
        <Button
          disabled={!ready || saving}
          onClick={() =>
            onSave({
              ...session.decisions,
              introducedRoot: { name: name.trim(), businessCode: code.trim() },
            })
          }
        >
          Add root
        </Button>
      }
    >
      <p className="text-sm leading-6 text-muted-foreground">{issue.detail}</p>
      <div className="space-y-1.5">
        <Label htmlFor="import-root-name">Name</Label>
        <Input
          id="import-root-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Acme Group"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="import-root-code">Business code</Label>
        <Input
          id="import-root-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ACME"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <div className="flex h-9 items-center rounded-xl border bg-muted/35 px-3 text-sm">
          Organization
          <span className="ml-auto text-xs text-muted-foreground">System-defined</span>
        </div>
      </div>
    </InspectorShell>
  );
}

function TypeResolver(props: ImportInspectorProps & { issue: ReviewIssue }) {
  const { issue, session, review, onSave, onSelect, onClose } = props;
  const rawType = issue.rawType ?? "";
  const current = session.decisions.typeMappings?.[rawType] ?? "";
  const affected = issue.nodeIds
    .map((id) => review.proposalNodes.find((node) => node.id === id))
    .filter((node): node is OrganizationImportReviewNode => Boolean(node));
  return (
    <InspectorShell
      title={`“${rawType}”`}
      status="Needs an organization type"
      tone="destructive"
      onBack={backToIssues(props)}
      onClose={onClose}
    >
      <div className="space-y-1.5">
        <Label htmlFor="import-type-map">Map to organization type</Label>
        <NativeSelect
          id="import-type-map"
          value={current}
          onChange={(event) =>
            onSave({
              ...session.decisions,
              typeMappings: { ...session.decisions.typeMappings, [rawType]: event.target.value },
            })
          }
        >
          <NativeSelectOption value="">Choose a type</NativeSelectOption>
          {review.typeOptions.map((type) => (
            <NativeSelectOption key={type.id} value={type.id}>
              {type.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Applies to {affected.length} proposed {affected.length === 1 ? "unit" : "units"}
        </p>
        <div className="mt-2 space-y-1">
          {affected.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect({ kind: "unit", nodeId: node.id })}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 truncate">{node.name}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </InspectorShell>
  );
}

function ParentResolver(props: ImportInspectorProps & { issue: ReviewIssue }) {
  const { issue, session, review, saving, onSave, onClose } = props;
  const anchorId = issue.anchorNodeId ?? issue.nodeIds[0] ?? "";
  const node = review.proposalNodes.find((candidate) => candidate.id === anchorId);
  const [parent, setParent] = useState("");
  useEffect(() => setParent(""), [anchorId]);

  function apply() {
    const decoded = parent.startsWith("canonical:")
      ? { parentNodeId: null, parentCanonicalId: parent.slice("canonical:".length) }
      : { parentNodeId: parent, parentCanonicalId: null };
    onSave({
      ...session.decisions,
      nodeCorrections: {
        ...session.decisions.nodeCorrections,
        [anchorId]: { ...session.decisions.nodeCorrections?.[anchorId], ...decoded },
      },
    });
  }

  return (
    <InspectorShell
      title={node?.name ?? "Unplaced unit"}
      status="Needs a parent"
      tone="destructive"
      onBack={backToIssues(props)}
      onClose={onClose}
      footer={
        <Button disabled={!parent || saving} onClick={apply}>
          Apply resolution
        </Button>
      }
    >
      <p className="text-sm leading-6 text-muted-foreground">
        Fusion couldn’t match this unit’s source parent to an existing unit. Choose where it belongs.
      </p>
      {node?.rawParent ? (
        <Field label="Source parent">
          <span className="font-mono text-sm">{node.rawParent}</span>
          <span className="ml-1.5 font-normal text-muted-foreground">· not found</span>
        </Field>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="import-parent-resolve">Parent</Label>
        <NativeSelect
          id="import-parent-resolve"
          value={parent}
          onChange={(event) => setParent(event.target.value)}
        >
          <NativeSelectOption value="">Choose a parent</NativeSelectOption>
          {review.resultingOrganization
            .filter((candidate) => candidate.id !== anchorId)
            .map((candidate) => (
              <NativeSelectOption key={candidate.id} value={candidate.id}>
                {candidate.name} ({candidate.businessCode})
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </div>
    </InspectorShell>
  );
}

function SourceMappingResolver(props: ImportInspectorProps) {
  const { session, review, onSave, onClose } = props;
  const columns = session.source.table?.columns ?? [];
  const requiredFields = new Set(["name", "parentBusinessCode"]);
  const unresolved =
    review.shape === "LevelColumns"
      ? []
      : review.fieldMappings.filter(
          (mapping) => mapping.status === "Unresolved" && requiredFields.has(mapping.field)
        );
  return (
    <InspectorShell
      title="Source columns"
      status="Set up before review"
      tone="destructive"
      onBack={backToIssues(props)}
      onClose={onClose}
    >
      {review.shapeStatus === "Unresolved" ? (
        <div className="space-y-1.5">
          <Label htmlFor="import-shape">Structure</Label>
          <NativeSelect
            id="import-shape"
            value={session.decisions.shape ?? ""}
            onChange={(event) =>
              onSave({
                ...session.decisions,
                shape: event.target.value
                  ? (event.target.value as OrganizationImportDecisions["shape"])
                  : null,
              })
            }
          >
            <NativeSelectOption value="">Choose structure</NativeSelectOption>
            <NativeSelectOption value="ParentReference">Parent reference</NativeSelectOption>
            <NativeSelectOption value="LevelColumns">Level columns</NativeSelectOption>
          </NativeSelect>
        </div>
      ) : null}
      {unresolved.map((mapping) => (
        <div key={mapping.field} className="space-y-1.5">
          <Label htmlFor={`import-field-${mapping.field}`}>{fieldLabel(mapping.field)}</Label>
          <NativeSelect
            id={`import-field-${mapping.field}`}
            value={session.decisions.fieldMappings?.[mapping.field]?.toString() ?? ""}
            onChange={(event) =>
              onSave({
                ...session.decisions,
                fieldMappings: {
                  ...session.decisions.fieldMappings,
                  [mapping.field]: event.target.value ? Number(event.target.value) : null,
                },
              })
            }
          >
            <NativeSelectOption value="">Choose column</NativeSelectOption>
            {columns.map((column) => (
              <NativeSelectOption key={column.index} value={column.index}>
                {column.sourceLabel ?? `Column ${column.index + 1}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ))}
    </InspectorShell>
  );
}

function GenericIssue(props: ImportInspectorProps & { issue: ReviewIssue }) {
  const { issue, review, onSelect, onClose } = props;
  const anchor = issue.anchorNodeId
    ? review.resultingOrganization.find((node) => node.id === issue.anchorNodeId)
    : null;
  const dateRelated =
    issue.raw?.code === "ExistingUnavailableAsOfDate" ||
    issue.raw?.code === "PermanentRootUnavailableAsOfDate";
  return (
    <InspectorShell
      title={issue.title}
      status={issue.severity === "Blocker" ? "Needs attention" : "Heads up"}
      tone={severityTone(issue.severity)}
      onBack={backToIssues(props)}
      onClose={onClose}
      footer={
        anchor ? (
          <Button variant="outline" onClick={() => onSelect({ kind: "unit", nodeId: anchor.id })}>
            Go to {anchor.name}
          </Button>
        ) : undefined
      }
    >
      <p className="text-sm leading-6 text-muted-foreground">{issue.detail}</p>
      {dateRelated ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Change the effective date at the top of the page, or replace the source.
        </p>
      ) : null}
    </InspectorShell>
  );
}

// --- unit inspectors -----------------------------------------------------

function UnitInspector(props: ImportInspectorProps & { node: OrganizationImportReviewNode }) {
  const { node } = props;
  if (node.classification === "Conflict" && (node.identityEvidence?.length ?? 0) > 0)
    return <IdentityConflictInspector {...props} node={node} />;
  if (node.classification === "Conflict") return <DifferenceInspector {...props} node={node} />;
  if (node.classification === "Unchanged") return <MatchedUnitInspector {...props} node={node} />;
  return <ProposedUnitInspector {...props} node={node} />;
}

function ProposedUnitInspector(props: ImportInspectorProps & { node: OrganizationImportReviewNode }) {
  const { node, session, review, saving, onSave, onSelect, onExcludeNode, onClose } = props;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [code, setCode] = useState(node.businessCode ?? "");
  const [parent, setParent] = useState(
    node.parentNodeId ?? (node.parentCanonicalId ? `canonical:${node.parentCanonicalId}` : "")
  );
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  useEffect(() => {
    setEditing(false);
    setName(node.name);
    setCode(node.businessCode ?? "");
    setParent(node.parentNodeId ?? (node.parentCanonicalId ? `canonical:${node.parentCanonicalId}` : ""));
  }, [node.id, node.name, node.businessCode, node.parentNodeId, node.parentCanonicalId]);

  const parentName = node.parentNodeId
    ? review.resultingOrganization.find((candidate) => candidate.id === node.parentNodeId)?.name
    : node.parentCanonicalId
      ? review.resultingOrganization.find((candidate) => candidate.id === `canonical:${node.parentCanonicalId}`)?.name
      : null;
  const sourceRows = Array.from(new Set(node.sourceCells.map((cell) => cell.rowNumber))).sort((a, b) => a - b);

  function saveEdits() {
    const decoded = parent.startsWith("canonical:")
      ? { parentNodeId: null, parentCanonicalId: parent.slice("canonical:".length) }
      : { parentNodeId: parent || null, parentCanonicalId: null };
    onSave({
      ...session.decisions,
      nodeCorrections: {
        ...session.decisions.nodeCorrections,
        [node.id]: {
          ...session.decisions.nodeCorrections?.[node.id],
          name: name.trim(),
          businessCode: code.trim(),
          ...(node.isProposalRoot ? {} : decoded),
        },
      },
    });
    setEditing(false);
  }

  return (
    <InspectorShell
      title={node.name}
      status={node.isProposalRoot ? "New organization root" : "New organizational unit"}
      tone="primary"
      onClose={onClose}
      footer={
        editing ? (
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button disabled={saving || !name.trim() || !code.trim()} onClick={saveEdits}>
              Save changes
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit details
          </Button>
        )
      }
    >
      {editing ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`import-name-${node.id}`}>Name</Label>
            <Input
              id={`import-name-${node.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`import-code-${node.id}`}>Business code</Label>
            <Input
              id={`import-code-${node.id}`}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </div>
          {!node.isProposalRoot ? (
            <div className="space-y-1.5">
              <Label htmlFor={`import-parent-${node.id}`}>Parent</Label>
              <NativeSelect
                id={`import-parent-${node.id}`}
                value={parent}
                onChange={(event) => setParent(event.target.value)}
              >
                <NativeSelectOption value="">Choose parent</NativeSelectOption>
                {review.resultingOrganization
                  .filter((candidate) => candidate.id !== node.id)
                  .map((candidate) => (
                    <NativeSelectOption key={candidate.id} value={candidate.id}>
                      {candidate.name} ({candidate.businessCode})
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Type">{node.typeName ?? node.rawType ?? "Unresolved"}</Field>
          <Field label="Business code">
            {node.businessCode || "—"}
            {node.businessCodeGenerated ? (
              <span className="ml-1.5 font-normal text-muted-foreground">· suggested</span>
            ) : null}
          </Field>
          <Field label="Parent">{parentName ?? "—"}</Field>
        </div>
      )}

      {node.descriptiveCandidates.length > 0 && !editing ? (
        <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/[0.04] p-3">
          <p className="text-xs font-medium text-warning">This may already exist in Organization</p>
          {node.descriptiveCandidates.map((candidate) => (
            <div key={candidate.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {candidate.name} <span className="text-muted-foreground">· {candidate.code}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onSave({
                    ...session.decisions,
                    acceptedExistingMatches: {
                      ...session.decisions.acceptedExistingMatches,
                      [node.id]: candidate.id,
                    },
                  })
                }
              >
                Use existing
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {sourceRows.length > 0 && !editing ? (
        <Disclosure open={evidenceOpen} onToggle={() => setEvidenceOpen((value) => !value)} label="Source evidence">
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p>
              Source {sourceRows.length === 1 ? "row" : "rows"} {sourceRows.join(", ")}
              {session.source.selectedSheetName ? ` · ${session.source.selectedSheetName}` : ""}
            </p>
            {node.rawParent ? <p>Source parent: {node.rawParent}</p> : null}
            {node.rawType && node.rawType !== node.typeName ? <p>Source type: {node.rawType}</p> : null}
          </div>
        </Disclosure>
      ) : null}

      {!editing ? (
        <>
          <Separator />
          {node.isProposalRoot ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                onSave({ ...session.decisions, introducedRoot: null });
                onSelect({ kind: "none" });
              }}
            >
              <Trash2 className="h-4 w-4" />
              Remove proposed root
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onExcludeNode(node.id)}
            >
              <Trash2 className="h-4 w-4" />
              Exclude from import
            </Button>
          )}
        </>
      ) : null}
    </InspectorShell>
  );
}

function MatchedUnitInspector(props: ImportInspectorProps & { node: OrganizationImportReviewNode }) {
  const { node, review, onClose } = props;
  const parentName = node.parentCanonicalId
    ? review.resultingOrganization.find((candidate) => candidate.id === `canonical:${node.parentCanonicalId}`)?.name
    : null;
  return (
    <InspectorShell title={node.name} status="Already in Organization" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Type">{node.typeName ?? "—"}</Field>
        <Field label="Business code">{node.businessCode || "—"}</Field>
        <Field label="Parent">{parentName ?? "Organization root"}</Field>
      </div>
    </InspectorShell>
  );
}

function ExistingUnitInspector(props: ImportInspectorProps & { nodeId: string }) {
  const { nodeId, review, onClose } = props;
  const node = review.resultingOrganization.find((candidate) => candidate.id === nodeId);
  if (!node) return <EmptyInspector onClose={onClose} />;
  const parentName = node.parentId
    ? review.resultingOrganization.find((candidate) => candidate.id === node.parentId)?.name
    : null;
  return (
    <InspectorShell
      title={node.name}
      status={node.isNew ? "New organizational unit" : "Already in Organization"}
      tone={node.isNew ? "primary" : "muted"}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Field label="Type">{node.typeName}</Field>
        <Field label="Business code">{node.businessCode || "—"}</Field>
        <Field label="Parent">{parentName ?? "Organization root"}</Field>
      </div>
    </InspectorShell>
  );
}

function IdentityConflictInspector(props: ImportInspectorProps & { node: OrganizationImportReviewNode }) {
  const { node, onClose } = props;
  return (
    <InspectorShell
      title={node.name}
      status="Identity conflict"
      tone="destructive"
      onClose={onClose}
      footer={
        <Button asChild variant="outline">
          <Link href="/organization/import">Start a corrected import</Link>
        </Button>
      }
    >
      <p className="text-sm leading-6 text-muted-foreground">
        This row identifies two different organization units, so Fusion cannot choose one.
      </p>
      <div className="space-y-2.5">
        {node.identityEvidence.map((evidence) => (
          <div key={`${evidence.identifier}-${evidence.unitId}`} className="rounded-xl border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {evidence.identifier === "fusionOrgUnitId" ? "Fusion ID" : "Business code"}
              {evidence.suppliedValue ? ` · ${evidence.suppliedValue}` : ""}
            </p>
            <p className="mt-1 text-sm font-medium">
              {evidence.unitName}
              <span className="ml-1.5 font-mono text-xs text-muted-foreground">{evidence.unitCode}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Correct the identifiers in your source file, then start a new import.
      </p>
    </InspectorShell>
  );
}

function DifferenceInspector(props: ImportInspectorProps & { node: OrganizationImportReviewNode }) {
  const { node, session, saving, onSave, onClose } = props;
  return (
    <InspectorShell
      title={node.name}
      status="Already exists"
      tone="destructive"
      onClose={onClose}
      footer={
        node.canonicalId ? (
          <Button
            variant="outline"
            disabled={saving}
            onClick={() =>
              onSave({
                ...session.decisions,
                keepCanonicalNodeIds: Array.from(
                  new Set([...(session.decisions.keepCanonicalNodeIds ?? []), node.id])
                ),
              })
            }
          >
            Keep what’s there
          </Button>
        ) : undefined
      }
    >
      <p className="text-sm leading-6 text-muted-foreground">
        This unit already exists in your organization, and the file describes it differently. Import can’t
        change a unit that’s already there. Keep the version you have now, or fix the file and import again.
      </p>
      <div className="space-y-3">
        <Field label="Type">{node.typeName ?? node.rawType ?? "—"}</Field>
        <Field label="Business code">{node.businessCode || "—"}</Field>
      </div>
    </InspectorShell>
  );
}

// --- helpers -------------------------------------------------------------

function Disclosure({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label}
      </button>
      {open ? <div className="mt-2 pl-5">{children}</div> : null}
    </div>
  );
}

function fieldLabel(field: string) {
  return (
    ({
      fusionOrgUnitId: "Fusion OrgUnit ID",
      businessCode: "Business code",
      name: "Name",
      type: "Type",
      parentBusinessCode: "Parent business code",
    }) as Record<string, string>
  )[field] ?? field;
}

export type { ImportInspectorProps };
