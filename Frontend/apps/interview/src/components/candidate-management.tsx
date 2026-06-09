"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ShieldCheck, History, RotateCcw, Settings2, UserX, Clock3, X, RefreshCw, ClipboardCheck } from "lucide-react";
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
import { RetentionTab } from "@/components/candidate-management/tabs/retention-tab";
import { HumanReviewTab } from "@/components/candidate-management/tabs/human-review-tab";
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
  deleteInvitation,
  saveCandidateAttemptSettings,
  saveCandidateLinkSecuritySettings,
  getCandidateRetentionState,
  saveCandidateRetentionSettings,
  runCandidateRetention,
} from "@/services/candidate-management-service";
import { getTests } from "@/services/test-service";
import { useNetworkStatus } from "@/hooks/use-network-status";
import {
  extractEmailsFromCsv,
  readCsvFileText,
  type CsvCandidateRow,
} from "@/lib/candidate-management-utils";
import type {
  CandidateLinkPreview,
  CandidateLinkSecurityState,
  CandidatePrivacyActionType,
  CandidateRetentionSettings,
  GracePeriodUnit,
  LinkValidityUnit,
} from "@/types";

type CandidateTabKey =
  | "invite"
  | "resend"
  | "link-security"
  | "timeline"
  | "retake"
  | "limits"
  | "anonymize"
  | "retention"
  | "review";

interface TabConfig {
  key: CandidateTabKey;
  label: string;
  icon: React.ElementType;
  description: string;
}

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
  {
    key: "review",
    label: "Review Queue",
    icon: ClipboardCheck,
    description: "AI-graded responses that need manual verification",
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
  const queryClient = useQueryClient();

  // ── UI / form state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendSearch, setResendSearch] = useState("");
  const [resendStatusFilter, setResendStatusFilter] = useState<ResendStatusFilter>("all");
  const [resendTestFilter, setResendTestFilter] = useState("all");
  const [resendModalItem, setResendModalItem] = useState<(typeof invitations)[number] | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
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

  // Link security form state (seeded from query, then user-editable)
  const [singleUseLinkEnabled, setSingleUseLinkEnabled] = useState(true);
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(true);
  const [ipLockEnabled, setIpLockEnabled] = useState(false);
  const [browserFingerprintEnabled, setBrowserFingerprintEnabled] = useState(false);
  const [linkValidForValue, setLinkValidForValue] = useState(7);
  const [linkValidForUnit, setLinkValidForUnit] = useState<LinkValidityUnit>("days");
  const [gracePeriodValue, setGracePeriodValue] = useState(30);
  const [gracePeriodUnit, setGracePeriodUnit] = useState<GracePeriodUnit>("minutes");
  const [linkSecuritySaving, setLinkSecuritySaving] = useState(false);
  const [linkSecurityRegenerating, setLinkSecurityRegenerating] = useState(false);
  const [linkSecurityMutationError, setLinkSecurityMutationError] = useState<string | null>(null);
  const [linkSecuritySuccess, setLinkSecuritySuccess] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<CandidateLinkPreview | null>(null);

  // Attempt settings form state (seeded from query, then user-editable)
  const [attemptSettingsSaving, setAttemptSettingsSaving] = useState(false);
  const [attemptSettingsMutationError, setAttemptSettingsMutationError] = useState<string | null>(null);
  const [attemptSettingsSuccess, setAttemptSettingsSuccess] = useState<string | null>(null);
  const [globalMaxAttempts, setGlobalMaxAttempts] = useState(0);

  // Timeline UI state
  const [selectedTimelineCandidateEmail, setSelectedTimelineCandidateEmail] = useState("");
  const [timelineLiveEnabled, setTimelineLiveEnabled] = useState(true);

  // Retake / privacy state
  const [grantRetakeSending, setGrantRetakeSending] = useState(false);
  const [grantRetakeError, setGrantRetakeError] = useState<string | null>(null);
  const [grantRetakeSuccess, setGrantRetakeSuccess] = useState<string | null>(null);
  const [privacyAction, setPrivacyAction] = useState<CandidatePrivacyActionType>("anonymize");
  const [privacyAdminId, setPrivacyAdminId] = useState("");
  const [privacySubmitting, setPrivacySubmitting] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacySuccess, setPrivacySuccess] = useState<string | null>(null);

  // Retention mutation state
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [retentionSaveError, setRetentionSaveError] = useState<string | null>(null);
  const [retentionRunError, setRetentionRunError] = useState<string | null>(null);
  const [retentionRunSuccess, setRetentionRunSuccess] = useState<string | null>(null);

  const popupTimerRef = useRef<number | null>(null);
  const csvReportTimerRef = useRef<number | null>(null);

  const activeTab = parseTab(searchParams.get("tab"));
  const timelineTabActive = activeTab === "timeline" || activeTab === "retake" || activeTab === "anonymize";

  // ── Server state (React Query) ───────────────────────────────────────────────

  const { data: overview, isLoading: loading, error: overviewQueryError } = useQuery({
    queryKey: ["candidate-overview"],
    queryFn: getCandidateManagementOverview,
  });

  const { data: tests = [] } = useQuery({
    queryKey: ["tests"],
    queryFn: () => getTests(),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations"],
    queryFn: () => getPendingInvitations(),
    refetchInterval: activeTab === "resend" ? 15000 : false,
    refetchOnWindowFocus: activeTab === "resend",
  });

  const {
    data: linkSecurityData,
    isLoading: linkSecurityLoading,
    error: linkSecurityQueryError,
  } = useQuery({
    queryKey: ["link-security", selectedTestId],
    queryFn: () => getCandidateLinkSecurityState(selectedTestId),
    enabled: activeTab === "link-security" && !!selectedTestId,
  });

  const {
    data: attemptSettingsData,
    isLoading: attemptSettingsLoading,
    error: attemptSettingsQueryError,
  } = useQuery({
    queryKey: ["attempt-settings"],
    queryFn: getCandidateAttemptSettings,
    enabled: activeTab === "limits",
  });

  const {
    data: retentionData,
    isLoading: retentionLoading,
    error: retentionQueryError,
  } = useQuery({
    queryKey: ["retention"],
    queryFn: getCandidateRetentionState,
    enabled: activeTab === "retention",
  });

  const {
    data: timelineCandidates = [],
    isLoading: timelineCandidatesLoading,
    error: timelineCandidatesQueryError,
  } = useQuery({
    queryKey: ["timeline-candidates", selectedTestId],
    queryFn: () => getCandidateTimelineCandidates(selectedTestId),
    enabled: timelineTabActive && !!selectedTestId,
    refetchInterval:
      activeTab === "timeline" && timelineLiveEnabled && timelineNetworkOnline
        ? TIMELINE_LIVE_REFRESH_MS
        : false,
    refetchOnWindowFocus: activeTab === "timeline" && timelineLiveEnabled,
  });

  const timelineQuery = useQuery({
    queryKey: ["timeline", selectedTestId, selectedTimelineCandidateEmail],
    queryFn: () =>
      getCandidateProgressTimeline(selectedTestId, selectedTimelineCandidateEmail),
    enabled:
      (activeTab === "timeline" || activeTab === "retake") &&
      !!selectedTestId &&
      !!selectedTimelineCandidateEmail &&
      timelineCandidates.some((c) => c.candidateEmail === selectedTimelineCandidateEmail),
    refetchInterval:
      activeTab === "timeline" && timelineLiveEnabled && timelineNetworkOnline
        ? TIMELINE_LIVE_REFRESH_MS
        : false,
    refetchOnWindowFocus: activeTab === "timeline" && timelineLiveEnabled,
  });

  // Derive timeline display values from query
  const timelineData = timelineQuery.data ?? null;
  const timelineLoading = timelineQuery.isLoading;
  const timelineLiveSyncing = timelineQuery.isFetching && !timelineQuery.isLoading;
  const timelineLastUpdatedAtUtc = timelineQuery.dataUpdatedAt
    ? new Date(timelineQuery.dataUpdatedAt).toISOString()
    : null;
  const timelineError =
    activeTab === "timeline" && timelineLiveEnabled && !timelineNetworkOnline
      ? "Internet disconnected. Live updates will resume automatically when connection returns."
      : (timelineCandidatesQueryError?.message ?? timelineQuery.error?.message ?? null);

  // Derived error for the top-level banner
  const error = overviewQueryError?.message ?? null;

  // Derived link-security error (query fetch + mutation)
  const linkSecurityError =
    linkSecurityMutationError ?? linkSecurityQueryError?.message ?? null;

  // Derived attempt-settings error (query fetch + mutation)
  const attemptSettingsError =
    attemptSettingsMutationError ?? attemptSettingsQueryError?.message ?? null;

  // Derived retention save error (query fetch + mutation)
  const retentionSaveErrorDisplay =
    retentionSaveError ?? retentionQueryError?.message ?? null;

  // ── Seeding & cleanup effects ────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (popupTimerRef.current !== null) window.clearTimeout(popupTimerRef.current);
      if (csvReportTimerRef.current !== null) window.clearTimeout(csvReportTimerRef.current);
    };
  }, []);

  // Auto-select first test when tests load
  useEffect(() => {
    if (tests.length > 0 && !selectedTestId) {
      setSelectedTestId(tests[0]?.id ?? "");
    }
  }, [tests, selectedTestId]);

  // Seed link-security form from query data
  useEffect(() => {
    if (linkSecurityData) applyLinkSecurityState(linkSecurityData);
  // applyLinkSecurityState is defined below in the same scope and is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkSecurityData]);

  // Seed attempt settings from query data
  useEffect(() => {
    if (attemptSettingsData) setGlobalMaxAttempts(attemptSettingsData.defaultMaxAttempts);
  }, [attemptSettingsData]);

  // Auto-select first timeline candidate when candidates load or test changes
  useEffect(() => {
    if (!timelineTabActive) return;
    if (timelineCandidates.length === 0) {
      setSelectedTimelineCandidateEmail("");
      return;
    }
    setSelectedTimelineCandidateEmail((prev) =>
      timelineCandidates.some((c) => c.candidateEmail === prev)
        ? prev
        : timelineCandidates[0]?.candidateEmail ?? ""
    );
  }, [timelineCandidates, timelineTabActive]);

  useEffect(() => {
    setGrantRetakeError(null);
    setGrantRetakeSuccess(null);
  }, [selectedTestId, selectedTimelineCandidateEmail]);

  useEffect(() => {
    if (activeTab !== "anonymize") return;
    setPrivacyError(null);
    setPrivacySuccess(null);
  }, [activeTab, selectedTestId, selectedTimelineCandidateEmail, privacyAction, privacyAdminId]);

  useEffect(() => {
    if (activeTab !== "limits") return;
    setAttemptSettingsMutationError(null);
    setAttemptSettingsSuccess(null);
  }, [activeTab, globalMaxAttempts]);

  // ── Memos ────────────────────────────────────────────────────────────────────

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

  // ── Helpers ──────────────────────────────────────────────────────────────────

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
    if (!value) return "Not generated";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ── Mutation handlers ────────────────────────────────────────────────────────

  async function handleSaveAttemptSettings(): Promise<void> {
    setAttemptSettingsSaving(true);
    setAttemptSettingsMutationError(null);
    setAttemptSettingsSuccess(null);

    try {
      const saved = await saveCandidateAttemptSettings({
        defaultMaxAttempts: globalMaxAttempts,
      });
      setGlobalMaxAttempts(saved.defaultMaxAttempts);
      void queryClient.invalidateQueries({ queryKey: ["attempt-settings"] });
      setAttemptSettingsSuccess("Attempt policy saved.");
    } catch (err) {
      setAttemptSettingsMutationError(
        err instanceof Error ? err.message : "Failed to save attempt settings."
      );
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
    if (popupTimerRef.current !== null) window.clearTimeout(popupTimerRef.current);
    popupTimerRef.current = window.setTimeout(() => {
      setInviteResultPopup(null);
      resetInviteWizard();
    }, 1800);
  }

  function showCsvImportReport(report: CsvImportReport): void {
    setCsvImportReport(report);
    if (csvReportTimerRef.current !== null) window.clearTimeout(csvReportTimerRef.current);
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
              return { email, candidateName: normalizedName || undefined };
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
        deadlineUtc: deadlineDate
          ? new Date(`${deadlineDate}T23:59:59.000Z`).toISOString()
          : undefined,
        linkExpiryHours: linkExpiryHours > 0 ? linkExpiryHours : undefined,
        timeLimitMinutes: timeLimitMinutes > 0 ? timeLimitMinutes : undefined,
        customMessage: customMessage.trim() || undefined,
        sendNowNotification,
      });

      const deliveredCount = created.filter((item) => item.status === "Invited").length;
      const failedCount = created.length - deliveredCount;

      setEmailChips([]);
      setEmailInput("");

      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
      void queryClient.invalidateQueries({ queryKey: ["candidate-overview"] });

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
    } catch (err) {
      const failureMessage = err instanceof Error ? err.message : "Failed to send invitations.";
      setInviteError(failureMessage);
      showInviteResultPopup("error", failureMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function canProceedFromStep(step: 1 | 2): boolean {
    if (step === 1) return Boolean(inviteMethod);
    return recipients.length > 0;
  }

  function goNextStep(): void {
    setInviteError(null);
    if (inviteStep === 1) { setInviteStep(2); return; }
    if (inviteStep === 2) {
      if (!canProceedFromStep(2)) {
        setInviteError("Add at least one valid candidate email before continuing.");
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

    showCsvImportReport({ importedCount, duplicateCount, invalidCount: parsed.invalidCount });

    if (parsed.emails.length === 0) {
      setInviteError("No valid emails found in CSV.");
      setInviteSuccess(null);
      return;
    }

    setEmailChips(merged);
    setCsvPreviewRows((prev) => {
      const next = new Map<string, CsvCandidateRow>();
      for (const item of prev) next.set(item.email, item);
      for (const item of parsed.rows) {
        const existing = next.get(item.email);
        if (!existing) { next.set(item.email, item); continue; }
        if (!existing.name && item.name) next.set(item.email, item);
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

  function initialsFromInvitation(item: (typeof invitations)[number]): string {
    const label = item.candidateName?.trim() || item.email;
    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    return (label.slice(0, 2) || "NA").toUpperCase();
  }

  async function handleConfirmResend(): Promise<void> {
    if (!resendModalItem) return;

    setResendSubmitting(true);
    setResendError(null);
    setResendSuccess(null);
    try {
      const updated = await resendInvitation(resendModalItem.id);
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
      if (updated.status === "Invited") {
        setResendSuccess(`Invitation resent to ${updated.email}.`);
      } else {
        setResendError(
          `Resend attempted for ${updated.email}, but delivery failed. Check SMTP configuration.`
        );
      }
      setResendModalItem(null);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to resend invitation.");
    } finally {
      setResendSubmitting(false);
    }
  }

  async function handleDeleteCandidate(invitationId: string): Promise<void> {
    setDeleteSubmitting(true);
    setResendError(null);
    setResendSuccess(null);
    try {
      await deleteInvitation(invitationId);
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
      setResendSuccess("Candidate invitation deleted successfully.");
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to delete candidate invitation.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleSaveLinkSecuritySettings(): Promise<void> {
    if (!selectedTestId) {
      setLinkSecurityMutationError("Select a test before saving link security settings.");
      return;
    }

    setLinkSecuritySaving(true);
    setLinkSecurityMutationError(null);
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
      void queryClient.invalidateQueries({ queryKey: ["link-security", selectedTestId] });
      setLinkSecuritySuccess("Link security settings saved.");
    } catch (err) {
      setLinkSecurityMutationError(
        err instanceof Error ? err.message : "Failed to save link security settings."
      );
    } finally {
      setLinkSecuritySaving(false);
    }
  }

  async function handleRegenerateLinkSecurity(): Promise<void> {
    if (!selectedTestId) {
      setLinkSecurityMutationError("Select a test before regenerating a link.");
      return;
    }

    setLinkSecurityRegenerating(true);
    setLinkSecurityMutationError(null);
    setLinkSecuritySuccess(null);

    try {
      const state = await regenerateCandidateLinkSecurityLink(selectedTestId);
      applyLinkSecurityState(state);
      void queryClient.invalidateQueries({ queryKey: ["link-security", selectedTestId] });
      setLinkSecuritySuccess("Invite link regenerated.");
    } catch (err) {
      setLinkSecurityMutationError(
        err instanceof Error ? err.message : "Failed to regenerate invite link."
      );
    } finally {
      setLinkSecurityRegenerating(false);
    }
  }

  async function handleCopyLinkSecurityPreview(): Promise<void> {
    const inviteLink = linkPreview?.inviteLink;
    if (!inviteLink) {
      setLinkSecurityMutationError("No active invitation link is available to copy.");
      return;
    }

    setLinkSecurityMutationError(null);

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
      setLinkSecurityMutationError("Failed to copy invite link. Please copy it manually.");
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
      void queryClient.invalidateQueries({ queryKey: ["timeline-candidates", selectedTestId] });
      void queryClient.invalidateQueries({
        queryKey: ["timeline", selectedTestId, selectedTimelineCandidateEmail],
      });
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

      void queryClient.invalidateQueries({ queryKey: ["timeline-candidates", selectedTestId] });
      void queryClient.invalidateQueries({
        queryKey: ["timeline", selectedTestId, selectedTimelineCandidateEmail],
      });
      setSelectedTimelineCandidateEmail(result.candidateAliasEmail || "");

      const actionLabel = privacyAction === "anonymize" ? "Anonymized" : "PII deleted";
      setPrivacySuccess(`${actionLabel} for ${result.candidateAliasEmail}.`);
    } catch (err) {
      setPrivacyError(err instanceof Error ? err.message : "Failed to apply privacy action.");
    } finally {
      setPrivacySubmitting(false);
    }
  }

  async function handleSaveRetentionSettings(settings: CandidateRetentionSettings): Promise<void> {
    setRetentionSaving(true);
    setRetentionSaveError(null);

    try {
      await saveCandidateRetentionSettings({
        enabled: settings.enabled,
        retentionAction: settings.retentionAction,
        retentionPeriodDays: settings.retentionPeriodDays,
        scanIntervalHours: settings.scanIntervalHours,
      });
      void queryClient.invalidateQueries({ queryKey: ["retention"] });
    } catch (err) {
      setRetentionSaveError(
        err instanceof Error ? err.message : "Failed to save retention settings."
      );
    } finally {
      setRetentionSaving(false);
    }
  }

  async function handleRunRetention(triggeredBy: string): Promise<void> {
    setRetentionRunning(true);
    setRetentionRunError(null);
    setRetentionRunSuccess(null);

    try {
      const run = await runCandidateRetention({ triggeredBy });
      void queryClient.invalidateQueries({ queryKey: ["retention"] });
      setRetentionRunSuccess(
        `Sweep complete — scanned ${run.candidatesScanned}, processed ${run.candidatesProcessed}.`
      );
    } catch (err) {
      setRetentionRunError(err instanceof Error ? err.message : "Failed to run retention sweep.");
    } finally {
      setRetentionRunning(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50/70">
      {/* Page header */}
      <div className="border-b border-zinc-200 bg-white px-8 py-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              Candidate Management
            </h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              Manage invitations, journey states, limits, and retention policies.
            </p>
          </div>
          {overview && !loading ? (
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pending</p>
                <p className="text-[20px] font-bold leading-none text-zinc-900 mt-0.5">
                  {overview.pendingInvitations}
                </p>
              </div>
              {(retentionData?.pendingCount ?? 0) > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Retention Due</p>
                  <p className="text-[20px] font-bold leading-none text-amber-700 mt-0.5">
                    {retentionData?.pendingCount}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-8 py-6">
        {error ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            <X className="h-4 w-4 shrink-0 text-red-500" />
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {/* Tab navigation */}
          <div className="border-b border-zinc-100 bg-zinc-50/50 px-3 pt-2.5 pb-0">
            <div className="flex gap-0.5 overflow-x-auto scrollbar-hide">
              {TAB_CONFIG.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    onClick={() => switchTab(tab.key)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2 text-[12px] font-medium transition-all duration-150 border border-transparent",
                      isActive
                        ? "bg-white border-zinc-200 border-b-white text-zinc-900 shadow-[0_-1px_3px_rgba(0,0,0,0.04)] -mb-px pb-[9px]"
                        : "text-zinc-500 hover:text-zinc-700 hover:bg-white/60"
                    )}
                  >
                    <tab.icon className={cn("h-3.5 w-3.5", isActive ? "text-zinc-700" : "text-zinc-400")} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="mb-5 flex items-start gap-3">
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                activeTab === "retention" ? "bg-amber-50" :
                activeTab === "anonymize" ? "bg-red-50" :
                activeTab === "link-security" ? "bg-blue-50" :
                "bg-zinc-100"
              )}>
                <activeConfig.icon className={cn(
                  "h-4 w-4",
                  activeTab === "retention" ? "text-amber-600" :
                  activeTab === "anonymize" ? "text-red-600" :
                  activeTab === "link-security" ? "text-blue-600" :
                  "text-zinc-600"
                )} />
              </div>
              <div>
                <h2 className="text-[17px] font-bold tracking-tight text-zinc-900">{activeConfig.label}</h2>
                <p className="mt-0.5 text-[13px] text-zinc-500">{activeConfig.description}</p>
              </div>
            </div>

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
                onDeleteCandidate={handleDeleteCandidate}
                deleteSubmitting={deleteSubmitting}
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
            ) : activeTab === "retention" ? (
              <RetentionTab
                settings={retentionData?.settings ?? null}
                pendingCount={retentionData?.pendingCount ?? 0}
                recentRuns={retentionData?.recentRuns ?? []}
                loading={retentionLoading}
                saving={retentionSaving}
                running={retentionRunning}
                saveError={retentionSaveErrorDisplay}
                runError={retentionRunError}
                runSuccess={retentionRunSuccess}
                onSaveSettings={handleSaveRetentionSettings}
                onRunNow={handleRunRetention}
              />
            ) : activeTab === "review" ? (
              <HumanReviewTab />
            ) : null}

            {loading ? (
              <div className="mt-4 flex items-center gap-2 text-[12px] text-zinc-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading overview data...
              </div>
            ) : overview?.generatedAtUtc ? (
              <p className="mt-4 text-[11px] text-zinc-400">
                Overview refreshed {new Date(overview.generatedAtUtc).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" })}
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
