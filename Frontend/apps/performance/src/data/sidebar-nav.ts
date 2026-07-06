import { ClipboardList, ScrollText, Settings2 } from "lucide-react";
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

export const PLATFORM_ADMIN_NAV: ShellNavSection = {
  title: "Platform administration",
  items: [
    {
      label: "Performance configuration",
      href: "/configuration/performance",
      icon: Settings2,
    },
  ],
};
