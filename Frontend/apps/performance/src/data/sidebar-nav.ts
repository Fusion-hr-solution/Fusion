import { ClipboardCheck, ClipboardList, ClipboardPenLine, Compass, Gauge, LineChart, Megaphone, ScrollText, Settings2, SlidersHorizontal, Target, UserRoundCheck, UsersRound } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";
import {
  canAccessMyObjectives,
  canAccessPlanApprovals,
  canAccessTeamObjectives,
  canAccessTeamProgress,
  canAccessMyEvaluations,
  canAccessTeamEvaluations,
  canManageEvaluations,
  canOperateEvaluations,
  canViewObjectivePlanningConfiguration,
  canViewPerformanceCampaigns,
  canViewPerformanceStrategy,
  hasAnyRole,
  PLATFORM_ADMIN_ROLE,
  type AuthUser,
} from "@repo/auth";

export const OVERVIEW_NAV: ShellNavSection = {
  items: [
    { label: "Overview", href: "/", icon: ClipboardList },
  ],
};

export const TENANT_CONFIGURATION_NAV: ShellNavSection = {
  title: "Configuration",
  items: [
    {
      label: "Objective Planning",
      href: "/configuration/planning",
      icon: ScrollText,
    },
  ],
};

export const CAMPAIGNS_NAV: ShellNavSection = {
  items: [
    {
      label: "Campaigns",
      href: "/campaigns",
      icon: Megaphone,
    },
  ],
};

/** Employee door: personal objective plans inside launched campaigns. */
export const MY_OBJECTIVES_NAV: ShellNavSection = {
  items: [
    {
      label: "My objectives",
      href: "/my-objectives",
      icon: UserRoundCheck,
    },
  ],
};

/** Manager door: team objectives inside launched campaigns (frozen responsibility). */
export const TEAM_OBJECTIVES_NAV: ShellNavSection = {
  items: [
    {
      label: "Team objectives",
      href: "/team-objectives",
      icon: Target,
    },
  ],
};

/** Manager review door: plan-level employee objective approvals. */
export const PLAN_APPROVALS_NAV: ShellNavSection = {
  items: [
    {
      label: "Plan approvals",
      href: "/plan-approvals",
      icon: ClipboardCheck,
    },
  ],
};

/** Manager follow-up door: ongoing progress on the locked baseline, distinct from approvals. */
export const TEAM_PROGRESS_NAV: ShellNavSection = {
  items: [
    {
      label: "Team progress",
      href: "/team-progress",
      icon: LineChart,
    },
  ],
};

/** Direction door: campaign strategy and cascade coverage, no HR permissions needed. */
export const STRATEGY_NAV: ShellNavSection = {
  items: [
    {
      label: "Strategy",
      href: "/strategy",
      icon: Compass,
    },
  ],
};

export const PLATFORM_ADMIN_NAV: ShellNavSection = {
  title: "Platform administration",
  items: [
    {
      label: "Performance configuration",
      href: "/platform/configuration/performance",
      icon: Settings2,
    },
  ],
};

export const EVALUATION_CONFIGURATION_NAV: ShellNavSection = {
  title: "Configuration",
  items: [
    { label: "Evaluation setup", href: "/configuration/evaluation", icon: SlidersHorizontal },
  ],
};

export const EVALUATIONS_NAV: ShellNavSection = {
  items: [{ label: "Evaluations", href: "/evaluations", icon: Gauge }],
};

export const MY_EVALUATIONS_NAV: ShellNavSection = {
  items: [{ label: "My evaluations", href: "/my-evaluations", icon: ClipboardPenLine }],
};

export const TEAM_EVALUATIONS_NAV: ShellNavSection = {
  items: [{ label: "Team evaluations", href: "/team-evaluations", icon: UsersRound }],
};

/**
 * `work` — day-to-day operational doors (own their own sidebar section + overview card).
 * `configuration` — tenant-owned setup; these collapse into ONE "Configuration" sidebar
 *   section and one calm overview band so the tenant sees a single setup space, not scattered
 *   duplicate headers. `platform` — cross-tenant admin, kept deliberately separate.
 */
export type PerformanceDoorGroup = "work" | "configuration" | "platform";

export type PerformanceDoor = {
  section: ShellNavSection;
  description: string;
  group: PerformanceDoorGroup;
  isVisible: (user: AuthUser | null) => boolean;
};

/**
 * Single source for Performance workspace doors. The overview, sidebar, and breadcrumb all
 * consume these definitions so labels, order, routes, and access rules cannot drift.
 */
export const PERFORMANCE_DOORS: readonly PerformanceDoor[] = [
  {
    section: MY_EVALUATIONS_NAV,
    description: "Complete evaluation work assigned to you.",
    group: "work",
    isVisible: canAccessMyEvaluations,
  },
  {
    section: TEAM_EVALUATIONS_NAV,
    description: "Review evaluations assigned through frozen reviewer relationships.",
    group: "work",
    isVisible: canAccessTeamEvaluations,
  },
  {
    section: MY_OBJECTIVES_NAV,
    description: "Create, correct, submit, or review your own objective plan.",
    group: "work",
    isVisible: canAccessMyObjectives,
  },
  {
    section: TEAM_OBJECTIVES_NAV,
    description: "Define the team-level objectives employees can align to.",
    group: "work",
    isVisible: canAccessTeamObjectives,
  },
  {
    section: PLAN_APPROVALS_NAV,
    description: "Review submitted plans, request changes, or approve.",
    group: "work",
    isVisible: canAccessPlanApprovals,
  },
  {
    section: TEAM_PROGRESS_NAV,
    description: "Follow progress against each person's locked objectives.",
    group: "work",
    isVisible: canAccessTeamProgress,
  },
  {
    section: STRATEGY_NAV,
    description: "Check campaign strategy coverage and cascade visibility.",
    group: "work",
    isVisible: canViewPerformanceStrategy,
  },
  {
    section: CAMPAIGNS_NAV,
    description: "Set up, launch, monitor, and lock objective planning campaigns.",
    group: "work",
    isVisible: canViewPerformanceCampaigns,
  },
  {
    section: EVALUATIONS_NAV,
    description: "Configure, check readiness, and launch evaluation rounds.",
    group: "work",
    isVisible: (user) => canManageEvaluations(user) || canOperateEvaluations(user),
  },
  {
    section: EVALUATION_CONFIGURATION_NAV,
    description: "Rating scales and evaluation templates.",
    group: "configuration",
    isVisible: canManageEvaluations,
  },
  {
    section: TENANT_CONFIGURATION_NAV,
    description: "Objective count, weights, and measurement methods.",
    group: "configuration",
    isVisible: canViewObjectivePlanningConfiguration,
  },
  {
    section: PLATFORM_ADMIN_NAV,
    description: "Maintain platform defaults and supported planning guardrails.",
    group: "platform",
    isVisible: (user) => hasAnyRole(user, [PLATFORM_ADMIN_ROLE]),
  },
];

export const PERFORMANCE_NAV_SECTIONS: readonly ShellNavSection[] = [
  OVERVIEW_NAV,
  ...PERFORMANCE_DOORS.map((door) => door.section),
];

export function getPerformanceDoors(user: AuthUser | null | undefined): PerformanceDoor[] {
  return PERFORMANCE_DOORS.filter((door) => door.isVisible(user ?? null));
}

export type GroupedPerformanceDoors = Record<PerformanceDoorGroup, PerformanceDoor[]>;

/** Visible doors partitioned by group — consumed by the sidebar and overview so both split
 *  operational work from configuration identically. */
export function getPerformanceDoorsByGroup(
  user: AuthUser | null | undefined,
): GroupedPerformanceDoors {
  const grouped: GroupedPerformanceDoors = { work: [], configuration: [], platform: [] };
  for (const door of getPerformanceDoors(user)) {
    grouped[door.group].push(door);
  }
  return grouped;
}

/** The single merged "Configuration" sidebar section built from every visible configuration
 *  door's items — one header, never the duplicated pair. Returns null when nothing is visible. */
export function buildConfigurationSection(
  doors: PerformanceDoor[],
): ShellNavSection | null {
  const items = doors.flatMap((door) => door.section.items);
  if (items.length === 0) return null;
  return { title: "Configuration", items };
}
