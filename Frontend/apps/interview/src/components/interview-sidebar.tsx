"use client";

import { usePathname } from "next/navigation";
import {
  Video,
  ClipboardList,
  Users,
  BarChart2,
  Settings,
  Bell,
  Search,
} from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";
import { SidebarUserPanel } from "@repo/auth";

const INTERVIEW_NAV: NavSection = {
  title: "Management",
  items: [
    { label: "Tests", href: "/", icon: ClipboardList },
    { label: "Candidates", href: "/candidates", icon: Users },
    { label: "Reports", href: "/reports", icon: BarChart2 },
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Notifications", href: "/notifications", icon: Bell, badge: "3" },
    { label: "Search", href: "/search", icon: Search, badge: "⌘K" },
  ],
};

export function InterviewSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/interview/, "") || "/";

  return (
    <AppSidebar
      activeModule="Interview"
      activePath={activePath}
      sections={[INTERVIEW_NAV]}
      brandIcon={Video}
      brandTitle="EY Interviews"
      brandSubtitle="Test Management"
      basePath="/interview"
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
