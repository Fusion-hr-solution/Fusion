import type { CandidateProgressTimeline, CandidateTimelineCandidate, Test } from "@/types";

export interface RetakeTabProps {
  selectedTestId: string;
  setSelectedTestId: (value: string) => void;
  tests: Test[];
  selectedTimelineCandidateEmail: string;
  setSelectedTimelineCandidateEmail: (value: string) => void;
  timelineCandidatesLoading: boolean;
  timelineCandidates: CandidateTimelineCandidate[];
  timelineError: string | null;
  timelineLoading: boolean;
  timelineData: CandidateProgressTimeline | null;
  timelineLastUpdatedAtUtc: string | null;
  grantRetakeSending: boolean;
  grantRetakeError: string | null;
  grantRetakeSuccess: string | null;
  onGrantRetake: () => Promise<void>;
}