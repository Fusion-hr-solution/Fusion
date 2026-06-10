"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { AccessWorkspaceNav } from "./access-workspace-nav";

export function AccessWorkspaceShell({
  active,
  showPeople,
  showProfiles,
  children,
  description = "Activate accounts and manage access for workforce users.",
}: {
  active: "people" | "profiles";
  showPeople: boolean;
  showProfiles: boolean;
  children: ReactNode;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Access" description={description} />
      <AccessWorkspaceNav
        active={active}
        showPeople={showPeople}
        showProfiles={showProfiles}
      />
      {children}
    </div>
  );
}
