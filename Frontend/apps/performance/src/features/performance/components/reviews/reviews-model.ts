import type { ReviewWorkItemDto } from "@repo/api";

export function composeReviewLanding<TWork extends Pick<ReviewWorkItemDto, "isSubject" | "isReviewer" | "isAssignedToCaller">, TRound, THistory>(input: {
  work: readonly TWork[];
  rounds: readonly TRound[];
  history: readonly THistory[];
  isAdministrator: boolean;
}) {
  return {
    myReviews: input.work.filter((item) => item.isSubject),
    // Everyone the caller reviews stays visible until finalization; the ones waiting on them come first.
    reviewing: input.work
      .filter((item) => item.isReviewer)
      .sort((a, b) => Number(b.isAssignedToCaller) - Number(a.isAssignedToCaller)),
    rounds: input.isAdministrator ? input.rounds : [],
    history: input.history,
  };
}
