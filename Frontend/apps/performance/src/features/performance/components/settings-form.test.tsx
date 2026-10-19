// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CycleSettingsDto } from "@repo/api";
import { SettingsForm } from "./settings-form";

const api = vi.hoisted(() => {
  const idle = { mutateAsync: async () => ({}), isLoading: false };
  return {
    update: { mutateAsync: vi.fn(async () => ({})), isLoading: false },
    scale: { data: { version: 1, scaleVersion: 1, levels: [] }, isLoading: false, error: null },
    competencies: { data: [], isLoading: false, error: null },
    idle,
    competencyMutations: { create: idle, update: idle, archive: idle, remove: idle },
  };
});
const update = api.update;
vi.mock("../api/use-performance", () => ({
  useUpdateSettings: () => api.update,
  useRatingScale: () => api.scale,
  useUpdateRatingScale: () => api.idle,
  useCompetencies: () => api.competencies,
  useCompetencyMutations: () => api.competencyMutations,
}));
vi.mock("@/features/performance/api/performance-failure", () => ({ reportPerformanceFailure: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const settings: CycleSettingsDto = {
  version: 3,
  defaultMeasurementMethod: "NumericTarget",
  suggestedObjectiveCountMin: 3,
  suggestedObjectiveCountMax: 6,
  planningDeadlineOffsetDays: 30,
  planAlignmentPolicy: "AtLeastOneConnected",
  defaultSelfAssessmentEnabled: true,
  defaultObjectiveRatingsEnabled: true,
  defaultCalibrationEnabled: false,
  evidenceRetentionMonths: 36,
  aiAssistanceEnabled: true,
  defaultOneOnOneCadence: "EveryTwoWeeks",
  selfAssessmentDueDays: 14,
  peerInputDueDays: 14,
  managerAssessmentDueDays: 7,
  acknowledgementReminderDays: 7,
};

describe("AI assistance setting", () => {
  it("turns AI off for the tenant and saves it with the other settings", async () => {
    render(<SettingsForm settings={settings} />);

    const toggle = screen.getByRole("switch", { name: "AI assistance" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    });

    expect(update.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ aiAssistanceEnabled: false, expectedVersion: 3 }));
  });
});
