import { ClipboardCheck, ClipboardList, Compass, Megaphone, ScrollText, Settings2, Target, UserRoundCheck } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";

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
