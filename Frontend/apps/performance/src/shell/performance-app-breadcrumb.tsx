"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumb } from "@repo/ds/shell";
import {
  PERFORMANCE_NAV_SECTIONS,
} from "@/data/sidebar-nav";

const NAV_ITEMS = PERFORMANCE_NAV_SECTIONS.flatMap((section) => section.items);

const BREADCRUMB_LABELS = new Map([
  ["platform", "Platform administration"],
  ["configuration", "Configuration"],
  ["evaluation", "Evaluation setup"],
  ["skills", "Skills"],
  ["planning", "Objective Planning"],
  ["performance", "Performance configuration"],
  ["campaigns", "Campaigns"],
  ["completion", "Planning completion"],
  ["new", "New campaign"],
  ["my-objectives", "My objectives"],
  ["team-objectives", "Team objectives"],
  ["plan-approvals", "Plan approvals"],
  ["team-progress", "Team progress"],
  ["my-evaluations", "My evaluations"],
  ["team-evaluations", "Team evaluations"],
  ["strategy", "Strategy"],
]);

export function PerformanceAppBreadcrumb() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";

  return (
    <AppBreadcrumb
      appName="Performance"
      pathname={activePath}
      navItems={NAV_ITEMS}
      overrides={BREADCRUMB_LABELS}
    />
  );
}
