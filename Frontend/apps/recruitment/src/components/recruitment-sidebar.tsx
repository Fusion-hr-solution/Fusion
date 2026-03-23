"use client";

import { usePathname } from "next/navigation";
import {
  Users,
  Briefcase,
  FileText,
  UserPlus,
} from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";
import { SidebarUserPanel } from "@repo/auth";

const RECRUITMENT_NAV: NavSection = {
  title: "Recruitment",
  items: [
    { label: "Job Openings", href: "/", icon: Briefcase },
    { label: "Applicants", href: "/applicants", icon: UserPlus },
    { label: "Applications", href: "/applications", icon: FileText },
  ],
};

export function RecruitmentSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/recruitment/, "") || "/";

  return (
    <AppSidebar
      activeModule="Recruitment"
      activePath={activePath}
      sections={[RECRUITMENT_NAV]}
      brandIcon={Users}
      brandTitle="EY Recruitment"
      brandSubtitle="Talent Acquisition"
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
