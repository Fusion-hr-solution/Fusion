import type { CandidateProgressTimeline, CandidateTimelineCandidate, Test } from "@/types";

export interface TimelineTabProps {
  selectedTestId: string;
  setSelectedTestId: (value: string) => void;
  tests: Test[];
  selectedTimelineCandidateEmail: string;
  setSelectedTimelineCandidateEmail: (value: string) => void;
  timelineCandidatesLoading: boolean;
  timelineCandidates: CandidateTimelineCandidate[];
  timelineLiveEnabled: boolean;
  timelineNetworkOnline: boolean;
  timelineLiveSyncing: boolean;
  timelineLastUpdatedAtUtc: string | null;
  setTimelineLiveEnabled: (fn: (prev: boolean) => boolean) => void;
  timelineError: string | null;
  timelineLoading: boolean;
  timelineData: CandidateProgressTimeline | null;
  refreshMs: number;
}
