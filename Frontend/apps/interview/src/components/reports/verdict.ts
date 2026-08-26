import type { CandidateReport } from "@/types";

/**
 * The hiring verdict is computed HERE, on the client, from score + proctoring — never persisted —
 * so the rule stays visible and tunable in the reviewer UI. Four decision states plus two neutral
 * ones (no pass mark set; still grading). Client-side proctoring is a deterrent, not proof, so the
 * copy stays factual rather than accusatory.
 */

export type VerdictKind = "clean" | "minor" | "disputed" | "below" | "review" | "grading";

export type VerdictTone = "green" | "amber" | "red" | "redAmber" | "neutral";

export interface Verdict {
  kind: VerdictKind;
  tone: VerdictTone;
  headline: string;
  detail: string;
  /** Label for the sticky action bar's primary button. */
  action: string;
}

function scorePercent(report: CandidateReport): number | null {
  if (report.totalScore == null || report.maxScore == null || report.maxScore <= 0) {
    return null;
  }
  return (report.totalScore / report.maxScore) * 100;
}

export function computeVerdict(report: CandidateReport): Verdict {
  const pct = scorePercent(report);

  if (report.gradingStatus !== "Completed" || pct == null) {
    return {
      kind: "grading",
      tone: "neutral",
      headline: "Grading in progress",
      detail: "This attempt hasn't finished grading yet, so there's no verdict to show.",
      action: "Awaiting grading",
    };
  }

  const proctoring = report.proctoring;
  const highIntegrity = !!proctoring && (proctoring.severity === "high" || proctoring.wentDark);
  const mediumIntegrity = !!proctoring && proctoring.severity === "medium";
  const rounded = Math.round(pct);

  // No pass mark configured → score alone can't decide; surface integrity only.
  if (report.passingThreshold == null) {
    if (highIntegrity) {
      return {
        kind: "disputed",
        tone: "redAmber",
        headline: "Integrity signals need review",
        detail: "No pass mark is set, and the integrity signals are strong enough to warrant a closer look.",
        action: "Escalate for review",
      };
    }
    return {
      kind: "review",
      tone: "neutral",
      headline: "Review needed — no pass mark set",
      detail: `Scored ${rounded}%. This test has no pass mark, so score alone can't decide the outcome.`,
      action: "Log a decision",
    };
  }

  const passed = pct >= report.passingThreshold;

  if (!passed) {
    return {
      kind: "below",
      tone: "red",
      headline: "Below the pass mark",
      detail: `Scored ${rounded}% against a ${report.passingThreshold}% pass mark.`,
      action: "Do not advance",
    };
  }

  if (highIntegrity) {
    return {
      kind: "disputed",
      tone: "redAmber",
      headline: "Do not advance on this score alone",
      detail: `Scored ${rounded}% — clears the ${report.passingThreshold}% bar — but integrity signals undermine the result.`,
      action: "Escalate for review",
    };
  }

  if (mediumIntegrity) {
    return {
      kind: "minor",
      tone: "amber",
      headline: "Advance with a note",
      detail: `Passed at ${rounded}% with a few minor integrity flags worth a second look.`,
      action: "Advance with a note",
    };
  }

  return {
    kind: "clean",
    tone: "green",
    headline: "Ready to advance",
    detail: `Passed at ${rounded}% against a ${report.passingThreshold}% pass mark, with a clean integrity check.`,
    action: "Advance candidate",
  };
}

/** Tailwind class fragments per tone, shared by the verdict banner, score ring, and action bar. */
export const TONE_STYLES: Record<
  VerdictTone,
  { ring: string; banner: string; badge: string; button: string; text: string }
> = {
  green: {
    ring: "text-emerald-500",
    banner: "border-emerald-200 bg-emerald-50",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    text: "text-emerald-800",
  },
  amber: {
    ring: "text-amber-500",
    banner: "border-amber-200 bg-amber-50",
    badge: "border-amber-200 bg-amber-100 text-amber-800",
    button: "bg-amber-600 hover:bg-amber-700 text-white",
    text: "text-amber-800",
  },
  redAmber: {
    ring: "text-orange-500",
    banner: "border-orange-200 bg-orange-50",
    badge: "border-orange-200 bg-orange-100 text-orange-800",
    button: "bg-orange-600 hover:bg-orange-700 text-white",
    text: "text-orange-800",
  },
  red: {
    ring: "text-red-500",
    banner: "border-red-200 bg-red-50",
    badge: "border-red-200 bg-red-100 text-red-800",
    button: "bg-red-600 hover:bg-red-700 text-white",
    text: "text-red-800",
  },
  neutral: {
    ring: "text-zinc-400",
    banner: "border-zinc-200 bg-zinc-50",
    badge: "border-zinc-200 bg-zinc-100 text-zinc-700",
    button: "bg-zinc-900 hover:bg-zinc-800 text-white",
    text: "text-zinc-700",
  },
};
