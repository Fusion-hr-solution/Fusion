"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ShieldCheck, History, RotateCcw, Settings2, UserX, Clock3, Link2, Check, FileUp, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteResultPopup } from "@/components/candidate-management/invite-result-popup";
import { CsvImportReportPopup } from "@/components/candidate-management/csv-import-report-popup";
import { InviteTab } from "@/components/candidate-management/tabs/invite-tab";
import { ResendTab } from "@/components/candidate-management/tabs/resend-tab";
import { LinkSecurityTab } from "@/components/candidate-management/tabs/link-security-tab";
import { TimelineTab } from "@/components/candidate-management/tabs/timeline-tab";
import { RetakeTab } from "@/components/candidate-management/tabs/retake-tab";
import { AttemptLimitsTab } from "@/components/candidate-management/tabs/attempt-limits-tab";
import { AnonymizeTab } from "@/components/candidate-management/tabs/anonymize-tab";
import type { CsvImportReport } from "@/services/models/csv_import_report_popup_model";
import type { InviteResult } from "@/services/models/invite_result_popup_model";
import type { InviteMethod } from "@/services/models/invite_tab_model";
import type { ResendStatusFilter } from "@/services/models/resend_tab_model";
import {
  grantCandidateRetake,
  getCandidateAttemptSettings,
  getCandidateProgressTimeline,
  getCandidateTimelineCandidates,
  getCandidateLinkSecurityState,
  getCandidateManagementOverview,
  getPendingInvitations,
  inviteCandidates,
  applyCandidatePrivacyAction,
  regenerateCandidateLinkSecurityLink,
  resendInvitation,
  saveCandidateAttemptSettings,
  saveCandidateLinkSecuritySettings,
} from "@/services/candidate-management-service";
import { getTests } from "@/services/test-service";
import { useNetworkStatus } from "@/hooks/use-network-status";
import {
  extractEmailsFromCsv,
  readCsvFileText,
  type CsvCandidateRow,
} from "@/lib/candidate-management-utils";
import type {
  CandidateProgressTimeline,
  CandidateTimelineCandidate,
  CandidateInvitation,
  CandidateLinkPreview,
  CandidateLinkSecurityState,
  CandidateManagementOverview,
  CandidatePrivacyActionType,
  GracePeriodUnit,
  LinkValidityUnit,
  Test,
} from "@/types";

type CandidateTabKey =
  | "invite"
  | "resend"
  | "link-security"
  | "timeline"
  | "retake"
  | "limits"
  | "anonymize"
  | "retention";

interface TabConfig {
  key: CandidateTabKey;
  label: string;
  icon: React.ElementType;
  description: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIMELINE_LIVE_REFRESH_MS = 5000;

const TAB_CONFIG: TabConfig[] = [
  {
    key: "invite",
    label: "Invite Candidate",
    icon: Mail,
    description: "Email, bulk, and link invite flow with multi-email chips",
  },
  {
    key: "resend",
    label: "Resend Invitation",
    icon: Mail,
    description: "Pending invitations table with resend modal",
  },
  {
    key: "link-security",
    label: "Link Security & Expiry",
    icon: ShieldCheck,
    description: "Single-use, IP lock, and expiry controls",
  },
  {
    key: "timeline",
    label: "Progress Timeline",
    icon: History,
    description: "Vertical journey tracker from invited to submitted",
  },
  {
    key: "retake",
    label: "Grant Retake",
    icon: RotateCcw,
    description: "Attempt history and controlled retake workflow",
  },
  {
    key: "limits",
    label: "Attempt Limits & Policies",
    icon: Settings2,
    description: "Global defaults and per-test override behavior",
  },
  {
    key: "anonymize",
    label: "Anonymize / Delete",
    icon: UserX,
    description: "Candidate data actions with destructive confirmation",
  },
  {
    key: "retention",
    label: "Retention Window",
    icon: Clock3,
    description: "Auto-deletion policy and upcoming deletions",
  },
];

const TAB_SET = new Set<CandidateTabKey>(TAB_CONFIG.map((tab) => tab.key));
const DEFAULT_TAB_CONFIG: TabConfig = TAB_CONFIG[0] ?? {
  key: "invite",
  label: "Invite Candidate",
  icon: Mail,
  description: "Email, bulk, and link invite flow with multi-email chips",
};

function parseTab(input: string | null): CandidateTabKey {
  if (input && TAB_SET.has(input as CandidateTabKey)) {
    return input as CandidateTabKey;
  }
  return "invite";
}

export function CandidateManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timelineNetworkOnline = useNetworkStatus();
  const [overview, setOverview] = useState<CandidateManagementOverview | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [invitations, setInvitations] = useState<CandidateInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendSearch, setResendSearch] = useState("");
  const [resendStatusFilter, setResendStatusFilter] = useState<ResendStatusFilter>("all");
  const [resendTestFilter, setResendTestFilter] = useState("all");
  const [resendModalItem, setResendModalItem] = useState<CandidateInvitation | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteStep, setInviteStep] = useState<1 | 2 | 3>(1);
  const [inviteMethod, setInviteMethod] = useState<InviteMethod>("email");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [linkExpiryHours, setLinkExpiryHours] = useState(72);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [customMessage, setCustomMessage] = useState("");
  const [sendNowNotification, setSendNowNotification] = useState(true);

  const [emailInput, setEmailInput] = useState("");
  const [emailChips, setEmailChips] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvCandidateRow[]>([]);
  const [inviteResultPopup, setInviteResultPopup] = useState<InviteResult | null>(null);
  const [csvImportReport, setCsvImportReport] = useState<CsvImportReport | null>(null);
  const [singleUseLinkEnabled, setSingleUseLinkEnabled] = useState(true);
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(true);
  const [ipLockEnabled, setIpLockEnabled] = useState(false);
  const [browserFingerprintEnabled, setBrowserFingerprintEnabled] = useState(false);
  const [linkValidForValue, setLinkValidForValue] = useState(7);
  const [linkValidForUnit, setLinkValidForUnit] = useState<LinkValidityUnit>("days");
  const [gracePeriodValue, setGracePeriodValue] = useState(30);
  const [gracePeriodUnit, setGracePeriodUnit] = useState<GracePeriodUnit>("minutes");
  const [linkSecurityLoading, setLinkSecurityLoading] = useState(false);
  const [linkSecuritySaving, setLinkSecuritySaving] = useState(false);
  const [linkSecurityRegenerating, setLinkSecurityRegenerating] = useState(false);
  const [linkSecurityError, setLinkSecurityError] = useState<string | null>(null);
  const [linkSecuritySuccess, setLinkSecuritySuccess] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<CandidateLinkPreview | null>(null);
  const [attemptSettingsLoading, setAttemptSettingsLoading] = useState(false);
  const [attemptSettingsSaving, setAttemptSettingsSaving] = useState(false);
  const [attemptSettingsError, setAttemptSettingsError] = useState<string | null>(null);
  const [attemptSettingsSuccess, setAttemptSettingsSuccess] = useState<string | null>(null);
  const [globalMaxAttempts, setGlobalMaxAttempts] = useState(0);
  const [timelineCandidates, setTimelineCandidates] = useState<CandidateTimelineCandidate[]>([]);
  const [timelineCandidatesForTestId, setTimelineCandidatesForTestId] = useState("");
  const [timelineCandidatesLoading, setTimelineCandidatesLoading] = useState(false);
  const [selectedTimelineCandidateEmail, setSelectedTimelineCandidateEmail] = useState("");
  const [timelineData, setTimelineData] = useState<CandidateProgressTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineLiveEnabled, setTimelineLiveEnabled] = useState(true);
  const [timelineLiveSyncing, setTimelineLiveSyncing] = useState(false);
  const [timelineLastUpdatedAtUtc, setTimelineLastUpdatedAtUtc] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [grantRetakeSending, setGrantRetakeSending] = useState(false);
  const [grantRetakeError, setGrantRetakeError] = useState<string | null>(null);
  const [grantRetakeSuccess, setGrantRetakeSuccess] = useState<string | null>(null);
  const [privacyAction, setPrivacyAction] = useState<CandidatePrivacyActionType>("anonymize");
  const [privacyAdminId, setPrivacyAdminId] = useState("");
  const [privacySubmitting, setPrivacySubmitting] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacySuccess, setPrivacySuccess] = useState<string | null>(null);
  const popupTimerRef = useRef<number | null>(null);
  const csvReportTimerRef = useRef<number | null>(null);

  const activeTab = parseTab(searchParams.get("tab"));

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      setLoading(true);
      setError(null);
      try {
        const [overviewData, testData, invitationData] = await Promise.all([
          getCandidateManagementOverview(),
          getTests(),
          getPendingInvitations(),
        ]);
        if (!isMounted) return;
        setOverview(overviewData);
        setTests(testData);
        setInvitations(invitationData);
        if (!selectedTestId && testData.length > 0) {
          setSelectedTestId(testData[0]?.id ?? "");
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load candidate management overview.");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current !== null) {
        window.clearTimeout(popupTimerRef.current);
      }
      if (csvReportTimerRef.current !== null) {
        window.clearTimeout(csvReportTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "resend") {
      return;
    }

    let isMounted = true;

    async function refreshResendInvitations() {
      try {
        const invitationData = await getPendingInvitations();
        if (!isMounted) {
          return;
        }
        setResendError(null);
        setResendSuccess(null);

        setInvitations(invitationData);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setResendError(err instanceof Error ? err.message : "Failed to refresh invitations.");
      }
    }

    void refreshResendInvitations();

    const intervalId = window.setInterval(() => {
      void refreshResendInvitations();
    }, 15000);

    function handleFocus() {
      void refreshResendInvitations();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshResendInvitations();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "link-security" || !selectedTestId) {
      return;
    }

    let isMounted = true;

    async function loadLinkSecurityState() {
      setLinkSecurityLoading(true);
      setLinkSecurityError(null);

      try {
        const state = await getCandidateLinkSecurityState(selectedTestId);
        if (!isMounted) {
          return;
        }

        applyLinkSecurityState(state);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setLinkSecurityError(err instanceof Error ? err.message : "Failed to load link security settings.");
      } finally {
        if (!isMounted) {
          return;
        }

        setLinkSecurityLoading(false);
      }
    }

    void loadLinkSecurityState();

    return () => {
      isMounted = false;
    };
  }, [activeTab, selectedTestId]);

  useEffect(() => {
    if (activeTab !== "limits") {
      return;
    }

    let isMounted = true;

    async function loadAttemptSettings() {
      setAttemptSettingsLoading(true);
      setAttemptSettingsError(null);

      try {
        const settings = await getCandidateAttemptSettings();
        if (!isMounted) {
          return;
        }
        setGlobalMaxAttempts(settings.defaultMaxAttempts);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setAttemptSettingsError(err instanceof Error ? err.message : "Failed to load attempt settings.");
      } finally {
        if (!isMounted) {
          return;
        }
        setAttemptSettingsLoading(false);
      }
    }

    void loadAttemptSettings();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  useEffect(() => {
    if ((activeTab !== "timeline" && activeTab !== "retake" && activeTab !== "anonymize") || !selectedTestId) {
      return;
    }

    setTimelineCandidates([]);
    setTimelineCandidatesForTestId("");
    setSelectedTimelineCandidateEmail("");
    setTimelineData(null);

    let isMounted = true;

    async function loadTimelineCandidates() {
      setTimelineCandidatesLoading(true);
      setTimelineError(null);

      try {
        const candidates = await getCandidateTimelineCandidates(selectedTestId);
        if (!isMounted) {
          return;
        }

        setTimelineCandidates(candidates);
        setTimelineCandidatesForTestId(selectedTestId);
        setTimelineLastUpdatedAtUtc(new Date().toISOString());

        if (candidates.length === 0) {
          setSelectedTimelineCandidateEmail("");
          setTimelineData(null);
          return;
        }

        setSelectedTimelineCandidateEmail((prev) =>
          candidates.some((item) => item.candidateEmail === prev)
            ? prev
            : candidates[0]?.candidateEmail ?? ""
        );
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setTimelineError(err instanceof Error ? err.message : "Failed to load timeline candidates.");
      } finally {
        if (!isMounted) {
          return;
        }

        setTimelineCandidatesLoading(false);
      }
    }

    void loadTimelineCandidates();

    return () => {
      isMounted = false;
    };
  }, [activeTab, selectedTestId]);

  useEffect(() => {
    if (
      (activeTab !== "timeline" && activeTab !== "retake") ||
      !selectedTestId ||
      !selectedTimelineCandidateEmail ||
      timelineCandidatesForTestId != selectedTestId
    ) {
      return;
    }

    let isMounted = true;

    async function loadTimeline() {
      setTimelineLoading(true);
      setTimelineError(null);

      try {
        const data = await getCandidateProgressTimeline(selectedTestId, selectedTimelineCandidateEmail);
        if (!isMounted) {
          return;
        }

        setTimelineData(data);
        setTimelineLastUpdatedAtUtc(new Date().toISOString());
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setTimelineData(null);
        setTimelineError(err instanceof Error ? err.message : "Failed to load candidate timeline.");
      } finally {
        if (!isMounted) {
          return;
        }

        setTimelineLoading(false);
      }
    }

    void loadTimeline();

    return () => {
      isMounted = false;
    };
  }, [
    activeTab,
    selectedTestId,
    selectedTimelineCandidateEmail,
    timelineCandidatesForTestId,
  ]);

  useEffect(() => {
    setGrantRetakeError(null);
    setGrantRetakeSuccess(null);
  }, [selectedTestId, selectedTimelineCandidateEmail]);

  useEffect(() => {
    if (activeTab !== "anonymize") {
      return;
    }

    setPrivacyError(null);
    setPrivacySuccess(null);
  }, [activeTab, selectedTestId, selectedTimelineCandidateEmail, privacyAction, privacyAdminId]);

  useEffect(() => {
    if (activeTab !== "limits") {
      return;
    }

    setAttemptSettingsError(null);
    setAttemptSettingsSuccess(null);
  }, [activeTab, globalMaxAttempts]);

  useEffect(() => {
    if (
      activeTab !== "timeline" ||
      !selectedTestId ||
      !timelineLiveEnabled ||
      timelineCandidatesLoading ||
      timelineLoading
    ) {
      return;
    }

    let isMounted = true;
    let refreshInFlight = false;
    let offlineMessageShown = false;

    function isOffline(): boolean {
      return typeof navigator !== "undefined" && !navigator.onLine;
    }

    async function refreshTimelineLive() {
      if (refreshInFlight) {
        return;
      }

      if (isOffline()) {
        if (isMounted && !offlineMessageShown) {
          setTimelineError("Internet disconnected. Live updates will resume automatically when connection returns.");
          setTimelineLiveSyncing(false);
        }
        offlineMessageShown = true;
        return;
      }

      offlineMessageShown = false;

      refreshInFlight = true;
      if (isMounted) {
        setTimelineLiveSyncing(true);
      }

      try {
        const candidates = await getCandidateTimelineCandidates(selectedTestId);
        if (!isMounted) {
          return;
        }

        setTimelineCandidates(candidates);
        setTimelineCandidatesForTestId(selectedTestId);

        if (candidates.length === 0) {
          setSelectedTimelineCandidateEmail("");
          setTimelineData(null);
          setTimelineError(null);
          setTimelineLastUpdatedAtUtc(new Date().toISOString());
          return;
        }

        const nextCandidateEmail = candidates.some((item) => item.candidateEmail === selectedTimelineCandidateEmail)
          ? selectedTimelineCandidateEmail
          : candidates[0]?.candidateEmail ?? "";

        if (!nextCandidateEmail) {
          setTimelineLastUpdatedAtUtc(new Date().toISOString());
          return;
        }

        if (nextCandidateEmail !== selectedTimelineCandidateEmail) {
          setSelectedTimelineCandidateEmail(nextCandidateEmail);
        }

        const data = await getCandidateProgressTimeline(selectedTestId, nextCandidateEmail);
        if (!isMounted) {
          return;
        }

        setTimelineData(data);
        setTimelineError(null);
        setTimelineLastUpdatedAtUtc(new Date().toISOString());
      } catch (err) {
        if (!isMounted) {
          return;
        }

        const offlineNow = isOffline();
        if (offlineNow) {
          offlineMessageShown = true;
          setTimelineError("Internet disconnected. Live updates will resume automatically when connection returns.");
        } else {
          setTimelineError(err instanceof Error ? err.message : "Failed to refresh candidate timeline.");
        }
      } finally {
        refreshInFlight = false;
        if (isMounted) {
          setTimelineLiveSyncing(false);
        }
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshTimelineLive();
      }
    }, TIMELINE_LIVE_REFRESH_MS);

    function handleFocus() {
      void refreshTimelineLive();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshTimelineLive();
      }
    }

    function handleOnline() {
      offlineMessageShown = false;
      void refreshTimelineLive();
    }

    function handleOffline() {
      offlineMessageShown = true;
      if (isMounted) {
        setTimelineError("Internet disconnected. Live updates will resume automatically when connection returns.");
        setTimelineLiveSyncing(false);
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [
    activeTab,
    selectedTestId,
    selectedTimelineCandidateEmail,
    timelineCandidatesLoading,
    timelineLoading,
    timelineLiveEnabled,
  ]);

  const activeConfig = useMemo(
    () => TAB_CONFIG.find((tab) => tab.key === activeTab) ?? DEFAULT_TAB_CONFIG,
    [activeTab]
  );

  const recipients = useMemo(() => {
    const list = [...emailChips];
    if (emailInput.trim()) {
      const buffered = emailInput.trim().toLowerCase();
      if (buffered.includes("@") && !list.includes(buffered)) {
        list.push(buffered);
      }
    }
    return list;
  }, [emailChips, emailInput]);

  const selectedTest = useMemo(
    () => tests.find((item) => item.id === selectedTestId),
    [selectedTestId, tests]
  );

  function applyLinkSecurityState(state: CandidateLinkSecurityState): void {
    setSingleUseLinkEnabled(state.settings.singleUseLinkEnabled);
    setEmailVerificationEnabled(state.settings.emailVerificationEnabled);
    setIpLockEnabled(state.settings.ipLockEnabled);
    setBrowserFingerprintEnabled(state.settings.browserFingerprintEnabled);
    setLinkValidForValue(state.settings.linkValidForValue);
    setLinkValidForUnit(state.settings.linkValidForUnit);
    setGracePeriodValue(state.settings.gracePeriodValue);
    setGracePeriodUnit(state.settings.gracePeriodUnit);
    setLinkPreview(state.preview);
  }

  function formatUtcForCard(value?: string): string {
    if (!value) {
      return "Not generated";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleSaveAttemptSettings(): Promise<void> {
    setAttemptSettingsSaving(true);
    setAttemptSettingsError(null);
    setAttemptSettingsSuccess(null);

    try {
      const saved = await saveCandidateAttemptSettings({
        defaultMaxAttempts: globalMaxAttempts,
      });
      setGlobalMaxAttempts(saved.defaultMaxAttempts);
      setAttemptSettingsSuccess("Attempt policy saved.");
    } catch (err) {
      setAttemptSettingsError(err instanceof Error ? err.message : "Failed to save attempt settings.");
    } finally {
      setAttemptSettingsSaving(false);
    }
  }

  function switchTab(tab: CandidateTabKey): void {
    router.push(`/candidates?tab=${tab}`);
  }

  function addEmailChip(raw: string): void {
    const next = raw.trim().toLowerCase();
    if (!next || !next.includes("@")) return;
    setEmailChips((prev) => (prev.includes(next) ? prev : [...prev, next]));
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (emailInput.trim()) {
        addEmailChip(emailInput);
        setEmailInput("");
      }
    }
    if (e.key === "Backspace" && !emailInput.trim() && emailChips.length > 0) {
      setEmailChips((prev) => prev.slice(0, -1));
    }
  }

  function removeEmailChip(email: string): void {
    setEmailChips((prev) => prev.filter((item) => item !== email));
    setCsvPreviewRows((prev) => prev.filter((item) => item.email !== email));
  }

  function clearAllEmailChips(): void {
    setEmailChips([]);
    setEmailInput("");
    setCsvPreviewRows([]);
  }

  function resetInviteWizard(): void {
    setInviteStep(1);
    setInviteMethod("email");
    setCandidateName("");
    setDeadlineDate("");
    setLinkExpiryHours(72);
    setTimeLimitMinutes(60);
    setCustomMessage("");
    setSendNowNotification(true);
    setEmailChips([]);
    setEmailInput("");
    setCsvPreviewRows([]);
    setInviteError(null);
    setInviteSuccess(null);
  }

  function showInviteResultPopup(status: "success" | "error", message: string): void {
    setInviteResultPopup({ status, message });
    if (popupTimerRef.current !== null) {
      window.clearTimeout(popupTimerRef.current);
    }
    popupTimerRef.current = window.setTimeout(() => {
      setInviteResultPopup(null);
      resetInviteWizard();
    }, 1800);
  }

  function showCsvImportReport(report: CsvImportReport): void {
    setCsvImportReport(report);
    if (csvReportTimerRef.current !== null) {
      window.clearTimeout(csvReportTimerRef.current);
    }
    csvReportTimerRef.current = window.setTimeout(() => {
      setCsvImportReport(null);
    }, 3200);
  }

  async function handleSendInvitations(): Promise<void> {
    setInviteError(null);
    setInviteSuccess(null);

    const emails = recipients;
    const csvNameByEmail = new Map(
      csvPreviewRows.map((item) => [item.email.toLowerCase(), item.name])
    );
    const candidateEntries =
      inviteMethod === "bulk"
        ? emails
            .map((email) => {
              const normalizedName = csvNameByEmail.get(email.toLowerCase())?.trim() || "";
              return {
                email,
                candidateName: normalizedName || undefined,
              };
            })
            .filter((entry) => Boolean(entry.candidateName))
        : undefined;

    if (!selectedTestId) {
      setInviteError("Select a test before sending invitations.");
      return;
    }

    if (emails.length === 0) {
      setInviteError("Add at least one email.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await inviteCandidates({
        testId: selectedTestId,
        emails,
        candidateEntries,
        inviteMethod,
        candidateName: candidateName.trim() || undefined,
        deadlineUtc: deadlineDate ? new Date(`${deadlineDate}T23:59:59.000Z`).toISOString() : undefined,
        linkExpiryHours: linkExpiryHours > 0 ? linkExpiryHours : undefined,
        timeLimitMinutes: timeLimitMinutes > 0 ? timeLimitMinutes : undefined,
        customMessage: customMessage.trim() || undefined,
        sendNowNotification,
      });

      const deliveredCount = created.filter((item) => item.status === "Invited").length;
      const failedCount = created.length - deliveredCount;

      setEmailChips([]);
      setEmailInput("");
      if (failedCount === 0) {
        setInviteSuccess(`${deliveredCount} invitation(s) sent.`);
        showInviteResultPopup("success", `${deliveredCount} invitation(s) sent successfully.`);
      } else if (deliveredCount === 0) {
        const failureMessage = `${failedCount} invitation(s) failed delivery. Check SMTP configuration or use the Resend tab.`;
        setInviteError(failureMessage);
        showInviteResultPopup("error", failureMessage);
      } else {
        setInviteSuccess(`${deliveredCount} invitation(s) sent.`);
        const partialMessage = `${deliveredCount} sent, ${failedCount} failed delivery.`;
        setInviteError(`${failedCount} invitation(s) failed delivery. Check SMTP configuration or use the Resend tab.`);
        showInviteResultPopup("error", partialMessage);
      }
      setInvitations((prev) => [...created, ...prev]);
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              pendingInvitations: prev.pendingInvitations + created.length,
              generatedAtUtc: new Date().toISOString(),
            }
          : prev
      );
    } catch (err) {
      const failureMessage = err instanceof Error ? err.message : "Failed to send invitations.";
      setInviteError(failureMessage);
      showInviteResultPopup("error", failureMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function canProceedFromStep(step: 1 | 2): boolean {
    if (step === 1) {
      return Boolean(inviteMethod);
    }

    return recipients.length > 0;
  }

  function goNextStep(): void {
    setInviteError(null);
    if (inviteStep === 1) {
      setInviteStep(2);
      return;
    }

    if (inviteStep === 2) {
      if (!canProceedFromStep(2)) {
        setInviteError(
          "Add at least one valid candidate email before continuing."
        );
        return;
      }
      setInviteStep(3);
    }
  }

  function goPrevStep(): void {
    setInviteError(null);
    if (inviteStep === 1) return;
    setInviteStep((prev) => (prev === 3 ? 2 : 1));
  }

  function selectMethod(method: InviteMethod): void {
    setInviteMethod(method);
    setInviteError(null);
    setInviteSuccess(null);
    setEmailChips([]);
    setEmailInput("");
    setCsvPreviewRows([]);
    setCandidateName("");
    setCustomMessage("");
    setDeadlineDate("");
  }

  async function importCsvEmails(file: File): Promise<void> {
    const content = await readCsvFileText(file);
    const parsed = extractEmailsFromCsv(content);
    const merged = Array.from(new Set([...emailChips, ...parsed.emails]));
    const importedCount = merged.length - emailChips.length;
    const duplicateCount = parsed.duplicateCount + (parsed.emails.length - importedCount);

    showCsvImportReport({
      importedCount,
      duplicateCount,
      invalidCount: parsed.invalidCount,
    });

    if (parsed.emails.length === 0) {
      setInviteError("No valid emails found in CSV.");
      setInviteSuccess(null);
      return;
    }

    setEmailChips(merged);
    setCsvPreviewRows((prev) => {
      const next = new Map<string, CsvCandidateRow>();

      for (const item of prev) {
        next.set(item.email, item);
      }

      for (const item of parsed.rows) {
        const existing = next.get(item.email);
        if (!existing) {
          next.set(item.email, item);
          continue;
        }

        if (!existing.name && item.name) {
          next.set(item.email, item);
        }
      }

      return Array.from(next.values());
    });
    setInviteError(null);
    if (importedCount === 0) {
      setInviteSuccess("No new emails were added. All valid emails are already in the list.");
      return;
    }

    const duplicateSuffix =
      duplicateCount > 0
        ? ` ${duplicateCount} duplicate entr${duplicateCount === 1 ? "y" : "ies"} skipped.`
        : "";
    const invalidSuffix =
      parsed.invalidCount > 0
        ? ` ${parsed.invalidCount} invalid entr${parsed.invalidCount === 1 ? "y" : "ies"} ignored.`
        : "";
    setInviteSuccess(
      `Imported ${importedCount} candidate email(s) from CSV.${duplicateSuffix}${invalidSuffix}`
    );
  }

  const filteredResendInvitations = useMemo(() => {
    const keyword = resendSearch.trim().toLowerCase();

    return invitations.filter((item) => {
      const matchesKeyword =
        keyword.length === 0 ||
        item.email.toLowerCase().includes(keyword) ||
        (item.candidateName ?? "").toLowerCase().includes(keyword) ||
        item.testTitle.toLowerCase().includes(keyword);

      const matchesStatus = resendStatusFilter === "all" || item.status === resendStatusFilter;
      const matchesTest = resendTestFilter === "all" || item.testId === resendTestFilter;

      return matchesKeyword && matchesStatus && matchesTest;
    });
  }, [invitations, resendSearch, resendStatusFilter, resendTestFilter]);

  function initialsFromInvitation(item: CandidateInvitation): string {
    const label = item.candidateName?.trim() || item.email;
    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return (label.slice(0, 2) || "NA").toUpperCase();
  }

  async function handleConfirmResend(): Promise<void> {
    if (!resendModalItem) return;

    setResendSubmitting(true);
    setResendError(null);
    setResendSuccess(null);
    try {
      const updated = await resendInvitation(resendModalItem.id);
      setInvitations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (updated.status === "Invited") {
        setResendSuccess(`Invitation resent to ${updated.email}.`);
      } else {
        setResendError(`Resend attempted for ${updated.email}, but delivery failed. Check SMTP configuration.`);
      }
      setResendModalItem(null);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend invitation.");
    } finally {
      setResendSubmitting(false);
    }
  }

  async function handleSaveLinkSecuritySettings(): Promise<void> {
    if (!selectedTestId) {
      setLinkSecurityError("Select a test before saving link security settings.");
      return;
    }

    setLinkSecuritySaving(true);
    setLinkSecurityError(null);
    setLinkSecuritySuccess(null);

    try {
      const state = await saveCandidateLinkSecuritySettings({
        testId: selectedTestId,
        singleUseLinkEnabled,
        emailVerificationEnabled,
        ipLockEnabled,
        browserFingerprintEnabled,
        linkValidForValue,
        linkValidForUnit,
        gracePeriodValue,
        gracePeriodUnit,
      });

      applyLinkSecurityState(state);
      setLinkSecuritySuccess("Link security settings saved.");
    } catch (err) {
      setLinkSecurityError(err instanceof Error ? err.message : "Failed to save link security settings.");
    } finally {
      setLinkSecuritySaving(false);
    }
  }

  async function handleRegenerateLinkSecurity(): Promise<void> {
    if (!selectedTestId) {
      setLinkSecurityError("Select a test before regenerating a link.");
      return;
    }

    setLinkSecurityRegenerating(true);
    setLinkSecurityError(null);
    setLinkSecuritySuccess(null);

    try {
      const state = await regenerateCandidateLinkSecurityLink(selectedTestId);
      applyLinkSecurityState(state);
      setLinkSecuritySuccess("Invite link regenerated.");
    } catch (err) {
      setLinkSecurityError(err instanceof Error ? err.message : "Failed to regenerate invite link.");
    } finally {
      setLinkSecurityRegenerating(false);
    }
  }

  async function handleCopyLinkSecurityPreview(): Promise<void> {
    const inviteLink = linkPreview?.inviteLink;
    if (!inviteLink) {
      setLinkSecurityError("No active invitation link is available to copy.");
      return;
    }

    setLinkSecurityError(null);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = inviteLink;
        tempInput.setAttribute("readonly", "");
        tempInput.style.position = "absolute";
        tempInput.style.left = "-9999px";
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }

      setLinkSecuritySuccess("Invite link copied to clipboard.");
    } catch {
      setLinkSecurityError("Failed to copy invite link. Please copy it manually.");
    }
  }

  async function handleGrantRetake(): Promise<void> {
    if (!selectedTestId) {
      setGrantRetakeError("Select a test before granting a retake.");
      return;
    }

    if (!selectedTimelineCandidateEmail) {
      setGrantRetakeError("Select a candidate before granting a retake.");
      return;
    }

    setGrantRetakeSending(true);
    setGrantRetakeError(null);
    setGrantRetakeSuccess(null);

    try {
      const result = await grantCandidateRetake({
        testId: selectedTestId,
        candidateEmail: selectedTimelineCandidateEmail,
      });

      const [candidates, timeline] = await Promise.all([
        getCandidateTimelineCandidates(selectedTestId),
        getCandidateProgressTimeline(selectedTestId, selectedTimelineCandidateEmail),
      ]);

      setTimelineCandidates(candidates);
      setTimelineCandidatesForTestId(selectedTestId);
      setTimelineData(timeline);
      setTimelineLastUpdatedAtUtc(new Date().toISOString());
      setTimelineError(null);

      setGrantRetakeSuccess(
        `Granted attempt ${result.attemptNumber} for ${result.candidateEmail}. Email delivery was triggered.`
      );
    } catch (err) {
      setGrantRetakeError(err instanceof Error ? err.message : "Failed to grant retake.");
    } finally {
      setGrantRetakeSending(false);
    }
  }

  async function handlePrivacyAction(): Promise<void> {
    if (!selectedTestId) {
      setPrivacyError("Select a test before applying a privacy action.");
      return;
    }

    if (!selectedTimelineCandidateEmail) {
      setPrivacyError("Select a candidate before applying a privacy action.");
      return;
    }

    const trimmedAdminId = privacyAdminId.trim();
    if (!trimmedAdminId) {
      setPrivacyError("Enter an admin ID before continuing.");
      return;
    }

    setPrivacySubmitting(true);
    setPrivacyError(null);
    setPrivacySuccess(null);

    try {
      const result = await applyCandidatePrivacyAction({
        testId: selectedTestId,
        candidateEmail: selectedTimelineCandidateEmail,
        action: privacyAction,
        adminId: trimmedAdminId,
        triggerSource: "UI",
      });

      const candidates = await getCandidateTimelineCandidates(selectedTestId);
      setTimelineCandidates(candidates);
      setTimelineCandidatesForTestId(selectedTestId);
      setTimelineData(null);
      setTimelineLastUpdatedAtUtc(new Date().toISOString());

      const nextCandidateEmail = candidates.some(
        (item) => item.candidateEmail === result.candidateAliasEmail
      )
        ? result.candidateAliasEmail
        : candidates[0]?.candidateEmail ?? "";
      setSelectedTimelineCandidateEmail(nextCandidateEmail);

      const actionLabel = privacyAction === "anonymize" ? "Anonymized" : "PII deleted";
      setPrivacySuccess(`${actionLabel} for ${result.candidateAliasEmail}.`);
    } catch (err) {
      setPrivacyError(err instanceof Error ? err.message : "Failed to apply privacy action.");
    } finally {
      setPrivacySubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white px-8 py-5">
        <h1 className="text-[24px] font-semibold text-zinc-900">Candidate Management</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Manage invitations, journey states, limits, and retention policies.
        </p>
      </div>

      <div className="px-8 py-6">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {TAB_CONFIG.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    onClick={() => switchTab(tab.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors",
                      isActive ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-6">
            <h2 className="text-[20px] font-bold text-zinc-900">{activeConfig.label}</h2>
            <p className="mt-1 text-[13px] text-zinc-500">{activeConfig.description}</p>

            {activeTab === "invite" ? (
              <InviteTab
                inviteStep={inviteStep}
                inviteMethod={inviteMethod}
                recipients={recipients}
                csvPreviewRows={csvPreviewRows}
                candidateName={candidateName}
                setCandidateName={setCandidateName}
                emailChips={emailChips}
                removeEmailChip={removeEmailChip}
                emailInput={emailInput}
                setEmailInput={setEmailInput}
                handleEmailKeyDown={handleEmailKeyDown}
                addEmailChip={addEmailChip}
                clearAllEmailChips={clearAllEmailChips}
                importCsvEmails={importCsvEmails}
                selectedTestId={selectedTestId}
                setSelectedTestId={setSelectedTestId}
                tests={tests}
                deadlineDate={deadlineDate}
                setDeadlineDate={setDeadlineDate}
                timeLimitMinutes={timeLimitMinutes}
                setTimeLimitMinutes={setTimeLimitMinutes}
                linkExpiryHours={linkExpiryHours}
                setLinkExpiryHours={setLinkExpiryHours}
                sendNowNotification={sendNowNotification}
                setSendNowNotification={setSendNowNotification}
                customMessage={customMessage}
                setCustomMessage={setCustomMessage}
                selectedTest={selectedTest}
                inviteError={inviteError}
                inviteSuccess={inviteSuccess}
                goPrevStep={goPrevStep}
                goNextStep={goNextStep}
                canProceedFromStep={canProceedFromStep}
                submitting={submitting}
                handleSendInvitations={handleSendInvitations}
                selectMethod={selectMethod}
              />
            ) : activeTab === "resend" ? (
              <ResendTab
                resendSearch={resendSearch}
                setResendSearch={setResendSearch}
                resendStatusFilter={resendStatusFilter}
                setResendStatusFilter={setResendStatusFilter}
                resendTestFilter={resendTestFilter}
                setResendTestFilter={setResendTestFilter}
                tests={tests}
                resendError={resendError}
                resendSuccess={resendSuccess}
                filteredResendInvitations={filteredResendInvitations}
                initialsFromInvitation={initialsFromInvitation}
                setResendError={setResendError}
                setResendModalItem={setResendModalItem}
                resendModalItem={resendModalItem}
                resendSubmitting={resendSubmitting}
                onConfirmResend={handleConfirmResend}
              />
            ) : activeTab === "link-security" ? (
              <LinkSecurityTab
                selectedTestId={selectedTestId}
                setSelectedTestId={setSelectedTestId}
                tests={tests}
                linkSecurityLoading={linkSecurityLoading}
                linkSecurityError={linkSecurityError}
                linkSecuritySuccess={linkSecuritySuccess}
                singleUseLinkEnabled={singleUseLinkEnabled}
                setSingleUseLinkEnabled={setSingleUseLinkEnabled}
                emailVerificationEnabled={emailVerificationEnabled}
                setEmailVerificationEnabled={setEmailVerificationEnabled}
                ipLockEnabled={ipLockEnabled}
                setIpLockEnabled={setIpLockEnabled}
                browserFingerprintEnabled={browserFingerprintEnabled}
                setBrowserFingerprintEnabled={setBrowserFingerprintEnabled}
                linkValidForValue={linkValidForValue}
                setLinkValidForValue={setLinkValidForValue}
                linkValidForUnit={linkValidForUnit}
                setLinkValidForUnit={setLinkValidForUnit}
                gracePeriodValue={gracePeriodValue}
                setGracePeriodValue={setGracePeriodValue}
                gracePeriodUnit={gracePeriodUnit}
                setGracePeriodUnit={setGracePeriodUnit}
                linkPreview={linkPreview}
                formatUtcForCard={formatUtcForCard}
                onCopyLinkSecurityPreview={handleCopyLinkSecurityPreview}
                onRegenerateLinkSecurity={handleRegenerateLinkSecurity}
                linkSecurityRegenerating={linkSecurityRegenerating}
                onSaveLinkSecuritySettings={handleSaveLinkSecuritySettings}
                linkSecuritySaving={linkSecuritySaving}
              />
            ) : activeTab === "timeline" ? (
              <TimelineTab
                selectedTestId={selectedTestId}
                setSelectedTestId={setSelectedTestId}
                tests={tests}
                selectedTimelineCandidateEmail={selectedTimelineCandidateEmail}
                setSelectedTimelineCandidateEmail={setSelectedTimelineCandidateEmail}
                timelineCandidatesLoading={timelineCandidatesLoading}
                timelineCandidates={timelineCandidates}
                timelineLiveEnabled={timelineLiveEnabled}
                timelineNetworkOnline={timelineNetworkOnline}
                timelineLiveSyncing={timelineLiveSyncing}
                timelineLastUpdatedAtUtc={timelineLastUpdatedAtUtc}
                setTimelineLiveEnabled={setTimelineLiveEnabled}
                timelineError={timelineError}
                timelineLoading={timelineLoading}
                timelineData={timelineData}
                refreshMs={TIMELINE_LIVE_REFRESH_MS}
              />
            ) : activeTab === "retake" ? (
              <RetakeTab
                selectedTestId={selectedTestId}
                setSelectedTestId={setSelectedTestId}
                tests={tests}
                selectedTimelineCandidateEmail={selectedTimelineCandidateEmail}
                setSelectedTimelineCandidateEmail={setSelectedTimelineCandidateEmail}
                timelineCandidatesLoading={timelineCandidatesLoading}
                timelineCandidates={timelineCandidates}
                timelineError={timelineError}
                timelineLoading={timelineLoading}
                timelineData={timelineData}
                timelineLastUpdatedAtUtc={timelineLastUpdatedAtUtc}
                grantRetakeSending={grantRetakeSending}
                grantRetakeError={grantRetakeError}
                grantRetakeSuccess={grantRetakeSuccess}
                onGrantRetake={handleGrantRetake}
              />
            ) : activeTab === "limits" ? (
              <AttemptLimitsTab
                selectedTestId={selectedTestId}
                setSelectedTestId={setSelectedTestId}
                tests={tests}
                globalMaxAttempts={globalMaxAttempts}
                setGlobalMaxAttempts={setGlobalMaxAttempts}
                attemptSettingsLoading={attemptSettingsLoading}
                attemptSettingsSaving={attemptSettingsSaving}
                attemptSettingsError={attemptSettingsError}
                attemptSettingsSuccess={attemptSettingsSuccess}
                onSaveAttemptSettings={handleSaveAttemptSettings}
              />
            ) : activeTab === "anonymize" ? (
              <AnonymizeTab
                selectedTestId={selectedTestId}
                setSelectedTestId={setSelectedTestId}
                tests={tests}
                timelineCandidates={timelineCandidates}
                selectedCandidateEmail={selectedTimelineCandidateEmail}
                setSelectedCandidateEmail={setSelectedTimelineCandidateEmail}
                adminId={privacyAdminId}
                setAdminId={setPrivacyAdminId}
                action={privacyAction}
                setAction={setPrivacyAction}
                submitting={privacySubmitting}
                error={privacyError}
                success={privacySuccess}
                onConfirm={handlePrivacyAction}
              />
            ) : (
              <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-[13px] font-medium text-zinc-700">
                  Tab scaffold is ready for the next step implementation.
                </p>
                <p className="mt-1 text-[12px] text-zinc-500">
                  We will implement this screen end-to-end in its dedicated iteration.
                </p>
              </div>
            )}

            {loading ? (
              <p className="mt-4 text-[12px] text-zinc-500">Loading overview data...</p>
            ) : overview?.generatedAtUtc ? (
              <p className="mt-4 text-[12px] text-zinc-500">
                Overview refreshed: {new Date(overview.generatedAtUtc).toLocaleString("en-US")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <InviteResultPopup result={inviteResultPopup} />
      <CsvImportReportPopup report={csvImportReport} />
    </div>
  );
}


