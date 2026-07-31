"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Where the learner currently is, for the Academy Assistant (AI-L-1).
 * The course player publishes its active chapter here; the root-mounted assistant reads it
 * to auto-scope `search_course_content`. Null = not reading a chapter (global mode).
 */
export interface AssistantScope {
  trainingId: string;
  chapterId: string;
}

interface ScopeContextValue {
  scope: AssistantScope | null;
  setScope: (scope: AssistantScope | null) => void;
}

const AssistantScopeContext = createContext<ScopeContextValue | null>(null);

export function AssistantScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<AssistantScope | null>(null);
  const value = useMemo(() => ({ scope, setScope }), [scope]);
  return (
    <AssistantScopeContext.Provider value={value}>{children}</AssistantScopeContext.Provider>
  );
}

/** The assistant's current scope (null outside a chapter). */
export function useAssistantScope(): AssistantScope | null {
  return useContext(AssistantScopeContext)?.scope ?? null;
}

/** Publish a scope while the caller is mounted; clears it on change/unmount. */
export function usePublishAssistantScope(scope: AssistantScope | null): void {
  const setScope = useContext(AssistantScopeContext)?.setScope;
  const trainingId = scope?.trainingId;
  const chapterId = scope?.chapterId;

  useEffect(() => {
    if (!setScope) return;
    setScope(trainingId && chapterId ? { trainingId, chapterId } : null);
    return () => setScope(null);
  }, [setScope, trainingId, chapterId]);
}
