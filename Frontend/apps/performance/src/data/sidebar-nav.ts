import { ClipboardCheck, GitBranch, LayoutDashboard, ListChecks, Settings, TrendingUp, UserRoundCheck } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";

export const OVERVIEW_NAV: ShellNavSection = {
  items: [
    { label: "Overview", href: "/", icon: LayoutDashboard, exact: true },
    { label: "Cycle setup", href: "/setup", icon: ListChecks },
    { label: "Goals", href: "/goals", icon: GitBranch },
    { label: "My plan", href: "/plan", icon: UserRoundCheck },
    { label: "Reviews", href: "/reviews", icon: ClipboardCheck },
    { label: "Contribution", href: "/contribution", icon: TrendingUp },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};
