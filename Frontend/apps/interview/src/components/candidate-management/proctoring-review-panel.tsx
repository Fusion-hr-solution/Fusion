import { AlertTriangle, ShieldCheck, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateAttemptProctoringSummary, ProctoringSeverity } from "@/types";

/**
 * Reviewer-facing proctoring roll-up for one attempt. Deliberately an AGGREGATE — a severity
 * headline, counts by type, and the heartbeat gap — not a raw event firehose. Client-side detection
 * is a deterrent, not proof, so the copy stays factual ("flagged", "gap") rather than accusatory.
 */

const TYPE_LABELS: Record<string, string> = {
  tab_focus_loss: "Tab / window switch",
  fullscreen_exit: "Fullscreen exit",
  second_display: "Second display",
  copy: "Copy",
  cut: "Cut",
  paste: "Paste",
  second_person: "Second person",
  candidate_absent: "Left frame",
  prohibited_object: "Phone / book / laptop",
  looking_away: "Looking away",
  camera_denied: "Camera blocked",
  camera_lost: "Camera lost",
};

const SEVERITY_PILL: Record<ProctoringSeverity, string> = {
  none: "border-emerald-200 bg-emerald-50 text-emerald-700",
  low: "border-zinc-200 bg-zinc-100 text-zinc-600",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-red-200 bg-red-50 text-red-700",
};

const SEVERITY_LABEL: Record<ProctoringSeverity, string> = {
  none: "No flags",
  low: "Low",
  medium: "Medium",
  high: "High",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

function formatGap(seconds?: number): string {
  if (seconds === undefined) {
    return "—";
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

function formatUtc(value?: string): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProctoringReviewPanel({ proctoring }: { proctoring: CandidateAttemptProctoringSummary }) {
  const { severity, totalEvents, countsByType, wentDark } = proctoring;
  const clean = totalEvents === 0 && !wentDark;

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-zinc-500" />
          <p className="text-[12px] font-semibold text-zinc-700">Proctoring</p>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              SEVERITY_PILL[severity]
            )}
          >
            {SEVERITY_LABEL[severity]}
          </span>
        </div>
        <span className="text-[11px] text-zinc-500">
          {totalEvents} event{totalEvents === 1 ? "" : "s"}
        </span>
      </div>

      {wentDark ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          <VideoOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Monitor went dark during the attempt — {formatGap(proctoring.heartbeatGapSeconds)} with no heartbeat
            (camera/tab closed or network lost). Treat the signals below as incomplete.
          </span>
        </div>
      ) : null}

      {clean ? (
        <p className="mt-3 text-[12px] text-emerald-700">No integrity signals were flagged for this attempt.</p>
      ) : countsByType.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {countsByType.map((item) => (
            <li
              key={item.type}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium",
                SEVERITY_PILL[item.severity]
              )}
            >
              {item.severity === "high" ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
              {typeLabel(item.type)}
              <span className="font-bold">×{item.count}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-500 sm:grid-cols-3">
        <div>
          <dt className="text-zinc-400">First flag</dt>
          <dd className="font-medium text-zinc-600">{formatUtc(proctoring.firstEventAtUtc)}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Last flag</dt>
          <dd className="font-medium text-zinc-600">{formatUtc(proctoring.lastEventAtUtc)}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Last heartbeat</dt>
          <dd className="font-medium text-zinc-600">{formatUtc(proctoring.lastHeartbeatAtUtc)}</dd>
        </div>
      </dl>
    </div>
  );
}
