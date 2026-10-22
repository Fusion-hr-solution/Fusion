"use client";

import { ChevronRight, HeartHandshake, Lightbulb, PartyPopper, ThumbsUp } from "lucide-react";
import { usePraiseFeed, useReactToPraise } from "@repo/api/query";
import { resolveFusionAttentionModules, useAuth } from "@repo/auth";
import { Skeleton } from "@repo/ds";
import { Button } from "@repo/ds/components/ui/button";
import { PraiseList, type PraiseReactionIcons } from "@repo/performance-ui";

/** The shell's own glyphs for praise reactions; the shared parts carry none. */
const REACTION_ICONS: PraiseReactionIcons = {
  Applause: <ThumbsUp />,
  Celebrate: <PartyPopper />,
  Insightful: <Lightbulb />,
  ThankYou: <HeartHandshake />,
};

const PRAISE_TAB = "/performance/feedback?tab=praise";

/**
 * The company's latest praise in the home's side column (D-14, D-31): the two newest, praise to the viewer marked, and
 * the way to all of it. It's Performance's, so it shows only to people who can enter Performance, and a failure there
 * never touches the home.
 */
export function HomePraise() {
  const { user } = useAuth();
  const entitled = resolveFusionAttentionModules(user).includes("performance");
  const feed = usePraiseFeed({ scope: "all", limit: 2 }, { enabled: entitled && Boolean(user?.tenantId) });
  const react = useReactToPraise();
  if (!entitled) return null;

  return (
    <section aria-labelledby="home-praise-heading" className="space-y-3">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <h2 id="home-praise-heading" className="type-section-title text-foreground">Praise</h2>
        <Button asChild variant="outline" size="sm">
          <a href={`${PRAISE_TAB}&compose=praise`}>Give praise</a>
        </Button>
      </div>
      {feed.error ? (
        <p className="type-body-secondary text-muted-foreground">Praise couldn&apos;t be loaded</p>
      ) : !feed.data ? (
        <div aria-label="Loading praise" className="space-y-3">
          <Skeleton className="h-28 w-full rounded-surface" />
          <Skeleton className="h-28 w-full rounded-surface" />
        </div>
      ) : (
        <PraiseList
          items={feed.data.items.slice(0, 2)}
          reactionIcons={REACTION_ICONS}
          reading
          viewerEmployeeId={user?.employeeId}
          onReact={(praise, kind, add) => react.mutate({ praiseId: praise.id, kind, add })}
          // Praise opens in Performance's drawer; it's another app, so this is a full navigation.
          onOpen={(praise) => window.location.assign(`${PRAISE_TAB}&praise=${praise.id}`)}
          empty={<p className="type-body-secondary text-muted-foreground">No praise yet</p>}
        />
      )}
      <a href={PRAISE_TAB} className="inline-flex items-center gap-1 type-label text-foreground hover:text-primary">
        All praise <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </a>
    </section>
  );
}
