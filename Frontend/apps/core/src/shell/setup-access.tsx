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
import { usePathname, useRouter } from "next/navigation";
import { coreSetupQueryKeys, type TenantSetupStateDto } from "@repo/api";
import { useApiQueryClient } from "@repo/api/query";
import { canSeeCoreSetupNavigation, useAuth } from "@repo/auth";
import { PageContainer, PageHeader, PageLoading } from "@repo/ds/shell";
import { getRoutePageSkeleton } from "@/shell/route-skeletons";
import {
  useActivateSetup,
  usePublishStructure,
  useReopenStructure,
  useSetupState,
  type VersionedSetupMutationArgs,
} from "@/features/setup/api/use-setup";
import {
  isSetupAreaPath,
  resolveSetupEntryRouteAction,
  SETUP_SUMMARY_PATH,
} from "@/features/setup/setup-entry-routing";

const SETUP_LOCK_REASON = "Complete setup to unlock the rest of Core.";

type SetupTransitionKind = "activating" | "publishing" | "reopening";

interface CoreSetupAccessContextValue {
  shouldCheckSetupAccess: boolean;
  setupState: TenantSetupStateDto | undefined;
  setupError: Error | null;
  /** Auth is hydrating or the setup-state query is in flight — access decisions are not yet known. */
  isAccessResolving: boolean;
  isSetupStateLoading: boolean;
  isSetupLocked: boolean;
  isNavigationLocked: boolean;
  lockedNavigationReason: string | null;
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
  isSetupLocked: false,
  isNavigationLocked: false,
  lockedNavigationReason: null,
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

function getCorePathname(pathname: string): string {
  const nextPath = pathname.replace(/^\/core/, "");
  return nextPath || "/";
}

function isSetupComplete(setupState: TenantSetupStateDto | undefined): boolean {
  return !!setupState?.hasPublishedStructure;
}

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

function SetupRedirectFallback() {
  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Setup"
        description="Complete organization setup before using the rest of the workspace."
      />
      <PageLoading rows={6} label="Opening setup..." />
    </PageContainer>
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
    const isSetupLocked =
      shouldCheckSetupAccess &&
      !isSetupAccessPending &&
      !effectiveSetupError &&
      !isSetupComplete(effectiveSetupState);

    return {
      shouldCheckSetupAccess,
      setupState: effectiveSetupState,
      setupError: effectiveSetupError,
      isAccessResolving: isAuthLoading || isSetupAccessPending,
      isSetupStateLoading,
      isSetupLocked,
      isNavigationLocked: shouldCheckSetupAccess && isSetupLocked,
      lockedNavigationReason: isSetupLocked ? SETUP_LOCK_REASON : null,
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

export function CoreSetupRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { shouldCheckSetupAccess, isAccessResolving, isSetupLocked } =
    useCoreSetupAccess();
  const currentPath = getCorePathname(pathname);
  const routeAction = resolveSetupEntryRouteAction({
    currentPath,
    shouldCheckSetupAccess,
    isSetupLocked,
  });
  const shouldHoldRoute = routeAction === "redirect-to-setup-summary";

  useEffect(() => {
    if (routeAction !== "redirect-to-setup-summary") {
      return;
    }

    router.replace(SETUP_SUMMARY_PATH);
  }, [routeAction, router]);

  // The setup area is always permitted — render immediately, even while
  // access is still resolving.
  if (isSetupAreaPath(currentPath)) {
    return <>{children}</>;
  }

  // Fail closed: until auth + setup state are known, hold non-setup routes on
  // the route's own dedicated skeleton — the same one the page renders while
  // its data loads — so the hold and the page read as ONE loading state.
  if (isAccessResolving) {
    return <>{getRoutePageSkeleton(currentPath)}</>;
  }

  if (shouldHoldRoute) {
    return <SetupRedirectFallback />;
  }

  return <>{children}</>;
}
