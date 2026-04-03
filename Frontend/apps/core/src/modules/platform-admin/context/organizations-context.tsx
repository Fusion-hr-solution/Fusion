"use client";

/**
 * Organizations state (mock today).
 *
 * API integration:
 * - Replace `MOCK_ORGANIZATIONS` seed with `fetch` / React Query / server components.
 * - Swap `addOrganization`, `updateOrganization` for mutations that POST/PATCH your API.
 * - Use server-returned `id` (UUID/slug); avoid `Date.now()` in `slugifyId` when persisting.
 * - Map API DTOs ⇄ `Organization` in a dedicated mapper; keep UI types stable in `types/organization.ts`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MOCK_ORGANIZATIONS } from "../data/mock-organizations";
import type { Organization } from "../types/organization";

function slugifyId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `org-${base || "new"}-${Date.now().toString(36)}`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "OR";
}

function formatShortStamp(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCreatedDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface OrganizationsContextValue {
  organizations: Organization[];
  getById: (id: string) => Organization | undefined;
  addOrganization: (input: {
    name: string;
    adminEmail: string;
    adminName?: string;
    internalNotes?: string;
  }) => Organization;
  updateOrganization: (id: string, patch: Partial<Organization>) => void;
}

const OrganizationsContext = createContext<OrganizationsContextValue | null>(
  null
);

export function OrganizationsProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>(
    () => MOCK_ORGANIZATIONS
  );

  const getById = useCallback(
    (id: string) => organizations.find((o) => o.id === id),
    [organizations]
  );

  const addOrganization = useCallback(
    (input: {
      name: string;
      adminEmail: string;
      adminName?: string;
      internalNotes?: string;
    }): Organization => {
      const now = new Date();
      const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const adminLocal =
        input.adminName?.trim() ||
        input.adminEmail
          .split("@")[0]
          ?.replace(/\./g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()) ||
        "Administrator";

      const next: Organization = {
        id: slugifyId(input.name),
        name: input.name.trim(),
        initials: initialsFromName(input.name),
        lifecycle: "invited",
        adminStatus: "Awaiting Login",
        userCount: 0,
        pendingInvites: 1,
        lastActivity: null,
        createdAt: formatCreatedDate(now),
        description:
          "Enterprise workspace provisioned. Awaiting primary administrator acceptance.",
        internalNotes: input.internalNotes?.trim() || undefined,
        primaryAdminName: adminLocal,
        primaryAdminEmail: input.adminEmail.trim(),
        inviteSentAt: formatShortStamp(now),
        inviteExpiresAt: formatShortStamp(expires),
        onboardingProgressPercent: 25,
        onboardingStageTitle: "Awaiting Acceptance",
        onboardingStageSubtitle: "Next: Initial Login",
      };
      setOrganizations((prev) => [next, ...prev]);
      return next;
    },
    []
  );

  const updateOrganization = useCallback(
    (id: string, patch: Partial<Organization>) => {
      setOrganizations((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
      );
    },
    []
  );

  const value = useMemo(
    () => ({
      organizations,
      getById,
      addOrganization,
      updateOrganization,
    }),
    [organizations, getById, addOrganization, updateOrganization]
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
