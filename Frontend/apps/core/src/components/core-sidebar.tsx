"use client";

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

function applySetupLock(section: NavSection, disabledReason: string): NavSection {
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
  const { user } = useAuth();
  const { isNavigationLocked, lockedNavigationReason } = useCoreSetupAccess();
  const canSeeSetup = canSeeCoreSetupNavigation(user);
  const canSeeOrganizations = canSeeOrganizationsNavigation(user);
  const canSeeEmployeeRoster = canSeeEmployeeRosterNavigation(user);
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

  const visibleSections = adminItems.length
    ? [{ ...PEOPLE_NAV, items: peopleItems }, { ...ADMIN_NAV, items: adminItems }]
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
      activePath={activePath}
      sections={sections}
      brandIcon={BrainCircuit}
      brandTitle="EY Core HR"
      brandSubtitle="HR Platform"
      basePath="/core"
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
