import type { Test } from "@/types";

export interface AttemptLimitsTabProps {
  selectedTestId: string;
  setSelectedTestId: (value: string) => void;
  tests: Test[];
  globalMaxAttempts: number;
  setGlobalMaxAttempts: (value: number) => void;
  attemptSettingsLoading: boolean;
  attemptSettingsSaving: boolean;
  attemptSettingsError: string | null;
  attemptSettingsSuccess: string | null;
  onSaveAttemptSettings: () => void;
}
