"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ShieldCheck, History, RotateCcw, Settings2, UserX, Clock3, Link2, Check, FileUp, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCandidateManagementOverview,
  getPendingInvitations,
  inviteCandidates,
  resendInvitation,
} from "@/services/candidate-management-service";
import { getTests } from "@/services/test-service";
import type { CandidateInvitation, CandidateManagementOverview, Test } from "@/types";

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

type InviteMethod = "email" | "bulk" | "link";
type InviteResultPopup = { status: "success" | "error"; message: string };
type CsvCandidateRow = {
  name: string;
  email: string;
};
type CsvExtractResult = {
  rows: CsvCandidateRow[];
  emails: string[];
  invalidCount: number;
  duplicateCount: number;
};
type CsvImportReport = {
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_HEADER_KEYS = new Set([
  "email",
  "emailaddress",
  "emailid",
  "e-mail",
  "e-mailaddress",
  "mail",
]);
const NAME_HEADER_KEYS = new Set([
  "name",
  "fullname",
  "full_name",
  "candidate",
  "candidatename",
  "candidate_name",
  "applicant",
]);
const CSV_DELIMITERS = [",", ";", "\t"] as const;

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

function decodeWithEncoding(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function readCsvFileText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) {
    return "";
  }

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return decodeWithEncoding(bytes.subarray(3), "utf-8");
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeWithEncoding(bytes.subarray(2), "utf-16le");
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeWithEncoding(bytes.subarray(2), "utf-16be");
  }

  const utf8Text = decodeWithEncoding(bytes, "utf-8");
  if (utf8Text.includes("\u0000")) {
    return decodeWithEncoding(bytes, "utf-16le");
  }

  return utf8Text;
}

function countUnquotedDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

function detectCsvDelimiter(headerLine: string): string {
  let selected = ",";
  let maxCount = -1;

  for (const delimiter of CSV_DELIMITERS) {
    const currentCount = countUnquotedDelimiter(headerLine, delimiter);
    if (currentCount > maxCount) {
      maxCount = currentCount;
      selected = delimiter;
    }
  }

  return selected;
}

function parseCsvRow(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function normalizeHeaderCell(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeEmailValue(value: string): string {
  const cleaned = value
    .replace(/\u0000/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim();

  const bracketMatch = cleaned.match(/<([^<>]+)>/);
  const extracted = bracketMatch?.[1] ?? cleaned;
  return extracted.trim().toLowerCase();
}

function normalizeNameValue(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function extractEmailsFromCsv(content: string): CsvExtractResult {
  const normalizedContent = content.replace(/\u0000/g, "").replace(/^\uFEFF/, "");
  const lines = normalizedContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      emails: [],
      invalidCount: 0,
      duplicateCount: 0,
    };
  }

  const delimiter = detectCsvDelimiter(lines[0] ?? "");
  const rows = lines.map((line) => parseCsvRow(line, delimiter));
  const header = rows[0]?.map(normalizeHeaderCell) ?? [];
  const emailColumnIndex = header.findIndex((cell) => EMAIL_HEADER_KEYS.has(cell));
  const nameColumnIndex = header.findIndex((cell) => NAME_HEADER_KEYS.has(cell));
  const dataStartIndex = emailColumnIndex >= 0 ? 1 : 0;
  const uniqueCandidates = new Map<string, CsvCandidateRow>();
  let invalidCount = 0;
  let duplicateCount = 0;

  function deriveNameFromRow(row: string[], emailIndex: number): string {
    if (nameColumnIndex >= 0) {
      return normalizeNameValue(row[nameColumnIndex] ?? "");
    }

    for (let i = 0; i < row.length; i += 1) {
      if (i === emailIndex) {
        continue;
      }
      const nameCandidate = normalizeNameValue(row[i] ?? "");
      if (!nameCandidate) {
        continue;
      }
      const maybeEmail = normalizeEmailValue(nameCandidate);
      if (!EMAIL_REGEX.test(maybeEmail)) {
        return nameCandidate;
      }
    }

    return "";
  }

  function collectCandidate(rawEmail: string, rawName: string, strictEmailColumn: boolean): void {
    const candidateEmail = normalizeEmailValue(rawEmail);
    const candidateName = normalizeNameValue(rawName);

    if (!candidateEmail) {
      return;
    }

    if (!EMAIL_REGEX.test(candidateEmail)) {
      if (strictEmailColumn || candidateEmail.includes("@")) {
        invalidCount += 1;
      }
      return;
    }

    const existing = uniqueCandidates.get(candidateEmail);
    if (existing) {
      duplicateCount += 1;
      if (!existing.name && candidateName) {
        uniqueCandidates.set(candidateEmail, {
          email: candidateEmail,
          name: candidateName,
        });
      }
      return;
    }

    uniqueCandidates.set(candidateEmail, {
      email: candidateEmail,
      name: candidateName,
    });
  }

  for (let rowIndex = dataStartIndex; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    if (emailColumnIndex >= 0) {
      const rowName = deriveNameFromRow(row, emailColumnIndex);
      collectCandidate(row[emailColumnIndex] ?? "", rowName, true);
      continue;
    }

    for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
      const rowName = deriveNameFromRow(row, cellIndex);
      collectCandidate(row[cellIndex] ?? "", rowName, false);
    }
  }

  const uniqueRows = Array.from(uniqueCandidates.values());

  return {
    rows: uniqueRows,
    emails: uniqueRows.map((item) => item.email),
    invalidCount,
    duplicateCount,
  };
}

export function CandidateManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [resendStatusFilter, setResendStatusFilter] = useState<"all" | "Invited" | "DeliveryFailed">("all");
  const [resendTestFilter, setResendTestFilter] = useState("all");
  const [resendModalItem, setResendModalItem] = useState<CandidateInvitation | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteStep, setInviteStep] = useState<1 | 2 | 3>(1);
  const [inviteMethod, setInviteMethod] = useState<InviteMethod>("email");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [customMessage, setCustomMessage] = useState("");
  const [sendNowNotification, setSendNowNotification] = useState(true);

  const [emailInput, setEmailInput] = useState("");
  const [emailChips, setEmailChips] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvCandidateRow[]>([]);
  const [inviteResultPopup, setInviteResultPopup] = useState<InviteResultPopup | null>(null);
  const [csvImportReport, setCsvImportReport] = useState<CsvImportReport | null>(null);
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
        candidateName: candidateName.trim() || undefined,
        deadlineUtc: deadlineDate ? new Date(`${deadlineDate}T23:59:59.000Z`).toISOString() : undefined,
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

  function renderResendTab(): React.ReactNode {
    return (
      <div className="mt-5 space-y-4">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,170px,220px]">
            <input
              value={resendSearch}
              onChange={(e) => setResendSearch(e.target.value)}
              placeholder="Search candidate, email, or test"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <select
              value={resendStatusFilter}
              onChange={(e) => setResendStatusFilter(e.target.value as "all" | "Invited" | "DeliveryFailed")}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="all">All status</option>
              <option value="Invited">Invited</option>
              <option value="DeliveryFailed">Delivery Failed</option>
            </select>
            <select
              value={resendTestFilter}
              onChange={(e) => setResendTestFilter(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="all">All tests</option>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.title}
                </option>
              ))}
            </select>
          </div>
        </section>

        {resendError ? <p className="text-[12px] text-red-600">{resendError}</p> : null}
        {resendSuccess ? <p className="text-[12px] text-emerald-700">{resendSuccess}</p> : null}

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Candidate</th>
                  <th className="px-4 py-3 font-semibold">Test</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Opens</th>
                  <th className="px-4 py-3 font-semibold">Last Sent</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredResendInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No invitations match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredResendInvitations.map((item) => (
                    <tr key={item.id} className="border-t border-zinc-100">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-700">
                            {initialsFromInvitation(item)}
                          </span>
                          <div>
                            <p className="font-semibold text-zinc-900">{item.candidateName || "Unnamed Candidate"}</p>
                            <p className="text-[12px] text-zinc-500">{item.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{item.testTitle}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            item.status === "Invited"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{item.opensCount}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {new Date(item.lastSentAtUtc || item.createdAtUtc).toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setResendError(null);
                            setResendModalItem(item);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          <Send className="h-3.5 w-3.5" /> Resend
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {resendModalItem ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
              <h3 className="text-[18px] font-semibold text-zinc-900">Resend Invitation</h3>
              <p className="mt-1 text-[13px] text-zinc-500">Please confirm the candidate details before resending.</p>

              <div className="mt-4 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[13px] text-zinc-700">
                <p>
                  Candidate: <span className="font-semibold">{resendModalItem.candidateName || "Unnamed Candidate"}</span>
                </p>
                <p>
                  Email: <span className="font-semibold">{resendModalItem.email}</span>
                </p>
                <p>
                  Test: <span className="font-semibold">{resendModalItem.testTitle}</span>
                </p>
                <p>
                  Current status: <span className="font-semibold">{resendModalItem.status}</span>
                </p>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={() => setResendModalItem(null)}
                  disabled={resendSubmitting}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleConfirmResend()}
                  disabled={resendSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {resendSubmitting ? "Resending..." : "Confirm Resend"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderInviteTab(): React.ReactNode {
    const stepChips: Array<{ id: 1 | 2 | 3; label: string }> = [
      { id: 1, label: "Method" },
      { id: 2, label: "Candidates" },
      { id: 3, label: "Configure" },
    ];

    const methodCards: Array<{ key: InviteMethod; label: string; helper: string; icon: React.ElementType }> = [
      {
        key: "email",
        label: "Email",
        helper: "Individual invites by entering emails",
        icon: Mail,
      },
      {
        key: "bulk",
        label: "Bulk CSV",
        helper: "Mass upload recipients from CSV",
        icon: FileUp,
      },
      {
        key: "link",
        label: "Link Invite",
        helper: "Generate and send a secure candidate link",
        icon: Link2,
      },
    ];

    const stepTitle =
      inviteStep === 1
        ? "Step 1: Choose Method"
        : inviteStep === 2
          ? "Step 2: Add Candidates"
          : "Step 3: Configure & Send";

    const stepHint =
      inviteStep === 1
        ? "Select how invitations will be delivered."
        : inviteStep === 2
          ? "Add recipients and verify candidate count before moving on."
          : "Finalize delivery settings and review before sending.";

    const stepSubtitle =
      inviteStep === 1
        ? "Choose one invitation channel to continue."
        : inviteStep === 2
          ? "Select recipients and confirm candidate count."
          : "Set invitation options and review before sending.";

    return (
      <div className="mt-5 space-y-5">
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-6 py-5">
            <div>
              <p className="text-[18px] font-semibold text-zinc-900">{stepTitle}</p>
              <p className="mt-1 text-[12px] text-zinc-500">{stepHint}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="text-[12px] text-zinc-400">{stepSubtitle}</p>
              {inviteStep === 2 ? (
                <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-700">
                {recipients.length} candidate(s) ready
                </div>
              ) : null}
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="mb-6">
              <div className="mx-auto flex w-full max-w-3xl items-center">
                {stepChips.map((step, i) => {
                  const isActive = inviteStep === step.id;
                  const isDone = inviteStep > step.id;

                  return (
                    <div key={step.id} className="flex flex-1 items-center">
                      {i > 0 ? (
                        <div className={cn("h-[2px] flex-1 rounded-full", inviteStep > i ? "bg-zinc-900" : "bg-zinc-100")} />
                      ) : null}

                      <div className="flex flex-col items-center gap-1.5 px-2">
                        <div
                          className={cn(
                            "relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-300",
                            isDone
                              ? "bg-zinc-900 text-white"
                              : isActive
                                ? "scale-110 bg-zinc-900 text-white shadow-[0_0_0_4px_rgba(0,0,0,0.08)]"
                                : "border-2 border-zinc-200 bg-white text-zinc-300"
                          )}
                        >
                          {isDone ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step.id}
                          {isActive ? <span className="absolute inset-0 animate-ping rounded-full bg-zinc-900 opacity-10" /> : null}
                        </div>
                        <div className="text-center" style={{ minWidth: 84 }}>
                          <p className={cn("text-[12px] font-semibold leading-tight", isActive ? "text-zinc-900" : isDone ? "text-zinc-500" : "text-zinc-400")}>
                            {step.label}
                          </p>
                          <p className={cn("mt-0.5 text-[10px]", isDone ? "text-zinc-400" : isActive ? "text-zinc-400" : "text-zinc-300")}>
                            {isDone ? "Complete" : isActive ? "In progress" : "Pending"}
                          </p>
                        </div>
                      </div>

                      {i < stepChips.length - 1 ? (
                        <div
                          className={cn(
                            "h-[2px] flex-1 rounded-full",
                            inviteStep > step.id ? "bg-zinc-900" : "bg-zinc-100"
                          )}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {inviteStep === 1 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {methodCards.map((method) => {
                const active = inviteMethod === method.key;
                return (
                  <button
                    key={method.key}
                    type="button"
                    onClick={() => selectMethod(method.key)}
                    className={cn(
                      "rounded-xl border-2 bg-white p-4 text-left shadow-sm transition-colors",
                      active ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-300"
                    )}
                  >
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                      <method.icon className="h-4 w-4 text-zinc-700" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-zinc-900">{method.label}</p>
                      {active ? <Check className="h-4 w-4 text-zinc-900" /> : null}
                    </div>
                    <p className="mt-1 text-[12px] text-zinc-500">{method.helper}</p>
                  </button>
                );
              })}
              </div>
            ) : null}

            {inviteStep === 2 ? (
              <div className="space-y-4">
                {inviteMethod === "bulk" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-zinc-600">Bulk Candidate Import</p>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                        {recipients.length} candidates added
                      </span>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50">
                      <FileUp className="h-3.5 w-3.5" /> Import CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void importCsvEmails(file);
                          }
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {csvPreviewRows.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3 py-2">
                          <p className="text-[12px] font-semibold text-zinc-700">
                            Imported candidates ({csvPreviewRows.length})
                          </p>
                          <button
                            type="button"
                            onClick={clearAllEmailChips}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-700"
                          >
                            <X className="h-3 w-3" /> Clear all
                          </button>
                        </div>
                        <div className="max-h-64 overflow-auto">
                          <table className="min-w-full text-left text-[12px]">
                            <thead className="bg-white text-zinc-500">
                              <tr>
                                <th className="px-3 py-2 font-semibold">Name</th>
                                <th className="px-3 py-2 font-semibold">Email</th>
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreviewRows.map((item) => (
                                <tr key={item.email} className="border-t border-zinc-100">
                                  <td className="px-3 py-2 text-zinc-700">{item.name || "-"}</td>
                                  <td className="px-3 py-2 font-medium text-zinc-900">{item.email}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-[12px] font-semibold text-zinc-600">Candidate Name (optional)</label>
                      <input
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="Ex: Alex Smith"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="block text-[12px] font-semibold text-zinc-600">Candidate Emails</label>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                          {recipients.length} candidates added
                        </span>
                      </div>
                      <div className="min-h-[44px] rounded-xl border border-zinc-200 bg-white px-2 py-2 focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-900/10">
                        <div className="flex flex-wrap items-center gap-2">
                          {emailChips.map((email) => (
                            <span
                              key={email}
                              className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                            >
                              {email}
                              <button
                                type="button"
                                onClick={() => removeEmailChip(email)}
                                className="text-white/80 hover:text-white"
                              >
                                x
                              </button>
                            </span>
                          ))}
                          <input
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            onKeyDown={handleEmailKeyDown}
                            onBlur={() => {
                              if (emailInput.trim()) {
                                addEmailChip(emailInput);
                                setEmailInput("");
                              }
                            }}
                            placeholder="Type email and press Enter"
                            className="min-w-[220px] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-zinc-900 outline-none"
                          />
                        </div>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="text-[11px] text-zinc-500">Use Enter or comma to add each email chip.</p>
                        {emailChips.length > 0 ? (
                          <button
                            type="button"
                            onClick={clearAllEmailChips}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-700"
                          >
                            <X className="h-3 w-3" /> Clear all
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}

              {inviteMethod === "link" ? (
                <div>
                  <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
                    Share Link mode still tracks entered recipients for audit and delivery reporting.
                  </p>
                </div>
              ) : null}
              </div>
            ) : null}

            {inviteStep === 3 ? (
              <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-zinc-600">Test</label>
                  <select
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  >
                    <option value="">Select a test</option>
                    {tests.map((test) => (
                      <option key={test.id} value={test.id}>
                        {test.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-zinc-600">Deadline (optional)</label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-zinc-600">Time Limit (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
                <div className="space-y-2 pt-6">
                  <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700">
                    <input
                      type="checkbox"
                      checked={sendNowNotification}
                      onChange={(e) => setSendNowNotification(e.target.checked)}
                    />
                    Send immediate notification email
                  </label>

                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-semibold text-zinc-600">Custom Message</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personalized note for candidates..."
                  className="min-h-[100px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">Pre-send Summary</p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-[13px] text-zinc-700 md:grid-cols-2">
                  <p>Method: <span className="font-semibold capitalize">{inviteMethod}</span></p>
                  <p>Recipients: <span className="font-semibold">{recipients.length}</span></p>
                  <p>Test: <span className="font-semibold">{selectedTest?.title || "Not selected"}</span></p>
                  <p>Deadline: <span className="font-semibold">{deadlineDate || "None"}</span></p>
                  <p>Time limit: <span className="font-semibold">{timeLimitMinutes} min</span></p>

                  <p className="md:col-span-2">
                    Candidate Name: <span className="font-semibold">{candidateName.trim() || "Not provided"}</span>
                  </p>
                  <p className="md:col-span-2">
                    Notifications: <span className="font-semibold">{sendNowNotification ? "Send immediately" : "Draft only"}</span>
                  </p>
                  {customMessage.trim() ? (
                    <p className="md:col-span-2 text-zinc-600">
                      Message preview: <span className="font-medium">{customMessage.trim().slice(0, 140)}{customMessage.trim().length > 140 ? "..." : ""}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-100 pt-5">
              <div>
                {inviteError ? <p className="text-[12px] text-red-600">{inviteError}</p> : null}
                {inviteSuccess ? <p className="text-[12px] text-emerald-700">{inviteSuccess}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goPrevStep}
                  disabled={inviteStep === 1 || submitting}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
                {inviteStep < 3 ? (
                  <button
                    onClick={goNextStep}
                    disabled={submitting || (inviteStep === 2 && !canProceedFromStep(2))}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={() => void handleSendInvitations()}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {submitting ? "Sending..." : "Send Invitations"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
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
              renderInviteTab()
            ) : activeTab === "resend" ? (
              renderResendTab()
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

      {inviteResultPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full",
                  inviteResultPopup.status === "success"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                )}
              >
                {inviteResultPopup.status === "success" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </span>
              <div>
                <p className="text-[15px] font-semibold text-zinc-900">Invitation status</p>
                <p className="mt-1 text-[13px] text-zinc-600">{inviteResultPopup.message}</p>
                <p className="mt-2 text-[12px] text-zinc-400">Returning to Step 1...</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {csvImportReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full",
                  csvImportReport.importedCount > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}
              >
                {csvImportReport.importedCount > 0 ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
              </span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-zinc-900">CSV import summary</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                    <p className="text-[14px] font-semibold text-zinc-900">{csvImportReport.importedCount}</p>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">Imported</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                    <p className="text-[14px] font-semibold text-zinc-900">{csvImportReport.duplicateCount}</p>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">Duplicates</p>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                    <p className="text-[14px] font-semibold text-zinc-900">{csvImportReport.invalidCount}</p>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">Invalid</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
