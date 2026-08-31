import { ClipboardCheck, GitBranch, LayoutDashboard, ListChecks, Settings, TrendingUp, UserRoundCheck } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";

/**
 * Primary Performance navigation: the perspectives an employee moves through in one
 * living Cycle. Cycle setup and Settings are administrative lifecycle work, not peers
 * of My plan, so they live in a demoted admin section below — reached, when relevant,
 * from Overview. Review/Contribution visibility is responsibility-gated at render.
 */
export const PRIMARY_NAV: ShellNavSection = {
  items: [
    { label: "Overview", href: "/", icon: LayoutDashboard, exact: true },
    { label: "Goals", href: "/goals", icon: GitBranch },
    { label: "My plan", href: "/plan", icon: UserRoundCheck },
    { label: "Reviews", href: "/reviews", icon: ClipboardCheck },
    { label: "Contribution", href: "/contribution", icon: TrendingUp },
  ],
};

/** Administration: shown only to Cycle administrators, kept out of the primary rail. */
export const ADMIN_NAV: ShellNavSection = {
  title: "Administration",
  items: [
    { label: "Cycle setup", href: "/setup", icon: ListChecks },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};
