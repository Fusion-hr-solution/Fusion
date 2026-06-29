"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@repo/auth";
import {
  coreAccessQueryKeys,
  coreSetupQueryKeys,
  coreWorkforceQueryKeys,
  createPlatformApiClient,
  draftStructureQueryKeys,
  tenantSettingsQueryKeys,
  type TenantSummaryDto,
} from "@repo/api";
import { useApiQueryClient } from "@repo/api/query";

const TENANT_STORAGE_KEY = "ey_core_tenant_context";

export interface TenantContextValue {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantStatus: string | null;
  isActive: boolean;
  isArchived: boolean;
  isReady: boolean;
  isLoading: boolean;
  setTenant: (tenantId: string) => void;
  setTenantBySlug: (slug: string) => void;
  clearTenant: () => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

function loadStoredTenantId(): string | null {
  try {
    return sessionStorage.getItem(TENANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTenantId(id: string | null): void {
  try {
    if (id) {
      sessionStorage.setItem(TENANT_STORAGE_KEY, id);
    } else {
      sessionStorage.removeItem(TENANT_STORAGE_KEY);
    }
  } catch {
    /* noop */
  }
}

export function TenantContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useApiQueryClient();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [tenantId, setTenantIdState] = useState<string | null>(() =>
    loadStoredTenantId()
  );
  const [tenantSlug, setTenantSlugState] = useState<string | null>(null);
  const [tenantSummary, setTenantSummary] = useState<TenantSummaryDto | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const prevTenantIdRef = useRef<string | null>(null);
  const failedTenantIdRef = useRef<string | null>(null);

  const isPlatformAdmin = !!user?.roles.includes("PlatformAdmin");

  const clearTenantScopedQueries = useCallback(() => {
    const queryRoots = [
      ["corehr"] as const,
      coreAccessQueryKeys.all(),
      coreWorkforceQueryKeys.all(),
      coreSetupQueryKeys.all(),
      tenantSettingsQueryKeys.all(),
      draftStructureQueryKeys.all(),
    ];

    queryRoots.forEach((queryKey) => {
      void queryClient.cancelQueries({ queryKey });
      queryClient.removeQueries({ queryKey });
    });
  }, [queryClient]);

  const activateTenant = useCallback(
    (id: string) => {
      failedTenantIdRef.current = null;
      prevTenantIdRef.current = id;
      setTenantSummary(null);
      setIsLoading(true);
      clearTenantScopedQueries();
      setTenantIdState(id);
      storeTenantId(id);
    },
    [clearTenantScopedQueries]
  );

  const setTenant = useCallback(
    (id: string) => {
      activateTenant(id);
    },
    [activateTenant]
  );

  const setTenantBySlug = useCallback(
    async (slug: string) => {
      try {
        const client = createPlatformApiClient();
        const summary = await client.get<TenantSummaryDto>(
          `/identity/tenant-context/by-slug/${slug}`
        );
        if (summary?.tenantId) {
          activateTenant(summary.tenantId);
          setTenantSlugState(slug);
        }
      } catch {
        failedTenantIdRef.current = slug;
      }
    },
    [activateTenant]
  );

  const clearTenant = useCallback(() => {
    failedTenantIdRef.current = null;
    prevTenantIdRef.current = null;
    setTenantIdState(null);
    setTenantSummary(null);
    setIsLoading(false);
    clearTenantScopedQueries();
    storeTenantId(null);
  }, [clearTenantScopedQueries]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated || !isPlatformAdmin) {
      clearTenant();
      return;
    }

    const urlSlug = searchParams.get("tenant");
    const urlTenantId = searchParams.get("tenantId");
    const storedId = loadStoredTenantId();
    const resolvedTenantId = urlTenantId || storedId;

    if (urlSlug && urlSlug !== failedTenantIdRef.current) {
      if (urlSlug !== tenantSlug) {
        setTenantBySlug(urlSlug);
      }
      return;
    }

    if (resolvedTenantId === failedTenantIdRef.current) {
      return;
    }

    if (resolvedTenantId && resolvedTenantId !== prevTenantIdRef.current) {
      activateTenant(resolvedTenantId);
    } else if (!urlTenantId && !urlSlug && !storedId && tenantId) {
      clearTenant();
    }
  }, [
    activateTenant,
    clearTenant,
    setTenantBySlug,
    isAuthenticated,
    isAuthLoading,
    isPlatformAdmin,
    pathname,
    searchParams,
    tenantId,
    tenantSlug,
  ]);

  useEffect(() => {
    if (!tenantId || !isPlatformAdmin) {
      setTenantSummary(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const client = createPlatformApiClient({
      getTenantId: () => tenantId,
    });

    client
      .get<TenantSummaryDto>("/identity/tenant-context/tenant-summary")
      .then((data) => {
        if (!cancelled) {
          setTenantSummary(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          failedTenantIdRef.current = tenantId;
          prevTenantIdRef.current = null;
          setTenantIdState(null);
          setTenantSummary(null);
          setIsLoading(false);
          clearTenantScopedQueries();
          storeTenantId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearTenantScopedQueries, tenantId, isPlatformAdmin]);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenantId,
      tenantSlug: tenantSummary?.slug ?? tenantSlug,
      tenantName: tenantSummary?.name ?? null,
      tenantStatus: tenantSummary?.operationalStatus ?? null,
      isActive: tenantSummary?.isActive ?? false,
      isArchived: tenantSummary?.isArchived ?? false,
      isReady: !!tenantId && !!tenantSummary,
      isLoading,
      setTenant,
      setTenantBySlug,
      clearTenant,
    }),
    [tenantId, tenantSlug, tenantSummary, isLoading, setTenant, setTenantBySlug, clearTenant]
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error(
      "useTenantContext must be used within a TenantContextProvider"
    );
  }
  return ctx;
}
