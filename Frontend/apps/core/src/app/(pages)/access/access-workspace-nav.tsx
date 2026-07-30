"use client";

import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessWorkspaceNav({
  active,
  showPeople,
  showProfiles,
}: {
  active: "people" | "profiles";
  showPeople: boolean;
  showProfiles: boolean;
}) {
  const peopleHref = "/access";
  const profilesHref = "/settings?tab=access-permissions";

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
          variant={active === "profiles" ? "default" : "outline"}
        >
          <Link href={profilesHref}>
            <ShieldCheck className="size-4" />
            Access profiles
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
