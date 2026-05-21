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
    activeBorder: string;
    activeBg: string;
    chip: string;
  }
> = {
  Anonymize: {
    icon: ShieldCheck,
    iconWrap: "bg-indigo-50",
    iconColor: "text-indigo-600",
    activeBorder: "border-indigo-500",
    activeBg: "bg-indigo-50/60",
    chip: "bg-indigo-50 text-indigo-700",
  },
  Delete: {
    icon: Trash2,
    iconWrap: "bg-red-50",
    iconColor: "text-red-600",
    activeBorder: "border-red-500",
    activeBg: "bg-red-50/60",
    chip: "bg-red-50 text-red-700",
  },
  Expire: {
    icon: Archive,
    iconWrap: "bg-amber-50",
    iconColor: "text-amber-600",
    activeBorder: "border-amber-500",
    activeBg: "bg-amber-50/60",
    chip: "bg-amber-50 text-amber-700",
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
      <div className="mt-5 flex items-center gap-2 text-[13px] text-zinc-500">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Loading retention settings...
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
        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Policy Status
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                savedEnabled ? "animate-pulse bg-emerald-500" : "bg-zinc-300"
              )}
            />
            <span
              className={cn(
                "text-[15px] font-bold",
                savedEnabled ? "text-emerald-700" : "text-zinc-500"
              )}
            >
              {savedEnabled ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-zinc-500">
            {savedEnabled
              ? `${ACTION_LABELS[savedAction]} after ${settings?.retentionPeriodDays ?? 0}d inactive`
              : "No automatic processing"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Due for Processing
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                "text-[26px] font-bold leading-none",
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

        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Last Run</p>
          <div className="mt-2 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-zinc-400" />
            <span className="text-[15px] font-bold text-zinc-900">
              {formatRelative(settings?.lastRunAtUtc ?? lastRun?.startedAtUtc)}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-zinc-500">
            {lastRun
              ? `${lastRun.candidatesProcessed} processed of ${lastRun.candidatesScanned} scanned`
              : "No sweeps recorded yet"}
          </p>
        </div>
      </div>

      {/* Policy configuration */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <Clock3 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-bold text-zinc-900">Retention Policy</p>
            <p className="mt-1 text-[12px] text-zinc-500">
              Automatically process candidates after a specified period of inactivity.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((prev) => !prev)}
            className={cn(
              "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
              enabled ? "bg-emerald-600" : "bg-zinc-300"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {/* Action selection */}
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Action on Expiry
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
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
                    "rounded-xl border px-4 py-3 text-left transition-colors",
                    isActive
                      ? `${accent.activeBorder} ${accent.activeBg}`
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg",
                        accent.iconWrap
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", accent.iconColor)} />
                    </span>
                    {isActive ? (
                      <CheckCircle2 className="h-4 w-4 text-zinc-900" />
                    ) : null}
                  </div>
                  <p className="mt-2 text-[13px] font-bold text-zinc-900">
                    {ACTION_LABELS[value]}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                    {ACTION_DESCRIPTIONS[value]}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <label
              htmlFor="retention-period"
              className="text-[11px] font-bold uppercase tracking-widest text-zinc-400"
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
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <p className="mt-1 text-[12px] text-zinc-500">
              Candidates inactive for this many days will be processed.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <label
              htmlFor="scan-interval"
              className="text-[11px] font-bold uppercase tracking-widest text-zinc-400"
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
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <p className="mt-1 text-[12px] text-zinc-500">How often the background job runs.</p>
          </div>
        </div>

        {saveError ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {saveError}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4">
          <p className="text-[12px] text-zinc-400">
            {isDirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white transition-colors",
              !isDirty || saving ? "opacity-50" : "hover:bg-zinc-700"
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
      </section>

      {/* Manual sweep */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <Play className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-zinc-900">Manual Sweep</p>
            <p className="mt-1 text-[12px] text-zinc-500">
              Run the retention policy immediately instead of waiting for the scheduled job.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <UserCheck
            className={cn(
              "h-5 w-5",
              pendingCount > 0 ? "text-amber-600" : "text-zinc-400"
            )}
          />
          <div>
            <p className="text-[13px] font-semibold text-zinc-900">
              {pendingCount > 0
                ? `${pendingCount} candidate${pendingCount !== 1 ? "s" : ""} due for processing`
                : "No candidates currently due"}
            </p>
            <p className="text-[12px] text-zinc-500">
              {pendingCount > 0
                ? `They will be ${ACTION_LABELS[action].toLowerCase()}d on the next sweep.`
                : "Nothing falls outside the retention window right now."}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Triggered By
            </p>
            <input
              type="text"
              value={triggeredBy}
              onChange={(e) => setTriggeredBy(e.target.value)}
              placeholder="Enter recruiter/admin identifier"
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <p className="mt-1 text-[12px] text-zinc-500">Required for audit logging.</p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
              <div>
                <p className="text-[12px] font-semibold text-amber-700">
                  Irreversible for Delete and Anonymize actions.
                </p>
                <p className="text-[12px] text-amber-700">
                  Processed candidates cannot be recovered.
                </p>
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[12px] text-amber-800">
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
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {runError}
          </div>
        ) : null}
        {runSuccess ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {runSuccess}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              {hasIdentifier ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <span className="h-3 w-3 rounded-full border border-zinc-300" />
              )}
              Identifier
            </span>
            <span className="flex items-center gap-1">
              {runConfirmed ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <span className="h-3 w-3 rounded-full border border-zinc-300" />
              )}
              Confirmation
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRunNow(triggeredBy)}
            disabled={!canRunNow}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors",
              !canRunNow ? "opacity-50" : "hover:bg-amber-700"
            )}
          >
            {running ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Run Sweep Now
              </>
            )}
          </button>
        </div>
      </section>

      {/* Run history */}
      <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-zinc-400" />
          <p className="text-[15px] font-bold text-zinc-900">Recent Runs</p>
          {recentRuns.length > 0 ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
              {recentRuns.length}
            </span>
          ) : null}
        </div>

        {recentRuns.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
            <Timer className="mx-auto h-6 w-6 text-zinc-300" />
            <p className="mt-2 text-[13px] font-medium text-zinc-600">No runs yet</p>
            <p className="text-[12px] text-zinc-400">
              Sweep history will appear here once the policy runs.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  <th className="pb-2 pr-4">Started</th>
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">Scanned</th>
                  <th className="pb-2 pr-4">Result</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">Triggered By</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => {
                  const runAction = run.retentionAction as RetentionAction;
                  const accent = ACTION_ACCENT[runAction] ?? ACTION_ACCENT.Anonymize;
                  return (
                    <tr
                      key={run.id}
                      className="border-b border-zinc-50 transition-colors hover:bg-zinc-50/60"
                    >
                      <td className="py-2.5 pr-4 text-zinc-700">
                        <span title={formatDateTime(run.startedAtUtc)}>
                          {formatDateTime(run.startedAtUtc)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-500">{run.triggerSource}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            accent.chip
                          )}
                        >
                          {ACTION_LABELS[runAction] ?? run.retentionAction}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-700">{run.candidatesScanned}</td>
                      <td className="py-2.5 pr-4">
                        {run.candidatesProcessed === 0 ? (
                          <span className="text-zinc-400">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {run.candidatesAnonymized > 0 ? (
                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                {run.candidatesAnonymized} anon
                              </span>
                            ) : null}
                            {run.candidatesDeleted > 0 ? (
                              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                {run.candidatesDeleted} del
                              </span>
                            ) : null}
                            {run.candidatesExpired > 0 ? (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                {run.candidatesExpired} exp
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-500">
                        {formatDuration(run.startedAtUtc, run.completedAtUtc)}
                      </td>
                      <td className="max-w-[120px] truncate py-2.5 pr-4 text-zinc-500">
                        {run.triggeredBy}
                      </td>
                      <td className="py-2.5">
                        {run.completedAtUtc ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
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
