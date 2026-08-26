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
    // print:* overrides let a page (e.g. the candidate report) print as a full flowing document:
    // the sidebar is dropped and the viewport height/overflow clamps are lifted.
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <div className="print:hidden">
        <InterviewSidebar />
      </div>
      <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
    </div>
  );
}
