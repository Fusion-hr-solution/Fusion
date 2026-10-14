import { describe, expect, it } from "vitest";
import { composeReviewLanding } from "./reviews-model";

describe("composeReviewLanding", () => {
  const work = [
    { reviewId: "self", isSubject: true, isReviewer: false, isAssignedToCaller: true },
    { reviewId: "waiting", isSubject: true, isReviewer: false, isAssignedToCaller: false },
    { reviewId: "not-ready", isSubject: false, isReviewer: true, isAssignedToCaller: false },
    { reviewId: "assess", isSubject: false, isReviewer: true, isAssignedToCaller: true },
  ] as const;
  const rounds = [{ id: "round" }] as const;
  const history = [{ reviewId: "history" }] as const;

  it("separates own reviews from the people the caller reviews, actionable first, and limits administration", () => {
    const employee = composeReviewLanding({ work, rounds, history, isAdministrator: false });
    expect(employee.myReviews.map((item) => item.reviewId)).toEqual(["self", "waiting"]);
    expect(employee.reviewing.map((item) => item.reviewId)).toEqual(["assess", "not-ready"]);
    expect(employee.rounds).toEqual([]);
    expect(employee.history).toBe(history);

    const administrator = composeReviewLanding({ work, rounds, history, isAdministrator: true });
    expect(administrator.rounds).toBe(rounds);
  });
});
