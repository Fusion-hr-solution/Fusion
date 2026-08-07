"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { coreSetupQueryKeys, type TenantSetupStateDto } from "@repo/api";
import { useApiQueryClient } from "@repo/api/query";
import {
  CUSTOMER_MODULES,
  canSeeCoreSetupNavigation,
  hasModuleEntitlement,
  useAuth,
} from "@repo/auth";
import {
  useActivateSetup,
  usePublishStructure,
  useReopenStructure,
  useSetupState,
  type VersionedSetupMutationArgs,
} from "@/features/setup/api/use-setup";
type SetupTransitionKind = "activating" | "publishing" | "reopening";

interface CoreSetupAccessContextValue {
  shouldCheckSetupAccess: boolean;
  setupState: TenantSetupStateDto | undefined;
  setupError: Error | null;
  /** Auth is hydrating or the setup-state query is in flight — access decisions are not yet known. */
  isAccessResolving: boolean;
  isSetupStateLoading: boolean;
  setupTransitionKind: SetupTransitionKind | null;
  startSetup: () => Promise<TenantSetupStateDto>;
  publishSetup: (
    args: VersionedSetupMutationArgs
  ) => Promise<TenantSetupStateDto>;
  reopenSetup: (
    args: VersionedSetupMutationArgs
  ) => Promise<TenantSetupStateDto>;
  refreshSetupAccess: () => Promise<void>;
}

const CoreSetupAccessContext = createContext<CoreSetupAccessContextValue>({
  shouldCheckSetupAccess: false,
  setupState: undefined,
  setupError: null,
  isAccessResolving: false,
  isSetupStateLoading: false,
  setupTransitionKind: null,
  startSetup: async () => {
    throw new Error("Setup access is unavailable.");
  },
  publishSetup: async () => {
    throw new Error("Setup access is unavailable.");
  },
  reopenSetup: async () => {
    throw new Error("Setup access is unavailable.");
  },
  refreshSetupAccess: async () => {},
});

function haveEquivalentSetupSnapshots(
  left: TenantSetupStateDto | undefined,
  right: TenantSetupStateDto | undefined
) {
  if (!left || !right) {
    return false;
  }

  return (
    left.version === right.version &&
    left.currentPhase === right.currentPhase &&
    left.canStartSetup === right.canStartSetup &&
    left.hasPublishedStructure === right.hasPublishedStructure &&
    left.isDraftCycleActive === right.isDraftCycleActive &&
    left.requiresRepublish === right.requiresRepublish &&
    left.publishedStructureVersion === right.publishedStructureVersion
  );
}

export function CoreSetupAccessProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useApiQueryClient();
  const [setupStateOverride, setSetupStateOverride] =
    useState<TenantSetupStateDto>();
  const [setupTransitionKind, setSetupTransitionKind] =
    useState<SetupTransitionKind | null>(null);
  const shouldCheckSetupAccess =
    !isAuthLoading &&
    isAuthenticated &&
    hasModuleEntitlement(user, CUSTOMER_MODULES.coreHr) &&
    canSeeCoreSetupNavigation(user);
  const {
    data: setupState,
    error: setupError,
    isLoading: isSetupStateLoading,
  } = useSetupState(shouldCheckSetupAccess);
  const activateSetupMutation = useActivateSetup();
  const publishStructureMutation = usePublishStructure();
  const reopenStructureMutation = useReopenStructure();
  const effectiveSetupState = setupStateOverride ?? setupState;
  const effectiveSetupError = setupStateOverride ? null : setupError;
  const isSetupAccessPending =
    shouldCheckSetupAccess && !effectiveSetupState && !effectiveSetupError;

  useEffect(() => {
    if (
      setupStateOverride &&
      haveEquivalentSetupSnapshots(setupStateOverride, setupState)
    ) {
      setSetupStateOverride(undefined);
    }
  }, [setupState, setupStateOverride]);

  useEffect(() => {
    if (shouldCheckSetupAccess) {
      return;
    }

    setSetupStateOverride(undefined);
    setSetupTransitionKind(null);
  }, [shouldCheckSetupAccess]);

  const refreshSetupAccess = useCallback(() => {
    if (!shouldCheckSetupAccess) {
      return Promise.resolve();
    }

    return queryClient.refetchQueries({
      queryKey: coreSetupQueryKeys.state(),
      exact: true,
    });
  }, [queryClient, shouldCheckSetupAccess]);

  const startSetup = useCallback(async () => {
    setSetupTransitionKind("activating");

    try {
      const nextState = await activateSetupMutation.mutateAsync();
      setSetupStateOverride(nextState);
      return nextState;
    } finally {
      setSetupTransitionKind(null);
    }
  }, [activateSetupMutation]);

  const publishSetup = useCallback(
    async (args: VersionedSetupMutationArgs) => {
      setSetupTransitionKind("publishing");

      try {
        const nextState = await publishStructureMutation.mutateAsync(args);
        setSetupStateOverride(nextState);
        return nextState;
      } finally {
        setSetupTransitionKind(null);
      }
    },
    [publishStructureMutation]
  );

  const reopenSetup = useCallback(
    async (args: VersionedSetupMutationArgs) => {
      setSetupTransitionKind("reopening");

      try {
        const nextState = await reopenStructureMutation.mutateAsync(args);
        setSetupStateOverride(nextState);
        return nextState;
      } finally {
        setSetupTransitionKind(null);
      }
    },
    [reopenStructureMutation]
  );

  const value = useMemo<CoreSetupAccessContextValue>(() => {
    return {
      shouldCheckSetupAccess,
      setupState: effectiveSetupState,
      setupError: effectiveSetupError,
      isAccessResolving: isAuthLoading || isSetupAccessPending,
      isSetupStateLoading,
      setupTransitionKind,
      startSetup,
      publishSetup,
      reopenSetup,
      refreshSetupAccess,
    };
  }, [
    effectiveSetupError,
    effectiveSetupState,
    shouldCheckSetupAccess,
    isAuthLoading,
    isSetupAccessPending,
    isSetupStateLoading,
    publishSetup,
    refreshSetupAccess,
    reopenSetup,
    setupTransitionKind,
    startSetup,
  ]);

  return (
    <CoreSetupAccessContext.Provider value={value}>
      {children}
    </CoreSetupAccessContext.Provider>
  );
}

export function useCoreSetupAccess() {
  return useContext(CoreSetupAccessContext);
}

/**
 * Renders tenant pages without gating them on setup completion.
 *
 * The previous behaviour redirected every route back to setup until the org
 * structure was published, which meant a new administrator could not reach
 * Access to invite a colleague until they had finished the work alone. A
 * destination that genuinely depends on another foundation now says so in its
 * own words, where the user tries to act.
 */
export function CoreSetupRouteGuard({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
