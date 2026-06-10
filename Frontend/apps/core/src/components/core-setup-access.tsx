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
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { useSetupState } from "@/features/setup/api/use-setup";

const SETUP_LOCK_REASON =
  "Complete organization setup before using the rest of the workspace.";

interface CoreSetupAccessContextValue {
  shouldCheckSetupAccess: boolean;
  setupState: TenantSetupStateDto | undefined;
  setupError: Error | null;
  isShellLoading: boolean;
  isSetupStateLoading: boolean;
  isSetupLocked: boolean;
  isNavigationLocked: boolean;
  lockedNavigationReason: string | null;
  refreshSetupAccess: () => void;
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
  refreshSetupAccess: () => {},
});

function getCorePathname(pathname: string): string {
  const nextPath = pathname.replace(/^\/core/, "");
  return nextPath || "/";
}

function isSetupAreaPath(pathname: string): boolean {
  return pathname === "/setup" || pathname.startsWith("/setup/");
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
  const queryClient = useApiQueryClient();
  const shouldCheckSetupAccess =
    !isAuthLoading && isAuthenticated && canSeeCoreSetupNavigation(user);
  const {
    data: setupState,
    error: setupError,
    isLoading: isSetupStateLoading,
  } = useSetupState(shouldCheckSetupAccess);
  const isSetupAccessPending =
    shouldCheckSetupAccess && !setupState && !setupError;

  const refreshSetupAccess = useCallback(() => {
    if (!shouldCheckSetupAccess) {
      return;
    }

    void queryClient.invalidateQueries({
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
  const { shouldCheckSetupAccess, isShellLoading, isSetupLocked } =
    useCoreSetupAccess();
  const currentPath = getCorePathname(pathname);
  const isSetupPage = isSetupAreaPath(currentPath);
  const shouldHoldRoute = shouldCheckSetupAccess && !isSetupPage && isSetupLocked;

  useEffect(() => {
    if (!shouldCheckSetupAccess || !isSetupLocked || isSetupPage) {
      return;
    }

    router.replace("/setup");
  }, [shouldCheckSetupAccess, isSetupLocked, isSetupPage, router]);

  if (shouldHoldRoute) {
    return <SetupRedirectFallback isChecking={isShellLoading} />;
  }

  return <>{children}</>;
}
