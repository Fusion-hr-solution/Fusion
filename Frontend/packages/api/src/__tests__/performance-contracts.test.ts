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

describe("performance evaluation foundation contracts", () => {
  it("builds configuration and round paths", () => {
    expect(performancePaths.evaluationScaleStatus("scale-1")).toBe(
      "/performance/evaluation-config/scales/scale-1/status",
    );
    expect(performancePaths.evaluationTemplatePreview("template-1", "Manager")).toBe(
      "/performance/evaluation-config/templates/template-1/preview?rater=Manager",
    );
    expect(performancePaths.evaluationRoundReadiness("round-1")).toBe(
      "/performance/evaluations/round-1/readiness",
    );
    expect(performancePaths.evaluationRoundExclusion("round-1", "employee-1")).toBe(
      "/performance/evaluations/round-1/participants/employee-1/exclusion",
    );
  });

  it("keeps admin, employee, and reviewer caches distinct", () => {
    expect(performanceQueryKeys.evaluationRoundReadiness("round-1")).toEqual([
      "performance", "evaluations", "round-1", "readiness",
    ]);
    expect(performanceQueryKeys.myEvaluationAssignments()).toEqual([
      "performance", "evaluations", "mine",
    ]);
    expect(performanceQueryKeys.teamEvaluationAssignments()).toEqual([
      "performance", "evaluations", "team",
    ]);
  });
});
