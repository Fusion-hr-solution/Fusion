"use client";

import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import {
  fusionRecentStorageKey,
  readRecentRecords,
  rememberRecentRecord,
  type FusionModuleKey,
  type FusionNavigationViewer,
  type FusionRecentRecord,
} from "../fusion-navigation";

export interface FusionViewerState {
  viewer: FusionNavigationViewer | null;
  /** The session is still being restored. */
  isLoading: boolean;
}

const FusionViewerContext = createContext<FusionViewerState | null>(null);

/**
 * Makes the signed-in person available to the Fusion sidebar's renderers.
 * `AuthProvider` mounts it, so `@repo/ui`'s sidebar reads the viewer without
 * importing `@repo/auth` (which depends on `@repo/ui`).
 */
export function FusionViewerProvider({ value, children }: PropsWithChildren<{ value: FusionViewerState }>) {
  return <FusionViewerContext.Provider value={value}>{children}</FusionViewerContext.Provider>;
}

/** The viewer, or a signed-out, settled state when no provider is mounted. */
export function useFusionViewer(): FusionViewerState {
  return useContext(FusionViewerContext) ?? { viewer: null, isLoading: false };
}

const RECENT_CHANGED_EVENT = "fusion:recent:changed";

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The last records the viewer opened in `module`, newest first. Empty on the
 * server, before the session restores and when storage is unavailable; follows
 * registrations in this tab and in others.
 */
export function useRecentRecords(module: FusionModuleKey | null): FusionRecentRecord[] {
  const { viewer } = useFusionViewer();
  const key = viewer && module ? fusionRecentStorageKey(viewer, module) : null;
  const [records, setRecords] = useState<FusionRecentRecord[]>([]);

  useEffect(() => {
    if (!key) {
      setRecords([]);
      return;
    }
    const read = () => setRecords(readRecentRecords(browserStorage(), key));
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) read();
    };
    window.addEventListener(RECENT_CHANGED_EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(RECENT_CHANGED_EVENT, read);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  return records;
}

/**
 * Registers the record a page shows as the viewer's most recent in `module`.
 * Pass `null` until the record has loaded. Writes once per record path.
 */
export function useRecentRecord(module: FusionModuleKey, record: FusionRecentRecord | null): void {
  const { viewer } = useFusionViewer();
  const key = viewer ? fusionRecentStorageKey(viewer, module) : null;
  const href = record?.href;
  const label = record?.label;
  const kind = record?.kind;

  useEffect(() => {
    if (!key || !href || !label || !kind) return;
    rememberRecentRecord(browserStorage(), key, { href, label, kind });
    window.dispatchEvent(new Event(RECENT_CHANGED_EVENT));
  }, [key, href, label, kind]);
}
