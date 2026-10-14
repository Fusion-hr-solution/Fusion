"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { performanceQueryKeys } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { useApis } from "./use-performance";

const RECORD_CYCLE = /\/cycles\/([^/]+)\//;
type RecordCycleScopeState = { cycleId: string | null; setCycleId: (cycleId: string | null) => void };
const RecordCycleScopeContext = createContext<RecordCycleScopeState | null>(null);

/** Must wrap the workspace shell so its header and navigation share record-selected Cycle state. */
export function RecordCycleScopeProvider({ children }: { children: ReactNode }) {
  const [cycleId, setCycleId] = useState<string | null>(null);
  const value = { cycleId, setCycleId };
  return createElement(RecordCycleScopeContext.Provider, { value }, children);
}

/** Registers the Cycle that owns a loaded record with the workspace shell. */
export function RecordCycleScope({ cycleId, children }: { cycleId: string; children: ReactNode }) {
  const scope = useContext(RecordCycleScopeContext);
  const setCycleId = scope?.setCycleId;
  const clear = useCallback(() => setCycleId?.(null), [setCycleId]);
  useEffect(() => {
    setCycleId?.(cycleId);
    return clear;
  }, [clear, cycleId, setCycleId]);
  return children;
}

/**
 * The Cycle the workspace is looking at: a record address carries its own Cycle; any other page reads
 * `?cycle=`. Null means "the current Cycle", which the server resolves.
 */
export function useSelectedCycleId(): string | null {
  const recordCycleId = useContext(RecordCycleScopeContext)?.cycleId;
  const pathname = usePathname();
  const params = useSearchParams();
  const fromRecord = pathname.match(RECORD_CYCLE)?.[1];
  return recordCycleId ?? (fromRecord ? decodeURIComponent(fromRecord) : params.get("cycle"));
}

/** Overview for the selected Cycle: one server projection of the sections that apply to the caller. */
export function useOverview(enabled = true) {
  const { performance } = useApis();
  const cycleId = useSelectedCycleId();
  return useApiQuery(
    performanceQueryKeys.overview(cycleId),
    (signal) => performance.getOverview(cycleId, signal),
    { enabled }
  );
}

/** The server-composed workspace for the selected Cycle: switchable Cycles, capabilities, destinations. */
export function useWorkspaceContext(enabled = true) {
  const { performance } = useApis();
  const cycleId = useSelectedCycleId();
  return useApiQuery(
    performanceQueryKeys.workspaceContext(cycleId),
    (signal) => performance.getWorkspaceContext(cycleId, signal),
    { enabled }
  );
}
