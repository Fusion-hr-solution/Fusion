"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  Pencil,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Separator,
  Skeleton,
  cn,
} from "@repo/ds";
import type {
  OrganizationImportDecisions,
  OrganizationImportReview,
  OrganizationImportReviewNode,
  OrganizationImportSemanticAssistance,
  OrganizationImportSemanticReviewedItem,
  OrganizationImportSemanticReviewOutcome,
  OrganizationImportSemanticSuggestion,
  OrganizationImportSessionDto,
  OrganizationImportShape,
} from "@repo/api";
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
  applyingSuggestions: boolean;
  onSelect: (selection: ReviewSelection) => void;
  onSave: (decisions: OrganizationImportDecisions) => void;
  onApplySuggestions: (items: OrganizationImportSemanticReviewedItem[]) => void;
  onChangeSourceShape: (shape: OrganizationImportShape) => void;
  onExcludeNode: (nodeId: string) => void;
  onClose: () => void;
}

export function ImportInspector(props: ImportInspectorProps) {
  const { selection, review, issues } = props;

  if (selection.kind === "suggestions") {
    const assistance = props.session.semanticAssistance;
    if (assistance?.state === "Pending" || assistance?.state === "Eligible")
      return <SemanticInterpretingInspector session={props.session} onClose={props.onClose} />;
    if (!assistance || assistance.state !== "Available")
      return <EmptyInspector onClose={props.onClose} />;
    return <SemanticSuggestionsInspector key={assistance.attemptId} {...props} assistance={assistance} />;
  }

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

type ReviewedSuggestion = {
  targetKey: string | null;
  outcome: OrganizationImportSemanticReviewOutcome;
};

// Fusion-native wording for a detected source shape. The raw target keys/labels
// ("Level columns", "Parent reference") are the deterministic vocabulary; the
// review surface reads the shape as a described structure, not a column format.
const SHAPE_LABEL: Record<string, string> = {
  LevelColumns: "Level-based hierarchy",
  ParentReference: "Parent-reference hierarchy",
};

// Before apply, the source shape is itself part of what AI interpreted, so the
// deterministic review still reads `Unresolved`. The detected shape therefore
// comes from the AI's own `source_shape` suggestion (target key `shape:<Shape>`),
// falling back to the resolved review shape.
function detectedSourceShape(
  assistance: OrganizationImportSemanticAssistance,
  review: OrganizationImportReview
): OrganizationImportShape {
  const shapeSuggestion = assistance.suggestions.find((s) => s.kind === "source_shape");
  const key = shapeSuggestion?.targetKey?.replace(/^shape:/, "");
  if (key === "LevelColumns" || key === "ParentReference") return key;
  return review.shape;
}

function initialSuggestionReview(assistance: OrganizationImportSemanticAssistance) {
  return Object.fromEntries(
    assistance.suggestions.map((suggestion) => [
      suggestion.issueKey,
      { targetKey: suggestion.targetKey, outcome: "Accepted" as const },
    ])
  ) as Record<string, ReviewedSuggestion>;
}

// The processing state IS the interpretation surface, mid-resolve: the same
// title, the same "Your term → Fusion meaning" frame, with the meanings still
// forming. Restrained motion (a pulsing interpretation mark and a resolving
// shimmer) makes the ~3s provider call read as deliberate work, then the rows
// settle into the real mappings when the attempt lands. No fake steps, no
// percentages, reduced-motion aware.
function SemanticInterpretingInspector({
  session,
  onClose,
}: {
  session: OrganizationImportSessionDto;
  onClose: () => void;
}) {
  const columnCount = session.source.table?.columns.length ?? 4;
  const rows = Math.min(Math.max(columnCount, 3), 5);
  return (
    <InspectorShell
      title="Fusion’s interpretation"
      titleIcon={
        <Sparkles
          className="h-4 w-4 animate-pulse text-primary motion-reduce:animate-none"
          aria-hidden
        />
      }
      status="Interpreting your structure…"
      tone="primary"
      onClose={onClose}
    >
      <section className="space-y-2" aria-hidden>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Structure detected
        </p>
        <div className="flex items-center gap-2.5 rounded-xl border bg-muted/25 px-3 py-2.5">
          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Skeleton className="h-4 w-40 motion-reduce:animate-none" />
        </div>
      </section>
      <section className="space-y-1">
        <div className="grid grid-cols-[minmax(0,1fr)_1.25rem_9.25rem] items-center gap-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Your term</span>
          <span aria-hidden />
          <span>Fusion meaning</span>
        </div>
        <div className="divide-y" aria-hidden>
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_1.25rem_9.25rem] items-center gap-2 py-3"
            >
              <Skeleton
                className="h-4 motion-reduce:animate-none"
                style={{ width: `${72 - index * 9}%`, animationDelay: `${index * 140}ms` }}
              />
              <ArrowRight className="h-4 w-4 justify-self-center text-muted-foreground/30" aria-hidden />
              <Skeleton
                className="h-9 w-[148px] rounded-md motion-reduce:animate-none"
                style={{ animationDelay: `${index * 140 + 70}ms` }}
              />
            </div>
          ))}
        </div>
      </section>
    </InspectorShell>
  );
}

// Fusion read the customer's own vocabulary and proposed a Fusion meaning for
// each term. The surface optimizes for scanning source → meaning: one header
// labels both sides once, each row is a translation, and only a *changed* row
// carries a marker. Provenance ("AI-assisted") is stated once, not per row.
function SemanticSuggestionsInspector({
  assistance,
  review,
  applyingSuggestions,
  onApplySuggestions,
  onChangeSourceShape,
  onClose,
}: ImportInspectorProps & { assistance: OrganizationImportSemanticAssistance }) {
  const [reviewed, setReviewed] = useState<Record<string, ReviewedSuggestion>>(() =>
    initialSuggestionReview(assistance)
  );
  const [changingShape, setChangingShape] = useState(false);

  // Every per-term interpretation is reviewable — field meanings (OU Ref → Business
  // Code) and hierarchy-level meanings (Strategic Pillar → Division) alike, each
  // carrying its own allowed-target vocabulary. Only the source shape is
  // informational (deterministic / auto-accepted) and never a term row.
  const terms = assistance.suggestions.filter((s) => s.kind !== "source_shape");
  // The detected source shape is read as a described structure, never an editable
  // dropdown here — changing it under the term suggestions would desync the two.
  // Reinterpreting to a different shape is an explicit, disruptive action.
  const detectedShape = detectedSourceShape(assistance, review);
  const shapeLabel = SHAPE_LABEL[detectedShape] ?? "Detected structure";
  // Defensive invariant: a reviewable interpretation that cannot be shown (no source
  // term, or no targets to choose from) must never be silently applied. If any exist,
  // Apply is disabled and a coherent fallback is surfaced instead.
  const unrenderable = terms.filter(
    (suggestion) => !suggestion.sourceLabel || suggestion.allowedTargets.length === 0
  );
  const canApply = unrenderable.length === 0;
  // The headline count is the interpretations the administrator is deciding on and
  // can see — it always reconciles with the visible rows.
  const acceptedCount = useMemo(
    () =>
      terms.filter(
        (suggestion) => (reviewed[suggestion.issueKey]?.outcome ?? "Rejected") !== "Rejected"
      ).length,
    [terms, reviewed]
  );
  const items = assistance.suggestions.map((suggestion) => ({
    issueKey: suggestion.issueKey,
    targetKey: reviewed[suggestion.issueKey]?.targetKey ?? null,
    outcome: reviewed[suggestion.issueKey]?.outcome ?? "Rejected",
  }));

  function choose(suggestion: OrganizationImportSemanticSuggestion, value: string) {
    const targetKey = value || null;
    setReviewed((previous) => ({
      ...previous,
      [suggestion.issueKey]: {
        targetKey,
        outcome:
          targetKey === null
            ? "Rejected"
            : targetKey === suggestion.targetKey
              ? "Accepted"
              : "Changed",
      },
    }));
  }

  return (
    <InspectorShell
      title="Fusion’s interpretation"
      titleIcon={<Sparkles className="h-4 w-4 text-primary" aria-hidden />}
      status="AI-assisted"
      tone="primary"
      onClose={onClose}
      footer={
        <Button
          disabled={applyingSuggestions || !canApply}
          onClick={() => onApplySuggestions(items)}
        >
          {applyingSuggestions
            ? "Applying…"
            : acceptedCount > 0
              ? `Apply ${acceptedCount} interpretation${acceptedCount === 1 ? "" : "s"}`
              : "Apply"}
        </Button>
      }
    >
      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Structure detected
        </p>
        <div className="flex items-center gap-2.5 rounded-xl border bg-muted/25 px-3 py-2.5">
          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{shapeLabel}</span>
        </div>
        {changingShape ? (
          <ShapeReinterpretation
            currentShape={detectedShape}
            onCancel={() => setChangingShape(false)}
            onChoose={(shape) => {
              setChangingShape(false);
              onChangeSourceShape(shape);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setChangingShape(true)}
            className="text-xs font-medium text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:underline"
          >
            Change source interpretation
          </button>
        )}
      </section>

      {terms.length > 0 ? (
        <section className="space-y-1">
          <div className="grid grid-cols-[minmax(0,1fr)_1.25rem_9.25rem] items-center gap-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Your term</span>
            <span aria-hidden />
            <span>Fusion meaning</span>
          </div>
          <div className="divide-y">
            {terms.map((suggestion, index) => {
              const current = reviewed[suggestion.issueKey] ?? {
                targetKey: null,
                outcome: "Rejected" as const,
              };
              const sourceLabel = suggestion.sourceLabel ?? "Source structure";
              const edited = current.outcome === "Changed";
              const manual = current.outcome === "Rejected";
              return (
                <div key={suggestion.issueKey} className="py-2.5 first:pt-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_1.25rem_9.25rem] items-center gap-2">
                    <span
                      className="min-w-0 truncate text-sm font-medium text-foreground"
                      title={suggestion.rationale ?? undefined}
                    >
                      {sourceLabel}
                    </span>
                    <ArrowRight
                      className={cn(
                        "h-4 w-4 justify-self-center text-muted-foreground/60",
                        manual && "text-muted-foreground/30"
                      )}
                      aria-hidden
                    />
                    <NativeSelect
                      aria-label={sourceLabel}
                      autoFocus={index === 0}
                      className="h-9 w-[148px] text-sm"
                      value={current.targetKey ?? ""}
                      onChange={(event) => choose(suggestion, event.target.value)}
                    >
                      <NativeSelectOption value="">Resolve manually</NativeSelectOption>
                      {suggestion.allowedTargets.map((target) => (
                        <NativeSelectOption key={target.key} value={target.key}>
                          {target.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  {edited || manual ? (
                    <div className="mt-1 flex justify-end">
                      {edited ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                          <Pencil className="h-3 w-3" aria-hidden />
                          Edited
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Left for manual review
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {!canApply ? (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/[0.04] p-3 text-sm"
          role="status"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span className="text-muted-foreground">
            Some interpretations couldn’t be shown for review. Reload the import, or resolve
            these columns manually.
          </span>
        </div>
      ) : null}
    </InspectorShell>
  );
}

// Reinterpreting the source shape is disruptive: it discards the current
// AI interpretation and re-derives requirements for the chosen structure. It is
// deliberately behind a confirm step so a shape can never quietly change
// underneath the level-based suggestions.
function ShapeReinterpretation({
  currentShape,
  onCancel,
  onChoose,
}: {
  currentShape: OrganizationImportShape;
  onCancel: () => void;
  onChoose: (shape: OrganizationImportShape) => void;
}) {
  const options: { shape: OrganizationImportShape; label: string }[] = [
    { shape: "LevelColumns", label: SHAPE_LABEL.LevelColumns! },
    { shape: "ParentReference", label: SHAPE_LABEL.ParentReference! },
  ];
  return (
    <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/[0.04] p-3">
      <p className="text-xs leading-5 text-muted-foreground">
        Choosing a different structure discards this interpretation and reinterprets the file.
      </p>
      <div className="grid gap-1.5">
        {options.map((option) => (
          <button
            key={option.shape}
            type="button"
            disabled={option.shape === currentShape}
            onClick={() => onChoose(option.shape)}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              option.shape === currentShape
                ? "cursor-default border-transparent bg-muted/50 text-muted-foreground"
                : "hover:border-foreground/30 hover:bg-muted/60"
            )}
          >
            {option.label}
            {option.shape === currentShape ? (
              <span className="text-xs text-muted-foreground">Current</span>
            ) : null}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        Cancel
      </button>
    </div>
  );
}

// --- shell ---------------------------------------------------------------

function InspectorShell({
  title,
  titleIcon,
  status,
  tone = "muted",
  onBack,
  onClose,
  footer,
  children,
}: {
  title: string;
  titleIcon?: React.ReactNode;
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
          <h2 className="flex items-center gap-2 truncate text-base font-semibold">
            {titleIcon}
            <span className="truncate">{title}</span>
          </h2>
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
