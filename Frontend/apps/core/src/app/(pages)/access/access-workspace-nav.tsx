"use client";

import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { buildTenantContextHref } from "@/lib/tenant-navigation";

export function AccessWorkspaceNav({
  active,
  showPeople,
  showProfiles,
}: {
  active: "people" | "profiles";
  showPeople: boolean;
  showProfiles: boolean;
}) {
  const { tenantId } = useTenantContext();
  const peopleHref = buildTenantContextHref("/access", tenantId);
  const profilesHref = buildTenantContextHref("/access/profiles", tenantId);

  if (!showPeople && !showProfiles) {
    return null;
  }

  return (
    <div className="inline-flex w-fit flex-wrap items-center gap-1 rounded-xl border bg-muted/20 p-1">
      {showPeople ? (
        <Button
          asChild
          size="sm"
          className="rounded-lg"
          variant={active === "people" ? "default" : "ghost"}
        >
          <Link href={peopleHref}>
            <Users className="size-4" />
            People
          </Link>
        </Button>
      ) : null}
      {showProfiles ? (
        <Button
          asChild
          size="sm"
          className="rounded-lg"
          variant={active === "profiles" ? "default" : "ghost"}
        >
          <Link href={profilesHref}>
            <ShieldCheck className="size-4" />
            Profiles
          </Link>
        </Button>
      ) : null}
    </div>
  );
}