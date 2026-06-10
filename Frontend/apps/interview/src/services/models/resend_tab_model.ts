import type { CandidateInvitation, Test } from "@/types";

export type ResendStatusFilter = "all" | "Invited" | "DeliveryFailed";

export interface ResendTabProps {
  resendSearch: string;
  setResendSearch: (value: string) => void;
  resendStatusFilter: ResendStatusFilter;
  setResendStatusFilter: (value: ResendStatusFilter) => void;
  resendTestFilter: string;
  setResendTestFilter: (value: string) => void;
  tests: Test[];
  resendError: string | null;
  resendSuccess: string | null;
  filteredResendInvitations: CandidateInvitation[];
  initialsFromInvitation: (item: CandidateInvitation) => string;
  setResendError: (value: string | null) => void;
  setResendModalItem: (item: CandidateInvitation | null) => void;
  resendModalItem: CandidateInvitation | null;
  resendSubmitting: boolean;
  onConfirmResend: () => Promise<void>;
  onDeleteCandidate?: (id: string) => Promise<void>;
  deleteSubmitting?: boolean;
}
