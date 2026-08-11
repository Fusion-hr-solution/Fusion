"use client";

import { useEffect, useState } from "react";
import { createCoreOrganizationApi, createPlatformApiClient } from "@repo/api";
import type { AuthUser } from "./types";
import {
  landingRequiresOrganizationReadiness,
  type OrganizationReadinessSignal,
} from "./routing";

/**
 * Reads canonical Organization readiness for the landing decision.
 *
 * Browser-only and one-shot: it runs on the shell origin where the session
 * token and the `/api` → Gateway proxy exist. Any failure maps to `null`
 * (unknown) so the caller fails closed to Getting Started rather than asserting
 * an operational state. This is the single place that couples routing to the
 * readiness contract; it creates no second source of truth.
 */
export async function fetchOrganizationReadySignal(): Promise<boolean | null> {
  try {
    const api = createCoreOrganizationApi(createPlatformApiClient());
    const readiness = await api.readiness();
    return readiness.isReady;
  } catch {
    return null;
  }
}

export interface OrganizationReadyLanding {
  /** True while a required readiness read is still resolving. */
  pending: boolean;
  /** Canonical readiness signal, or `undefined` when no read was required. */
  organizationReady: OrganizationReadinessSignal;
}

/**
 * Resolves the canonical Organization readiness that the ordinary landing
 * decision needs, and only when it needs it.
 *
 * A readiness read happens once for the Tenant Administrator foundation case;
 * every other user (and any caller that already has a safe callback and passes
 * `skip`) resolves immediately with no read. Entry points keep their existing
 * loading state while `pending`, then redirect with
 * `resolveDefaultProductDestination(user, { organizationReady })`.
 */
export function useOrganizationReadyLanding({
  user,
  isLoading,
  skip = false,
}: {
  user: AuthUser | null;
  isLoading: boolean;
  /** Skip the read entirely, e.g. when a safe callback already decided. */
  skip?: boolean;
}): OrganizationReadyLanding {
  const [signal, setSignal] = useState<OrganizationReadinessSignal>(undefined);
  const [resolved, setResolved] = useState(false);

  const required =
    !isLoading && !skip && landingRequiresOrganizationReadiness(user);
  const userKey = user?.userId ?? null;
  const tenantKey = user?.tenantId ?? null;

  useEffect(() => {
    if (!required) {
      return;
    }

    let active = true;
    setResolved(false);
    void fetchOrganizationReadySignal().then((next) => {
      if (active) {
        setSignal(next);
        setResolved(true);
      }
    });

    return () => {
      active = false;
    };
  }, [required, userKey, tenantKey]);

  if (isLoading) {
    return { pending: true, organizationReady: undefined };
  }

  if (required && !resolved) {
    return { pending: true, organizationReady: undefined };
  }

  return { pending: false, organizationReady: required ? signal : undefined };
}
