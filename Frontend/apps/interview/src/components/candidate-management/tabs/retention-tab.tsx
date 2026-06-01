"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock3,
  Play,
  RefreshCw,
  ShieldCheck,
  Timer,
  Trash2,
  UserCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateRetentionSettings, CandidateRetentionRun, RetentionAction } from "@/types";

const ACTION_LABELS: Record<RetentionAction, string> = {
  Anonymize: "Anonymize",
  Delete: "Hard Delete",
  Expire: "Expire",
};

const ACTION_DESCRIPTIONS: Record<RetentionAction, string> = {
  Anonymize: "Replace candidate PII with pseudonyms. Scores and answers are preserved.",
  Delete: "Permanently remove all invitation, attempt, and event records. This is irreversible.",
  Expire: "Mark candidates as Expired and hide them from the timeline. No data is removed.",
};

const ACTION_ACCENT: Record<
  RetentionAction,
  {
    icon: typeof ShieldCheck;
    iconWrap: string;
    iconColor: string;
    ring: string;
    activeBg: string;
    selectedRing: string;
    chip: string;
    chipDot: string;
  }
> = {
  Anonymize: {
    icon: ShieldCheck,
    iconWrap: "bg-indigo-100",
    iconColor: "text-indigo-600",
    ring: "ring-indigo-500",
    activeBg: "bg-indigo-50/50",
    selectedRing: "ring-2 ring-indigo-500 border-indigo-300",
    chip: "bg-indigo-50 text-indigo-700",
    chipDot: "bg-indigo-400",
  },
  Delete: {
    icon: Trash2,
    iconWrap: "bg-red-100",
    iconColor: "text-red-600",
    ring: "ring-red-500",
    activeBg: "bg-red-50/50",
    selectedRing: "ring-2 ring-red-500 border-red-300",
    chip: "bg-red-50 text-red-700",
    chipDot: "bg-red-400",
  },
  Expire: {
    icon: Archive,
    iconWrap: "bg-amber-100",
    iconColor: "text-amber-600",
    ring: "ring-amber-500",
    activeBg: "bg-amber-50/50",
    selectedRing: "ring-2 ring-amber-500 border-amber-300",
    chip: "bg-amber-50 text-amber-700",
    chipDot: "bg-amber-400",
  },
};

interface RetentionTabProps {
  settings: CandidateRetentionSettings | null;
  pendingCount: number;
  recentRuns: CandidateRetentionRun[];
  loading: boolean;
  saving: boolean;
  running: boolean;
  saveError: string | null;
  runError: string | null;
  runSuccess: string | null;
  onSaveSettings: (settings: CandidateRetentionSettings) => void;
  onRunNow: (triggeredBy: string) => void;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "Never";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(value?: string | null): string {
  if (!value) {
    return "never";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }
  const deltaSeconds = Math.round((parsed.getTime() - Date.now()) / 1000);
  if (deltaSeconds >= 0) return "just now";
  const abs = -deltaSeconds;
  if (abs < 60) return "just now";
  const minutes = Math.round(abs / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatDuration(start: string, end?: string | null): string {
  if (!end) {
    return "—";
  }
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "—";
  }
  const seconds = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div className="h-3 w-20 rounded bg-zinc-100 animate-pulse" />
      <div className="mt-3 h-6 w-16 rounded bg-zinc-100 animate-pulse" />
      <div className="mt-2 h-3 w-32 rounded bg-zinc-100 animate-pulse" />
    </div>
  );
}

export function RetentionTab({
  settings,
  pendingCount,
  recentRuns,
  loading,
  saving,
  running,
  saveError,
  runError,
  runSuccess,
  onSaveSettings,
  onRunNow,
}: RetentionTabProps) {
  const [enabled, setEnabled] = useState(false);
  const [action, setAction] = useState<RetentionAction>("Anonymize");
  const [periodDays, setPeriodDays] = useState(90);
  const [scanIntervalHours, setScanIntervalHours] = useState(24);
  const [triggeredBy, setTriggeredBy] = useState("");
  const [runConfirmed, setRunConfirmed] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setAction(settings.retentionAction);
      setPeriodDays(settings.retentionPeriodDays);
      setScanIntervalHours(settings.scanIntervalHours);
    }
  }, [settings]);

  const isDirty =
    settings !== null &&
    (enabled !== settings.enabled ||
      action !== settings.retentionAction ||
      periodDays !== settings.retentionPeriodDays ||
      scanIntervalHours !== settings.scanIntervalHours);

  function handleSave() {
    onSaveSettings({
      enabled,
      retentionAction: action,
      retentionPeriodDays: periodDays,
      scanIntervalHours,
      lastRunAtUtc: settings?.lastRunAtUtc,
    });
  }

  const hasIdentifier = triggeredBy.trim().length > 0;
  const canRunNow = hasIdentifier && runConfirmed && !running;

  if (loading) {
    return (
      <div className="mt-5 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-100 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-zinc-100 animate-pulse" />
              <div className="h-3 w-56 rounded bg-zinc-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const savedEnabled = settings?.enabled ?? false;
  const savedAction = (settings?.retentionAction ?? "Anonymize") as RetentionAction;
  const lastRun = recentRuns[0] ?? null;
  return (
    <div className="mt-5 space-y-5">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Policy status card */}
        <div className={cn(
          "rounded-2xl border bg-white px-5 py-4 shadow-sm transition-colors",
          savedEnabled ? "border-emerald-200" : "border-zinc-200"
        )}>
          <div className={cn(
            "mb-3 h-1 w-8 rounded-full",
            savedEnabled ? "bg-emerald-400" : "bg-zinc-200"
          )} />
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Policy Status
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                savedEnabled ? "animate-pulse bg-emerald-400" : "bg-zinc-300"
              )}
            />
            <span
              className={cn(
                "text-[16px] font-bold",
                savedEnabled ? "text-emerald-700" : "text-zinc-400"
              )}
            >
              {savedEnabled ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-zinc-500">
            {savedEnabled
              ? `${ACTION_LABELS[savedAction]} · ${settings?.retentionPeriodDays ?? 0}d inactivity`
              : "No automatic processing"}
          </p>
        </div>

        {/* Due for processing card */}
        <div className={cn(
          "rounded-2xl border bg-white px-5 py-4 shadow-sm transition-colors",
          pendingCount > 0 ? "border-amber-200" : "border-zinc-200"
        )}>
          <div className={cn(
            "mb-3 h-1 w-8 rounded-full",
            pendingCount > 0 ? "bg-amber-400" : "bg-zinc-200"
          )} />
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Due for Processing
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                "text-[28px] font-bold leading-none tracking-tight",
                pendingCount > 0 ? "text-amber-600" : "text-zinc-900"
              )}
            >
              {pendingCount}
            </span>
            <span className="text-[12px] text-zinc-500">
              candidate{pendingCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-zinc-500">
            {pendingCount > 0 ? "Ready for the next sweep" : "Nothing past retention window"}
          </p>
        </div>

        {/* Last run card */}
        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <div className="mb-3 h-1 w-8 rounded-full bg-zinc-200" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Last Run</p>
          <div className="mt-2 flex items-center gap-2">
            <Clock3 className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="text-[16px] font-bold text-zinc-900">
              {formatRelative(settings?.lastRunAtUtc ?? lastRun?.startedAtUtc)}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-zinc-500">
            {lastRun
              ? `${lastRun.candidatesProcessed} processed · ${lastRun.candidatesScanned} scanned`
              : "No sweeps recorded yet"}
          </p>
        </div>
      </div>

      {/* Policy configuration */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <Clock3 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-bold text-zinc-900">Retention Policy</p>
            <p className="text-[12px] text-zinc-500">
              Automatically process candidates after a period of inactivity.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((prev) => !prev)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:ring-offset-2",
              enabled ? "bg-emerald-500" : "bg-zinc-200"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Action selection */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Action on Expiry
            </p>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
              {(Object.keys(ACTION_LABELS) as RetentionAction[]).map((value) => {
                const accent = ACTION_ACCENT[value];
                const Icon = accent.icon;
                const isActive = action === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAction(value)}
                    className={cn(
                      "group relative rounded-xl border px-4 py-3.5 text-left transition-all duration-150 focus:outline-none",
                      isActive
                        ? accent.selectedRing + " " + accent.activeBg
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                          isActive ? accent.iconWrap : "bg-zinc-100 group-hover:bg-zinc-200"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 transition-colors", isActive ? accent.iconColor : "text-zinc-500")} />
                      </span>
                      {isActive ? (
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", accent.iconWrap)}>
                          <CheckCircle2 className={cn("h-3.5 w-3.5", accent.iconColor)} />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2.5 text-[13px] font-bold text-zinc-900">
                      {ACTION_LABELS[value]}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                      {ACTION_DESCRIPTIONS[value]}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period & interval */}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="retention-period"
                className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400"
              >
                Retention Period (days)
              </label>
              <input
                id="retention-period"
                type="number"
                min={1}
                max={3650}
                value={periodDays}
                onChange={(e) => setPeriodDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-medium text-zinc-900 transition-all duration-150 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <p className="text-[12px] text-zinc-400">
                Candidates inactive for this many days will be processed.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="scan-interval"
                className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400"
              >
                Scan Interval (hours)
              </label>
              <input
                id="scan-interval"
                type="number"
                min={1}
                max={168}
                value={scanIntervalHours}
                onChange={(e) => setScanIntervalHours(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-medium text-zinc-900 transition-all duration-150 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <p className="text-[12px] text-zinc-400">How often the background job runs.</p>
            </div>
          </div>

          {saveError ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {saveError}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4">
            <p className={cn("text-[12px]", isDirty ? "font-medium text-amber-600" : "text-zinc-400")}>
              {isDirty ? "Unsaved changes" : "All changes saved"}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150",
                isDirty && !saving
                  ? "bg-zinc-900 hover:bg-zinc-700 active:scale-[0.98]"
                  : "bg-zinc-300 cursor-not-allowed"
              )}
            >
              {saving ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Policy"
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Manual sweep */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <Zap className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-zinc-900">Manual Sweep</p>
            <p className="text-[12px] text-zinc-500">
              Run the retention policy immediately, bypassing the scheduled job.
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Pending preview */}
          <div className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3",
            pendingCount > 0
              ? "border-amber-200 bg-amber-50/60"
              : "border-zinc-200 bg-zinc-50"
          )}>
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              pendingCount > 0 ? "bg-amber-100" : "bg-zinc-100"
            )}>
              <UserCheck className={cn("h-4 w-4", pendingCount > 0 ? "text-amber-600" : "text-zinc-400")} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">
                {pendingCount > 0
                  ? `${pendingCount} candidate${pendingCount !== 1 ? "s" : ""} due for processing`
                  : "No candidates currently due"}
              </p>
              <p className="text-[12px] text-zinc-500">
                {pendingCount > 0
                  ? `Will be ${ACTION_LABELS[action].toLowerCase()}d on sweep.`
                  : "Nothing falls outside the retention window right now."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Triggered by */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                Triggered By
              </label>
              <input
                type="text"
                value={triggeredBy}
                onChange={(e) => setTriggeredBy(e.target.value)}
                placeholder="Recruiter / admin identifier"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-medium text-zinc-900 transition-all duration-150 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <p className="text-[12px] text-zinc-400">Required for audit logging.</p>
            </div>

            {/* Warning + confirm */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-[12px] font-semibold text-amber-800">
                    Irreversible for Delete and Anonymize.
                  </p>
                  <p className="mt-0.5 text-[12px] text-amber-700">
                    Processed records cannot be recovered.
                  </p>
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px] font-medium text-amber-900">
                <input
                  type="checkbox"
                  checked={runConfirmed}
                  onChange={(e) => setRunConfirmed(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                I understand this cannot be undone.
              </label>
            </div>
          </div>

          {runError ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {runError}
            </div>
          ) : null}
          {runSuccess ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {runSuccess}
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                  hasIdentifier ? "bg-emerald-100" : "bg-zinc-100"
                )}>
                  <CheckCircle2 className={cn("h-2.5 w-2.5", hasIdentifier ? "text-emerald-600" : "text-zinc-300")} />
                </span>
                Identifier
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                  runConfirmed ? "bg-emerald-100" : "bg-zinc-100"
                )}>
                  <CheckCircle2 className={cn("h-2.5 w-2.5", runConfirmed ? "text-emerald-600" : "text-zinc-300")} />
                </span>
                Confirmed
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRunNow(triggeredBy)}
              disabled={!canRunNow}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150",
                canRunNow
                  ? "bg-amber-600 hover:bg-amber-700 active:scale-[0.98]"
                  : "cursor-not-allowed bg-amber-300"
              )}
            >
              {running ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Running sweep...
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-current" />
                  Run Sweep Now
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Run history */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
            <Timer className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-bold text-zinc-900">Recent Runs</p>
            <p className="text-[12px] text-zinc-500">Last {Math.min(recentRuns.length, 20)} sweep executions.</p>
          </div>
          {recentRuns.length > 0 ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600">
              {recentRuns.length}
            </span>
          ) : null}
        </div>

        {recentRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100">
              <Timer className="h-5 w-5 text-zinc-400" />
            </div>
            <p className="mt-3 text-[14px] font-semibold text-zinc-700">No runs yet</p>
            <p className="mt-1 text-center text-[12px] text-zinc-400">
              Sweep history will appear here once the retention policy executes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70">
                  <th className="py-2.5 pl-6 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Started
                  </th>
                  <th className="py-2.5 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Source
                  </th>
                  <th className="py-2.5 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Action
                  </th>
                  <th className="py-2.5 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Scanned
                  </th>
                  <th className="py-2.5 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Result
                  </th>
                  <th className="py-2.5 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Duration
                  </th>
                  <th className="py-2.5 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Triggered By
                  </th>
                  <th className="py-2.5 pr-6 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run, idx) => {
                  const runAction = run.retentionAction as RetentionAction;
                  const accent = ACTION_ACCENT[runAction] ?? ACTION_ACCENT.Anonymize;
                  return (
                    <tr
                      key={run.id}
                      className={cn(
                        "border-b border-zinc-50 transition-colors hover:bg-zinc-50/80",
                        idx % 2 === 0 ? "" : "bg-zinc-50/30"
                      )}
                    >
                      <td className="py-3 pl-6 pr-4 text-zinc-700" title={formatDateTime(run.startedAtUtc)}>
                        {formatDateTime(run.startedAtUtc)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                          {run.triggerSource}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          accent.chip
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", accent.chipDot)} />
                          {ACTION_LABELS[runAction] ?? run.retentionAction}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium text-zinc-700">{run.candidatesScanned}</td>
                      <td className="py-3 pr-4">
                        {run.candidatesProcessed === 0 ? (
                          <span className="text-zinc-400">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {run.candidatesAnonymized > 0 ? (
                              <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                {run.candidatesAnonymized} anon
                              </span>
                            ) : null}
                            {run.candidatesDeleted > 0 ? (
                              <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                {run.candidatesDeleted} del
                              </span>
                            ) : null}
                            {run.candidatesExpired > 0 ? (
                              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                {run.candidatesExpired} exp
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-zinc-500">
                        {formatDuration(run.startedAtUtc, run.completedAtUtc)}
                      </td>
                      <td className="max-w-[120px] truncate py-3 pr-4 text-zinc-500">
                        {run.triggeredBy}
                      </td>
                      <td className="py-3 pr-6">
                        {run.completedAtUtc ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Running
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
