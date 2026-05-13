import type { CandidatePrivacyActionType, CandidateTimelineCandidate, Test } from "@/types";

export interface AnonymizeTabProps {
  selectedTestId: string;
  setSelectedTestId: (value: string) => void;
  tests: Test[];
  timelineCandidates: CandidateTimelineCandidate[];
  selectedCandidateEmail: string;
  setSelectedCandidateEmail: (value: string) => void;
  adminId: string;
  setAdminId: (value: string) => void;
  action: CandidatePrivacyActionType;
  setAction: (value: CandidatePrivacyActionType) => void;
  submitting: boolean;
  error?: string | null;
  success?: string | null;
  onConfirm: () => void;
}
