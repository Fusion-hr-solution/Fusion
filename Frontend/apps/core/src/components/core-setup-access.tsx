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
import type { TenantSetupStateDto } from "@repo/api";
import { canSeeCoreSetupNavigation, useAuth } from "@repo/auth";
import { PageHeader } from "@/components/page-header";
import { Spinner } from "@/components/ui/spinner";
import { useSetupState } from "@/app/(pages)/setup/use-setup";

const SETUP_LOCK_REASON = "Complete organization setup before using the rest of the workspace.";
const SETUP_LOADING_REASON = "Checking setup access...";

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
    <div className="flex min-h-full flex-col gap-6 p-6">
      <PageHeader
        title="Setup required"
        description="Complete organization setup before using the rest of the workspace."
      />
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {isChecking ? <Spinner /> : <Lock className="size-4" />}
          <span>{isChecking ? "Checking setup access..." : "Taking you to Setup..."}</span>
        </div>
      </div>
    </div>
  );
}

export function CoreSetupAccessProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const shouldCheckSetupAccess =
    isAuthenticated && canSeeCoreSetupNavigation(user);
  const {
    data: setupState,
    error: setupError,
    isLoading: isSetupStateLoading,
    refetch: refetchSetupState,
  } = useSetupState(shouldCheckSetupAccess);

  const refreshSetupAccess = useCallback(() => {
    if (!shouldCheckSetupAccess) {
      return;
    }

    refetchSetupState();
  }, [shouldCheckSetupAccess, refetchSetupState]);

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
      isNavigationLocked: shouldCheckSetupAccess && (isSetupStateLoading || isSetupLocked),
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
  const {
    shouldCheckSetupAccess,
    isSetupStateLoading,
    isSetupLocked,
  } = useCoreSetupAccess();
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