"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@repo/auth";
import { createPlatformApiClient } from "@repo/api";
import type { TenantSummaryDto } from "@repo/api";

const TENANT_STORAGE_KEY = "ey_core_tenant_context";

export interface TenantContextValue {
  tenantId: string | null;
  tenantName: string | null;
  tenantStatus: string | null;
  isActive: boolean;
  isArchived: boolean;
  isReady: boolean;
  isLoading: boolean;
  setTenant: (tenantId: string) => void;
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

export function TenantContextProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [tenantId, setTenantIdState] = useState<string | null>(null);
  const [tenantSummary, setTenantSummary] = useState<TenantSummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const prevTenantIdRef = useRef<string | null>(null);

  const isPlatformAdmin = !!user?.roles.includes("PlatformAdmin");

  const setTenant = useCallback((id: string) => {
    prevTenantIdRef.current = id;
    setTenantIdState(id);
    storeTenantId(id);
  }, []);

  const clearTenant = useCallback(() => {
    prevTenantIdRef.current = null;
    setTenantIdState(null);
    setTenantSummary(null);
    setIsLoading(false);
    storeTenantId(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isPlatformAdmin) {
      clearTenant();
      return;
    }

    const urlTenantId = searchParams.get("tenantId");
    const storedId = loadStoredTenantId();
    const resolvedTenantId = urlTenantId || storedId;

    if (resolvedTenantId && resolvedTenantId !== prevTenantIdRef.current) {
      prevTenantIdRef.current = resolvedTenantId;
      setTenantIdState(resolvedTenantId);
      storeTenantId(resolvedTenantId);
    } else if (!urlTenantId && !storedId && tenantId) {
      clearTenant();
    }
  }, [clearTenant, isAuthenticated, isPlatformAdmin, pathname, searchParams, tenantId]);

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

    client.get<TenantSummaryDto>("/identity/tenant-context/tenant-summary")
      .then((data) => {
        if (!cancelled) {
          setTenantSummary(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTenantSummary(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, isPlatformAdmin]);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenantId,
      tenantName: tenantSummary?.name ?? null,
      tenantStatus: tenantSummary?.operationalStatus ?? null,
      isActive: tenantSummary?.isActive ?? false,
      isArchived: tenantSummary?.isArchived ?? false,
      isReady: !!tenantId && !!tenantSummary,
      isLoading,
      setTenant,
      clearTenant,
    }),
    [tenantId, tenantSummary, isLoading, setTenant, clearTenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenantContext must be used within a TenantContextProvider");
  }
  return ctx;
}
