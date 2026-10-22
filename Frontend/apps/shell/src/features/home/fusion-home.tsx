"use client";

import { FUSION_ATTENTION_MODULES } from "@repo/api";
import { useFusionUpcoming, useFusionWork, useMyCard } from "@repo/api/query";
import { resolveFusionAttentionModules, useAuth } from "@repo/auth";
import { Skeleton } from "@repo/ds";
import {
  AppShell,
  HomeAgenda,
  LeadFocus,
  PageContainer,
  ThemeProvider,
  TopBar,
  WorkList,
  selectLead,
} from "@repo/ds/shell";
import { FusionSidebar } from "./fusion-sidebar";
import { HomePraise } from "./home-praise";
import { ShellNotificationBell } from "./shell-notification-bell";
import { YourYear } from "./your-year";

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(fullName: string | undefined): string | null {
  return fullName?.trim().split(/\s+/)[0] || null;
}

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** "Tuesday 20 October · QA Automation Engineer, Consulting A": the day, and the job and unit when Core HR has them. */
function DayLine({ now }: { now: Date }) {
  const card = useMyCard();
  const job = [card.data?.jobTitle, card.data?.orgUnitName].filter(Boolean).join(", ");
  return (
    <p className="type-body-secondary text-muted-foreground">
      {DAY.format(now).replace(",", "")}
      {job ? ` · ${job}` : ""}
    </p>
  );
}

const labelOf = (key: string) => FUSION_ATTENTION_MODULES.find((module) => module.key === key)?.label ?? key;

/**
 * The work column: the one thing that matters most (or, with no work, what's next), everything else that needs the
 * person, and their next two weeks across modules.
 */
export function HomeWork() {
  const { user } = useAuth();
  const modules = resolveFusionAttentionModules(user);
  const enabled = Boolean(user?.tenantId);
  const work = useFusionWork(modules, { enabled });
  const upcoming = useFusionUpcoming(modules, { enabled });
  const today = new Date();
  const lead = selectLead(work.items, upcoming.items, today);
  const rest = lead?.kind === "work" ? work.items.filter((item) => item.id !== lead.item.id) : work.items;
  const workBusy = work.modules.some((module) => module.status === "loading");
  const datesBusy = upcoming.modules.some((module) => module.status === "loading");

  return (
    <div className="space-y-10">
      {(workBusy || (!lead && datesBusy)) && lead?.kind !== "work" ? (
        <Skeleton aria-label="Loading your work" className="h-36 w-full rounded-surface" />
      ) : (
        <LeadFocus lead={lead} moduleLabel={labelOf} today={today} />
      )}

      {rest.length > 0 || work.failedModules.length > 0 || (workBusy && lead?.kind === "work") ? (
        <section aria-labelledby="home-work-heading" className="space-y-3">
          <h2 id="home-work-heading" className="type-section-title text-foreground">
            Also needs you
          </h2>
          <WorkList items={rest} modules={work.modules} today={today} />
        </section>
      ) : null}

      <section aria-labelledby="home-agenda-heading" className="space-y-3">
        <h2 id="home-agenda-heading" className="type-section-title text-foreground">
          Next two weeks
        </h2>
        {datesBusy && upcoming.items.length === 0 ? (
          <Skeleton aria-label="Loading your next two weeks" className="h-24 w-full rounded-surface" />
        ) : (
          <HomeAgenda work={work.items} moments={upcoming.items} lead={lead} modules={upcoming.modules} today={today} />
        )}
      </section>
    </div>
  );
}

/**
 * The Fusion home at the shell root (D-31, B-077): the frame, a greeting with the day and the person's job, the work
 * column, and a side column with their year and the company's praise. Without Performance there's no second job, so
 * the work sits in one column.
 */
export function FusionHome() {
  const { user } = useAuth();
  const name = firstName(user?.fullName);
  const now = new Date();
  const performance = resolveFusionAttentionModules(user).includes("performance");
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
          <div className="space-y-2">
            <h1 className="type-display text-foreground">
              {greeting(now)}
              {name ? `, ${name}` : ""}
            </h1>
            <DayLine now={now} />
          </div>
          {performance ? (
            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_352px]">
              <HomeWork />
              <aside aria-label="Your year and praise" className="space-y-10">
                <YourYear employeeId={user?.employeeId} enabled={performance} />
                <HomePraise />
              </aside>
            </div>
          ) : (
            <HomeWork />
          )}
        </PageContainer>
      </AppShell>
    </ThemeProvider>
  );
}
