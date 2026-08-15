"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  ListChecks,
  MoreHorizontal,
  RefreshCw,
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
  type OrganizationImportSemanticReviewedItem,
  type OrganizationImportSessionDto,
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
  const [commitOpen, setCommitOpen] = useState(false);
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

  if (sessionQuery.isLoading)
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader title="Import structure" description="Loading your import." />
        <PageSkeleton rows={4} label="Loading import" />
      </PageContainer>
    );
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
      commitOpen={commitOpen}
      setCommitOpen={setCommitOpen}
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
    <div className="flex h-[calc(100dvh-4rem)] min-h-[640px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Spinner className="size-6" aria-hidden />
      <p>Completing import…</p>
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
  commitOpen,
  setCommitOpen,
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
  commitOpen: boolean;
  setCommitOpen: (open: boolean) => void;
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
  const attention = useMemo(() => attentionByNode(issues), [issues]);
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
    } else if (selection.kind === "suggestions" && assistance?.state !== "Available") {
      setSelection({ kind: "none" });
    }
  }, [assistance?.state, review, issues, selection, setSelection]);

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
      setCommitOpen(false);
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
      setCommitOpen(false);
      onRefetch();
    }
  }

  async function retrySuggestions() {
    if (!assistance?.inputFingerprint) return;
    const requestKey = `${session.id}:${assistance.inputFingerprint}`;
    generatedRequestRef.current = requestKey;
    setFailedRequestKey(null);
    try {
      await mutations.generateSuggestions.mutateAsync({
        id: session.id,
        inputFingerprint: assistance.inputFingerprint,
        retry: true,
      });
      onRefetch();
    } catch (error) {
      toast.error("Suggestions could not be retried", {
        description: translateOrganizationImportError(error).message,
      });
      setFailedRequestKey(requestKey);
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
    } catch (error) {
      toast.error("Suggestions were not applied", {
        description: translateOrganizationImportError(error).message,
      });
      onRefetch();
    }
  }

  function openIssues() {
    if (issues.length === 1 && issues[0]) setSelection(issueTarget(issues[0]));
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

  const canCommit = review?.canCommit ?? false;
  const createCount = review?.createCount ?? 0;
  const existingCount = review?.existingCount ?? 0;
  const isNoop = canCommit && createCount === 0;
  const blockerCount = issues.filter((issue) => issue.severity === "Blocker").length;
  const hasBlocker = issues.some((issue) => issue.severity === "Blocker");

  const selectedId = selection.kind === "unit" ? selection.nodeId : null;
  const highlightedIds = useMemo(() => {
    if (selection.kind === "issue") {
      const issue = issues.find((candidate) => candidate.key === selection.key);
      return new Set(issue?.nodeIds ?? []);
    }
    return new Set<string>();
  }, [selection, issues]);

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[640px] flex-col overflow-hidden">
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
          {review ? (
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
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {assistance?.state === "Eligible" && assistance.inputFingerprint &&
                failedRequestKey === `${session.id}:${assistance.inputFingerprint}` ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted/70 px-2.5 py-1 text-sm text-muted-foreground"
                    role="status"
                  >
                    Suggestions unavailable
                    <button
                      type="button"
                      className="font-medium text-foreground hover:underline disabled:opacity-50"
                      disabled={mutations.generateSuggestions.isLoading}
                      onClick={() => void retrySuggestions()}
                    >
                      Retry
                    </button>
                  </span>
                ) : assistance?.state === "Pending" ||
                (assistance?.state === "Eligible" && mutations.generateSuggestions.isLoading) ? (
                  <span
                    className="inline-flex items-center gap-2 rounded-lg bg-muted/70 px-2.5 py-1 text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <Spinner className="size-3.5" aria-hidden />
                    Interpreting unfamiliar organization terms…
                  </span>
                ) : assistance?.state === "Available" ? (
                  <button
                    type="button"
                    onClick={() => setSelection({ kind: "suggestions" })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ListChecks className="h-4 w-4" aria-hidden />
                    {assistance.suggestions.length} suggestions to review
                  </button>
                ) : assistance?.state === "Failed" ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted/70 px-2.5 py-1 text-sm text-muted-foreground"
                    role="status"
                  >
                    Suggestions unavailable
                    <button
                      type="button"
                      className="font-medium text-foreground hover:underline disabled:opacity-50"
                      disabled={mutations.generateSuggestions.isLoading || Boolean(assistance.retryAfter && new Date(assistance.retryAfter) > new Date())}
                      onClick={() => void retrySuggestions()}
                    >
                      Retry
                    </button>
                  </span>
                ) : null}
                {issues.length > 0 ? (
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
                    Needs attention · {issues.length}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {!review || !tree ? (
        <div className="flex-1 p-6">
          <PageSkeleton rows={5} label="Building Organization proposal" />
        </div>
      ) : (
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
                issues={issues}
                saving={mutations.replaceDecisions.isLoading}
                applyingSuggestions={mutations.applySuggestions.isLoading}
                onSelect={setSelection}
                onSave={(decisions) => void saveDecisions(decisions)}
                onApplySuggestions={(items) => void applySuggestions(items)}
                onExcludeNode={requestExclude}
                onClose={() => setSelection({ kind: "none" })}
              />
            </aside>
          ) : null}
        </div>
      )}

      {review ? (
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-background px-6 py-3">
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
                  : `${blockerCount} things need your attention before you can finish.`
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
            <Button onClick={() => setCommitOpen(true)}>Complete import</Button>
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

      <AlertDialog open={commitOpen} onOpenChange={setCommitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete import?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block text-base text-foreground">
                <span className="font-semibold">
                  {createCount} organizational {createCount === 1 ? "unit" : "units"}
                </span>{" "}
                will be added, effective{" "}
                <span className="font-semibold">{formatHumanDate(session.effectiveDate)}</span>.
              </span>
              <span className="mt-1.5 block">Later changes are managed from Organization.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back to review</AlertDialogCancel>
            <AlertDialogAction disabled={mutations.commit.isLoading} onClick={() => void complete()}>
              {mutations.commit.isLoading ? "Completing…" : "Complete import"}
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
