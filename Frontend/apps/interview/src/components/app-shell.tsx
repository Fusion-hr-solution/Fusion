"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { InterviewSidebar } from "@/components/interview-sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/candidate/start";

  if (hideSidebar) {
    return <main className="min-h-screen bg-zinc-50">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <InterviewSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
