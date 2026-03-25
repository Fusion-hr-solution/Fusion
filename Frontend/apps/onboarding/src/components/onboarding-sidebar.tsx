"use client";

import { usePathname } from "next/navigation";
import {
  Handshake,
  UserCheck,
  ListChecks,
  CalendarDays,
} from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";
import { SidebarUserPanel } from "@repo/auth";

const ONBOARDING_NAV: NavSection = {
  title: "Onboarding",
  items: [
    { label: "New Hires", href: "/", icon: UserCheck },
    { label: "Tasks", href: "/tasks", icon: ListChecks },
    { label: "Schedule", href: "/schedule", icon: CalendarDays },
  ],
};

export function OnboardingSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/onboarding/, "") || "/";

  return (
    <AppSidebar
      activeModule="Onboarding"
      activePath={activePath}
      sections={[ONBOARDING_NAV]}
      brandIcon={Handshake}
      brandTitle="EY Onboarding"
      brandSubtitle="New Hire Journey"
      basePath="/onboarding"
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
