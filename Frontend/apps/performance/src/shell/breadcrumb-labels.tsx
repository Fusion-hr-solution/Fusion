"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BreadcrumbLabelRegistry = {
  labels: ReadonlyMap<string, string>;
  register: (segment: string, label: string) => void;
  unregister: (segment: string, label: string) => void;
};

const EMPTY_LABELS: ReadonlyMap<string, string> = new Map();

const BreadcrumbLabelContext = createContext<BreadcrumbLabelRegistry | null>(
  null
);

/**
 * Session-scoped registry mapping dynamic route segments (round ids, participant
 * ids) to human labels, so breadcrumbs never show raw identifiers. Pages register
 * labels as their data arrives via useBreadcrumbLabel.
 */
export function BreadcrumbLabelProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(
    EMPTY_LABELS
  );

  const register = useCallback((segment: string, label: string) => {
    setLabels((prev) => {
      if (prev.get(segment) === label) return prev;
      const next = new Map(prev);
      next.set(segment, label);
      return next;
    });
  }, []);

  const unregister = useCallback((segment: string, label: string) => {
    setLabels((prev) => {
      if (prev.get(segment) !== label) return prev;
      const next = new Map(prev);
      next.delete(segment);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ labels, register, unregister }),
    [labels, register, unregister]
  );

  return (
    <BreadcrumbLabelContext.Provider value={value}>
      {children}
    </BreadcrumbLabelContext.Provider>
  );
}

export function useBreadcrumbLabels(): ReadonlyMap<string, string> {
  return useContext(BreadcrumbLabelContext)?.labels ?? EMPTY_LABELS;
}

/** Registers a label for a dynamic segment while the calling page is mounted. */
export function useBreadcrumbLabel(
  segment: string | null | undefined,
  label: string | null | undefined
) {
  const registry = useContext(BreadcrumbLabelContext);
  const register = registry?.register;
  const unregister = registry?.unregister;

  useEffect(() => {
    if (!register || !unregister || !segment || !label) return;
    register(segment, label);
    return () => unregister(segment, label);
  }, [register, unregister, segment, label]);
}
