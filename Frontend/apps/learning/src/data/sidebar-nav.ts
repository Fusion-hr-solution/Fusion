import {
  BookOpen,
  LayoutDashboard,
  Award,
  Trophy,
  GraduationCap,
  Users,
  BarChart3,
  ClipboardList,
  Settings,
} from "lucide-react";
import type { NavSection } from "@/types/sidebar";

export const EMPLOYEE_NAV: NavSection = {
  title: "Learning",
  items: [
    { label: "Catalog", href: "/", icon: BookOpen },
    {
      label: "My Trainings",
      href: "/my-trainings",
      icon: GraduationCap,
      badge: "3",
    },
    { label: "Certificates", href: "/certificates", icon: Award },
    { label: "Badges", href: "/badges", icon: Trophy },
  ],
};

export const ADMIN_NAV: NavSection = {
  title: "Administration",
  items: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    {
      label: "Manage Trainings",
      href: "/admin/trainings",
      icon: ClipboardList,
    },
    { label: "Employee Progress", href: "/admin/progress", icon: BarChart3 },
    { label: "Assignments", href: "/admin/assignments", icon: Users },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
};
