"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createPlatformApiClient,
  platformOrganizationsPaths,
  type CreatePlatformOrganizationRequest,
  type PlatformOrganizationCreatedDto,
  type PlatformOrganizationDetailDto,
  type PlatformOrganizationSummaryDto,
} from "@repo/api";
import type { Organization } from "../types/organization";
import {
  mapDetailToOrganization,
  mapSummaryToOrganization,
} from "../lib/map-platform-organization";

function mergeOrgList(
  prev: Organization[],
  next: Organization
): Organization[] {
  const i = prev.findIndex((o) => o.id === next.id);
  if (i < 0) return [next, ...prev];
  const copy = [...prev];
  copy[i] = { ...copy[i]!, ...next };
  return copy;
}

interface CreateOrgInput {
  name: string;
  adminEmail: string;
  adminName?: string;
  internalNotes?: string;
}

interface OrganizationsContextValue {
  organizations: Organization[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getById: (id: string) => Organization | undefined;
  /** Loads detail from API and merges into state (invite link, counts). */
  ensureOrganization: (id: string) => Promise<Organization | null>;
  createOrganization: (input: CreateOrgInput) => Promise<Organization>;
  suspendOrganization: (id: string) => Promise<void>;
  reactivateOrganization: (id: string) => Promise<void>;
  archiveOrganization: (id: string) => Promise<void>;
  resendFirstAdminInvite: (id: string) => Promise<void>;
  revokeFirstAdminInvites: (id: string) => Promise<void>;
}

const OrganizationsContext = createContext<OrganizationsContextValue | null>(
  null
);

export function OrganizationsProvider({ children }: { children: ReactNode }) {
  const client = useRef(createPlatformApiClient()).current;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rows = await client.get<PlatformOrganizationSummaryDto[]>(
        platformOrganizationsPaths.list()
      );
      setOrganizations(rows.map(mapSummaryToOrganization));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organizations.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getById = useCallback(
    (id: string) => organizations.find((o) => o.id === id),
    [organizations]
  );

  const ensureOrganization = useCallback(
    async (id: string): Promise<Organization | null> => {
      setError(null);
      try {
        const detail = await client.get<PlatformOrganizationDetailDto>(
          platformOrganizationsPaths.detail(id)
        );
        const mapped = mapDetailToOrganization(detail);
        setOrganizations((prev) => mergeOrgList(prev, mapped));
        return mapped;
      } catch {
        return null;
      }
    },
    [client]
  );

  const createOrganization = useCallback(
    async (input: CreateOrgInput): Promise<Organization> => {
      const parts = input.adminName?.trim().split(/\s+/) ?? [];
      const first = parts[0];
      const last = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
      const body: CreatePlatformOrganizationRequest = {
        name: input.name.trim(),
        firstAdminEmail: input.adminEmail.trim(),
        firstAdminFirstName: first,
        firstAdminLastName: last,
        internalNotes: input.internalNotes?.trim() || undefined,
      };
      const created = await client.post<PlatformOrganizationCreatedDto>(
        platformOrganizationsPaths.create(),
        body
      );
      const mapped = mapDetailToOrganization(created.organization);
      setOrganizations((prev) => mergeOrgList(prev, mapped));
      return mapped;
    },
    [client]
  );

  const suspendOrganization = useCallback(
    async (id: string) => {
      await client.post(platformOrganizationsPaths.suspend(id));
      await refresh();
    },
    [client, refresh]
  );

  const reactivateOrganization = useCallback(
    async (id: string) => {
      await client.post(platformOrganizationsPaths.reactivate(id));
      await refresh();
    },
    [client, refresh]
  );

  const archiveOrganization = useCallback(
    async (id: string) => {
      await client.post(platformOrganizationsPaths.archive(id));
      await refresh();
    },
    [client, refresh]
  );

  const resendFirstAdminInvite = useCallback(
    async (id: string) => {
      await client.post(platformOrganizationsPaths.resendFirstAdmin(id));
      await refresh();
    },
    [client, refresh]
  );

  const revokeFirstAdminInvites = useCallback(
    async (id: string) => {
      await client.post(platformOrganizationsPaths.revokeFirstAdmin(id));
      await refresh();
    },
    [client, refresh]
  );

  const value = useMemo(
    () => ({
      organizations,
      loading,
      error,
      refresh,
      getById,
      ensureOrganization,
      createOrganization,
      suspendOrganization,
      reactivateOrganization,
      archiveOrganization,
      resendFirstAdminInvite,
      revokeFirstAdminInvites,
    }),
    [
      organizations,
      loading,
      error,
      refresh,
      getById,
      ensureOrganization,
      createOrganization,
      suspendOrganization,
      reactivateOrganization,
      archiveOrganization,
      resendFirstAdminInvite,
      revokeFirstAdminInvites,
    ]
  );

  return (
    <OrganizationsContext.Provider value={value}>
      {children}
    </OrganizationsContext.Provider>
  );
}

export function useOrganizations() {
  const ctx = useContext(OrganizationsContext);
  if (!ctx) {
    throw new Error("useOrganizations must be used within OrganizationsProvider");
  }
  return ctx;
}
