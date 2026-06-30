import { ClipboardList, Library, ScrollText, Settings2 } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";

export const REVIEWS_NAV: ShellNavSection = {
  title: "Reviews",
  items: [
    { label: "Overview", href: "/", icon: ClipboardList },
  ],
};

export const HR_ADMIN_NAV: ShellNavSection = {
  title: "Performance setup",
  items: [
    { label: "Objective policy", href: "/policy", icon: ScrollText },
    { label: "Objective templates", href: "/templates", icon: Library },
  ],
};

export const PLATFORM_ADMIN_NAV: ShellNavSection = {
  title: "Platform defaults",
  items: [
    { label: "Platform defaults", href: "/defaults", icon: Settings2 },
  ],
};
