"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ds";
import {
  translateWorkforceImportError,
  type WorkforceApplyStatusDto,
  type WorkforceImportSessionDto,
  type WorkforceInterpretationSummaryDto,
  type WorkforceReviewOutdatedResultDto,
  type WorkforceSemanticSuggestionDto,
} from "@repo/api";

import { ImportShell, ImportContentColumn, type ImportStep } from "./import-shell";
import { WorkforceInterpretation, type StagedDecisions } from "./workforce-interpretation";
import { WorkforceReviewWorkspace } from "./workforce-review-workspace";
import { WorkforceApplyState } from "./workforce-apply-state";
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
  const [understanding, setUnderstanding] = useState<string>("Reading employee data");
  const prepared = useRef(false);

  const applyStatus = useWorkforceApplyStatus(session?.id ?? null, phase === "applying");

  // Fusion understands the source automatically. Deterministic interpretation runs first; when it
  // leaves column meanings unresolved, semantic assistance runs and confident mappings are accepted
  // into the proposal without the administrator ever operating the interpretation engine. Only
  // genuinely ambiguous meaning (or a name/date-format choice) falls through to Needs input.
  const prepare = useCallback(
    async (s: WorkforceImportSessionDto) => {
      setPhase("preparing");
      setUnderstanding("Reading employee data");
      try {
        let result = await api.prepare(s.id, s.version);
        let current = await api.session(s.id);

        if (result.interpretation.unresolvedColumnIndexes.length > 0) {
          setUnderstanding("Understanding the columns");
          const suggested = await api.suggestMeanings(s.id).catch(() => null);
          const mappings: Record<number, string> = {};
          if (suggested?.available) {
            for (const suggestion of suggested.suggestions) mappings[suggestion.columnIndex] = suggestion.targetField;
          }
          if (Object.keys(mappings).length > 0) {
            setUnderstanding("Resolving organization and reporting");
            await api.decide(current.id, current.version, { columnMappings: mappings });
            current = await api.session(current.id);
            result = await api.prepare(current.id, current.version);
            current = await api.session(current.id);
          }
          if (!suggested?.available) setSuggestReason(suggested?.reason ?? null);
        }

        setUnderstanding("Preparing review");
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

  if (phase === "review" && session) {
    return (
      <ImportShell step={step} baseline={session.baselineDate} source={source}>
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
    <ImportShell step={step} baseline={session?.baselineDate} source={source}>
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
        // Full-body so the processing state is centered on the page, like the applying loader.
        <UnderstandingState status={understanding} />
      )}
    </ImportShell>
  );
}

const DEFAULT_APPLY: WorkforceApplyStatusDto = {
  status: "Queued", phase: "Preparing", processed: 0, total: null, result: null, reviewOutdated: null, message: null,
};

const UNDERSTANDING_STEPS = [
  "Reading employee data",
  "Understanding the columns",
  "Resolving organization and reporting",
  "Preparing review",
];

/**
 * One stable processing state — never a blank flash or a bare spinner. The heading holds while the
 * quiet sub-status tracks the real operation; the steps ahead are shown dim so the surface has a
 * calm, bounded shape rather than a fake percentage.
 */
function UnderstandingState({ status }: { status: string }) {
  const currentIndex = Math.max(0, UNDERSTANDING_STEPS.indexOf(status));
  return (
    // Fills the shell's flex body so the state is centered on both axes of the page,
    // not within a narrow left-aligned content column.
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex items-center gap-2.5">
          <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
          <h2 className="type-title font-semibold text-foreground">Understanding your workforce</h2>
        </div>
        <p className="mt-1.5 type-body text-muted-foreground">
          Reading the employee data, understanding the columns, and preparing work and reporting relationships.
        </p>
        <ol className="mt-6 space-y-2" aria-live="polite">
          {UNDERSTANDING_STEPS.map((label, index) => {
            const state = index < currentIndex ? "done" : index === currentIndex ? "active" : "todo";
            return (
              <li key={label} className="flex items-center justify-center gap-2.5 type-meta">
                <span
                  aria-hidden
                  className={
                    state === "done"
                      ? "size-1.5 rounded-full bg-primary"
                      : state === "active"
                        ? "size-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none"
                        : "size-1.5 rounded-full border border-[var(--color-border)]"
                  }
                />
                <span className={state === "todo" ? "text-muted-foreground/50" : "text-muted-foreground"}>{label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
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
