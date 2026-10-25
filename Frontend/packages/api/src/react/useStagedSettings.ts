"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../types";

/**
 * How many values differ between two settings snapshots: every leaf that changed counts once. A list of records
 * (rating levels) counts per record; a list of plain values (groups turned off) counts as one value. Keys in
 * `ignore` (a version, a computed field) never count.
 */
export function countChanges(saved: unknown, draft: unknown, ignore: readonly string[] = []): number {
  if (Object.is(saved, draft)) return 0;
  const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  if (Array.isArray(saved) && Array.isArray(draft) && saved.length === draft.length && saved.every(isObject) && draft.every(isObject)) {
    return saved.reduce<number>((count, item, index) => count + countChanges(item, draft[index], ignore), 0);
  }
  if (isObject(saved) && isObject(draft)) {
    const keys = new Set([...Object.keys(saved), ...Object.keys(draft)]);
    let count = 0;
    for (const key of keys) {
      if (!ignore.includes(key)) count += countChanges(saved[key], draft[key], ignore);
    }
    return count;
  }
  return JSON.stringify(saved) === JSON.stringify(draft) ? 0 : 1;
}

/** A save refused because someone else saved the section first. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export interface StagedSettings<T> {
  /** The values on screen: the staged edit, else the saved values. */
  draft: T | undefined;
  /** Stages an edit. */
  update: (change: (draft: T) => T) => void;
  changes: number;
  dirty: boolean;
  discard: () => void;
  /** Saves the staged edit. Resolves true when saved; a conflict or error is kept in state. */
  submit: () => Promise<boolean>;
  saving: boolean;
  /** Someone else saved first; the edit is kept until the person reloads. */
  conflict: boolean;
  /** Any other failure of the last save. */
  error: unknown;
  /** Drops the edit and loads what was saved. */
  reload: () => void;
}

export interface UseStagedSettingsOptions {
  /** Keys that never count as a change (a version). */
  ignore?: readonly string[];
  /** Fetches the saved values again, used by `reload`. */
  onReload?: () => unknown;
  /** Asked before leaving with staged edits. */
  leaveMessage?: string;
}

const DEFAULT_LEAVE_MESSAGE = "Leave without saving? Your changes are discarded.";

/**
 * Staged edits for one company settings section (B-071 D4). The page shows `draft`, stages changes with `update`
 * and offers the save bar while `dirty`. Leaving the page, by link or by closing the tab, asks first.
 */
export function useStagedSettings<T>(
  saved: T | undefined,
  save: (draft: T) => Promise<unknown>,
  options: UseStagedSettingsOptions = {},
): StagedSettings<T> {
  const [edit, setEdit] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const draft = edit ?? saved;
  const changes = edit && saved !== undefined ? countChanges(saved, edit, options.ignore) : 0;
  const dirty = changes > 0;
  const leaveMessage = options.leaveMessage ?? DEFAULT_LEAVE_MESSAGE;

  const update = useCallback(
    (change: (current: T) => T) => {
      setError(null);
      setEdit((current) => {
        const base = current ?? saved;
        return base === undefined ? current : change(base);
      });
    },
    [saved],
  );

  const discard = useCallback(() => {
    setEdit(null);
    setError(null);
    setConflict(false);
  }, []);

  const submit = useCallback(async () => {
    if (!edit || !dirty) return true;
    setSaving(true);
    setError(null);
    try {
      await save(edit);
      setEdit(null);
      return true;
    } catch (failure) {
      if (isConflict(failure)) setConflict(true);
      else setError(failure);
      return false;
    } finally {
      setSaving(false);
    }
  }, [edit, dirty, save]);

  const { onReload } = options;
  const reload = useCallback(() => {
    setEdit(null);
    setConflict(false);
    setError(null);
    onReload?.();
  }, [onReload]);

  useLeaveGuard(dirty, leaveMessage);

  return { draft, update, changes, dirty, discard, submit, saving, conflict, error, reload };
}

/** While `active`, closing the tab or following a link away asks first. */
function useLeaveGuard(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin === window.location.origin && next.pathname === window.location.pathname) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [active, message]);
}
