import type {
  BootstrapInvitationSummary,
  ProvisionableModule,
  TenantDetail,
  TenantHistoryEntry,
} from "@/features/tenants/api";

/**
 * The shapes the tenant tests build on.
 *
 * Shared so a contract change surfaces as one compile error rather than as
 * several test files quietly describing different tenants.
 */

export const TENANT_ID = "8230f988-b9ae-41ac-b7d6-290fd932cb66";

/** What the service accepts today: Core HR always, Performance optionally. */
export const ACCEPTED_MODULES: ProvisionableModule[] = [
  { module: "CoreHR", mandatory: true },
  { module: "Performance", mandatory: false },
];

export function anInvitation(
  overrides: Partial<BootstrapInvitationSummary> = {}
): BootstrapInvitationSummary {
  return {
    invitationId: "b1f0c5de-1f6e-4a5c-9a1e-6b1d7c2f9a30",
    email: "admin@atlas.example",
    state: "Pending",
    expiresAt: "2026-08-08T09:00:00Z",
    createdAt: "2026-08-01T09:00:00Z",
    lastDelivery: {
      outcome: "Sent",
      attemptedAt: "2026-08-01T09:01:00Z",
      failureCode: null,
    },
    allowedActions: ["resend", "revoke", "replace"],
    ...overrides,
  };
}

export function anEvent(
  eventType: string,
  occurredAt: string,
  overrides: Partial<TenantHistoryEntry> = {}
): TenantHistoryEntry {
  return {
    eventType,
    occurredAt,
    outcome: "Succeeded",
    reason: null,
    actorName: null,
    ...overrides,
  };
}

export function aTenant(overrides: Partial<TenantDetail> = {}): TenantDetail {
  return {
    tenantId: TENANT_ID,
    name: "Atlas Group",
    slug: "atlas-group",
    isActive: true,
    administratorActivationStatus: "AwaitingAdministratorActivation",
    locale: "en-GB",
    timeZone: "Europe/London",
    createdAt: "2026-08-01T09:00:00Z",
    modules: ["CoreHR"],
    bootstrapInvitation: null,
    history: [],
    ...overrides,
  };
}
