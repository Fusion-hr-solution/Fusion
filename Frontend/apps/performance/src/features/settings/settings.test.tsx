// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, type CycleSettingsDto, type FusionSettingsSection, type ReviewQuestionDto } from "@repo/api";

const m = vi.hoisted(() => ({
  settings: undefined as CycleSettingsDto | undefined,
  save: vi.fn(),
  saveScale: vi.fn(),
  conflictSaver: null as { actorName: string; at: string; section: string } | null,
  questions: [] as ReviewQuestionDto[],
  archive: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
  create: vi.fn(),
}));

const LEVELS = [
  { value: 1, label: "Needs improvement", description: null },
  { value: 2, label: "Developing", description: null },
  { value: 3, label: "Effective", description: "Meets what the role expects" },
  { value: 4, label: "Strong", description: null },
  { value: 5, label: "Exceptional", description: null },
];
const VERSIONS = [
  { number: 2, createdAt: "2026-10-20T09:00:00Z", usedBy: [] },
  { number: 1, createdAt: "2025-09-01T09:00:00Z", usedBy: ["FY2026 · Year-end review"] },
];

vi.mock("@repo/api/query", () => ({
  useSettingsConflictSaver: (_module: string, _ids: string[], conflict: boolean) => (conflict ? m.conflictSaver : null),
  useSettingsSections: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/features/performance/api/use-performance", () => ({
  useSettings: () => ({ data: m.settings, error: null, refetch: vi.fn() }),
  useRatingScale: () => ({ data: { version: 7, scaleVersion: 2, levels: LEVELS, versions: VERSIONS }, error: null, refetch: vi.fn() }),
}));
vi.mock("@/features/performance/api/use-review-work", () => ({
  useReviewQuestions: () => ({ data: m.questions, error: null, isLoading: false, refetch: vi.fn() }),
  useReviewQuestionCommands: () => ({
    create: { mutateAsync: m.create, isLoading: false },
    update: { mutateAsync: vi.fn(), isLoading: false },
    archive: { mutateAsync: m.archive, isLoading: false },
    remove: { mutateAsync: m.remove, isLoading: false },
    reorder: { mutateAsync: m.reorder, isLoading: false },
  }),
}));
vi.mock("./api", () => ({
  useSaveCycleSettings: () => ({ mutateAsync: m.save }),
  useSaveRatingScale: () => ({ mutateAsync: m.saveScale }),
  useRefreshSettingsSections: () => vi.fn(),
}));

import {
  AiAndDataSettings,
  ReviewsSettings,
  aiAndDataConsequence,
  conversationsConsequence,
  planningConsequence,
  reviewsConsequence,
} from "./sections/cycle-sections";
import { RatingScaleSettings } from "./sections/rating-scale";
import { createTranslator } from "next-intl";
import { IntlTestProvider } from "@repo/ds/testing";
import dsFr from "@repo/ds/messages/fr.json";
import { loadPerformanceMessages } from "@/i18n/messages";
import type { Say } from "./say";
import { ReviewQuestionsSettings } from "./sections/review-questions";

const SETTINGS: CycleSettingsDto = {
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
  nineBoxBands: { lowTop: 2, midTop: 3, custom: false },
};

function section(id: string, label: string, access: "view" | "manage"): FusionSettingsSection {
  return { id, label, order: 1, path: `/performance/settings/${id}`, access, lastChange: null };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  m.conflictSaver = null;
});

describe("Consequences", () => {
  it("say what a save does, in the board's words", () => {
    expect(reviewsConsequence(SETTINGS, { ...SETTINGS, managerAssessmentDueDays: 10 })).toBe(
      "New review rounds give managers 10 days. Rounds already created keep their dates."
    );
    expect(aiAndDataConsequence(SETTINGS, { ...SETTINGS, aiAssistanceEnabled: false })).toBe(
      "Suggestions disappear everywhere at once, open reviews included."
    );
    expect(conversationsConsequence(SETTINGS, { ...SETTINGS, defaultOneOnOneCadence: "Weekly" })).toBe(
      "New 1:1 series start weekly. Series already running keep their rhythm."
    );
    expect(reviewsConsequence(SETTINGS, { ...SETTINGS, nineBoxBands: { lowTop: 2, midTop: 4, custom: true } })).toBe(
      "Calibration sessions opened from now on use the new bands."
    );
  });
});

describe("Reviews", () => {
  it("shows a view-only reader every value as text, with no controls or save bar", () => {
    m.settings = SETTINGS;
    render(<ReviewsSettings section={section("reviews", "Reviews", "view")} />);
    expect(screen.getByText("View only")).toBeTruthy();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.getByText("7 days after the self-assessment")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("stages a due-date change under the save bar and saves it with the version it read", async () => {
    m.settings = SETTINGS;
    m.save.mockResolvedValue(SETTINGS);
    render(<ReviewsSettings section={section("reviews", "Reviews", "manage")} />);
    fireEvent.change(screen.getByLabelText("Manager assessment due, in days after the self-assessment"), { target: { value: "10" } });
    expect(screen.getByText("1 change")).toBeTruthy();
    expect(screen.getByText(/New review rounds give managers 10 days/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.save).toHaveBeenCalledOnce());
    const request = m.save.mock.calls[0]![0];
    expect(request).toMatchObject({ managerAssessmentDueDays: 10, expectedVersion: 3 });
    expect(request.nineBoxBands).toBeUndefined();
  });

  it("moves the top cut point with the keyboard and saves the bands", async () => {
    m.settings = SETTINGS;
    m.save.mockResolvedValue(SETTINGS);
    render(<ReviewsSettings section={section("reviews", "Reviews", "manage")} />);
    const thumbs = screen.getAllByRole("slider");
    thumbs[1]!.focus();
    fireEvent.keyDown(thumbs[1]!, { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ nineBoxBands: { lowTop: 2, midTop: 4 } })));
  });

  it("names whoever saved first and offers Reload", async () => {
    m.settings = SETTINGS;
    m.save.mockRejectedValue(new ApiError(409, "Conflict", ["This changed since you opened it."], null));
    m.conflictSaver = { actorName: "Amira Khelifi", section: "Reviews", at: new Date(Date.now() - 60_000).toISOString() };
    render(<ReviewsSettings section={section("reviews", "Reviews", "manage")} />);
    fireEvent.change(screen.getByLabelText("Self-assessment due, in days after launch"), { target: { value: "21" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Amira Khelifi saved Reviews 1 min ago.");
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  });
});

describe("AI and data", () => {
  it("turns AI off for the tenant under the save bar", async () => {
    m.settings = SETTINGS;
    m.save.mockResolvedValue(SETTINGS);
    render(<AiAndDataSettings section={section("ai-and-data", "AI and data", "manage")} />);
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ aiAssistanceEnabled: false })));
  });
});

describe("Rating scale", () => {
  it("lists every version with the rounds that used it", () => {
    render(<RatingScaleSettings section={section("rating-scale", "Rating scale", "manage")} />);
    expect(screen.getByText("Version 2")).toBeTruthy();
    expect(screen.getByText(/Not used yet/)).toBeTruthy();
    expect(screen.getByText(/Used by FY2026 · Year-end review/)).toBeTruthy();
    expect(screen.getAllByText("Current")).toHaveLength(1);
  });

  it("saves descriptions as the next version", async () => {
    m.saveScale.mockResolvedValue(undefined);
    render(<RatingScaleSettings section={section("rating-scale", "Rating scale", "manage")} />);
    fireEvent.change(screen.getByLabelText("Level 4 description"), { target: { value: "Goes beyond the role" } });
    fireEvent.click(screen.getByRole("button", { name: "Save version 3" }));
    await waitFor(() =>
      expect(m.saveScale).toHaveBeenCalledWith(
        expect.objectContaining({ expectedVersion: 7, levels: expect.arrayContaining([expect.objectContaining({ value: 4, description: "Goes beyond the role" })]) })
      )
    );
  });
});

describe("Review questions", () => {
  it("archives a used question and deletes an unused one", async () => {
    m.questions = [
      { id: "q1", text: "What are you most proud of this year?", audience: "Person", sortOrder: 0, state: "Active", firstUsedAt: "2026-09-01T00:00:00Z", version: 2, roundCount: 2 },
      { id: "q2", text: "How did they support the team?", audience: "Manager", sortOrder: 0, state: "Active", firstUsedAt: null, version: 1, roundCount: 0 },
    ];
    m.archive.mockResolvedValue(undefined);
    m.remove.mockResolvedValue(undefined);
    render(<ReviewQuestionsSettings section={section("review-questions", "Review questions", "manage")} />);
    expect(screen.queryByRole("button", { name: "Delete: What are you most proud of this year?" })).toBeNull();
    expect(screen.getByText("Asked in 2 rounds")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive: What are you most proud of this year?" }));
    expect(m.archive).toHaveBeenCalledWith({ id: "q1", version: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Delete: How did they support the team?" }));
    expect(m.remove).toHaveBeenCalledWith({ id: "q2", version: 1 });
  });
});

const fr = await loadPerformanceMessages("fr");

describe("In French", () => {
  const french = createTranslator({ locale: "fr", messages: fr, namespace: "settings" });
  const sayInFrench: Say = (key, values) => french(key as never, values as never);

  it("says what a save does in French", () => {
    expect(reviewsConsequence(SETTINGS, { ...SETTINGS, managerAssessmentDueDays: 10 }, sayInFrench)).toBe(
      "Les nouvelles campagnes d’évaluation laissent 10 jours aux managers. Les campagnes déjà créées gardent leurs dates."
    );
    expect(planningConsequence(SETTINGS, { ...SETTINGS, planAlignmentPolicy: "Optional" }, sayInFrench)).toBe(
      "Dans les nouveaux cycles, les plans n’ont pas besoin d’être reliés aux objectifs de l’entreprise. Les cycles déjà actifs gardent les leurs."
    );
    expect(conversationsConsequence(SETTINGS, { ...SETTINGS, defaultOneOnOneCadence: "Monthly" }, sayInFrench)).toBe(
      "Les nouvelles séries d’entretiens individuels démarrent chaque mois. Les séries en cours gardent leur rythme."
    );
  });

  it("renders Reviews in French, named from the catalogue", () => {
    m.settings = SETTINGS;
    render(
      <IntlTestProvider locale="fr" messages={{ ...dsFr, ...fr }}>
        <ReviewsSettings section={section("reviews", "Reviews", "view")} />
      </IntlTestProvider>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Évaluations" })).toBeTruthy();
    expect(screen.getByText("Ce que comprend une évaluation")).toBeTruthy();
    expect(screen.getAllByText("Activé").length).toBeGreaterThan(0);
    expect(screen.getByText("Bas")).toBeTruthy();
  });
});
