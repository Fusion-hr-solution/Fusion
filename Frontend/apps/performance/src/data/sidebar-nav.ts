import { GitBranch, LayoutDashboard, ListChecks, Settings, UserRoundCheck, Users } from "@/lib/icons";
import type { ShellNavSection } from "@repo/ds/shell";

/**
 * Primary Performance navigation: one entry per durable, recurring job — never one per entity,
 * service or capability. Overview orients and points onward; My Plan is planning and executing
 * one's own commitments; Team Performance is a people leader's work for their team. Entries are
 * capability-gated at render. Organization direction is deliberately absent: it is reached in
 * context (Overview, Team Performance, any objective record), not as a destination of its own.
 */
export const PRIMARY_NAV: ShellNavSection = {
  items: [
    { label: "Overview", href: "/", icon: LayoutDashboard, exact: true },
    { label: "My Plan", href: "/plan", icon: UserRoundCheck },
    { label: "Team Performance", href: "/team", icon: Users },
  ],
};

/** Routes reached in context rather than from the sidebar; listed so labels still resolve. */
export const CONTEXTUAL_ROUTES = [{ label: "Organization direction", href: "/goals", icon: GitBranch }];

/** Administration: shown only to Cycle administrators, kept out of the primary rail. */
export const ADMIN_NAV: ShellNavSection = {
  title: "Administration",
  items: [
    { label: "Cycle", href: "/cycle", icon: ListChecks },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};
