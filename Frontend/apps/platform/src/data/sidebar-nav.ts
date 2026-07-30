import { LayoutDashboard } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";

export const PLATFORM_OVERVIEW_NAV: ShellNavSection = {
  items: [
    {
      label: "Overview",
      href: "/",
      icon: LayoutDashboard,
      exact: true,
    },
  ],
};
