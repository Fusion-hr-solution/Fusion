import { describe, expect, it } from "vitest";
import type { TeamRosterMemberDto } from "@repo/api";
import { latestRosterActivity } from "./roster-activity";

type Source = Pick<TeamRosterMemberDto, "activityKind" | "activityAt" | "updateRequest">;

describe("Your People last activity", () => {
  const prior: Source = { activityKind: "ProgressUpdated", activityAt: "2026-10-07T00:00:00Z" };

  it("shows a newer request instead of stale progress time", () => {
    expect(latestRosterActivity({ ...prior, updateRequest: {
      id: "request", state: "Open", objectiveTitle: "Improve onboarding", requestedAt: "2026-10-08T00:00:00Z",
      satisfiedAt: null, version: 1,
    } })).toEqual({ label: "Update requested", at: "2026-10-08T00:00:00Z", objectiveTitle: "Improve onboarding" });
  });

  it("keeps the newer progress event after an older satisfied request", () => {
    expect(latestRosterActivity({ ...prior, updateRequest: {
      id: "request", state: "Satisfied", objectiveTitle: null, requestedAt: "2026-10-05T00:00:00Z",
      satisfiedAt: "2026-10-06T00:00:00Z", version: 2,
    } })).toEqual({ label: "Progress updated", at: prior.activityAt, objectiveTitle: null });
  });

  it("does not invent activity when neither source has an event", () => {
    expect(latestRosterActivity({ activityKind: "None", activityAt: null })).toBeNull();
  });
});
