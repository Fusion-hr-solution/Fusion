import type { OverviewSectionDto } from "@repo/api";
import { reviewHref } from "@/lib/performance-routes";
import { formatDate } from "../../lib";
import { overviewHref, plural } from "./overview-model";
import { Facts, Headline, OverviewSection, SectionAction } from "./overview-primitives";

type Section<K extends OverviewSectionDto["kind"]> = Extract<OverviewSectionDto, { kind: K }>;

export function MyReviewSection({ section }: { section: Section<"myReview"> }) {
  const reviewId = section.openReviewId ?? section.resultReviewId;
  const label = section.openState ? reviewStage(section.openState) : "Finalized result";
  return (
    <OverviewSection label="My review" attention={Boolean(section.openReviewId)} action={reviewId
      ? <SectionAction href={reviewHref(reviewId)} primary={Boolean(section.openReviewId)}>{section.openReviewId ? "Open review" : "View result"}</SectionAction>
      : <SectionAction href={overviewHref(section.destination)}>Open Reviews</SectionAction>}>
      <Headline attention={Boolean(section.openReviewId)}>{section.openReviewId ? `Your ${label.toLowerCase()} is in progress` : section.resultReviewId ? "A finalized review result is available" : "No review is open"}</Headline>
      <Facts facts={[
        section.dueDate ? { label: `Due ${formatDate(section.dueDate)}` } : null,
        section.finalizedReviewCount > 0 ? { label: plural(section.finalizedReviewCount, "finalized result") } : null,
      ]} />
    </OverviewSection>
  );
}

export function TeamReviewsSection({ section }: { section: Section<"teamReviews"> }) {
  return (
    <OverviewSection label="Team reviews" attention action={<SectionAction href={overviewHref(section.destination)} primary>Open Reviews</SectionAction>}>
      <Headline attention>{plural(section.assessmentsReady, "reviewer assessment")} ready for you</Headline>
      <Facts facts={[
        section.assessmentsTotal > 0 ? { label: `${section.assessmentsSubmitted} of ${section.assessmentsTotal} submitted` } : null,
      ]} />
    </OverviewSection>
  );
}

export function ReviewOperationSection({ section }: { section: Section<"reviewOperation"> }) {
  const stageSummary = section.stageCounts.filter((stage) => stage.count > 0).map((stage) => `${stage.count} ${reviewStage(stage.state).toLowerCase()}`).join(" · ");
  return (
    <OverviewSection label="Review operations" action={<SectionAction href={overviewHref(section.destination)}>Open round</SectionAction>}>
      <Headline>{section.reviewRoundName} · {section.state}</Headline>
      <Facts facts={[
        section.selfAssessments && section.selfAssessments.required > 0 ? { label: `Self-assessments ${section.selfAssessments.submitted} of ${section.selfAssessments.required}` } : null,
        section.managerAssessments && section.managerAssessments.required > 0 ? { label: `Reviewer assessments ${section.managerAssessments.submitted} of ${section.managerAssessments.required}` } : null,
        stageSummary ? { label: stageSummary } : null,
        section.readyToFinalize > 0 ? { label: `${plural(section.readyToFinalize, "review")} ready to finalize`, tone: "attention" } : null,
      ]} />
    </OverviewSection>
  );
}

export function CalibrationSection({ section }: { section: Section<"calibration"> }) {
  const href = overviewHref(section.destination);
  const opened = section.sessionState !== null;
  return (
    <OverviewSection label="Calibration" attention={section.outstanding > 0} action={
      <SectionAction href={href} primary={section.outstanding > 0}>
        {section.sessionState === "Finalized" ? "View calibration" : opened ? "Open calibration" : "Start calibration"}
      </SectionAction>
    }>
      <Headline attention={section.outstanding > 0}>
        {section.sessionState === "Finalized"
          ? "Calibration is finalized"
          : section.sessionState === "Open"
            ? "Calibration is in progress"
            : section.outstanding > 0
              ? "Waiting for reviewer assessments"
              : "Calibration is ready to start"}
      </Headline>
      <Facts facts={[
        section.subjects > 0 ? { label: plural(section.subjects, "subject") } : null,
        opened ? { label: `${section.discussed} discussed · ${section.remaining} remaining` } : null,
        section.outstanding > 0 ? { label: plural(section.outstanding, "review") + " outstanding", tone: "attention" } : null,
      ]} />
    </OverviewSection>
  );
}

function reviewStage(state: string) {
  switch (state) {
    case "SelfAssessment": return "Self-assessment";
    case "ManagerAssessment": return "Reviewer assessment";
    case "Calibration": return "Calibration";
    case "ReadyToFinalize": return "Ready to finalize";
    case "Finalized": return "Finalized";
    default: return state;
  }
}
