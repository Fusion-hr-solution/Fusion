"use client";

import { HeartHandshake, Lightbulb, PartyPopper, ThumbsUp } from "lucide-react";
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
 * The company's latest praise on the home (D-14, D-31): what colleagues recognized, beside the person's work. It's
 * Performance's, so it shows only to people who can enter Performance, and a failure there never touches the home.
 */
export function HomePraise() {
  const { user } = useAuth();
  const entitled = resolveFusionAttentionModules(user).includes("performance");
  const feed = usePraiseFeed({ scope: "all", limit: 5 }, { enabled: entitled && Boolean(user?.tenantId) });
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
          items={feed.data.items}
          reactionIcons={REACTION_ICONS}
          onReact={(praise, kind, add) => react.mutate({ praiseId: praise.id, kind, add })}
          // Praise opens in Performance's drawer; it's another app, so this is a full navigation.
          onOpen={(praise) => window.location.assign(`${PRAISE_TAB}&praise=${praise.id}`)}
          empty={<p className="type-body-secondary text-muted-foreground">No praise yet</p>}
        />
      )}
    </section>
  );
}
