"use client";

import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";
import {
  SidebarUserPanel,
  useAuth,
  canSeeCoreSetupNavigation,
  canSeeOrganizationsNavigation,
} from "@repo/auth";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import { useCoreSetupAccess } from "@/components/core-setup-access";
import { canSeeEmployeeRosterNavigation } from "@/lib/employee-roster-access";

type CSSVariableStyle = CSSProperties & Record<`--${string}`, string>;

// Match the shared EY module sidebar theme locally so Core's app-level tokens
// do not drift from the visual baseline used by Learning and Interview.
const SHARED_MODULE_SIDEBAR_THEME: CSSVariableStyle = {
  "--background": "hsl(0 0% 100%)",
  "--foreground": "hsl(0 0% 3.9%)",
  "--card": "hsl(0 0% 100%)",
  "--card-foreground": "hsl(0 0% 3.9%)",
  "--popover": "hsl(0 0% 100%)",
  "--popover-foreground": "hsl(0 0% 3.9%)",
  "--primary": "hsl(47.2 100% 49.7%)",
  "--primary-foreground": "hsl(29.5 83.4% 24.6%)",
  "--secondary": "hsl(240 3.5% 95.8%)",
  "--secondary-foreground": "hsl(240 6% 10%)",
  "--muted": "hsl(0 0% 96.1%)",
  "--muted-foreground": "hsl(0 0% 45.2%)",
  "--accent": "hsl(0 0% 96.1%)",
  "--accent-foreground": "hsl(0 0% 9.1%)",
  "--destructive": "hsl(357.2 100% 45.3%)",
  "--destructive-foreground": "hsl(210 40% 98%)",
  "--border": "hsl(0 0% 89.8%)",
  "--input": "hsl(0 0% 89.8%)",
  "--ring": "hsl(0 0% 63%)",
  "--radius": "0.625rem",
  "--sidebar": "hsl(0 0% 98%)",
  "--sidebar-foreground": "hsl(0 0% 3.9%)",
  "--sidebar-primary": "hsl(38.9 100% 40.9%)",
  "--sidebar-primary-foreground": "hsl(54.5 90.6% 95.3%)",
  "--sidebar-accent": "hsl(0 0% 96.1%)",
  "--sidebar-accent-foreground": "hsl(0 0% 9.1%)",
  "--sidebar-border": "hsl(0 0% 89.8%)",
  "--sidebar-ring": "hsl(0 0% 63%)",
};

function applySetupLock(
  section: NavSection,
  disabledReason: string
): NavSection {
  return {
    ...section,
    items: section.items.map((item) =>
      item.href === "/setup"
        ? item
        : {
            ...item,
            disabled: true,
            disabledReason,
          }
    ),
  };
}

export function CoreSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/core/, "") || "/";
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isNavigationLocked, lockedNavigationReason } = useCoreSetupAccess();
  const canSeeSetup = canSeeCoreSetupNavigation(user);
  const canSeeOrganizations = canSeeOrganizationsNavigation(user);
  const canSeeEmployeeRoster = canSeeEmployeeRosterNavigation(user);
  const loadingSections: NavSection[] = [
    {
      ...PEOPLE_NAV,
      items: PEOPLE_NAV.items.map((item) => ({
        ...item,
        disabled: true,
      })),
    },
    {
      ...ADMIN_NAV,
      items: ADMIN_NAV.items.map((item) => ({
        ...item,
        disabled: true,
      })),
    },
  ];
  const peopleItems = PEOPLE_NAV.items.filter((item) => {
    if (item.href === "/employees") {
      return canSeeEmployeeRoster;
    }

    return true;
  });
  const adminItems = ADMIN_NAV.items.filter((item) => {
    if (item.href === "/setup") {
      return canSeeSetup;
    }

    if (item.href === "/organizations") {
      return canSeeOrganizations;
    }

    return canSeeSetup;
  });

  const visibleSections = isAuthLoading
    ? loadingSections
    : adminItems.length
      ? [
          { ...PEOPLE_NAV, items: peopleItems },
          { ...ADMIN_NAV, items: adminItems },
        ]
      : [{ ...PEOPLE_NAV, items: peopleItems }];

  const sections =
    isNavigationLocked && lockedNavigationReason
      ? visibleSections.map((section) =>
          applySetupLock(section, lockedNavigationReason)
        )
      : visibleSections;

  return (
    <AppSidebar
      activeModule="Core"
      activePath={isAuthLoading ? "" : activePath}
      sections={sections}
      brandIcon={BrainCircuit}
      brandTitle="EY Core HR"
      brandSubtitle="HR Platform"
      basePath="/core"
      style={SHARED_MODULE_SIDEBAR_THEME}
      moduleSwitcherContentStyle={SHARED_MODULE_SIDEBAR_THEME}
      moduleSwitcherTriggerStyle={SHARED_MODULE_SIDEBAR_THEME}
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
