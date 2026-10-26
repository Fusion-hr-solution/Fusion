import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInFrench, sayInFrench } from "@/test/intl";
import { describeAssistance } from "@/features/data-import/model/match-assistance";
import { checkLocalSource } from "@/features/data-import/model/upload-source";
import { EmploymentStatus } from "@/features/people/components/workforce-ui";
import { formatEmploymentType } from "@/features/people/components/worker-profile/worker-profile-view";
import { reviewChips, reviewNotices } from "@/features/workforce-import/model/review-view";
import { MatchHeadline } from "@/features/data-import/components/match-banner";

describe("Core HR in French", () => {
  it("names an employment state and a worker type in French", () => {
    renderInFrench(<EmploymentStatus state="Scheduled" />);
    expect(screen.getByText("À venir")).toBeInTheDocument();
    expect(formatEmploymentType("PartTime", { say: sayInFrench("profile") })).toBe("Temps partiel");
  });

  it("words automatic matching and a local file problem in French", () => {
    const say = sayInFrench("dataImport");
    expect(describeAssistance(null, 2, say).summary).toBe("2 éléments demandent votre vérification.");
    const empty = new File([], "équipe.csv");
    expect(checkLocalSource(empty, { say, english: false })?.message).toBe("Le fichier choisi est vide.");
  });

  it("credits AI in the Match headline in French", () => {
    renderInFrench(<MatchHeadline needsReview={0} mostlyUnresolved={false} byAi noun="workforce" />);
    expect(screen.getByText(/toutes vos données de collaborateurs/)).toBeInTheDocument();
  });

  it("words workforce review views and findings in French", () => {
    const say = sayInFrench("wfImport");
    const counts = { total: 4, create: 2, existing: 0, notImported: 1, blocked: 1, withWarnings: 0, openDecisionCount: 1 };
    expect(reviewChips(counts, say).map((chip) => chip.label)).toEqual(["Tous", "À traiter", "Créés", "Non importés"]);
    expect(reviewNotices(counts, [], "1 sept. 2026", say)[0]!.title).toBe("Décision à prendre avant de publier");
  });
});
