import { CalendarRange, FeedbackIcon, FileCheck2, GitBranch, LayoutDashboard, OneOnOnes, Settings, UserRoundCheck, Users } from "@/lib/icons";
import type { WorkspaceDestinationsDto } from "@repo/api";
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
    // Conversations belong to people, not cycles (S-02): they keep no cycle in their address.
    { label: "1:1s", href: "/one-on-ones", icon: OneOnOnes },
    { label: "Feedback", href: "/feedback", icon: FeedbackIcon },
    { label: "Reviews", href: "/reviews", icon: FileCheck2 },
  ],
};

/** Routes reached in context rather than from the sidebar; listed so labels still resolve. */
export const CONTEXTUAL_ROUTES = [{ label: "Organization direction", href: "/goals", icon: GitBranch }];

/** Administration: shown only to Cycle administrators, kept out of the primary rail. */
export const ADMIN_NAV: ShellNavSection = {
  title: "Administration",
  items: [
    { label: "Cycle", href: "/cycle", icon: CalendarRange },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};

/** Which primary destinations the caller has, from the server's workspace context (navigation, never access). */
const DESTINATION_OF: Record<string, keyof WorkspaceDestinationsDto> = {
  "/plan": "myPlan",
  "/team": "team",
  "/one-on-ones": "oneOnOnes",
  "/feedback": "feedback",
  "/reviews": "reviews",
};

export function visiblePrimaryItems(destinations: WorkspaceDestinationsDto | undefined): ShellNavSection["items"] {
  return PRIMARY_NAV.items.filter((item) => {
    const key = DESTINATION_OF[item.href];
    return key ? (destinations?.[key] ?? false) : true;
  });
}

/** Destinations that belong to people, not cycles: the cycle switcher never follows into them. */
export const CYCLE_FREE_ROUTES: ReadonlySet<string> = new Set(["/one-on-ones", "/feedback"]);

