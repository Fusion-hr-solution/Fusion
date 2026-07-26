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

describe("performance evaluation execution contracts", () => {
  it("builds skills configuration and round skill paths", () => {
    expect(performancePaths.skillsWorkspace()).toBe("/performance/skills-config/workspace");
    expect(performancePaths.skillExpectationSetStatus("set-1")).toBe(
      "/performance/skills-config/sets/set-1/status",
    );
    expect(performancePaths.proficiencyScaleDuplicate("scale-1")).toBe(
      "/performance/skills-config/scales/scale-1/duplicate",
    );
    expect(performancePaths.evaluationRoundWeights("round-1")).toBe(
      "/performance/evaluations/round-1/weights",
    );
    expect(performancePaths.evaluationRoundSkillItemExpectedLevel("round-1", "item-1")).toBe(
      "/performance/evaluations/round-1/skills/items/item-1/expected-level",
    );
  });

  it("builds assessment workspace and action paths", () => {
    expect(performancePaths.myAssessmentWorkspace("round-1")).toBe(
      "/performance/assessments/rounds/round-1/self",
    );
    expect(performancePaths.participantAssessmentWorkspace("round-1", "employee-1")).toBe(
      "/performance/assessments/rounds/round-1/participants/employee-1",
    );
    expect(performancePaths.finalizeEvaluation("assignment-1")).toBe(
      "/performance/assessments/assignments/assignment-1/finalize",
    );
    expect(performancePaths.roundCompletion("round-1")).toBe(
      "/performance/assessments/rounds/round-1/completion",
    );
  });

  it("keeps skills, self, team, and completion caches distinct", () => {
    expect(performanceQueryKeys.skillsWorkspace()).toEqual([
      "performance", "skills-configuration", "workspace",
    ]);
    expect(performanceQueryKeys.myAssessmentWorkspace("round-1")).toEqual([
      "performance", "assessments", "self", "round-1",
    ]);
    expect(performanceQueryKeys.participantAssessmentWorkspace("round-1", "employee-1")).toEqual([
      "performance", "assessments", "participant", "round-1", "employee-1",
    ]);
    expect(performanceQueryKeys.roundCompletion("round-1")).toEqual([
      "performance", "assessments", "completion", "round-1",
    ]);
  });
});
