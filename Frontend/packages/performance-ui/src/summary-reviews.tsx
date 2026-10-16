import type { PersonSummaryReviewsDto } from "@repo/api";
import { formatDate, stepLabel, type RenderSummaryLink } from "./summary-lib";

/** The open review, then released results across cycles, newest first. Each opens the review. */
export function SummaryReviews({ reviews, renderLink }: { reviews: PersonSummaryReviewsDto; renderLink: RenderSummaryLink }) {
  const current = reviews.current;
  const rows = [
    ...(current
      ? [
          {
            id: current.reviewId,
            href: current.href,
            title: current.reviewRoundName,
            detail: current.dueDate ? `Due ${formatDate(current.dueDate)}` : "In progress",
            outcome: current.state === "Closed" ? "Closed" : stepLabel(current.state),
            current: true,
          },
        ]
      : []),
    ...reviews.history.map((result) => ({
      id: result.reviewId,
      href: result.href,
      title: `${result.reviewRoundName}, ${result.cycleName}`,
      detail: result.finalizedAt ? `Finalized ${formatDate(result.finalizedAt)}` : "Finalized",
      outcome: result.finalRatingLabel ?? "No rating",
      current: false,
    })),
  ];

  return (
    <section aria-labelledby="summary-reviews-heading" className="space-y-3">
      <h2 id="summary-reviews-heading" className="type-section-title text-foreground">
        Reviews
      </h2>
      {rows.length === 0 ? (
        <p className="type-body-secondary text-muted-foreground">No reviews yet</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-surface bg-card">
          {rows.map((row) => (
            <li key={row.id}>
              {renderLink({
                href: row.href,
                className: "group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted",
                children: (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate type-body font-medium text-foreground group-hover:underline">{row.title}</span>
                      <span className="block truncate type-meta text-muted-foreground">{row.detail}</span>
                    </span>
                    <span className={row.current ? "shrink-0 type-label text-primary-ink" : "shrink-0 type-label text-foreground"}>
                      {row.outcome}
                    </span>
                  </>
                ),
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
