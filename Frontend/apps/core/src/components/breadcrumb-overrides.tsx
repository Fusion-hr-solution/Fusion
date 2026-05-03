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

const BreadcrumbOverridesContext =
  createContext<BreadcrumbOverridesContextType | null>(null);

export function BreadcrumbOverridesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [overrides, setOverrides] = useState<OverridesMap>(new Map());

  const setOverride = useCallback((segment: string, label: string) => {
    setOverrides((prev) => new Map(prev).set(segment, label));
  }, []);

  const clearOverride = useCallback((segment: string) => {
    setOverrides((prev) => {
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
    <BreadcrumbOverridesContext.Provider value={value}>
      {children}
    </BreadcrumbOverridesContext.Provider>
  );
}

function useBreadcrumbOverrides() {
  const ctx = useContext(BreadcrumbOverridesContext);
  if (!ctx)
    throw new Error(
      "useBreadcrumbOverrides must be used within BreadcrumbOverridesProvider"
    );
  return ctx;
}

/**
 * Register a friendly label for a path segment (e.g. an employee ID → employee name).
 * Automatically cleared when the component unmounts.
 */
export function useBreadcrumbLabel(segment: string, label: string | undefined) {
  const { setOverride, clearOverride } = useBreadcrumbOverrides();

  useEffect(() => {
    if (!segment || !label) return;
    setOverride(segment, label);
    return () => clearOverride(segment);
  }, [clearOverride, label, segment, setOverride]);
}

export function useBreadcrumbOverridesMap(): OverridesMap {
  const ctx = useContext(BreadcrumbOverridesContext);
  return ctx?.overrides ?? new Map();
}
