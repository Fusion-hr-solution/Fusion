"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { coreSetupQueryKeys, type TenantSetupStateDto } from "@repo/api";
import { useApiQueryClient } from "@repo/api/query";
import { canSeeCoreSetupNavigation, useAuth } from "@repo/auth";
import { useTenantContext } from "@/components/core-tenant-context-provider";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { useSetupState } from "@/app/(pages)/setup/use-setup";
import {
  resolveSetupEntryRouteAction,
  SETUP_DRAFT_ENTRY_PATH,
  SETUP_SUMMARY_PATH,
} from "@/app/(pages)/setup/setup-entry-routing";

const SETUP_LOCK_REASON = "Complete setup to unlock the rest of Core.";

interface CoreSetupAccessContextValue {
  shouldCheckSetupAccess: boolean;
  setupState: TenantSetupStateDto | undefined;
  setupError: Error | null;
  isShellLoading: boolean;
  isSetupStateLoading: boolean;
  isSetupLocked: boolean;
  isNavigationLocked: boolean;
  lockedNavigationReason: string | null;
  refreshSetupAccess: () => Promise<void>;
}

const CoreSetupAccessContext = createContext<CoreSetupAccessContextValue>({
  shouldCheckSetupAccess: false,
  setupState: undefined,
  setupError: null,
  isShellLoading: false,
  isSetupStateLoading: false,
  isSetupLocked: false,
  isNavigationLocked: false,
  lockedNavigationReason: null,
  refreshSetupAccess: async () => {},
});

function getCorePathname(pathname: string): string {
  const nextPath = pathname.replace(/^\/core/, "");
  return nextPath || "/";
}

function isSetupComplete(setupState: TenantSetupStateDto | undefined): boolean {
  return (
    setupState?.currentPhase === "operational" ||
    setupState?.currentPhase === "structurallyPublished"
  );
}

function SetupRedirectFallback({ isChecking }: { isChecking: boolean }) {
  return (
    <CorePageLoadingState
      title="Setup"
      description="Complete organization setup before using the rest of the workspace."
      message={isChecking ? "Loading setup..." : "Opening setup..."}
      variant="redirect"
    />
  );
}

export function CoreSetupAccessProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { tenantId } = useTenantContext();
  const queryClient = useApiQueryClient();
  const shouldCheckSetupAccess =
    !isAuthLoading &&
    isAuthenticated &&
    (canSeeCoreSetupNavigation(user) || !!tenantId);
  const {
    data: setupState,
    error: setupError,
    isLoading: isSetupStateLoading,
  } = useSetupState(shouldCheckSetupAccess);
  const isSetupAccessPending =
    shouldCheckSetupAccess && !setupState && !setupError;

  const refreshSetupAccess = useCallback(() => {
    if (!shouldCheckSetupAccess) {
      return Promise.resolve();
    }

    return queryClient.invalidateQueries({
      queryKey: coreSetupQueryKeys.state(),
      exact: true,
    });
  }, [queryClient, shouldCheckSetupAccess]);

  const value = useMemo<CoreSetupAccessContextValue>(() => {
    const isSetupLocked =
      shouldCheckSetupAccess &&
      !isSetupAccessPending &&
      !setupError &&
      !isSetupComplete(setupState);

    return {
      shouldCheckSetupAccess,
      setupState,
      setupError,
      isShellLoading: isAuthLoading || isSetupAccessPending,
      isSetupStateLoading,
      isSetupLocked,
      isNavigationLocked: shouldCheckSetupAccess && isSetupLocked,
      lockedNavigationReason: isSetupLocked ? SETUP_LOCK_REASON : null,
      refreshSetupAccess,
    };
  }, [
    shouldCheckSetupAccess,
    setupError,
    setupState,
    isAuthLoading,
    isSetupAccessPending,
    isSetupStateLoading,
    refreshSetupAccess,
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
  const { shouldCheckSetupAccess, isShellLoading, isSetupLocked, setupState } =
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

  if (shouldHoldRoute) {
    return <SetupRedirectFallback isChecking={isShellLoading} />;
  }

  return <>{children}</>;
}
