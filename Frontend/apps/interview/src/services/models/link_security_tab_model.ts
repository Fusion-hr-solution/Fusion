import type { CandidateLinkPreview, GracePeriodUnit, LinkValidityUnit, Test } from "@/types";

export interface LinkSecurityTabProps {
  selectedTestId: string;
  setSelectedTestId: (value: string) => void;
  tests: Test[];
  linkSecurityLoading: boolean;
  linkSecurityError: string | null;
  linkSecuritySuccess: string | null;
  singleUseLinkEnabled: boolean;
  setSingleUseLinkEnabled: (fn: (prev: boolean) => boolean) => void;
  emailVerificationEnabled: boolean;
  setEmailVerificationEnabled: (fn: (prev: boolean) => boolean) => void;
  ipLockEnabled: boolean;
  setIpLockEnabled: (fn: (prev: boolean) => boolean) => void;
  browserFingerprintEnabled: boolean;
  setBrowserFingerprintEnabled: (fn: (prev: boolean) => boolean) => void;
  linkValidForValue: number;
  setLinkValidForValue: (value: number) => void;
  linkValidForUnit: LinkValidityUnit;
  setLinkValidForUnit: (value: LinkValidityUnit) => void;
  gracePeriodValue: number;
  setGracePeriodValue: (value: number) => void;
  gracePeriodUnit: GracePeriodUnit;
  setGracePeriodUnit: (value: GracePeriodUnit) => void;
  linkPreview: CandidateLinkPreview | null;
  formatUtcForCard: (value?: string) => string;
  onCopyLinkSecurityPreview: () => Promise<void>;
  onRegenerateLinkSecurity: () => Promise<void>;
  linkSecurityRegenerating: boolean;
  onSaveLinkSecuritySettings: () => Promise<void>;
  linkSecuritySaving: boolean;
}
