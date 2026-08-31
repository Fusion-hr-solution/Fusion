"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  EyeOff,
  FileSpreadsheet,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  NativeSelect,
  NativeSelectOption,
  Spinner,
  cn,
} from "@repo/ds";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
import {
  translateOrganizationImportError,
  type OrganizationImportDecisions,
  type OrganizationImportReview,
  type OrganizationImportSemanticReviewedItem,
  type OrganizationImportSessionDto,
  type OrganizationImportShape,
  type OrganizationImportTypeOption,
} from "@repo/api";
import { toast } from "sonner";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";
import {
  useOrganizationImportMutations,
  useOrganizationImportSession,
} from "../api/use-organization-import";
import { formatHumanDate, formatRelativeTime } from "../model/format";
import {
  attentionByNode,
  buildReviewTree,
  deriveReviewIssues,
  interpretationNodeIds,
  isDeferredDuringInterpretation,
  PLACEHOLDER_ROOT_ID,
  proposedDescendantIds,
  rootRequired,
  UNPLACED_PARENT_ID,
  unresolvedParentNodeIds,
  type ReviewSelection,
} from "../model/import-review-model";
import { ImportReviewOutline } from "./import-review-outline";
import { ImportInspector, issueTarget } from "./import-inspector";

export function ImportReviewWorkspace({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const sessionQuery = useOrganizationImportSession(sessionId);
  const mutations = useOrganizationImportMutations();
  const [date, setDate] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [selection, setSelection] = useState<ReviewSelection>({ kind: "none" });
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [handoff, setHandoff] = useState(false);
  useBreadcrumbLabel(sessionId, sessionQuery.data?.source.originalFileName);

  useEffect(() => {
    if (sessionQuery.data) setDate(sessionQuery.data.effectiveDate);
  }, [sessionQuery.data]);

  // Once a commit succeeds we hold one calm transition until the browser lands
  // on canonical Organization, so the committed session never flashes in between.
  if (handoff) return <ImportHandoff />;

  if (sessionQuery.isLoading) return <ImportReviewSkeleton />;
  if (sessionQuery.error)
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Import structure" />
        <PagePermissionNotice
          title="Import not available"
          description={translateOrganizationImportError(sessionQuery.error).message}
          action={<Button onClick={() => void sessionQuery.refetch()}>Retry</Button>}
        />
      </PageContainer>
    );

  const session = sessionQuery.data;
  if (!session) return null;
  if (session.status === "Discarded") return <DiscardedImport session={session} />;
  if (session.status === "Committed") return <CommittedImport session={session} />;

  return (
    <ActiveReviewWorkspace
      session={session}
      date={date}
      setDate={setDate}
      discardOpen={discardOpen}
      setDiscardOpen={setDiscardOpen}
      selection={selection}
      setSelection={setSelection}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      mutations={mutations}
      onRefetch={() => void sessionQuery.refetch()}
      onHandoff={() => setHandoff(true)}
      router={router}
    />
  );
}

function ImportHandoff() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Spinner className="size-6" aria-hidden />
      <p>Completing import…</p>
    </div>
  );
}

/**
 * The review's own skeleton — it mirrors the header / interpretation band / tree / footer layout the
 * review will land on, so the hand-off from the staged intake resolves in place instead of flashing a
 * generic centred loader and then jumping into a full-height workspace.
 */
function ImportReviewSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Loading your import"
    >
      <header className="shrink-0 space-y-3 border-b px-6 pb-3 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-44 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-72 animate-pulse rounded bg-muted/60" />
          </div>
          <div className="h-8 w-44 animate-pulse rounded-xl bg-muted/60" />
        </div>
        <div className="h-4 w-52 animate-pulse rounded bg-muted/50" />
      </header>

      <div className="shrink-0 border-b bg-primary/[0.04] px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="size-5 animate-pulse rounded-md bg-primary/15" />
          <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
          <div className="h-6 w-32 animate-pulse rounded-lg bg-muted/50" />
          <div className="h-6 w-28 animate-pulse rounded-lg bg-muted/50" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-2">
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(240px,1fr)_170px_160px] items-center gap-4 border-b border-border/50 py-3"
          >
            <div
              className="flex items-center gap-2"
              style={{ paddingInlineStart: `${(index % 4) * 22}px` }}
            >
              <div className="size-4 shrink-0 animate-pulse rounded bg-muted/50" />
              <div
                className="h-4 animate-pulse rounded bg-muted/60"
                style={{ width: `${120 + ((index * 29) % 130)}px` }}
              />
            </div>
            <div className="h-3.5 w-24 animate-pulse rounded bg-muted/50" />
            <div className="h-3.5 w-14 animate-pulse rounded bg-muted/40" />
          </div>
        ))}
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t bg-card px-6 py-3 shadow-[0_-6px_16px_-12px_rgb(0_0_0/0.18)]">
        <div className="h-4 w-64 animate-pulse rounded bg-muted/50" />
        <div className="h-9 w-36 animate-pulse rounded-lg bg-muted/60" />
      </footer>
    </div>
  );
}

type Mutations = ReturnType<typeof useOrganizationImportMutations>;

function ActiveReviewWorkspace({
  session,
  date,
  setDate,
  discardOpen,
  setDiscardOpen,
  selection,
  setSelection,
  collapsed,
  setCollapsed,
  mutations,
  onRefetch,
  onHandoff,
  router,
}: {
  session: OrganizationImportSessionDto;
  date: string;
  setDate: (value: string) => void;
  discardOpen: boolean;
  setDiscardOpen: (open: boolean) => void;
  selection: ReviewSelection;
  setSelection: (selection: ReviewSelection) => void;
  collapsed: ReadonlySet<string>;
  setCollapsed: (value: ReadonlySet<string>) => void;
  mutations: Mutations;
  onRefetch: () => void;
  onHandoff: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const review = session.review;
  const source = session.source;
  const savedAt = session.updatedAt ?? session.createdAt;
  // Latest session for deferred writes (e.g. an Undo fired after a recompute
  // has already advanced the ETag version).
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const generatedRequestRef = useRef<string | null>(null);
  const [failedRequestKey, setFailedRequestKey] = useState<string | null>(null);
  const reviewSurfaceRef = useRef<HTMLElement | null>(null);
  // Structural interpretations (which column is Name/Type/Parent, which source
  // shape) are plumbing, not business decisions — Fusion applies them itself while
  // it builds the proposal. This tracks the attempt whose structural suggestions
  // have already been written so the silent apply fires once per attempt.
  const appliedStructuralAttemptRef = useRef<string | null>(null);
  // After an explicit source-shape reinterpretation, route to the deterministic
  // resolver for the new shape once recompute settles (unless a fresh AI
  // interpretation takes over instead).
  const routeToSourceAfterRecomputeRef = useRef(false);
  const assistance = session.semanticAssistance;

  useEffect(() => {
    if (assistance?.state !== "Eligible" || !assistance.inputFingerprint) return;
    const requestKey = `${session.id}:${assistance.inputFingerprint}`;
    if (generatedRequestRef.current === requestKey) return;
    generatedRequestRef.current = requestKey;
    setFailedRequestKey(null);
    void mutations.generateSuggestions
      .mutateAsync({ id: session.id, inputFingerprint: assistance.inputFingerprint })
      .then(() => onRefetch())
      .catch((error) => {
        setFailedRequestKey(requestKey);
        toast.error("Suggestions could not be requested", {
          description: translateOrganizationImportError(error).message,
        });
      });
  }, [assistance?.inputFingerprint, assistance?.state, mutations.generateSuggestions, onRefetch, session.id]);

  const issues = useMemo(() => (review ? deriveReviewIssues(review) : []), [review]);
  const unplacedIds = useMemo(() => unresolvedParentNodeIds(issues), [issues]);
  const tree = useMemo(
    () =>
      review
        ? buildReviewTree(review.resultingOrganization, rootRequired(review), unplacedIds)
        : null,
    [review, unplacedIds]
  );
  // Coalesce the assistance lifecycle into one phase the whole workspace agrees
  // on, so a term Fusion is actively interpreting never simultaneously reads as a
  // red "needs attention" failure. While interpreting or waiting for review, the
  // semantic issues belong to the interpretation surface, not the manual queue.
  const currentKey = assistance?.inputFingerprint
    ? `${session.id}:${assistance.inputFingerprint}`
    : null;
  const generateFailed =
    assistance?.state === "Failed" || (currentKey !== null && failedRequestKey === currentKey);
  const semanticPhase: "interpreting" | "ready" | "failed" | "none" =
    assistance?.state === "Available"
      ? "ready"
      : generateFailed
        ? "failed"
        : Boolean(assistance?.inputFingerprint) &&
            (assistance?.state === "Pending" || assistance?.state === "Eligible")
          ? "interpreting"
          : "none";
  const semanticActive = semanticPhase === "interpreting" || semanticPhase === "ready";
  // Split Fusion's interpretation into the two things it means for the journey.
  // Structural suggestions (source shape, which column is Name/Type/Parent) are
  // applied silently — the administrator never operates them. Vocabulary
  // suggestions (what a source term like "Pôle" means) are the only genuine
  // business decisions, surfaced together as one consolidated confirmation.
  const readySuggestions = useMemo(
    () => (semanticPhase === "ready" ? (assistance?.suggestions ?? []) : []),
    [semanticPhase, assistance?.suggestions]
  );
  const structuralSuggestions = useMemo(
    () =>
      readySuggestions.filter(
        (suggestion) =>
          suggestion.kind === "field_mapping" || suggestion.kind === "source_shape"
      ),
    [readySuggestions]
  );
  const hasVocabularySuggestion = readySuggestions.some(
    (suggestion) => suggestion.kind === "organization_type_mapping"
  );
  // A ready attempt that carries only structural suggestions is applied for the
  // administrator; until that write lands the workspace stays in the one calm
  // "Understanding your organization" state rather than surfacing an apply step.
  const structuralAutoApplyPending =
    semanticPhase === "ready" &&
    structuralSuggestions.length > 0 &&
    !hasVocabularySuggestion;
  // While AI is interpreting or awaiting review, the manual attention queue drops
  // both the semantic issues and the root/placement conditions that only fail
  // because the levels are not typed yet — they cannot be evaluated until Apply.
  const manualIssues = useMemo(
    () =>
      semanticActive
        ? issues.filter((issue) => !isDeferredDuringInterpretation(issue))
        : issues,
    [issues, semanticActive]
  );
  const interpretationIds = useMemo(() => interpretationNodeIds(issues), [issues]);

  // Silently apply structural interpretations as Fusion's own proposal-building
  // step — never as an administrator action. Writing the field/shape decisions
  // recomputes the proposal and advances the interpretation continuously, so the
  // only interpretation the administrator is ever asked about is real vocabulary.
  useEffect(() => {
    if (!structuralAutoApplyPending || !assistance?.attemptId) return;
    if (appliedStructuralAttemptRef.current === assistance.attemptId) return;
    appliedStructuralAttemptRef.current = assistance.attemptId;
    const previous = sessionRef.current.decisions;
    const fieldMappings = { ...(previous.fieldMappings ?? {}) };
    let shape = previous.shape ?? null;
    for (const suggestion of structuralSuggestions) {
      if (suggestion.kind === "field_mapping" && suggestion.sourceColumnIndex !== null) {
        const field = suggestion.targetKey.replace(/^field:/, "");
        fieldMappings[field] = suggestion.sourceColumnIndex;
      } else if (suggestion.kind === "source_shape") {
        const detected = suggestion.targetKey.replace(/^shape:/, "");
        if (detected === "LevelColumns" || detected === "ParentReference") shape = detected;
      }
    }
    void saveDecisions({ ...previous, shape, fieldMappings });
  }, [structuralAutoApplyPending, structuralSuggestions, assistance?.attemptId]);

  const attention = useMemo(() => attentionByNode(manualIssues), [manualIssues]);
  const [excludeTarget, setExcludeTarget] = useState<
    { nodeId: string; name: string; descendantCount: number } | null
  >(null);

  // Drop a selection that no longer resolves after a recompute.
  useEffect(() => {
    if (!review) return;
    if (selection.kind === "unit" && selection.nodeId !== PLACEHOLDER_ROOT_ID) {
      const known =
        review.proposalNodes.some((node) => node.id === selection.nodeId) ||
        review.resultingOrganization.some((node) => node.id === selection.nodeId);
      if (!known) setSelection({ kind: "none" });
    } else if (selection.kind === "issue" && !issues.some((issue) => issue.key === selection.key)) {
      setSelection({ kind: "none" });
    } else if (selection.kind === "issues" && issues.length === 0) {
      setSelection({ kind: "none" });
    } else if (
      selection.kind === "suggestions" &&
      assistance?.state !== "Available" &&
      assistance?.state !== "Pending" &&
      assistance?.state !== "Eligible"
    ) {
      // Keep the drawer open across the interpreting → ready transition; only a
      // terminal non-review state (failed/applied/none) closes it.
      setSelection({ kind: "none" });
    }
  }, [assistance?.state, review, issues, selection, setSelection]);

  // Once a source-shape reinterpretation has recomputed, surface the deterministic
  // resolver for the new shape — unless a fresh AI interpretation has taken over,
  // in which case its own inspector leads.
  useEffect(() => {
    if (!routeToSourceAfterRecomputeRef.current || !review) return;
    if (semanticPhase === "interpreting" || semanticPhase === "ready") {
      routeToSourceAfterRecomputeRef.current = false;
      return;
    }
    const sourceIssue = issues.find((issue) => issue.kind === "sourceMapping");
    if (sourceIssue) {
      routeToSourceAfterRecomputeRef.current = false;
      setSelection({ kind: "issue", key: sourceIssue.key });
    } else if (issues.length > 0) {
      routeToSourceAfterRecomputeRef.current = false;
      setSelection({ kind: "issues" });
    }
  }, [issues, review, semanticPhase, setSelection]);

  async function changeDate(value: string) {
    setDate(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    try {
      await mutations.changeDate.mutateAsync({ id: session.id, version: session.version, effectiveDate: value });
      onRefetch();
    } catch (error) {
      toast.error("Effective date was not changed", {
        description: translateOrganizationImportError(error).message,
      });
      setDate(session.effectiveDate);
    }
  }

  async function saveDecisions(decisions: OrganizationImportDecisions) {
    try {
      await mutations.replaceDecisions.mutateAsync({
        id: sessionRef.current.id,
        version: sessionRef.current.version,
        decisions,
      });
      onRefetch();
    } catch (error) {
      toast.error("The proposal was not updated", {
        description: translateOrganizationImportError(error).message,
      });
      onRefetch();
    }
  }

  async function discard() {
    try {
      await mutations.discard.mutateAsync({ id: session.id, version: session.version });
      router.replace("/organization/import");
    } catch (error) {
      toast.error("Import was not discarded", {
        description: translateOrganizationImportError(error).message,
      });
    }
  }

  async function complete() {
    if (!review) return;
    try {
      const result = await mutations.commit.mutateAsync({
        id: session.id,
        version: session.version,
        semanticDigest: review.semanticDigest,
      });
      // Hold one controlled transition so the committed session never flashes
      // before the browser lands on canonical Organization.
      onHandoff();
      const reveal = result.createdUnits.map((unit) => unit.orgUnitId).join(",");
      router.replace(
        `/organization?asOf=${encodeURIComponent(result.effectiveDate)}${reveal ? `&reveal=${encodeURIComponent(reveal)}` : ""}`
      );
    } catch (error) {
      const problem = translateOrganizationImportError(error);
      toast.error(problem.code === "ProposalChanged" ? "The proposal changed" : "The import was not completed", {
        description: problem.message,
      });
      onRefetch();
    }
  }

  async function applySuggestions(reviewedItems: OrganizationImportSemanticReviewedItem[]) {
    if (!assistance?.attemptId || !assistance.inputFingerprint || assistance.attemptVersion === null) return;
    try {
      await mutations.applySuggestions.mutateAsync({
        id: session.id,
        version: session.version,
        attemptId: assistance.attemptId,
        inputFingerprint: assistance.inputFingerprint,
        attemptVersion: assistance.attemptVersion,
        reviewedItems,
      });
      setSelection({ kind: "none" });
      onRefetch();
      window.requestAnimationFrame(() => reviewSurfaceRef.current?.focus());
      toast.success("Interpretations applied");
    } catch (error) {
      toast.error("Suggestions were not applied", {
        description: translateOrganizationImportError(error).message,
      });
      onRefetch();
    }
  }

  // An explicit source-shape change is a full reinterpretation: it writes the
  // authoritative shape decision, which changes the semantic fingerprint and
  // supersedes the current AI attempt server-side, so the stale level-based
  // suggestions can no longer be applied. The drawer closes immediately and the
  // deterministic resolver for the new shape is surfaced once recompute settles.
  async function changeSourceShape(shape: OrganizationImportShape) {
    if (shape === review?.shape) return;
    setSelection({ kind: "none" });
    routeToSourceAfterRecomputeRef.current = true;
    await saveDecisions({ ...sessionRef.current.decisions, shape });
    toast("Reinterpreting the source", {
      description: `Now reading it as a ${shape === "LevelColumns" ? "level-based" : "parent-reference"} hierarchy.`,
    });
  }

  function openIssues() {
    if (manualIssues.length === 1 && manualIssues[0]) setSelection(issueTarget(manualIssues[0]));
    else setSelection({ kind: "issues" });
  }

  function selectNode(id: string) {
    if (id === PLACEHOLDER_ROOT_ID) return setSelection({ kind: "issue", key: "root" });
    if (id === UNPLACED_PARENT_ID) return setSelection({ kind: "issues" });
    // An unplaced unit routes straight to its parent resolver, not a generic editor.
    const parentIssue = issues.find((issue) => issue.kind === "parent" && issue.anchorNodeId === id);
    if (parentIssue) return setSelection({ kind: "issue", key: parentIssue.key });
    setSelection({ kind: "unit", nodeId: id });
  }

  function requestExclude(nodeId: string) {
    const descendants = review ? proposedDescendantIds(review.resultingOrganization, nodeId) : [];
    const name =
      review?.proposalNodes.find((node) => node.id === nodeId)?.name ??
      review?.resultingOrganization.find((node) => node.id === nodeId)?.name ??
      "unit";
    if (descendants.length > 0) setExcludeTarget({ nodeId, name, descendantCount: descendants.length });
    else void performExclude(nodeId, name);
  }

  async function performExclude(nodeId: string, name: string) {
    if (!review) return;
    const previous = session.decisions;
    const ids = [nodeId, ...proposedDescendantIds(review.resultingOrganization, nodeId)];
    setExcludeTarget(null);
    setSelection({ kind: "none" });
    await saveDecisions({
      ...previous,
      excludedNodeIds: Array.from(new Set([...(previous.excludedNodeIds ?? []), ...ids])),
    });
    toast(`Excluded ${name}`, {
      description: ids.length > 1 ? `${ids.length} units removed from this import.` : undefined,
      action: { label: "Undo", onClick: () => void saveDecisions(previous) },
    });
  }

  function toggle(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  }

  // Type-vocabulary is resolved on the consolidated understanding surface, never in
  // the manual attention queue — so the queue only ever holds genuine review work.
  const nonTypeManualIssues = useMemo(
    () => manualIssues.filter((issue) => issue.kind !== "type"),
    [manualIssues]
  );
  const canCommit = review?.canCommit ?? false;
  const createCount = review?.createCount ?? 0;
  const existingCount = review?.existingCount ?? 0;
  const isNoop = canCommit && createCount === 0;
  const blockerCount = nonTypeManualIssues.filter((issue) => issue.severity === "Blocker").length;
  const hasBlocker = nonTypeManualIssues.some((issue) => issue.severity === "Blocker");

  // One consolidated business decision per source term Fusion couldn't place on its
  // own, carrying Fusion's suggested meaning and how many units share that term. The
  // administrator confirms a meaning once; it applies to every unit that uses it.
  const vocabularyDecisions = useMemo<VocabularyDecision[]>(() => {
    const typeIssues = issues.filter((issue) => issue.kind === "type");
    return typeIssues.map((issue) => {
      const rawType = issue.rawType ?? "";
      const suggestion = readySuggestions.find(
        (candidate) =>
          candidate.kind === "organization_type_mapping" &&
          (candidate.sourceLabel ?? "").toLowerCase() === rawType.toLowerCase()
      );
      const suggestedTypeId = suggestion?.targetKey.startsWith("type:")
        ? suggestion.targetKey.slice("type:".length)
        : null;
      return {
        rawType,
        unitCount: issue.raw?.affectedCount ?? issue.nodeIds.length,
        suggestedTypeId,
        suggestedLabel: suggestion?.targetLabel ?? null,
      };
    });
  }, [issues, readySuggestions]);

  // The single processing state and the single decision state. While Fusion is still
  // reading, interpreting, or applying its own structural interpretations, the whole
  // workspace holds one calm "Understanding your organization" surface — no resets,
  // no per-pass apply. Only genuine vocabulary pauses it, on one consolidated screen.
  const understandingPhase =
    Boolean(review) && (semanticPhase === "interpreting" || structuralAutoApplyPending);
  const vocabularyPhase =
    Boolean(review) && !understandingPhase && vocabularyDecisions.length > 0;

  async function applyTypeMappings(entries: { rawType: string; typeId: string }[]) {
    const previous = sessionRef.current.decisions;
    const typeMappings = { ...(previous.typeMappings ?? {}) };
    for (const entry of entries) typeMappings[entry.rawType] = entry.typeId;
    await saveDecisions({ ...previous, typeMappings });
  }

  const selectedId = selection.kind === "unit" ? selection.nodeId : null;
  const highlightedIds = useMemo(() => {
    if (selection.kind === "issue") {
      const issue = issues.find((candidate) => candidate.key === selection.key);
      return new Set(issue?.nodeIds ?? []);
    }
    return new Set<string>();
  }, [selection, issues]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b px-6 pt-5">
        <PageHeader
          title="Import structure"
          description={`${source.originalFileName} · saved ${formatRelativeTime(savedAt)} by ${session.lastUpdatedByDisplayName}`}
          className="mb-3"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border bg-background px-2 py-1">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Effective</span>
                <Input
                  aria-label="Effective date"
                  type="date"
                  value={date}
                  disabled={mutations.changeDate.isLoading}
                  onChange={(event) => void changeDate(event.target.value)}
                  className="h-7 w-[132px] border-0 p-1 shadow-none focus-visible:ring-0"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={mutations.refresh.isLoading}
                    onClick={() =>
                      void mutations.refresh.mutateAsync({ id: session.id }).then(() => onRefetch())
                    }
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh against Organization
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDiscardOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Discard import
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="font-medium text-foreground">{source.sourceFormat.toUpperCase()}</span>
            <span>
              {source.rowCount.toLocaleString()} rows
              {source.selectedSheetName ? ` · ${source.selectedSheetName}` : ""}
            </span>
          </span>
          {review && !understandingPhase && !vocabularyPhase ? (
            <>
              <span className="h-4 w-px bg-border" aria-hidden />
              <span className="flex items-center gap-1.5">
                {createCount > 0 ? (
                  <span>
                    <span className="font-semibold text-primary">{createCount}</span> new
                    {existingCount === 0 ? (
                      <span className="text-muted-foreground"> from this file</span>
                    ) : null}
                  </span>
                ) : null}
                {existingCount > 0 ? (
                  <span className="text-muted-foreground">
                    {createCount > 0 ? "· " : ""}
                    {existingCount} matched
                  </span>
                ) : null}
              </span>
              {nonTypeManualIssues.length > 0 ? (
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={openIssues}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      hasBlocker
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                        : "bg-warning/10 text-warning hover:bg-warning/15"
                    )}
                  >
                    {hasBlocker ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <TriangleAlert className="h-4 w-4" />
                    )}
                    Needs attention · {nonTypeManualIssues.length}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      {!review || !tree ? (
        <div className="flex-1 p-6">
          <PageSkeleton rows={5} label="Building Organization proposal" />
        </div>
      ) : understandingPhase ? (
        <UnderstandingState fileName={source.originalFileName} />
      ) : vocabularyPhase ? (
        <VocabularyState
          decisions={vocabularyDecisions}
          typeOptions={review.typeOptions}
          saving={mutations.replaceDecisions.isLoading}
          onConfirm={(entries) => void applyTypeMappings(entries)}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <InterpretationSummary review={review} />
          <div className="relative flex min-h-0 flex-1">
          <main
            ref={reviewSurfaceRef}
            tabIndex={-1}
            className="min-w-0 flex-1 outline-none"
            aria-label="Resulting organization review"
          >
            {tree.roots.length > 0 ? (
              <ImportReviewOutline
                model={tree}
                collapsed={collapsed}
                selectedId={selectedId}
                highlightedIds={highlightedIds}
                attention={attention}
                interpretation={null}
                interpretationIds={interpretationIds}
                onSelect={selectNode}
                onToggle={toggle}
              />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                  {issues.length
                    ? "Take care of what needs attention to build the organization."
                    : "No organizational units resolve for this file."}
                </p>
              </div>
            )}
          </main>
          {selection.kind !== "none" ? (
            <aside
              className="min-h-0 w-[400px] shrink-0 border-l bg-background max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:w-[380px] max-xl:shadow-xl"
              aria-label="Import review panel"
            >
              <ImportInspector
                selection={selection}
                session={session}
                review={review}
                issues={manualIssues}
                saving={mutations.replaceDecisions.isLoading}
                applyingSuggestions={mutations.applySuggestions.isLoading}
                onSelect={setSelection}
                onSave={(decisions) => void saveDecisions(decisions)}
                onApplySuggestions={(items) => void applySuggestions(items)}
                onChangeSourceShape={(shape) => void changeSourceShape(shape)}
                onExcludeNode={requestExclude}
                onClose={() => setSelection({ kind: "none" })}
              />
            </aside>
          ) : null}
          </div>
        </div>
      )}

      {review && !understandingPhase && !vocabularyPhase ? (
        <footer className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-card px-6 py-3 shadow-[0_-6px_16px_-12px_rgb(0_0_0/0.18)]">
          <div className="flex items-center gap-2 text-sm">
            {canCommit ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            <span className={cn(!canCommit && "text-destructive")}>
              {!canCommit
                ? blockerCount === 1
                  ? "1 thing needs your attention before you can finish."
                  : blockerCount > 1
                    ? `${blockerCount} things need your attention before you can finish.`
                    : "Resolve the remaining items before you can finish."
                : isNoop
                  ? "Everything in this file already exists in Organization. No changes will be made."
                  : `${createCount} new organizational ${createCount === 1 ? "unit" : "units"} · effective ${formatHumanDate(session.effectiveDate)}`}
            </span>
          </div>
          {!canCommit ? (
            <Button variant="outline" onClick={openIssues}>
              Review
            </Button>
          ) : isNoop ? (
            <Button disabled={mutations.commit.isLoading} onClick={() => void complete()}>
              {mutations.commit.isLoading ? "Finishing…" : "Finish import"}
            </Button>
          ) : (
            // One click commits — the Review IS the confirmation; no interstitial dialog. The button
            // disables itself while the commit is in flight so a second click cannot double-submit.
            <Button disabled={mutations.commit.isLoading} onClick={() => void complete()}>
              {mutations.commit.isLoading ? "Completing…" : "Complete import"}
            </Button>
          )}
        </footer>
      ) : null}

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this import?</AlertDialogTitle>
            <AlertDialogDescription>
              Your Organization won’t be changed. This import will no longer be available to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep import</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={mutations.discard.isLoading}
              onClick={() => void discard()}
            >
              Discard import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={excludeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setExcludeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exclude {excludeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This also removes{" "}
              <span className="font-semibold text-foreground">
                {excludeTarget?.descendantCount} proposed{" "}
                {excludeTarget?.descendantCount === 1 ? "unit" : "units"}
              </span>{" "}
              beneath it from the import. You can undo this straight after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                excludeTarget && void performExclude(excludeTarget.nodeId, excludeTarget.name)
              }
            >
              Exclude {excludeTarget ? excludeTarget.descendantCount + 1 : 0} units
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// One business decision per source term Fusion couldn't place deterministically,
// carrying Fusion's suggested Organization type and how many units share the term.
type VocabularyDecision = {
  rawType: string;
  unitCount: number;
  suggestedTypeId: string | null;
  suggestedLabel: string | null;
};

const TYPE_RANK: Record<string, number> = {
  organization: 0,
  "business unit": 1,
  division: 2,
  department: 3,
  team: 4,
  unit: 5,
};

/**
 * What Fusion made of the raw file, shown once the proposal is ready — the interpretation the
 * administrator would otherwise never see behind a tree that "just appears". It surfaces the work
 * structurally, not as prose: the layout Fusion read, the columns it set aside, and — the signature
 * moment — each of the file's own terms mapped to a Fusion organization type. Only rendered when
 * Fusion actually translated something (a source term differs from its Fusion type, or a column was
 * set aside); a native Fusion-template file that needs no interpretation shows nothing here.
 */
function InterpretationSummary({ review }: { review: OrganizationImportReview }) {
  const mappings = useMemo(() => {
    const seen = new Map<string, string>();
    for (const node of review.proposalNodes) {
      const from = node.rawType?.trim();
      const to = node.typeName?.trim();
      if (!from || !to || from.toLowerCase() === to.toLowerCase()) continue;
      if (!seen.has(from)) seen.set(from, to);
    }
    return [...seen.entries()]
      .map(([from, to]) => ({ from, to }))
      .sort(
        (a, b) => (TYPE_RANK[a.to.toLowerCase()] ?? 9) - (TYPE_RANK[b.to.toLowerCase()] ?? 9)
      );
  }, [review.proposalNodes]);
  const ignored = review.ignoredColumns ?? [];

  if (mappings.length === 0 && ignored.length === 0) return null;

  const layout =
    review.shape === "LevelColumns"
      ? "Level hierarchy"
      : review.shape === "ParentReference"
        ? "Parent references"
        : null;

  return (
    <section
      aria-label="Fusion’s interpretation"
      className="shrink-0 overflow-x-auto border-b bg-primary/[0.04] px-6 py-2.5"
    >
      <div className="flex min-w-max items-center gap-x-4 gap-y-2">
        <span className="flex shrink-0 items-center gap-2">
          <span className="grid size-5 place-items-center rounded-md bg-primary/12 text-primary ring-1 ring-primary/20">
            <Sparkles className="size-3.5" aria-hidden />
          </span>
          <span className="type-label font-semibold text-foreground">
            Fusion’s interpretation
          </span>
          {layout ? (
            <span className="type-meta text-muted-foreground">· {layout}</span>
          ) : null}
        </span>

        {mappings.length ? (
          <div className="flex items-center gap-1.5">
            {mappings.map((mapping) => (
              <span
                key={mapping.from}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-card px-2 py-1 type-meta shadow-[var(--shadow-raised)]"
              >
                <span className="max-w-[10rem] truncate text-muted-foreground">
                  {mapping.from}
                </span>
                <ArrowRight className="size-3 shrink-0 text-primary/60" aria-hidden />
                <span className="font-medium text-foreground">{mapping.to}</span>
              </span>
            ))}
          </div>
        ) : null}

        {ignored.length ? (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 type-meta text-muted-foreground"
            title={ignored.map((column) => `${column.label} — ${column.reason}`).join("\n")}
          >
            <EyeOff className="size-3.5 shrink-0" aria-hidden />
            {ignored.length === 1
              ? `Set aside “${ignored[0]!.label}”`
              : `${ignored.length} columns set aside`}
          </span>
        ) : null}
      </div>
    </section>
  );
}

// The single processing state. Everything Fusion does internally — reading the
// source, inferring the hierarchy and root, interpreting vocabulary, applying its
// own structural interpretations — happens behind this one calm surface, with no
// resets and no per-pass apply. It never asks the administrator to operate a step.
function UnderstandingState({ fileName }: { fileName: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center p-6"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto grid h-16 w-16 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/15 motion-reduce:hidden" />
          <span className="relative grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Sparkles className="h-7 w-7 animate-pulse motion-reduce:animate-none" aria-hidden />
          </span>
        </div>
        <h2 className="mt-6 text-lg font-semibold">Understanding your organization</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          Reading {fileName}, identifying the hierarchy, and learning your vocabulary.
        </p>
        <div className="mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-muted">
          <span className="block h-full w-1/3 animate-[understanding-sweep_1.4s_ease-in-out_infinite] rounded-full bg-primary/70 motion-reduce:w-full motion-reduce:animate-none" />
        </div>
      </div>
      <style>{`@keyframes understanding-sweep{0%{transform:translateX(-140%)}100%{transform:translateX(420%)}}`}</style>
    </div>
  );
}

// The one consolidated decision surface. Fusion resolved the structure itself and
// now asks only about genuine meaning: what each unfamiliar source term is, once,
// for every unit that uses it. Fusion's suggestion is pre-selected, so the whole
// vocabulary is usually confirmed in a single action; a term with no confident
// suggestion falls back to an explicit choice. Resolving the last one advances to
// review automatically.
function VocabularyState({
  decisions,
  typeOptions,
  saving,
  onConfirm,
}: {
  decisions: VocabularyDecision[];
  typeOptions: OrganizationImportTypeOption[];
  saving: boolean;
  onConfirm: (entries: { rawType: string; typeId: string }[]) => void;
}) {
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      decisions.map((decision) => [decision.rawType, decision.suggestedTypeId ?? ""])
    )
  );
  const labelFor = (typeId: string) => typeOptions.find((type) => type.id === typeId)?.name;
  const allSuggested = decisions.every((decision) => decision.suggestedTypeId);
  const allChosen = decisions.every((decision) => choices[decision.rawType]);

  function confirmAll() {
    const entries = decisions
      .map((decision) => ({ rawType: decision.rawType, typeId: choices[decision.rawType] ?? "" }))
      .filter((entry) => entry.typeId);
    if (entries.length > 0) onConfirm(entries);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
          {decisions.length === 1
            ? "Fusion found 1 meaning to confirm"
            : `Fusion found ${decisions.length} meanings to confirm`}
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {decisions.length === 1
            ? "Confirm one meaning"
            : `Confirm ${decisions.length} meanings`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {allSuggested
            ? "Your file uses its own words for organization types. Confirm what each one means."
            : "Set what each of your organization terms means."}
        </p>

        <div className="mt-7 divide-y rounded-2xl border">
          {decisions.map((decision) => {
            const chosen = choices[decision.rawType] ?? "";
            const isSuggested =
              decision.suggestedTypeId !== null && chosen === decision.suggestedTypeId;
            return (
              <div
                key={decision.rawType}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold">{decision.rawType}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                    <span
                      className={cn(
                        "truncate text-base font-medium",
                        chosen ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {chosen ? labelFor(chosen) : "Choose a type"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isSuggested ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Sparkles className="h-3 w-3" aria-hidden />
                        Fusion’s suggestion
                      </span>
                    ) : decision.suggestedLabel ? (
                      <button
                        type="button"
                        className="underline-offset-2 hover:text-foreground hover:underline"
                        onClick={() =>
                          setChoices((previous) => ({
                            ...previous,
                            [decision.rawType]: decision.suggestedTypeId ?? "",
                          }))
                        }
                      >
                        Fusion suggested {decision.suggestedLabel}
                      </button>
                    ) : (
                      "Needs a type"
                    )}
                    <span aria-hidden> · </span>
                    Used by {decision.unitCount.toLocaleString()}{" "}
                    {decision.unitCount === 1 ? "unit" : "units"}
                  </p>
                </div>
                <NativeSelect
                  aria-label={`Type for ${decision.rawType}`}
                  className="h-9 w-[176px] text-sm"
                  value={chosen}
                  disabled={saving}
                  onChange={(event) =>
                    setChoices((previous) => ({
                      ...previous,
                      [decision.rawType]: event.target.value,
                    }))
                  }
                >
                  <NativeSelectOption value="">Choose a type</NativeSelectOption>
                  {typeOptions.map((type) => (
                    <NativeSelectOption key={type.id} value={type.id}>
                      {type.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button size="lg" disabled={saving || !allChosen} onClick={confirmAll}>
            <Check className="h-4 w-4" aria-hidden />
            {saving
              ? "Applying…"
              : decisions.length === 1
                ? "Confirm meaning"
                : allSuggested && allChosen
                  ? "Use these meanings"
                  : "Confirm meanings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommittedImport({ session }: { session: OrganizationImportSessionDto }) {
  const result = session.commitResult;
  return (
    <PageContainer className="space-y-8">
      <PageHeader title="Import structure" description="This import is complete." />
      <PagePermissionNotice
        title={result?.noChanges ? "Nothing new to add" : "Organization units added"}
        description={
          result?.noChanges
            ? `${session.source.originalFileName} matched the Organization on ${formatHumanDate(session.effectiveDate)}. No organizational changes were made.`
            : `${result?.createdUnits.length ?? 0} units were added, effective ${formatHumanDate(session.effectiveDate)}.`
        }
        action={
          <Button asChild>
            <Link href={`/organization?asOf=${encodeURIComponent(session.effectiveDate)}`}>
              View Organization
            </Link>
          </Button>
        }
      />
    </PageContainer>
  );
}

function DiscardedImport({ session }: { session: OrganizationImportSessionDto }) {
  return (
    <PageContainer className="space-y-8">
      <PageHeader title="Import structure" description="This import is no longer active." />
      <PagePermissionNotice
        title="Import discarded"
        description={`${session.source.originalFileName} can no longer be resumed. Its source has been removed.`}
        action={
          <Button asChild>
            <Link href="/organization/import">Start another import</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
