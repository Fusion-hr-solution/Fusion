import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInArabic, sayInArabic } from "@/test/intl";
import { describeAssistance } from "@/features/data-import/model/match-assistance";
import { checkLocalSource } from "@/features/data-import/model/upload-source";
import { EmploymentStatus } from "@/features/people/components/workforce-ui";
import { formatEmploymentType } from "@/features/people/components/worker-profile/worker-profile-view";
import { reviewChips, reviewNotices } from "@/features/workforce-import/model/review-view";
import { MatchHeadline } from "@/features/data-import/components/match-banner";

describe("Core HR in Arabic", () => {
  it("names an employment state and a worker type in Arabic", () => {
    renderInArabic(<EmploymentStatus state="Scheduled" />);
    expect(screen.getByText("مجدول")).toBeInTheDocument();
    expect(formatEmploymentType("PartTime", { say: sayInArabic("profile") })).toBe("دوام جزئي");
  });

  it("words automatic matching and a local file problem in Arabic", () => {
    const say = sayInArabic("dataImport");
    expect(describeAssistance(null, 3, say).summary).toBe("3 عناصر تحتاج إلى مراجعتك.");
    const empty = new File([], "فريق.csv");
    expect(checkLocalSource(empty, { say, english: false })?.message).toBe("الملف المختار فارغ.");
  });

  it("credits AI in the Match headline in Arabic", () => {
    renderInArabic(<MatchHeadline needsReview={0} mostlyUnresolved={false} byAi noun="workforce" />);
    expect(screen.getByText(/كل بيانات موظفيك/)).toBeInTheDocument();
  });

  it("words workforce review views and findings in Arabic", () => {
    const say = sayInArabic("wfImport");
    const counts = { total: 4, create: 2, existing: 0, notImported: 1, blocked: 1, withWarnings: 0, openDecisionCount: 1 };
    expect(reviewChips(counts, say).map((chip) => chip.label)).toEqual(["الكل", "يحتاج إلى متابعة", "إنشاء", "لن يُستورد"]);
    expect(reviewNotices(counts, [], "1 سبتمبر 2026", say)[0]!.title).toBe("قرار مطلوب قبل النشر");
  });
});
