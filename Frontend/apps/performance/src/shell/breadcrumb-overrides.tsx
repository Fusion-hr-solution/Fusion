"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type OverridesMap = Map<string, string>;

interface BreadcrumbOverridesContextType {
  overrides: OverridesMap;
  setOverride: (segment: string, label: string) => void;
  clearOverride: (segment: string) => void;
}

const BreadcrumbOverridesContext = createContext<BreadcrumbOverridesContextType | null>(null);

/**
 * Holds friendly labels for dynamic path segments (e.g. an objective id → its title) so the
 * shell breadcrumb never shows a raw UUID. Mirrors Core's provider; mounted once in the
 * Performance (pages) layout.
 */
export function BreadcrumbOverridesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<OverridesMap>(new Map());

  const setOverride = useCallback((segment: string, label: string) => {
    setOverrides((prev) => {
      if (prev.get(segment) === label) return prev;
      return new Map(prev).set(segment, label);
    });
  }, []);

  const clearOverride = useCallback((segment: string) => {
    setOverrides((prev) => {
      if (!prev.has(segment)) return prev;
      const next = new Map(prev);
      next.delete(segment);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ overrides, setOverride, clearOverride }),
    [overrides, setOverride, clearOverride]
  );

  return (
    <BreadcrumbOverridesContext.Provider value={value}>{children}</BreadcrumbOverridesContext.Provider>
  );
}

/**
 * Register a friendly label for a path segment. Cleared automatically when the component
 * unmounts. Safe to call even when no provider is mounted (renders as a no-op).
 */
export function useBreadcrumbLabel(segment: string, label: string | undefined) {
  const ctx = useContext(BreadcrumbOverridesContext);

  useEffect(() => {
    if (!ctx || !segment || !label) return;
    ctx.setOverride(segment, label);
    return () => ctx.clearOverride(segment);
  }, [ctx, segment, label]);
}

export function useBreadcrumbOverridesMap(): OverridesMap {
  const ctx = useContext(BreadcrumbOverridesContext);
  return ctx?.overrides ?? new Map();
}
