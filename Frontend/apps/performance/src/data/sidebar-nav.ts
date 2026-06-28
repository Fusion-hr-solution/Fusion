import { ClipboardList, Target, TrendingUp } from "lucide-react";
import type { ShellNavSection } from "@repo/ds/shell";

export const REVIEWS_NAV: ShellNavSection = {
  title: "Reviews",
  items: [
    { label: "Overview", href: "/", icon: ClipboardList },
  ],
};

export const GOALS_NAV: ShellNavSection = {
  title: "Goals",
  items: [
    { label: "Goals", href: "/goals", icon: Target },
    { label: "Analytics", href: "/analytics", icon: TrendingUp },
  ],
};
