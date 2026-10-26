// @repo/performance-ui: shared Performance parts for other modules and Performance itself.
// No icons and no routing: links come from the host through `renderLink`.

export { PersonPerformanceSummary } from "./person-performance-summary";
export type { PersonPerformanceSummaryProps, PersonPerformanceSummaryState } from "./person-performance-summary";
export { PlanDial, ResultsOverTime, ReviewStepTrack, SummaryGlance } from "./summary-glance";
export { SummaryObjectives } from "./summary-objectives";
export { SummaryReviews } from "./summary-reviews";
export { SummaryDevelopment } from "./summary-development";
export { ObjectiveStatusBadge, statusMix } from "./objective-status";
export { usePerformanceWords } from "./use-words";
export type { StatusMix } from "./objective-status";
export type { RenderSummaryLink } from "./summary-lib";
export { PraiseCard, PraiseList, PraiseReactions } from "./praise";
export { AvatarStack, PersonInitials, initials } from "./people";
export type { PersonInitialsSize } from "./people";
export { VALUE_TONE, ValueChip, ValueDot, useValueTones, valueTone } from "./values";
export type { ValueTone } from "./values";
export type { PraiseCardProps, PraiseListProps, PraiseReactionIcons } from "./praise";
export { SummaryFeedback, SummaryOneOnOne, SummaryPraise } from "./summary-conversations";
export type { SummaryPraiseProps } from "./summary-conversations";
