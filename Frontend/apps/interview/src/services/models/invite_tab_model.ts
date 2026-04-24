import type { KeyboardEvent } from "react";
import type { CsvCandidateRow } from "@/lib/candidate-management-utils";
import type { Test } from "@/types";

export type InviteMethod = "email" | "bulk" | "link";

export interface InviteTabProps {
  inviteStep: 1 | 2 | 3;
  inviteMethod: InviteMethod;
  recipients: string[];
  csvPreviewRows: CsvCandidateRow[];
  candidateName: string;
  setCandidateName: (value: string) => void;
  emailChips: string[];
  removeEmailChip: (email: string) => void;
  emailInput: string;
  setEmailInput: (value: string) => void;
  handleEmailKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  addEmailChip: (raw: string) => void;
  clearAllEmailChips: () => void;
  importCsvEmails: (file: File) => Promise<void>;
  selectedTestId: string;
  setSelectedTestId: (value: string) => void;
  tests: Test[];
  deadlineDate: string;
  setDeadlineDate: (value: string) => void;
  timeLimitMinutes: number;
  setTimeLimitMinutes: (value: number) => void;
  linkExpiryHours: number;
  setLinkExpiryHours: (value: number) => void;
  sendNowNotification: boolean;
  setSendNowNotification: (value: boolean) => void;
  customMessage: string;
  setCustomMessage: (value: string) => void;
  selectedTest?: Test;
  inviteError: string | null;
  inviteSuccess: string | null;
  goPrevStep: () => void;
  goNextStep: () => void;
  canProceedFromStep: (step: 1 | 2) => boolean;
  submitting: boolean;
  handleSendInvitations: () => Promise<void>;
  selectMethod: (method: InviteMethod) => void;
}
