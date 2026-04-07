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
  type PlatformOrganizationPagedListDto,
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

type ListQueryInput = {
  skip: number;
  take: number;
  search?: string;
  filterByStatus?: Organization["lifecycle"] | undefined;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
};

interface OrganizationsContextValue {
  organizations: Organization[];
  totalCount: number;
  stats: {
    totalOrganizations: number;
    attentionNeeded: number;
    invitedPending: number;
    activeUserCount: number;
  } | null;
  loading: boolean;
  error: string | null;
  refresh: (override?: Partial<ListQueryInput>) => Promise<void>;
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
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<OrganizationsContextValue["stats"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listQueryRef = useRef<ListQueryInput>({
    skip: 0,
    take: 100,
    orderBy: "createdAt",
    orderDirection: "desc",
    search: undefined,
    filterByStatus: undefined,
  });

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const q = { ...listQueryRef.current };
      const paged = await client.get<PlatformOrganizationPagedListDto>(
        platformOrganizationsPaths.list(),
        {
          params: {
            skip: q.skip,
            take: q.take,
            search: q.search,
            orderBy: q.orderBy,
            orderDirection: q.orderDirection,
            filterByStatus: q.filterByStatus,
          },
        }
      );
      setOrganizations(paged.items.map(mapSummaryToOrganization));
      setTotalCount(paged.totalCount);
      setStats(paged.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organizations.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  const refreshWithOverride = useCallback(
    async (override?: Partial<ListQueryInput>) => {
      if (override) {
        listQueryRef.current = { ...listQueryRef.current, ...override };
      }
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    void refreshWithOverride();
  }, [refreshWithOverride]);

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
      await refreshWithOverride();
    },
    [client, refreshWithOverride]
  );

  const reactivateOrganization = useCallback(
    async (id: string) => {
      await client.post(platformOrganizationsPaths.reactivate(id));
      await refreshWithOverride();
    },
    [client, refreshWithOverride]
  );

  const archiveOrganization = useCallback(
    async (id: string) => {
      await client.post(platformOrganizationsPaths.archive(id));
      await refreshWithOverride();
    },
    [client, refreshWithOverride]
  );

  const resendFirstAdminInvite = useCallback(
    async (id: string) => {
      await client.post(platformOrganizationsPaths.resendFirstAdmin(id));
      await refreshWithOverride();
    },
    [client, refreshWithOverride]
  );

  const revokeFirstAdminInvites = useCallback(
    async (id: string) => {
      await client.post(platformOrganizationsPaths.revokeFirstAdmin(id));
      await refreshWithOverride();
    },
    [client, refreshWithOverride]
  );

  const value = useMemo(
    () => ({
      organizations,
      totalCount,
      stats,
      loading,
      error,
      refresh: refreshWithOverride,
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
      totalCount,
      stats,
      loading,
      error,
      refreshWithOverride,
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
