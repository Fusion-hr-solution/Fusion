import { GitBranch, LayoutDashboard, ListChecks, Settings, UserRoundCheck, Users } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";

/**
 * Primary Performance navigation: the durable business surfaces, not feature chunks.
 * Organization Goals owns company + organizational direction (contribution is a lens within
 * it, not a peer). Team Performance is the manager's durable team responsibility. Cycle and
 * Settings are administrative and live in the demoted admin section below. Organization Goals
 * and Team Performance visibility is responsibility-gated at render.
 */
export const PRIMARY_NAV: ShellNavSection = {
  items: [
    { label: "Overview", href: "/", icon: LayoutDashboard, exact: true },
    { label: "Organization Goals", href: "/goals", icon: GitBranch },
    { label: "My plan", href: "/plan", icon: UserRoundCheck },
    { label: "Team Performance", href: "/team", icon: Users },
  ],
};

/** Administration: shown only to Cycle administrators, kept out of the primary rail. */
export const ADMIN_NAV: ShellNavSection = {
  title: "Administration",
  items: [
    { label: "Cycle", href: "/cycle", icon: ListChecks },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};
