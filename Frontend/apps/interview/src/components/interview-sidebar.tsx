"use client";

import { usePathname } from "next/navigation";
import {
  Video,
  ClipboardList,
  Users,
  BarChart2,
  Settings,
} from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";

const INTERVIEW_NAV: NavSection = {
  title: "Management",
  items: [
    { label: "Tests", href: "/", icon: ClipboardList },
    { label: "Candidates", href: "/candidates", icon: Users },
    { label: "Reports", href: "/reports", icon: BarChart2 },
    { label: "Settings", href: "/settings", icon: Settings },
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
    />
  );
}
