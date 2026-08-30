"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  Clock3,
  Gauge,
  Hash,
  Printer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateReport } from "@/types";
import { getTests } from "@/services/test-service";
import { getCandidateReport } from "@/services/reports-service";
import { getCandidateTimelineCandidates } from "@/services/candidate-management-service";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import { ProctoringReviewPanel } from "@/components/candidate-management/proctoring-review-panel";
import { ScoreRing } from "./score-ring";
import { SkillBar } from "./skill-bar";
import { MiniStat } from "./mini-stat";
import { Legend } from "./legend";
import { Switch } from "./switch";
import { ReportSkeleton } from "./report-skeleton";
import { computeVerdict, TONE_STYLES } from "./verdict";
import { formatDateUtc, formatDuration, formatPct, formatSignedPct } from "./format";

// recharts loads only here, client-side — kept out of the shared bundle and the server render.
const SkillRadar = dynamic(() => import("./skill-radar"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center text-[12px] text-zinc-400">
      Loading chart…
    </div>
  ),
});

const MIN_RADAR_AXES = 3;

function scorePercent(report: CandidateReport): number | null {
  if (report.totalScore == null || report.maxScore == null || report.maxScore <= 0) {
    return null;
  }
  return (report.totalScore / report.maxScore) * 100;
}

/** Plain-language read of the strongest and weakest axis, cohort-relative when available. */
function buildReading(report: CandidateReport): string | null {
  if (report.skills.length === 0) {
    return null;
  }
  const withCohort = report.cohortAvailable;
  const sorted = [...report.skills].sort((a, b) => b.scorePct - a.scorePct);
  const strongest = sorted[0]!;
  const weakest = sorted[sorted.length - 1]!;

  const strong = withCohort && strongest.cohortAvgPct != null
    ? `Strongest in ${strongest.key} (${formatPct(strongest.scorePct)}, ${formatSignedPct(
        strongest.scorePct - strongest.cohortAvgPct
      )} vs the cohort).`
    : `Strongest in ${strongest.key} (${formatPct(strongest.scorePct)}).`;

  if (strongest.key === weakest.key) {
    return strong;
  }

  const weak = withCohort && weakest.cohortAvgPct != null
    ? ` Needs a closer look at ${weakest.key} (${formatPct(weakest.scorePct)}, ${formatSignedPct(
        weakest.scorePct - weakest.cohortAvgPct
      )} vs the cohort).`
    : ` Needs a closer look at ${weakest.key} (${formatPct(weakest.scorePct)}).`;

  return strong + weak;
}

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [testId, setTestId] = useState(() => searchParams.get("testId") ?? "");
  const [candidateEmail, setCandidateEmail] = useState(() => searchParams.get("candidateEmail") ?? "");
  const [showComparison, setShowComparison] = useState(true);

  const attemptNumber = useMemo(() => {
    const raw = searchParams.get("attemptNumber");
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [searchParams]);

  // Keep the URL shareable without triggering a navigation/re-render.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams();
    if (testId) params.set("testId", testId);
    if (candidateEmail) params.set("candidateEmail", candidateEmail);
    if (attemptNumber) params.set("attemptNumber", String(attemptNumber));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [testId, candidateEmail, attemptNumber]);

  const testsQuery = useQuery({
    queryKey: ["tests"],
    queryFn: () => getTests(),
  });

  const candidatesQuery = useQuery({
    queryKey: ["report-candidates", testId],
    queryFn: () => getCandidateTimelineCandidates(testId),
    enabled: testId.length > 0,
  });

  const reportQuery = useQuery({
    queryKey: ["report", testId, candidateEmail, attemptNumber ?? null],
    queryFn: () => getCandidateReport(testId, candidateEmail, attemptNumber),
    enabled: testId.length > 0 && candidateEmail.length > 0,
  });

  const testOptions = useMemo(
    () => (testsQuery.data ?? []).map((test) => ({ value: test.id, label: test.title })),
    [testsQuery.data]
  );

  const candidateOptions = useMemo(
    () =>
      (candidatesQuery.data ?? []).map((candidate) => ({
        value: candidate.candidateEmail,
        label: candidate.candidateName
          ? `${candidate.candidateName} · ${candidate.candidateEmail}`
          : candidate.candidateEmail,
      })),
    [candidatesQuery.data]
  );

  const report = reportQuery.data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900">Candidate report</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            A decision-oriented view of one attempt — score, skill profile, benchmark, and integrity.
          </p>
        </div>
        {report ? (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 print:hidden"
          >
            <Printer className="h-4 w-4" />
            Save as PDF
          </button>
        ) : null}
      </header>

      {/* Selection controls — stripped from print output. */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] print:hidden">
        <DropdownSelect
          id="report-test"
          label="Test"
          placeholder={testsQuery.isLoading ? "Loading tests…" : "Select a test"}
          value={testId}
          options={testOptions}
          onChange={(value) => {
            setTestId(value);
            setCandidateEmail("");
          }}
          emptyMessage="No tests found"
        />
        <DropdownSelect
          id="report-candidate"
          label="Candidate"
          placeholder={
            !testId
              ? "Pick a test first"
              : candidatesQuery.isLoading
                ? "Loading candidates…"
                : "Select a candidate"
          }
          value={candidateEmail}
          options={candidateOptions}
          onChange={setCandidateEmail}
          disabled={!testId}
          emptyMessage="No candidates for this test"
        />
        <div className="flex items-end">
          <label
            className={cn(
              "flex items-center gap-2 pb-2 text-[12px] font-medium",
              report?.cohortAvailable ? "text-zinc-600" : "text-zinc-400"
            )}
          >
            <Switch
              checked={showComparison && Boolean(report?.cohortAvailable)}
              onCheckedChange={setShowComparison}
              disabled={!report?.cohortAvailable}
              aria-label="Compare against the test cohort"
            />
            Cohort compare
          </label>
        </div>
      </div>

      {/* Body states. */}
      {!testId || !candidateEmail ? (
        <EmptyPrompt />
      ) : reportQuery.isLoading ? (
        <ReportSkeleton />
      ) : reportQuery.isError ? (
        <ErrorCard
          message={
            reportQuery.error instanceof Error
              ? reportQuery.error.message
              : "Something went wrong loading this report."
          }
        />
      ) : report ? (
        <ReportBody
          report={report}
          showComparison={showComparison && report.cohortAvailable}
          onOpenTimeline={() => {
            // Name the tab AND the subject: the tab is URL-driven, while the test/candidate
            // selectors otherwise auto-pick the first of each — which would open a stranger's
            // timeline rather than the candidate being reviewed.
            const params = new URLSearchParams({
              tab: "timeline",
              testId: report.testId,
              candidateEmail: report.candidateEmail,
            });
            router.push(`/candidates?${params.toString()}`);
          }}
        />
      ) : null}
    </div>
  );
}

function ReportBody({
  report,
  showComparison,
  onOpenTimeline,
}: {
  report: CandidateReport;
  showComparison: boolean;
  onOpenTimeline: () => void;
}) {
  const verdict = computeVerdict(report);
  const tone = TONE_STYLES[verdict.tone];
  const pct = scorePercent(report);
  const hasTiming = report.totalDurationSeconds != null;
  const reading = buildReading(report);
  const canShowRadar = report.skills.length >= MIN_RADAR_AXES;

  const cohortDelta =
    report.cohortAvailable && report.overallCohortAvgPct != null && pct != null
      ? pct - report.overallCohortAvgPct
      : null;

  return (
    <div className="space-y-4">
      {/* Verdict — announced to assistive tech when it changes. */}
      <div
        role="status"
        aria-live="polite"
        className={cn("rounded-2xl border p-4", tone.banner)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                tone.badge
              )}
            >
              {verdict.kind === "grading" ? "Pending" : "Verdict"}
            </span>
            <h2 className={cn("text-[16px] font-bold", tone.text)}>{verdict.headline}</h2>
          </div>
          <p className="text-[12px] text-zinc-500">
            {report.candidateName ? `${report.candidateName} · ` : ""}
            {report.candidateEmail} · {report.testTitle} · attempt #{report.attemptNumber}
          </p>
        </div>
        <p className={cn("mt-1 text-[13px]", tone.text)}>{verdict.detail}</p>
      </div>

      {/* Key stats. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Score"
          value={
            report.totalScore != null && report.maxScore != null
              ? `${report.totalScore}/${report.maxScore}`
              : "—"
          }
          sub={pct != null ? `${formatPct(pct)} overall` : "not graded"}
          icon={Gauge}
        />
        <MiniStat
          label="vs Cohort"
          value={cohortDelta != null ? `${formatSignedPct(cohortDelta)} pts` : "—"}
          sub={
            report.cohortAvailable
              ? `cohort avg ${formatPct(report.overallCohortAvgPct)} · n=${report.cohortSize}`
              : "not enough data"
          }
          icon={Users}
        />
        <MiniStat
          label="Time"
          value={hasTiming ? formatDuration(report.totalDurationSeconds) : "—"}
          sub={hasTiming ? "total on attempt" : "not captured"}
          icon={Clock3}
        />
        <MiniStat
          label="Submitted"
          value={report.submittedAtUtc ? formatDateUtc(report.submittedAtUtc).split(",")[0] ?? "—" : "—"}
          sub={`attempt #${report.attemptNumber}`}
          icon={Hash}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Score ring + reading. */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <ScoreRing valuePct={pct} tone={verdict.tone} passingThreshold={report.passingThreshold} />
          {reading ? (
            <p className="mt-4 border-t border-zinc-100 pt-3 text-[12px] leading-relaxed text-zinc-600">
              {reading}
            </p>
          ) : null}
        </section>

        {/* Skill profile. */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-zinc-500" />
              <h3 className="text-[14px] font-semibold text-zinc-800">Skill profile</h3>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-500">
                by {report.axisKind === "tag" ? "tag" : "question type"}
              </span>
            </div>
            {showComparison ? (
              <Legend
                items={[
                  { label: "At/above cohort", className: "bg-emerald-500" },
                  { label: "Below", className: "bg-amber-500" },
                  { label: "Well below", className: "bg-red-500" },
                ]}
              />
            ) : null}
          </div>

          {report.axisKind === "type" ? (
            <p className="mb-2 text-[11px] text-zinc-400">
              Grouped by question type — add tags to questions for a finer skill breakdown.
            </p>
          ) : null}

          {report.skills.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-zinc-400">
              No graded questions to break down for this attempt.
            </p>
          ) : (
            <>
              {canShowRadar ? (
                <SkillRadar skills={report.skills} showCohort={showComparison} />
              ) : (
                <p className="mb-1 text-[11px] text-zinc-400">
                  Radar needs at least {MIN_RADAR_AXES} skill areas — showing bars only.
                </p>
              )}
              <div className="mt-2 divide-y divide-zinc-100">
                {report.skills.map((skill, index) => (
                  <SkillBar
                    key={skill.key}
                    skill={skill}
                    index={index}
                    showCohort={showComparison}
                    hasTiming={hasTiming}
                  />
                ))}
              </div>
            </>
          )}

          {!report.cohortAvailable && report.cohortUnavailableReason ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {report.cohortUnavailableReason}
            </p>
          ) : null}
        </section>
      </div>

      {report.proctoring ? <ProctoringReviewPanel proctoring={report.proctoring} /> : null}

      {/* Sticky action bar — recommendation + export, stripped from print. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center justify-between gap-2 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur print:hidden">
        <span className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold", tone.badge)}>
          {verdict.action}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenTimeline}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-700 transition-colors hover:border-zinc-300"
          >
            Open timeline
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors",
              tone.button
            )}
          >
            <Printer className="h-4 w-4" />
            Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyPrompt() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-16 text-center">
      <BarChart3 className="mx-auto h-8 w-8 text-zinc-300" />
      <p className="mt-3 text-[14px] font-medium text-zinc-600">Pick a test and candidate</p>
      <p className="mt-1 text-[12px] text-zinc-400">
        Choose a test, then a candidate, to generate their report.
      </p>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 py-12 text-center">
      <AlertCircle className="mx-auto h-7 w-7 text-amber-500" />
      <p className="mt-3 text-[14px] font-medium text-amber-800">Report unavailable</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] text-amber-700">{message}</p>
    </div>
  );
}

export function Reports() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-6"><ReportSkeleton /></div>}>
      <ReportsContent />
    </Suspense>
  );
}
