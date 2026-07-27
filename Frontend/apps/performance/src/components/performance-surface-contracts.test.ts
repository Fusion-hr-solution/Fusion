import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL(".", import.meta.url);
const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, root), "utf8");

describe("Performance workflow surface contracts", () => {
  it("keeps objective authoring truthful across submit and correction states", () => {
    const page = source("my-objectives/my-objectives-pages.tsx");
    expect(page).toContain("changesRequested");
    expect(page).toContain("readyToResubmit");
    expect(page).toContain("readOnly");
    expect(page).toContain("You do not have permission");
  });

  it("keeps approval actions scoped and explicit", () => {
    const page = source("plan-approvals/plan-approvals-pages.tsx");
    expect(page).toContain("Approval scope required");
    expect(page).toContain("Plan approved");
    expect(page).toContain("Changes requested");
    expect(page).toContain("canAct");
  });

  it("keeps assessment save, conflict, and terminal actions represented", () => {
    const participant = source("evaluations/assessment/participant-workspace.tsx");
    const self = source("evaluations/assessment/self-assessment-workspace.tsx");
    expect(participant).toContain("useAssessmentAutosave");
    expect(participant).toContain("finalize");
    expect(participant).toContain("acknowledge");
    expect(self).toContain("useAssessmentAutosave");
    expect(self).toContain("submit");
    expect(self).toContain("version");
  });

  it("keeps check-in and skills surfaces permission-gated", () => {
    const checkIn = source("check-ins/check-in-detail-page.tsx");
    const skills = source("evaluations/skills-configuration/skills-configuration-page.tsx");
    expect(checkIn).toContain("canAccessTeamProgress");
    expect(skills).toContain("canManageSkills");
    expect(skills).toContain("SkillsConfigurationPage");
  });
});
