import { Check, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateProgressTimeline, CandidateTimelineCandidate, Test } from "@/types";

interface TimelineTabProps {
  selectedTestId: string;
  setSelectedTestId: (value: string) => void;
  tests: Test[];
  selectedTimelineCandidateEmail: string;
  setSelectedTimelineCandidateEmail: (value: string) => void;
  timelineCandidatesLoading: boolean;
  timelineCandidates: CandidateTimelineCandidate[];
  timelineLiveEnabled: boolean;
  timelineNetworkOnline: boolean;
  timelineLiveSyncing: boolean;
  timelineLastUpdatedAtUtc: string | null;
  setTimelineLiveEnabled: (fn: (prev: boolean) => boolean) => void;
  timelineError: string | null;
  timelineLoading: boolean;
  timelineData: CandidateProgressTimeline | null;
  refreshMs: number;
}

export function TimelineTab({
  selectedTestId,
  setSelectedTestId,
  tests,
  selectedTimelineCandidateEmail,
  setSelectedTimelineCandidateEmail,
  timelineCandidatesLoading,
  timelineCandidates,
  timelineLiveEnabled,
  timelineNetworkOnline,
  timelineLiveSyncing,
  timelineLastUpdatedAtUtc,
  setTimelineLiveEnabled,
  timelineError,
  timelineLoading,
  timelineData,
  refreshMs,
}: TimelineTabProps) {
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

  function formatRelativeFromNow(value?: string | null): string {
    if (!value) {
      return "just now";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "just now";
    }

    const deltaMs = parsed.getTime() - Date.now();
    const deltaSeconds = Math.round(deltaMs / 1000);
    const absSeconds = Math.abs(deltaSeconds);

    if (absSeconds < 5) {
      return "just now";
    }

    if (absSeconds < 60) {
      return `${absSeconds}s ago`;
    }

    const absMinutes = Math.round(absSeconds / 60);
    if (absMinutes < 60) {
      return `${absMinutes}m ago`;
    }

    const absHours = Math.round(absMinutes / 60);
    if (absHours < 24) {
      return `${absHours}h ago`;
    }

    const absDays = Math.round(absHours / 24);
    return `${absDays}d ago`;
  }

  function prettifyMilestoneName(name: string): string {
    switch (name) {
      case "LinkOpened":
        return "Link Opened";
      case "InProgress":
        return "In Progress";
      default:
        return name;
    }
  }

  function pendingLabel(milestoneName: string): string {
    switch (milestoneName) {
      case "LinkOpened":
        return "Not yet opened";
      case "Started":
        return "Not yet started";
      case "InProgress":
        return "Not started yet";
      case "Submitted":
        return "Not yet submitted";
      default:
        return "Pending";
    }
  }

  const latestAttemptStatus = timelineData?.attempts[timelineData.attempts.length - 1]?.status ?? "Invited";

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px,1fr] md:items-end">
          <div>
            <label htmlFor="timeline-test" className="mb-1 block text-[12px] font-semibold text-zinc-600">Test</label>
            <select
              id="timeline-test"
              name="timelineTestId"
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="">Select test</option>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="timeline-candidate" className="mb-1 block text-[12px] font-semibold text-zinc-600">Candidate</label>
            <select
              id="timeline-candidate"
              name="timelineCandidateEmail"
              value={selectedTimelineCandidateEmail}
              onChange={(e) => setSelectedTimelineCandidateEmail(e.target.value)}
              disabled={timelineCandidatesLoading || timelineCandidates.length === 0}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {timelineCandidates.length === 0 ? (
                <option value="">No candidates found</option>
              ) : (
                timelineCandidates.map((candidate) => (
                  <option key={candidate.candidateEmail} value={candidate.candidateEmail}>
                    {candidate.candidateName
                      ? `${candidate.candidateName} (${candidate.candidateEmail})`
                      : candidate.candidateEmail}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                timelineLiveEnabled && timelineNetworkOnline
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : timelineLiveEnabled
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-zinc-200 bg-zinc-100 text-zinc-600"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  timelineLiveEnabled && timelineNetworkOnline
                    ? "animate-pulse bg-emerald-500"
                    : timelineLiveEnabled
                      ? "bg-amber-500"
                      : "bg-zinc-400"
                )}
              />
              {timelineLiveEnabled
                ? timelineNetworkOnline
                  ? `Live updates every ${refreshMs / 1000}s`
                  : "Offline, waiting for connection"
                : "Live updates paused"}
            </span>

            <span
              className={cn(
                "rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700",
                timelineLiveSyncing ? "visible" : "invisible"
              )}
            >
              Syncing...
            </span>

            <span className="text-[12px] text-zinc-500">
              {timelineLastUpdatedAtUtc
                ? `Last updated ${formatRelativeFromNow(timelineLastUpdatedAtUtc)} (${formatTimelineUtc(timelineLastUpdatedAtUtc)})`
                : "Waiting for first sync"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setTimelineLiveEnabled((prev) => !prev)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-100"
          >
            {timelineLiveEnabled ? "Pause Live" : "Resume Live"}
          </button>
        </div>
      </section>

      {timelineError ? <p className="text-[12px] text-red-600">{timelineError}</p> : null}
      {timelineCandidatesLoading || (timelineLoading && !timelineData) ? (
        <p className="text-[12px] text-zinc-500">Loading progress timeline...</p>
      ) : null}

      {!timelineLoading && !timelineCandidatesLoading && !timelineError && timelineCandidates.length === 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[13px] font-medium text-zinc-700">No candidate journey available for the selected test yet.</p>
        </section>
      ) : null}

      {!timelineCandidatesLoading && timelineData ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[14px] font-semibold text-zinc-900">
                  {timelineData.candidateName || timelineData.candidateEmail}
                </p>
                <p className="text-[12px] text-zinc-500">{timelineData.testTitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                  {timelineData.attempts.length} attempt(s)
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    latestAttemptStatus === "Submitted"
                      ? "bg-emerald-100 text-emerald-700"
                      : latestAttemptStatus === "InProgress"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-zinc-100 text-zinc-600"
                  )}
                >
                  {latestAttemptStatus}
                </span>
              </div>
            </div>
          </div>

          {timelineData.attempts.map((attempt) => (
            <div
              key={attempt.attemptNumber}
              className={cn(
                "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm",
                attempt.status === "Submitted"
                  ? "border-l-4 border-l-emerald-400"
                  : attempt.status === "InProgress"
                    ? "border-l-4 border-l-amber-400"
                    : "border-l-4 border-l-zinc-300"
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <p className="text-[14px] font-semibold text-zinc-900">Attempt {attempt.attemptNumber}</p>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    attempt.status === "Submitted"
                      ? "bg-emerald-100 text-emerald-700"
                      : attempt.status === "InProgress"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-zinc-100 text-zinc-600"
                  )}
                >
                  {attempt.status}
                </span>
              </div>

              <ol className="mt-4 space-y-3">
                {attempt.milestones.map((milestone, milestoneIndex) => {
                  const completed = milestone.state === "Completed";
                  const isLastMilestone = milestoneIndex === attempt.milestones.length - 1;

                  return (
                    <li key={milestone.name} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                            completed
                              ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                              : "border-zinc-300 bg-zinc-100 text-zinc-400"
                          )}
                        >
                          {completed ? <Check className="h-3 w-3" strokeWidth={3} /> : <Clock3 className="h-3 w-3" strokeWidth={2.5} />}
                        </span>

                        {!isLastMilestone ? (
                          <span
                            className={cn(
                              "mt-1 h-6 w-px",
                              completed ? "bg-emerald-200" : "bg-zinc-200"
                            )}
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <p className={cn("text-[13px] font-semibold", completed ? "text-zinc-900" : "text-zinc-500")}>
                          {prettifyMilestoneName(milestone.name)}
                        </p>
                        <p className={cn("text-[12px]", completed ? "text-zinc-500" : "text-zinc-400")}>
                          {completed
                            ? formatTimelineUtc(milestone.occurredAtUtc)
                            : pendingLabel(milestone.name)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
