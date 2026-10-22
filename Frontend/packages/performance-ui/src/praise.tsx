import type { ReactNode } from "react";
import { PRAISE_REACTIONS, PRAISE_REACTION_LABEL, type PraiseDto, type PraiseReactionKind } from "@repo/api";
import { cn } from "@repo/ds";
import { AvatarStack, joinNames } from "./people";
import { ValueChip } from "./values";

export { initials, joinNames } from "./people";

/** The host's glyph per reaction: Performance passes its Hugeicons, the shell and Core HR their Lucide icons. */
export type PraiseReactionIcons = Record<PraiseReactionKind, ReactNode>;

export interface PraiseCardProps {
  praise: PraiseDto;
  reactionIcons: PraiseReactionIcons;
  /** Present when the viewer can react; reactions are read-only counts without it. */
  onReact?: (kind: PraiseReactionKind, add: boolean) => void;
  /** Opens the praise drawer (Performance) or its deep link (other modules). */
  onOpen?: () => void;
  /** Reactions waiting on the server, so a quick second tap doesn't fire twice. */
  pendingReaction?: PraiseReactionKind | null;
  /** The praise wall reads the message in the human voice; compact lists keep the system voice. */
  reading?: boolean;
  /** The viewer's employee id: praise naming them is marked as addressed to them. */
  viewerEmployeeId?: string | null;
}

/** "2 h ago", "Yesterday", then a short date: recent praise reads as recent. */
export function praiseTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const minutes = Math.round((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24 && at.getDate() === now.getDate()) return `${hours} h ago`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (at.toDateString() === yesterday.toDateString()) return "Yesterday";
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) });
}

/**
 * One praise, led by the people praised: their faces and names, then who gave it and when, the message, the value
 * in its own hue, and the reactions. In a list the message clamps and opens the drawer for the rest.
 */
export function PraiseCard({ praise, reactionIcons, onReact, onOpen, pendingReaction, reading = false, viewerEmployeeId }: PraiseCardProps) {
  const toViewer = Boolean(viewerEmployeeId) && praise.recipients.some((r) => r.id === viewerEmployeeId);
  const recipients = joinNames(praise.recipients.map((r) => r.name));
  const author = praise.author.name ?? "A colleague";
  const message = (
    <p className={cn(reading ? "type-narrative" : "type-body", "text-foreground", onOpen && "line-clamp-4")}>{praise.message}</p>
  );
  return (
    <article className="flex flex-col gap-3.5 rounded-surface bg-card p-5" aria-label={`${author} praised ${recipients}`}>
      <header className="flex items-center gap-3">
        <AvatarStack names={praise.recipients.map((r) => r.name)} size="lg" max={3} />
        <div className="min-w-0 flex-1">
          <p className="type-label text-foreground">{recipients}</p>
          <p className="type-meta text-muted-foreground">
            from {author} · <time dateTime={praise.givenAt}>{praiseTime(praise.givenAt)}</time>
          </p>
        </div>
      </header>
      {toViewer ? (
        <span className="self-start rounded-detail bg-primary/15 px-2 py-0.5 type-meta font-semibold text-primary">To you</span>
      ) : null}
      {onOpen ? (
        <button type="button" onClick={onOpen} className="block w-full rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {message}
        </button>
      ) : (
        message
      )}
      <ValueChip value={praise.value} className="self-start" />
      <PraiseReactions praise={praise} icons={reactionIcons} onReact={onReact} pending={pendingReaction} />
    </article>
  );
}

/** The four reactions as toggles with counts; when read-only, only those someone used show. */
export function PraiseReactions({
  praise,
  icons,
  onReact,
  pending,
}: {
  praise: PraiseDto;
  icons: PraiseReactionIcons;
  onReact?: (kind: PraiseReactionKind, add: boolean) => void;
  pending?: PraiseReactionKind | null;
}) {
  const byKind = new Map(praise.reactions.map((r) => [r.kind, r]));
  const kinds = onReact ? PRAISE_REACTIONS : PRAISE_REACTIONS.filter((kind) => (byKind.get(kind)?.count ?? 0) > 0);
  if (kinds.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
      {kinds.map((kind) => {
        const reaction = byKind.get(kind) ?? { kind, count: 0, mine: false };
        const content = (
          <>
            <span aria-hidden className="flex size-4 items-center justify-center [&_svg]:size-4">
              {icons[kind]}
            </span>
            {reaction.count > 0 ? <span className="tabular-nums">{reaction.count}</span> : null}
          </>
        );
        const label = `${PRAISE_REACTION_LABEL[kind]}${reaction.count > 0 ? `, ${reaction.count}` : ""}`;
        const shape = "inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 type-meta";
        return onReact ? (
          <button
            key={kind}
            type="button"
            aria-pressed={reaction.mine}
            aria-label={label}
            title={PRAISE_REACTION_LABEL[kind]}
            disabled={pending === kind}
            onClick={() => onReact(kind, !reaction.mine)}
            className={cn(
              shape,
              "transition-colors duration-[var(--duration-fast)]",
              reaction.mine
                ? "border-primary/30 bg-primary-tint text-primary-ink"
                : reaction.count > 0
                  ? "border-border text-muted-foreground hover:text-foreground"
                  : "border-transparent text-muted-foreground/70 hover:border-border hover:text-foreground",
            )}
          >
            {content}
          </button>
        ) : (
          <span key={kind} aria-label={label} className={cn(shape, "border-border text-muted-foreground")}>
            {content}
          </span>
        );
      })}
    </div>
  );
}

export interface PraiseListProps extends Omit<PraiseCardProps, "praise" | "onReact" | "onOpen"> {
  items: readonly PraiseDto[];
  onReact?: (praise: PraiseDto, kind: PraiseReactionKind, add: boolean) => void;
  onOpen?: (praise: PraiseDto) => void;
  /** Shown when there's nothing to list; one line, owned by the host. */
  empty?: ReactNode;
  /** Two columns on wide screens, for the praise wall. */
  wall?: boolean;
}

export function PraiseList({ items, onReact, onOpen, empty, wall = false, ...card }: PraiseListProps) {
  if (items.length === 0) return <>{empty ?? null}</>;
  return (
    <ul className={wall ? "gap-3 md:columns-2 [&>li]:mb-3 [&>li]:break-inside-avoid" : "space-y-3"}>
      {items.map((praise) => (
        <li key={praise.id}>
          <PraiseCard
            {...card}
            praise={praise}
            onReact={onReact ? (kind, add) => onReact(praise, kind, add) : undefined}
            onOpen={onOpen ? () => onOpen(praise) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
