"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@repo/api";

export type AutosaveStatus = "idle" | "saving" | "saved" | "conflict" | "error";

function isConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 409 || error.status === 412 || error.status === 428)
  );
}

/**
 * Single-flight serialized autosave for assessment drafts.
 *
 * Every save sends the latest known assignment version as If-Match and adopts
 * the version returned by the server, so saves are strictly ordered and never
 * race each other. `flush()` drains pending work and resolves the version a
 * follow-up mutation (submit, finalize) must send; it rejects if a save fails,
 * so submits can never run against unsaved or conflicted state.
 *
 * On a version conflict the queue parks (`status: "conflict"`) until the caller
 * reloads the workspace and calls `reset(freshVersion)` — discard-and-reload,
 * no merge attempts.
 */
export function useAssessmentAutosave<TResult>({
  save,
  versionOf,
  initialVersion,
  enabled = true,
  debounceMs = 800,
  onSaved,
}: {
  /** Performs the draft save with the given If-Match version; returns the server result. */
  save: (version: number) => Promise<TResult>;
  versionOf: (result: TResult) => number;
  initialVersion: number;
  enabled?: boolean;
  debounceMs?: number;
  onSaved?: (result: TResult) => void;
}) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");

  const versionRef = useRef(initialVersion);
  const dirtyRef = useRef(false);
  const activeRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<AutosaveStatus>("idle");

  const saveRef = useRef(save);
  const versionOfRef = useRef(versionOf);
  const onSavedRef = useRef(onSaved);
  const enabledRef = useRef(enabled);
  saveRef.current = save;
  versionOfRef.current = versionOf;
  onSavedRef.current = onSaved;
  enabledRef.current = enabled;

  const setStatusBoth = useCallback((next: AutosaveStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Runs exactly one save; throws on failure. Callers own follow-up chaining. */
  const runOneSave = useCallback(async () => {
    dirtyRef.current = false;
    setStatusBoth("saving");
    const run = (async () => {
      const result = await saveRef.current(versionRef.current);
      versionRef.current = versionOfRef.current(result);
      onSavedRef.current?.(result);
    })();
    activeRef.current = run.then(
      () => undefined,
      () => undefined
    );
    try {
      await run;
      setStatusBoth("saved");
    } catch (error) {
      if (isConflict(error)) {
        setStatusBoth("conflict");
      } else {
        dirtyRef.current = true; // retryable — next edit or flush tries again
        setStatusBoth("error");
      }
      throw error;
    } finally {
      activeRef.current = null;
    }
  }, [setStatusBoth]);

  const drain = useCallback(async () => {
    while (enabledRef.current && statusRef.current !== "conflict") {
      if (activeRef.current) {
        await activeRef.current;
        continue;
      }
      if (!dirtyRef.current) return;
      await runOneSave();
    }
  }, [runOneSave]);

  /** Debounced entry point: call after every draft edit. */
  const markDirty = useCallback(() => {
    if (!enabledRef.current || statusRef.current === "conflict") return;
    dirtyRef.current = true;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void drain().catch(() => {
        // status already reflects the failure; edits keep the dirty flag alive
      });
    }, debounceMs);
  }, [clearTimer, drain, debounceMs]);

  /** Drains pending saves and resolves the version the next mutation must send. */
  const flush = useCallback(async (): Promise<number> => {
    clearTimer();
    await drain();
    if (statusRef.current === "conflict") {
      throw new ApiError(409, "Conflict", ["The evaluation changed elsewhere."], null);
    }
    return versionRef.current;
  }, [clearTimer, drain]);

  /** Adopts a version from outside the save loop (initial load, refetch, submit response). */
  const reset = useCallback(
    (version: number) => {
      versionRef.current = version;
      dirtyRef.current = false;
      clearTimer();
      setStatusBoth("idle");
    },
    [clearTimer, setStatusBoth]
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { status, markDirty, flush, reset };
}
