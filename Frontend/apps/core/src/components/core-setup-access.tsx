"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { Lock } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { coreSetupQueryKeys, type TenantSetupStateDto } from "@repo/api";
import { useApiQueryClient } from "@repo/api/query";
import { canSeeCoreSetupNavigation, useAuth } from "@repo/auth";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { useSetupState } from "@/app/(pages)/setup/use-setup";

const SETUP_LOCK_REASON =
  "Complete organization setup before using the rest of the workspace.";
const SETUP_LOADING_REASON = "Loading setup...";

interface CoreSetupAccessContextValue {
  shouldCheckSetupAccess: boolean;
  isSetupStateLoading: boolean;
  isSetupLocked: boolean;
  isNavigationLocked: boolean;
  lockedNavigationReason: string | null;
  refreshSetupAccess: () => void;
}

const CoreSetupAccessContext = createContext<CoreSetupAccessContextValue>({
  shouldCheckSetupAccess: false,
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
      title="Setup required"
      description="Complete organization setup before using the rest of the workspace."
      message={isChecking ? "Loading setup..." : "Redirecting to setup..."}
      variant="redirect"
    />
  );
}

export function CoreSetupAccessProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useApiQueryClient();
  const shouldCheckSetupAccess =
    isAuthenticated && canSeeCoreSetupNavigation(user);
  const {
    data: setupState,
    error: setupError,
    isLoading: isSetupStateLoading,
  } = useSetupState(shouldCheckSetupAccess);

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
      !isSetupStateLoading &&
      !setupError &&
      !isSetupComplete(setupState);

    return {
      shouldCheckSetupAccess,
      isSetupStateLoading,
      isSetupLocked,
      isNavigationLocked:
        shouldCheckSetupAccess && (isSetupStateLoading || isSetupLocked),
      lockedNavigationReason: shouldCheckSetupAccess
        ? isSetupStateLoading
          ? SETUP_LOADING_REASON
          : isSetupLocked
            ? SETUP_LOCK_REASON
            : null
        : null,
      refreshSetupAccess,
    };
  }, [
    shouldCheckSetupAccess,
    isSetupStateLoading,
    refreshSetupAccess,
    setupError,
    setupState,
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
  const { shouldCheckSetupAccess, isSetupStateLoading, isSetupLocked } =
    useCoreSetupAccess();
  const currentPath = getCorePathname(pathname);
  const isSetupPage = isSetupAreaPath(currentPath);
  const shouldHoldRoute =
    shouldCheckSetupAccess &&
    !isSetupPage &&
    (isSetupStateLoading || isSetupLocked);

  useEffect(() => {
    if (!shouldCheckSetupAccess || !isSetupLocked || isSetupPage) {
      return;
    }

    router.replace("/setup");
  }, [shouldCheckSetupAccess, isSetupLocked, isSetupPage, router]);

  if (shouldHoldRoute) {
    return <SetupRedirectFallback isChecking={isSetupStateLoading} />;
  }

  return <>{children}</>;
}
