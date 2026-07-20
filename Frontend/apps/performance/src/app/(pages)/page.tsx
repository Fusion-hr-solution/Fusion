"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { cn } from "@/lib/utils";
import { getPerformanceDoors } from "@/data/sidebar-nav";

type WorkDoor = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export default function PerformancePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer>
        <PageLoading rows={4} label="Loading Performance workspace" />
      </PageContainer>
    );
  }

  const doors: WorkDoor[] = getPerformanceDoors(user).map(({ section, description }) => {
    const item = section.items[0]!;
    return { title: item.label, description, href: item.href, icon: item.icon };
  });

  return (
    <PageContainer>
      <PageHeader
        title="Performance"
        description="Objective planning workspaces for the roles assigned to your account."
      />

      {doors.length === 0 ? (
        <PagePermissionNotice title="Performance access required" />
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {doors.map((door) => (
            <PerformanceDoor key={door.href} door={door} />
          ))}
        </section>
      )}
    </PageContainer>
  );
}

function PerformanceDoor({ door }: { door: WorkDoor }) {
  const Icon = door.icon;
  return (
    <Link
      href={door.href}
      className={cn(
        "group flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold text-foreground">{door.title}</span>
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">{door.description}</span>
        </span>
      </div>
      <span className="mt-5 text-sm font-medium text-primary">Open workspace</span>
    </Link>
  );
}
