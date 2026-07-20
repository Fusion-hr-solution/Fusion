"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { InterviewSidebar } from "@/components/interview-sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // The frontend-project sandbox is embedded as a bare iframe (its own full-screen chrome) —
  // render it with no admin shell at all.
  if (pathname === "/candidate/frontend-sandbox") {
    return <>{children}</>;
  }

  // The candidate exam takes over the viewport without the admin sidebar.
  if (pathname === "/candidate/start") {
    return <main className="min-h-screen bg-zinc-50">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <InterviewSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
