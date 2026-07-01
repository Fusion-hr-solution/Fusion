"use client";

import type { ReactNode } from "react";
import { PageContainer, PageHeader } from "@repo/ds/shell";
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
    <PageContainer width="wide" className="space-y-6">
      <PageHeader title="Access" description={description} />
      <AccessWorkspaceNav
        active={active}
        showPeople={showPeople}
        showProfiles={showProfiles}
      />
      {children}
    </PageContainer>
  );
}
