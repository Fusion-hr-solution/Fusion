"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { cn } from "@/lib/utils";
import { getPerformanceDoorsByGroup, type PerformanceDoor } from "@/data/sidebar-nav";

type Entry = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

function toEntry(door: PerformanceDoor): Entry {
  const item = door.section.items[0]!;
  return { title: item.label, description: door.description, href: item.href, icon: item.icon };
}

export default function PerformancePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer>
        <PageLoading rows={4} label="Loading Performance workspace" />
      </PageContainer>
    );
  }

  const grouped = getPerformanceDoorsByGroup(user);
  const work = grouped.work.map(toEntry);
  const configuration = grouped.configuration.map(toEntry);
  const platform = grouped.platform.map(toEntry);
  const total = work.length + configuration.length + platform.length;

  return (
    <PageContainer>
      <PageHeader title="Performance" />

      {total === 0 ? (
        <PagePermissionNotice title="Performance access required" />
      ) : (
        <div className="flex flex-col gap-10">
          {work.length > 0 ? (
            <section
              aria-label="Workspaces"
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              {work.map((entry) => (
                <WorkspaceDoor key={entry.href} entry={entry} />
              ))}
            </section>
          ) : null}

          {configuration.length > 0 ? (
            <SetupBand title="Configuration" entries={configuration} />
          ) : null}

          {platform.length > 0 ? (
            <SetupBand title="Platform administration" entries={platform} />
          ) : null}
        </div>
      )}
    </PageContainer>
  );
}

/** Operational workspace — a door the user opens to do work. Card affordance. */
function WorkspaceDoor({ entry }: { entry: Entry }) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      className={cn(
        "group flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold text-foreground">{entry.title}</span>
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">
            {entry.description}
          </span>
        </span>
      </div>
      <span className="mt-5 text-sm font-medium text-primary">Open workspace</span>
    </Link>
  );
}

/**
 * Setup areas are not workspaces — they're a small, stable set the tenant configures rarely.
 * A quiet full-width band with divided rows keeps them visually distinct from the work grid,
 * so "which is what" is unmistakable at a glance.
 */
function SetupBand({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {entries.map((entry) => (
          <SetupRow key={entry.href} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function SetupRow({ entry }: { entry: Entry }) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{entry.title}</span>
        <span className="block truncate text-sm text-muted-foreground">{entry.description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
