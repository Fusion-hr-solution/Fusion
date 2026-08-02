import { Building2 } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";

export const PLATFORM_NAV: ShellNavSection = {
  items: [
    {
      label: "Tenants",
      href: "/tenants",
      icon: Building2,
    },
  ],
};
