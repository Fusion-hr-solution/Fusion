"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@repo/ds";
import { ChevronDown, FileUp, Trash2 } from "lucide-react";
import {
  translateWorkforceImportError,
  type WorkforceApplyStatusDto,
  type WorkforceImportSessionDto,
  type WorkforceInterpretationSummaryDto,
  type WorkforceReviewOutdatedResultDto,
  type WorkforceSemanticSuggestionDto,
} from "@repo/api";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";

import { ImportShell, ImportContentColumn, type ImportStep } from "./import-shell";
import { WorkforceInterpretation, type StagedDecisions } from "./workforce-interpretation";
import { WorkforceReviewWorkspace } from "./workforce-review-workspace";
import { WorkforceApplyState } from "./workforce-apply-state";
import { ImportProcessing } from "@/features/data-import/components/import-processing";
import { workforceOnrampConfig } from "@/features/data-import/model/import-descriptor";
import { useWorkforceApplyStatus, useWorkforceImportApi, useWorkforceImportSession } from "../api/use-workforce-import";

type Phase = "loading" | "preparing" | "interpret" | "review" | "applying" | "expired";

const STEP: Record<Phase, ImportStep> = {
  loading: "reading",
  preparing: "preparing",
  interpret: "understanding",
  review: "review",
  applying: "applying",
  expired: "source",
};

/**
 * The active import workspace, bound to one session. Reading → interpretation → review →
 * ready → applying all happen inside a single stable ImportShell; the work area changes,
 * the page never does. Deep-link/refresh safe: everything derives from the session id.
 */
export function WorkforceImportSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const api = useWorkforceImportApi();
  const sessionQuery = useWorkforceImportSession(sessionId);

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<WorkforceImportSessionDto | null>(null);
  const [interpretation, setInterpretation] = useState<WorkforceInterpretationSummaryDto | null>(null);
  const [suggestions, setSuggestions] = useState<WorkforceSemanticSuggestionDto[] | null>(null);
  const [suggestReason, setSuggestReason] = useState<string | null>(null);
  const [outdated, setOutdated] = useState<WorkforceReviewOutdatedResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const prepared = useRef(false);

  // Give the session a meaningful breadcrumb leaf instead of the generic "Details" fallback.
  useBreadcrumbLabel(sessionId, "Review");

  const applyStatus = useWorkforceApplyStatus(session?.id ?? null, phase === "applying");

  // Deterministic interpretation decides the phase — the same file always routes the same way, never
  // on whether the AI happened to answer. If deterministic interpretation resolves every required
  // field, we go straight to review; otherwise the Understand-columns step opens, where AI is offered
  // as an in-step assist the administrator stays in control of (spec §17), not a silent phase gate.
  const prepare = useCallback(
    async (s: WorkforceImportSessionDto) => {
      setPhase("preparing");
      try {
        const result = await api.prepare(s.id, s.version);
        const current = await api.session(s.id);
        setInterpretation(result.interpretation);
        setSession(current);
        const needsInterp =
          result.interpretation.nameFormatDecisionNeeded ||
          result.interpretation.dateFormatDecisionNeeded ||
          result.interpretation.unresolvedColumnIndexes.length > 0;
        setPhase(needsInterp ? "interpret" : "review");
      } catch (e) {
        setError(translateWorkforceImportError(e).message);
        setPhase("review");
      }
    },
    [api]
  );

  // Drive the session from its id: committed → People; expired → notice; otherwise prepare once.
  useEffect(() => {
    const loaded = sessionQuery.data;
    if (!loaded || prepared.current) return;
    if (loaded.status === "Committed") {
      router.replace(`/people?importBatch=${loaded.id}`);
      return;
    }
    if (loaded.status === "Expired") {
      setSession(loaded);
      setPhase("expired");
      return;
    }
    prepared.current = true;
    setSession(loaded);
    void prepare(loaded);
  }, [sessionQuery.data, prepare, router]);

  // Staged interpretation decisions are committed in one batch when the user continues to review,
  // so accepting a column read (manual or AI) is instant with no per-click round-trip.
  const onCommitDecisions = useCallback(
    async (staged: StagedDecisions) => {
      if (!session) return;
      const hasWork =
        Object.keys(staged.columnMappings).length > 0 || Boolean(staged.dateFormat) || Boolean(staged.nameFormat);
      if (!hasWork) {
        setPhase("review");
        return;
      }
      setBusy(true);
      try {
        await api.decide(session.id, session.version, {
          columnMappings: staged.columnMappings,
          dateFormat: staged.dateFormat,
          nameFormat: staged.nameFormat,
        });
        const refreshed = await api.session(session.id);
        await api.prepare(refreshed.id, refreshed.version);
        setSession(await api.session(refreshed.id));
        setPhase("review");
      } catch (e) {
        setError(translateWorkforceImportError(e).message);
      } finally {
        setBusy(false);
      }
    },
    [api, session]
  );

  const onSuggest = useCallback(async () => {
    if (!session) return;
    setSuggesting(true);
    try {
      const result = await api.suggestMeanings(session.id);
      if (result.available) {
        setSuggestions(result.suggestions);
        setSuggestReason(null);
      } else {
        setSuggestions([]);
        setSuggestReason(result.reason ?? "Suggestions aren't available right now. You can continue manually.");
      }
    } finally {
      setSuggesting(false);
    }
  }, [api, session]);

  // When the Understand-columns step opens with unresolved columns, read them once up front so each
  // column arrives already understood (a suggestion to accept), not as a blank "Choose meaning". The
  // phase stays deterministic; AI only fills the step's content, and manual controls remain if it's down.
  useEffect(() => {
    if (
      phase === "interpret" &&
      interpretation &&
      interpretation.unresolvedColumnIndexes.length > 0 &&
      suggestions === null &&
      !suggesting &&
      !suggestReason
    ) {
      void onSuggest();
    }
  }, [phase, interpretation, suggestions, suggesting, suggestReason, onSuggest]);

  const onCommit = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setOutdated(null);
    try {
      await api.commit(session.id, session.version);
      setPhase("applying");
    } catch (e) {
      setError(translateWorkforceImportError(e).message);
    } finally {
      setBusy(false);
    }
  }, [api, session]);

  const onFinishNoWork = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      await api.finish(session.id, session.version);
      router.push("/people");
    } catch (e) {
      setError(translateWorkforceImportError(e).message);
    } finally {
      setBusy(false);
    }
  }, [api, session, router]);

  // Replace the source in place when the row data itself is wrong — the fix belongs in the file, not in
  // a hundred inline edits (spec §32). The new source re-runs interpretation and lands back in review.
  const onReplaceSource = useCallback(
    async (file: File) => {
      if (!session) return;
      setError(null);
      setBusy(true);
      try {
        const updated = await api.replaceSource(session.id, session.version, file);
        setSession(updated);
        await prepare(updated);
      } catch (e) {
        setError(translateWorkforceImportError(e).message);
        setPhase("review");
      } finally {
        setBusy(false);
      }
    },
    [api, session, prepare]
  );

  const onDiscard = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      await api.discard(session.id, session.version);
      router.push("/people/import");
    } catch (e) {
      setError(translateWorkforceImportError(e).message);
      setBusy(false);
    }
  }, [api, session, router]);

  // React to the Apply operation while applying.
  useEffect(() => {
    const status = applyStatus.data;
    if (phase !== "applying" || !status || !session) return;
    if (status.status === "Succeeded") {
      router.push(`/people?importBatch=${session.id}`);
    } else if (status.status === "ReviewOutdated") {
      setOutdated(status.reviewOutdated ?? null);
      api.session(session.id).then(setSession);
      setPhase("review");
    }
  }, [applyStatus.data, phase, session, router, api]);

  const step = STEP[phase];
  const source = session ? { fileName: session.source.fileName } : null;
  // Source details / replace / discard — an escape hatch available whenever a source exists, so a
  // wrong or misaligned file is never a dead end (spec §33/§35A).
  const sourceMenu =
    session && phase !== "applying" ? (
      <SourceMenu source={session.source} busy={busy} onReplace={onReplaceSource} onDiscard={onDiscard} />
    ) : undefined;

  if (phase === "review" && session) {
    return (
      <ImportShell step={step} baseline={session.baselineDate} source={source} sourceActions={sourceMenu}>
        <WorkforceReviewWorkspace
          session={session}
          onSession={setSession}
          onCommit={onCommit}
          onFinishNoWork={onFinishNoWork}
          committing={busy}
          outdatedBanner={outdated ? <OutdatedBanner outdated={outdated} onDismiss={() => setOutdated(null)} /> : undefined}
        />
      </ImportShell>
    );
  }

  return (
    <ImportShell step={step} baseline={session?.baselineDate} source={source} sourceActions={sourceMenu}>
      {phase === "applying" && session ? (
        // Full-body so the loader is centered on the page, not inside the review column.
        <WorkforceApplyState
          status={applyStatus.data ?? DEFAULT_APPLY}
          onReturnToReview={() => setPhase("review")}
          onRetry={onCommit}
        />
      ) : phase === "expired" ? (
        <ImportContentColumn className="mx-auto w-full max-w-2xl">
          {error ? <p className="mb-4 type-meta text-[var(--color-destructive)]">{error}</p> : null}
          <ExpiredNotice onRestart={() => router.push("/people/import")} />
        </ImportContentColumn>
      ) : phase === "interpret" && session && interpretation ? (
        <ImportContentColumn className="mx-auto w-full max-w-2xl">
          {error ? <p className="mb-4 type-meta text-[var(--color-destructive)]">{error}</p> : null}
          <WorkforceInterpretation
            interpretation={interpretation}
            suggesting={suggesting}
            committing={busy}
            onSuggest={onSuggest}
            suggestions={suggestions}
            suggestionsUnavailableReason={suggestReason}
            onCommit={onCommitDecisions}
          />
        </ImportContentColumn>
      ) : (
        // The same staged processing hand-off the on-ramp shows, so Reading → Understanding → Review
        // is one continuous treatment rather than a second, different loader.
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
          <ImportProcessing
            phase="interpreting"
            fileName={session?.source.fileName ?? "your file"}
            copy={workforceOnrampConfig.processing}
          />
        </div>
      )}
    </ImportShell>
  );
}

const DEFAULT_APPLY: WorkforceApplyStatusDto = {
  status: "Queued", phase: "Preparing", processed: 0, total: null, result: null, reviewOutdated: null, message: null,
};

/**
 * Source details as a quiet header control: replace the file when the row data is wrong, or discard the
 * whole import — the two escape hatches that keep a misaligned source from being a dead end.
 */
function SourceMenu({
  source,
  busy,
  onReplace,
  onDiscard,
}: {
  source: WorkforceImportSessionDto["source"];
  busy: boolean;
  onReplace: (file: File) => void;
  onDiscard: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onReplace(file);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={busy} className="text-muted-foreground">
            Source details
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-2 py-1.5">
            <p className="type-meta text-muted-foreground">Source file</p>
            <p className="truncate type-label font-medium text-foreground">{source.fileName ?? "—"}</p>
            {source.selectedSheet ? (
              <p className="mt-0.5 type-meta text-muted-foreground">Sheet · {source.selectedSheet}</p>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={busy} onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden />
            Replace source…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => setDiscardOpen(true)}>
            <Trash2 className="size-4" aria-hidden />
            Discard import
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this import?</AlertDialogTitle>
            <AlertDialogDescription>
              The uploaded source and your review decisions will be removed. No employees have been added.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep import</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDiscard}>
              Discard import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ExpiredNotice({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="max-w-md py-6">
      <h2 className="type-title font-semibold text-foreground">This import has expired</h2>
      <p className="mt-1 type-body text-muted-foreground">
        The temporary workforce source was removed to protect employee data. No employees were added.
      </p>
      <Button className="mt-5" onClick={onRestart}>Start a new import</Button>
    </div>
  );
}

function OutdatedBanner({ outdated, onDismiss }: { outdated: WorkforceReviewOutdatedResultDto; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-warning)]/30 bg-[var(--color-warning-subtle)] px-6 py-2.5">
      <div>
        <p className="type-label font-medium text-foreground">A few items changed since your review</p>
        <p className="type-meta text-muted-foreground">
          {outdated.affectedCount} {outdated.affectedCount === 1 ? "decision needs" : "decisions need"} to be checked again.
          Your other decisions were preserved.
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground">Dismiss</Button>
    </div>
  );
}
