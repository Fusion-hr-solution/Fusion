"use client";

import { FUSION_ATTENTION_MODULES } from "@repo/api";
import { useFusionWork } from "@repo/api/query";
import { resolveFusionAttentionModules, useAuth } from "@repo/auth";
import { Skeleton } from "@repo/ds";
import { AppShell, PageContainer, ThemeProvider, TopBar, WorkFocus, WorkList, selectFeaturedWork } from "@repo/ds/shell";
import { FusionSidebar } from "./fusion-sidebar";
import { ShellNotificationBell } from "./shell-notification-bell";

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(fullName: string | undefined): string | null {
  return fullName?.trim().split(/\s+/)[0] || null;
}

/** The work area: the one thing that matters most, then everything else that needs the person. */
export function HomeWork() {
  const { user } = useAuth();
  const work = useFusionWork(resolveFusionAttentionModules(user), { enabled: Boolean(user?.tenantId) });
  const featured = selectFeaturedWork(work.items);
  const rest = featured ? work.items.filter((item) => item.id !== featured.id) : work.items;
  const labelOf = (key: string) => FUSION_ATTENTION_MODULES.find((module) => module.key === key)?.label ?? key;
  const busy = work.modules.some((module) => module.status === "loading");

  if (!featured && busy) {
    return (
      <div className="space-y-8">
        <Skeleton aria-label="Loading your work" className="h-36 w-full rounded-surface" />
        <WorkList items={[]} modules={work.modules} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {featured ? <WorkFocus item={featured} moduleLabel={labelOf(featured.module)} /> : null}
      {featured && rest.length === 0 && !busy && work.failedModules.length === 0 ? null : (
        <section aria-labelledby="home-work-heading" className="space-y-3">
          {featured ? (
            <h2 id="home-work-heading" className="type-section-title text-foreground">
              Also needs you
            </h2>
          ) : (
            <h2 id="home-work-heading" className="sr-only">
              Your work
            </h2>
          )}
          <WorkList items={rest} modules={work.modules} />
        </section>
      )}
    </div>
  );
}

/** The Fusion home at the shell root (D-31): the Fusion frame, a greeting and the person's work across modules. */
export function FusionHome() {
  const { user } = useAuth();
  const name = firstName(user?.fullName);
  return (
    <ThemeProvider>
      <AppShell
        sidebar={<FusionSidebar />}
        header={
          <TopBar>
            <ShellNotificationBell />
          </TopBar>
        }
      >
        <PageContainer className="space-y-8">
          <h1 className="type-page-title text-foreground">
            {greeting(new Date())}
            {name ? `, ${name}` : ""}
          </h1>
          <HomeWork />
        </PageContainer>
      </AppShell>
    </ThemeProvider>
  );
}
