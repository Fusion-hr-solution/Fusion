import type { AuthUser } from "@repo/auth";
import type { CoreHRReadinessDto, OrganizationReadinessDto } from "@repo/api";
import { englishSay, type Say } from "@repo/ds/lib/say";
import { englishMessages } from "@/i18n/messages";
import {
  SETUP_CAPABILITIES,
  type CapabilityGroup,
  type SetupCapability,
} from "./catalog";

/**
 * What a capability row says about itself.
 *
 * These stay separate rather than collapsing into one status because they answer
 * different questions: `planned` means nobody can do this yet, `blocked` means
 * you can't do it *until* something else, and `unknown` means we could not find
 * out — which must never be presented as either of the other two.
 */
export type CapabilityState =
  | "available"
  | "not-started"
  | "in-progress"
  | "ready"
  | "planned"
  | "blocked"
  | "not-included"
  | "unknown";

export interface ComposedCapability {
  capability: SetupCapability;
  state: CapabilityState;
  /** Title of the capability this one waits on, when blocked. */
  blockedBy: string | null;
  /** Real progress from the owning capability. Never invented here. */
  detail: string | null;
  /** True only when the route exists, the user may enter, and nothing blocks it. */
  isActionable: boolean;
}

export interface ComposeInput {
  user: AuthUser | null;
  entitlements: string[];
  /** Owned by Core HR. `undefined` while loading, `null` when it failed to load. */
  setupState: OrganizationReadinessDto | null | undefined;
  /** Canonical employee total. `undefined` while loading, `null` when unavailable. */
  workforceTotalCount: number | null | undefined;
  /** Server-owned CoreHR readiness: the authority on whether the workforce is established and sound. */
  coreHRReadiness?: CoreHRReadinessDto | null;
  /** Workforce Access distribution. `undefined` loading, `null` failed/unavailable. */
  workforceAccessSummary?:
    | { activeAccountCount: number; invitePendingCount: number; notInvitedCount: number }
    | null;
  /** Count of active tenant administrators. `undefined` loading, `null` unavailable. */
  administratorCount?: number | null;
  capabilities?: SetupCapability[];
  /** Words details and prerequisite names (`setup` namespace); English by default. */
  say?: Say;
}

const ENGLISH = englishSay(englishMessages, "setup");

/** A capability's name in the person's language; one the catalogue doesn't know keeps its own title. */
export function capabilityTitle(capability: SetupCapability, say: Say = ENGLISH): string {
  const key = `capabilities.${capability.key}.title`;
  const word = say(key);
  return word === `setup.${key}` || word === key ? capability.title : word;
}

export type LaunchpadVariant =
  | "fresh"
  | "underway"
  | "mature"
  | "indeterminate";

/** Core HR owns this truth; the launchpad only reads it. */
function organizationStateOf(
  setupState: OrganizationReadinessDto | null | undefined,
  say: Say
): { state: CapabilityState; detail: string | null } {
  if (setupState === undefined) {
    return { state: "unknown", detail: null };
  }

  if (setupState === null) {
    return { state: "unknown", detail: null };
  }

  if (setupState.isReady) {
    return { state: "ready", detail: say("detail.organizationReady") };
  }

  if (setupState.hasPermanentRoot) {
    return {
      state: "in-progress",
      detail: setupState.permanentRootFirstEffectiveDate
        ? say("detail.scheduledFor", { date: setupState.permanentRootFirstEffectiveDate })
        : say("detail.organizationEstablished"),
    };
  }

  return { state: "not-started", detail: null };
}

export function composeSetupCapabilities({
  user,
  entitlements,
  setupState,
  workforceTotalCount,
  coreHRReadiness,
  workforceAccessSummary,
  administratorCount,
  capabilities = SETUP_CAPABILITIES,
  say = ENGLISH,
}: ComposeInput): ComposedCapability[] {
  const ordered = [...capabilities].sort((a, b) => a.order - b.order);
  const byKey = new Map<string, ComposedCapability>();
  const visible: ComposedCapability[] = [];

  for (const capability of ordered) {
    const entry = resolve(capability);
    // Prerequisites still resolve against it, so a capability the reader cannot
    // see never silently unblocks the ones that depend on it.
    byKey.set(capability.key, entry);

    // Fail closed by omission: an unauthorized reader is told nothing about this
    // capability at all, rather than being shown a row explaining what they are
    // missing out on.
    if (capability.isAuthorized(user)) {
      visible.push(entry);
    }
  }

  return visible;

  function resolve(capability: SetupCapability): ComposedCapability {
    // Entitlement first: an excluded module is not unfinished setup, so it must
    // not be described in the vocabulary of work that remains.
    if (
      capability.requiresEntitlement &&
      !entitlements.includes(capability.requiresEntitlement)
    ) {
      return base(capability, "not-included");
    }

    if (capability.availability === "planned") {
      const unmet = firstUnmetPrerequisite(capability);
      return {
        ...base(capability, "planned"),
        blockedBy: unmet ? capabilityTitle(unmet.capability, say) : null,
      };
    }

    const unmet = firstUnmetPrerequisite(capability);
    if (unmet) {
      return {
        ...base(capability, unmet.state === "unknown" ? "unknown" : "blocked"),
        blockedBy: capabilityTitle(unmet.capability, say),
      };
    }

    if (capability.key === "organization") {
      const { state, detail } = organizationStateOf(setupState, say);
      return {
        ...base(capability, state),
        detail,
        isActionable: state !== "unknown",
      };
    }

    if (capability.key === "workforce") {
      // CoreHR decides whether the workforce is established: people are active, placed in a
      // valid unit, and their reporting lines are sound. Setup state is never stored elsewhere.
      if (coreHRReadiness) {
        const { workforce } = coreHRReadiness;
        const problems = workforce.withoutCurrentAssignment + workforce.assignedToInactiveUnit + workforce.withInvalidManager + workforce.inManagerCycle;
        const state =
          workforce.activeEmployees === 0
            ? workforce.importInProgress ? "in-progress" : "not-started"
            : problems > 0 ? "in-progress" : "ready";
        const detail =
          workforce.activeEmployees === 0
            ? workforce.importInProgress ? say("detail.importInProgress") : undefined
            : problems > 0
              ? say("detail.needAttention", { count: problems })
              : say("detail.active", { count: workforce.activeEmployees });
        return { ...base(capability, state), ...(detail ? { detail } : {}), isActionable: true };
      }
      if (workforceTotalCount === undefined || workforceTotalCount === null) {
        return {
          ...base(capability, "unknown"),
          // A failed progress read does not make the known, authorized roster
          // destination unsafe. Keep the route while declining to invent state.
          isActionable: true,
        };
      }

      return {
        ...base(
          capability,
          workforceTotalCount > 0 ? "ready" : "not-started"
        ),
        isActionable: true,
      };
    }

    if (capability.key === "workforce-access") {
      // Authoritative distribution from Workforce Access. A failed read keeps the
      // route but declines to invent counts (no fake "tenant complete" score).
      if (workforceAccessSummary === undefined || workforceAccessSummary === null) {
        return { ...base(capability, "available"), isActionable: true };
      }
      const { activeAccountCount, invitePendingCount, notInvitedCount } =
        workforceAccessSummary;
      const detail =
        say("detail.withAccess", { count: activeAccountCount }) +
        (invitePendingCount > 0 ? ` · ${say("detail.pending", { count: invitePendingCount })}` : "") +
        (notInvitedCount > 0 ? ` · ${say("detail.without", { count: notInvitedCount })}` : "");
      return {
        ...base(capability, activeAccountCount > 0 ? "ready" : "in-progress"),
        detail,
        isActionable: true,
      };
    }

    if (capability.key === "administrator-access") {
      // A reader who can see this row is, by authorization, a tenant
      // administrator — so access is established the moment this page renders.
      // The count refines the detail; a failed read keeps it ready without one.
      if (administratorCount === undefined) {
        return { ...base(capability, "unknown"), isActionable: true };
      }
      // A visible reader is themselves a usable administrator, so access is
      // ready even if the count read failed; the count only refines the detail.
      return {
        ...base(capability, "ready"),
        detail:
          administratorCount && administratorCount > 0
            ? say("detail.administrators", { count: administratorCount })
            : null,
        isActionable: true,
      };
    }

    // No owning progress source: say it is available rather than claiming it has
    // not been started, which would be a statement about data we never read.
    return { ...base(capability, "available"), isActionable: true };
  }

  function firstUnmetPrerequisite(
    capability: SetupCapability
  ): ComposedCapability | null {
    for (const key of capability.prerequisites) {
      const prerequisite = byKey.get(key);
      if (!prerequisite) {
        continue;
      }
      if (prerequisite.state !== "ready") {
        return prerequisite;
      }
    }
    return null;
  }

  function base(
    capability: SetupCapability,
    state: CapabilityState
  ): ComposedCapability {
    return {
      capability,
      state,
      blockedBy: null,
      detail: null,
      isActionable: false,
    };
  }
}

export function deriveLaunchpadVariant(
  composed: ComposedCapability[],
  workforceTotalCount: number | null | undefined
): LaunchpadVariant {
  const organization = composed.find(
    (entry) => entry.capability.key === "organization"
  );

  if (!organization || workforceTotalCount == null) {
    return "indeterminate";
  }

  if (
    organization.state === "not-started" &&
    workforceTotalCount === 0
  ) {
    return "fresh";
  }

  if (
    organization.state === "ready" &&
    workforceTotalCount > 0
  ) {
    return "mature";
  }

  if (
    organization.state === "in-progress" ||
    organization.state === "not-started" ||
    (organization.state === "ready" && workforceTotalCount === 0)
  ) {
    return "underway";
  }

  return "indeterminate";
}

export function capabilitiesInGroup(
  composed: ComposedCapability[],
  group: CapabilityGroup
): ComposedCapability[] {
  return composed.filter((entry) => entry.capability.group === group);
}

/**
 * The single emphasized next step, or nothing.
 *
 * Only a real, reachable, unblocked action qualifies. Administrator access is
 * deliberately excluded: it is optional maintenance, and recommending it because
 * a new tenant has one administrator would turn a safeguard into homework.
 */
export function recommendedNextStep(
  composed: ComposedCapability[]
): ComposedCapability | null {
  return (
    composed.find(
      (entry) =>
        entry.isActionable &&
        entry.capability.key !== "administrator-access" &&
        (entry.state === "not-started" || entry.state === "in-progress")
    ) ?? null
  );
}
