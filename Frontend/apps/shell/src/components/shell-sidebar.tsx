"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { AppSidebar } from "@repo/ui";

export function ShellSidebar() {
  const pathname = usePathname();
  const activePath = pathname || "/";

  return (
    <AppSidebar
      activeModule="Home"
      activePath={activePath}
      sections={[]}
      brandIcon={LayoutDashboard}
      brandTitle="EY Fusion"
      brandSubtitle="HR Platform"
    />
  );
}
