import { ClipboardCheck, ClipboardList, Compass, LineChart, Megaphone, ScrollText, Settings2, Target, UserRoundCheck } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";
import {
  canAccessMyObjectives,
  canAccessPlanApprovals,
  canAccessTeamObjectives,
  canAccessTeamProgress,
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

export type PerformanceDoor = {
  section: ShellNavSection;
  description: string;
  isVisible: (user: AuthUser | null) => boolean;
};

/**
 * Single source for Performance workspace doors. The overview, sidebar, and breadcrumb all
 * consume these definitions so labels, order, routes, and access rules cannot drift.
 */
export const PERFORMANCE_DOORS: readonly PerformanceDoor[] = [
  {
    section: MY_OBJECTIVES_NAV,
    description: "Create, correct, submit, or review your own objective plan.",
    isVisible: canAccessMyObjectives,
  },
  {
    section: TEAM_OBJECTIVES_NAV,
    description: "Define the team-level objectives employees can align to.",
    isVisible: canAccessTeamObjectives,
  },
  {
    section: PLAN_APPROVALS_NAV,
    description: "Review submitted plans, request changes, or approve.",
    isVisible: canAccessPlanApprovals,
  },
  {
    section: TEAM_PROGRESS_NAV,
    description: "Follow progress against each person's locked objectives.",
    isVisible: canAccessTeamProgress,
  },
  {
    section: STRATEGY_NAV,
    description: "Check campaign strategy coverage and cascade visibility.",
    isVisible: canViewPerformanceStrategy,
  },
  {
    section: CAMPAIGNS_NAV,
    description: "Set up, launch, monitor, and lock objective planning campaigns.",
    isVisible: canViewPerformanceCampaigns,
  },
  {
    section: TENANT_CONFIGURATION_NAV,
    description: "Review tenant planning limits, weights, and measurement methods.",
    isVisible: canViewObjectivePlanningConfiguration,
  },
  {
    section: PLATFORM_ADMIN_NAV,
    description: "Maintain platform defaults and supported planning guardrails.",
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
