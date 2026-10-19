import type { PersonSummaryFeedbackDto, PersonSummaryOneOnOneDto, PersonSummaryPraiseDto, PraiseDto, PraiseReactionKind } from "@repo/api";
import { StatusBadge } from "@repo/ds/shell";
import { PraiseList, initials, type PraiseReactionIcons } from "./praise";
import { formatDate, type RenderSummaryLink } from "./summary-lib";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";

const linkClass = "type-label text-primary-ink hover:underline";

/** The person's next 1:1 with the viewer; the server only sends it to the two people. */
export function SummaryOneOnOne({ oneOnOne, renderLink }: { oneOnOne: PersonSummaryOneOnOneDto; renderLink: RenderSummaryLink }) {
  const next = oneOnOne.nextMeetingAt ? new Date(oneOnOne.nextMeetingAt) : null;
  return (
    <section aria-label="1:1" className="flex flex-wrap items-center justify-between gap-3 rounded-surface bg-card px-5 py-4">
      <div className="min-w-0">
        <p className="type-eyebrow text-muted-foreground">Next 1:1</p>
        <p className="type-body text-foreground">
          {next
            ? next.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
            : "Not scheduled"}
        </p>
      </div>
      {renderLink({ href: oneOnOne.href, className: linkClass, children: "Open 1:1s" })}
    </section>
  );
}

/** Feedback the person received, as the viewer may see it; manager-only items are marked. */
export function SummaryFeedback({ feedback, renderLink }: { feedback: PersonSummaryFeedbackDto; renderLink: RenderSummaryLink }) {
  return (
    <section aria-labelledby="summary-feedback-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="summary-feedback-heading" className="type-section-title text-foreground">
          Feedback {feedback.total > 0 ? <span className="type-metric text-muted-foreground">{feedback.total}</span> : null}
        </h2>
        {feedback.total > 0 ? renderLink({ href: feedback.href, className: linkClass, children: "Open feedback" }) : null}
      </div>
      {feedback.items.length === 0 ? (
        <p className="type-body-secondary text-muted-foreground">No feedback yet</p>
      ) : (
        <ul className="divide-y divide-border rounded-surface bg-card">
          {feedback.items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-5 py-4">
              <Avatar className="size-8">
                <AvatarFallback className="text-[0.65rem] font-medium">{initials(item.author.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="type-label text-foreground">{item.author.name ?? "A colleague"}</span>
                  {item.subject ? (
                    <span className="rounded-control bg-inlay px-2 py-0.5 type-meta text-foreground">{item.subject.label}</span>
                  ) : null}
                  {item.visibility === "ManagerOnly" ? <StatusBadge tone="neutral">Manager only</StatusBadge> : null}
                  <span className="type-meta text-muted-foreground">{formatDate(item.sentAt)}</span>
                </div>
                <p className="type-body line-clamp-2 text-foreground">{item.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface SummaryPraiseProps {
  praise: PersonSummaryPraiseDto;
  renderLink: RenderSummaryLink;
  reactionIcons: PraiseReactionIcons;
  onReact?: (praise: PraiseDto, kind: PraiseReactionKind, add: boolean) => void;
  onOpen?: (praise: PraiseDto) => void;
}

/** Praise the person received: everyone in Performance sees it. */
export function SummaryPraise({ praise, renderLink, reactionIcons, onReact, onOpen }: SummaryPraiseProps) {
  return (
    <section aria-labelledby="summary-praise-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="summary-praise-heading" className="type-section-title text-foreground">
          Praise {praise.total > 0 ? <span className="type-metric text-muted-foreground">{praise.total}</span> : null}
        </h2>
        {praise.total > praise.items.length ? renderLink({ href: praise.href, className: linkClass, children: "See all praise" }) : null}
      </div>
      <PraiseList
        items={praise.items}
        reactionIcons={reactionIcons}
        onReact={onReact}
        onOpen={onOpen}
        empty={<p className="type-body-secondary text-muted-foreground">No praise yet</p>}
      />
    </section>
  );
}


