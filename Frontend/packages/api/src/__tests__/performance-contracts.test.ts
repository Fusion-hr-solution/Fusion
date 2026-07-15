import { describe, expect, it } from "vitest";
import { performancePaths, performanceQueryKeys } from "../performance";

describe("performance P1.6 planning completion contracts", () => {
  it("builds campaign completion endpoint paths", () => {
    expect(performancePaths.planningCompletionWorkspace("fy26-planning")).toBe(
      "/performance/planning-completion/campaigns/fy26-planning",
    );
    expect(performancePaths.planningCompletionParticipant("cycle-1", "employee-1")).toBe(
      "/performance/planning-completion/campaigns/cycle-1/participants/employee-1",
    );
    expect(performancePaths.planningCompletionReminder("cycle-1")).toBe(
      "/performance/planning-completion/campaigns/cycle-1/reminders",
    );
    expect(performancePaths.planningCompletionReassignReviewer("cycle-1", "employee-1")).toBe(
      "/performance/planning-completion/campaigns/cycle-1/participants/employee-1/reassign-reviewer",
    );
    expect(performancePaths.planningCompletionExcludeParticipant("cycle-1", "employee-1")).toBe(
      "/performance/planning-completion/campaigns/cycle-1/participants/employee-1/exclude",
    );
    expect(performancePaths.planningCompletionLock("cycle-1")).toBe(
      "/performance/planning-completion/campaigns/cycle-1/lock",
    );
  });

  it("keeps completion query keys separate from employee and manager workspaces", () => {
    expect(
      performanceQueryKeys.planningCompletionWorkspace("fy26-planning", {
        status: "blocked",
        search: "flit",
        page: 2,
        pageSize: 20,
      }),
    ).toEqual([
      "performance",
      "planning-completion",
      "workspace",
      "fy26-planning",
      {
        status: "blocked",
        search: "flit",
        blocker: null,
        overdue: null,
        reminderNeeded: null,
        approverEmployeeId: null,
        page: 2,
        pageSize: 20,
      },
    ]);
    expect(performanceQueryKeys.planningCompletionParticipant("cycle-1", "employee-1")).toEqual([
      "performance",
      "planning-completion",
      "participant",
      "cycle-1",
      "employee-1",
    ]);
  });
});
