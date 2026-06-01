import { AlertTriangle, CheckCircle2, Mail, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import type { RetakeTabProps } from "@/services/models/retake_tab_model";

export function RetakeTab({
  selectedTestId,
  setSelectedTestId,
  tests,
  selectedTimelineCandidateEmail,
  setSelectedTimelineCandidateEmail,
  timelineCandidatesLoading,
  timelineCandidates,
  timelineError,
  timelineLoading,
  timelineData,
  timelineLastUpdatedAtUtc,
  grantRetakeSending,
  grantRetakeError,
  grantRetakeSuccess,
  onGrantRetake,
}: RetakeTabProps) {
  function formatTimelineUtc(value?: string): string {
    if (!value) {
      return "";
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

  function findMilestoneTime(attemptIndex: number, milestoneName: string): string | undefined {
    return timelineData?.attempts[attemptIndex]?.milestones.find((item) => item.name === milestoneName)?.occurredAtUtc;
  }

  function formatDuration(startedAt?: string, submittedAt?: string): string {
    if (!startedAt || !submittedAt) {
      return "-";
    }

    const start = new Date(startedAt);
    const end = new Date(submittedAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return "-";
    }

    const deltaMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (deltaMinutes < 60) {
      return `${deltaMinutes}m`;
    }

    const hours = Math.floor(deltaMinutes / 60);
    const minutes = deltaMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const attempts = timelineData?.attempts ?? [];
  const submittedCount = attempts.filter((item) => item.status === "Submitted").length;
  const inProgressCount = attempts.filter((item) => item.status === "InProgress").length;
  const pendingStartCount = attempts.filter((item) => item.status === "PendingStart").length;
  const latestAttempt = attempts[attempts.length - 1];
  const nextAttemptNumber = attempts.length + 1;

  const latestStatusTone =
    latestAttempt?.status === "Submitted"
      ? "text-emerald-700 bg-emerald-100"
      : latestAttempt?.status === "InProgress"
        ? "text-amber-700 bg-amber-100"
        : latestAttempt?.status === "PendingStart"
          ? "text-sky-700 bg-sky-100"
          : "text-zinc-700 bg-zinc-100";

  const readinessHeadline =
    pendingStartCount > 0
      ? "Candidate already has a pending attempt"
      : inProgressCount > 0
        ? "Candidate currently has an active in-progress attempt"
        : "Candidate is ready for a newly granted retake";

  const readinessTone =
    pendingStartCount > 0
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : inProgressCount > 0
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  const canGrantRetake = Boolean(timelineData) && !grantRetakeSending && !timelineLoading;

  function statusBadge(status: string): string {
    if (status === "Submitted") return "bg-emerald-100 text-emerald-700";
    if (status === "InProgress") return "bg-amber-100 text-amber-700";
    if (status === "PendingStart") return "bg-sky-100 text-sky-700";
    return "bg-zinc-100 text-zinc-600";
  }

  function formatStatusLabel(status: string): string {
    if (status === "PendingStart") return "Pending Start";
    if (status === "InProgress") return "In Progress";
    return status;
  }

  function renderAttemptLedger(): React.ReactNode {
    if (!timelineData || attempts.length === 0) {
      return null;
    }

    return (
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4">
          <div>
            <p className="text-[14px] font-semibold text-zinc-900">Attempt Ledger</p>
            <p className="mt-1 text-[12px] text-zinc-500">Compact history for fast retake decisions.</p>
          </div>

          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
            {attempts.length} total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[12px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Attempt</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Invited</th>
                <th className="px-4 py-3 text-left font-semibold">Started</th>
                <th className="px-4 py-3 text-left font-semibold">Submitted</th>
                <th className="px-4 py-3 text-left font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody>
              {attempts
                .slice()
                .reverse()
                .map((attempt) => {
                  const actualIndex = attempts.findIndex((item) => item.attemptNumber === attempt.attemptNumber);
                  const invitedAt = findMilestoneTime(actualIndex, "Invited");
                  const startedAt = findMilestoneTime(actualIndex, "Started");
                  const submittedAt = findMilestoneTime(actualIndex, "Submitted");

                  return (
                    <tr key={attempt.attemptNumber} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-semibold text-zinc-900">#{attempt.attemptNumber}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", statusBadge(attempt.status))}>
                          {formatStatusLabel(attempt.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{invitedAt ? formatTimelineUtc(invitedAt) : "-"}</td>
                      <td className="px-4 py-3 text-zinc-600">{startedAt ? formatTimelineUtc(startedAt) : "-"}</td>
                      <td className="px-4 py-3 text-zinc-600">{submittedAt ? formatTimelineUtc(submittedAt) : "-"}</td>
                      <td className="px-4 py-3 text-zinc-600">{formatDuration(startedAt, submittedAt)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 px-5 py-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Retake Command Center
            </p>
            <h3 className="mt-3 text-[20px] font-semibold">Grant a controlled new attempt with full context</h3>
            <p className="mt-1 max-w-2xl text-[13px] text-zinc-300">
              Each retake issues a fresh secure link and automatically triggers candidate email delivery.
            </p>
          </div>

          {timelineLastUpdatedAtUtc ? (
            <p className="text-[12px] text-zinc-300">Last synced {formatTimelineUtc(timelineLastUpdatedAtUtc)}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px,1fr] lg:items-end">
          <DropdownSelect
            id="retake-test"
            label="Test"
            placeholder="Select test"
            value={selectedTestId}
            options={tests.map((test) => ({ value: test.id, label: test.title }))}
            onChange={setSelectedTestId}
          />

          <DropdownSelect
            id="retake-candidate"
            label="Candidate"
            placeholder={timelineCandidates.length === 0 ? "No candidates found" : "Select candidate"}
            value={selectedTimelineCandidateEmail}
            options={timelineCandidates.map((candidate) => ({
              value: candidate.candidateEmail,
              label: candidate.candidateName
                ? `${candidate.candidateName} (${candidate.candidateEmail})`
                : candidate.candidateEmail,
            }))}
            onChange={setSelectedTimelineCandidateEmail}
            disabled={timelineCandidatesLoading || timelineCandidates.length === 0}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <div>
            <p className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
              <Mail className="h-3.5 w-3.5" />
              Email is always sent on grant
            </p>
            <p className="mt-2 text-[12px] text-zinc-600">Next attempt number will be #{nextAttemptNumber}.</p>
          </div>

          <button
            type="button"
            onClick={() => {
              void onGrantRetake();
            }}
            disabled={!canGrantRetake}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2.5 text-[12px] font-semibold text-white transition-colors duration-150 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {grantRetakeSending ? "Granting..." : "Grant Retake"}
          </button>
        </div>
        {grantRetakeSuccess ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {grantRetakeSuccess}
          </div>
        ) : null}
        {grantRetakeError ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {grantRetakeError}
          </div>
        ) : null}
      </section>

      {timelineError ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {timelineError}
        </div>
      ) : null}
      {timelineCandidatesLoading || (timelineLoading && !timelineData) ? (
        <div className="flex items-center gap-2 text-[12px] text-zinc-400">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
          Loading retake context...
        </div>
      ) : null}

      {!timelineLoading && !timelineCandidatesLoading && !timelineError && timelineCandidates.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100">
            <RotateCcw className="h-4 w-4 text-zinc-400" />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-zinc-700">No candidates yet</p>
          <p className="mt-1 text-center text-[12px] text-zinc-400">
            Select a test and invite candidates to see retake history.
          </p>
        </section>
      ) : null}

      {!timelineCandidatesLoading && timelineData ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Total Attempts</p>
                <p className="mt-2 text-[24px] font-semibold text-zinc-900">{attempts.length}</p>
              </article>
              <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Completed</p>
                <p className="mt-2 text-[24px] font-semibold text-emerald-700">{submittedCount}</p>
              </article>
              <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">In Progress</p>
                <p className="mt-2 text-[24px] font-semibold text-amber-700">{inProgressCount}</p>
              </article>
              <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Pending Start</p>
                <p className="mt-2 text-[24px] font-semibold text-sky-700">{pendingStartCount}</p>
              </article>
            </section>

            {renderAttemptLedger()}
          </div>

          <div className="space-y-4 xl:col-span-4">
            <section className={cn("rounded-2xl border p-4", readinessTone)}>
              <p className="inline-flex items-center gap-2 text-[12px] font-semibold">
                {pendingStartCount > 0 || inProgressCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                Retake Readiness
              </p>
              <p className="mt-2 text-[13px] font-semibold">{readinessHeadline}</p>
              <p className="mt-1 text-[12px] opacity-90">
                Granting retake creates attempt #{nextAttemptNumber} and sends a new invite email automatically.
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-[12px] font-semibold text-zinc-700">Latest Attempt Snapshot</p>
              {latestAttempt ? (
                <div className="mt-3 space-y-2 text-[12px] text-zinc-600">
                  <p>
                    Attempt #{latestAttempt.attemptNumber}
                    <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold", latestStatusTone)}>
                      {formatStatusLabel(latestAttempt.status)}
                    </span>
                  </p>
                  <p>Candidate: {timelineData.candidateName || timelineData.candidateEmail}</p>
                  <p>Test: {timelineData.testTitle}</p>
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-zinc-500">No attempts yet.</p>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-[12px] font-semibold text-zinc-700">Operator Notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-zinc-600">
                <li>Previous attempts remain immutable and cannot be restarted.</li>
                <li>Attempt numbering is sequential and always increases.</li>
                <li>Use this action only when a recruiter has explicitly approved a retake.</li>
              </ul>
            </section>
          </div>
        </section>
      ) : null}
    </div>
  );
}