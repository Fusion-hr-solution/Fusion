import { cn } from "@/lib/utils";
import type { VerdictTone } from "./verdict";
import { TONE_STYLES } from "./verdict";

/**
 * SVG donut for the overall score. Colour comes from the verdict tone (not the raw score) so the ring
 * reinforces the recommendation. A faint tick marks the pass threshold on the arc.
 */
interface ScoreRingProps {
  valuePct: number | null;
  tone: VerdictTone;
  passingThreshold?: number;
  caption?: string;
  size?: number;
}

const STROKE = 12;

export function ScoreRing({ valuePct, tone, passingThreshold, caption, size = 168 }: ScoreRingProps) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = valuePct == null ? 0 : Math.max(0, Math.min(100, valuePct));
  const dash = (clamped / 100) * circumference;
  const center = size / 2;

  // Pass-mark tick: a short radial mark at the threshold angle (top = 0%, clockwise).
  const thresholdAngle =
    passingThreshold != null ? (passingThreshold / 100) * 2 * Math.PI - Math.PI / 2 : null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Score ${valuePct == null ? "not available" : `${Math.round(clamped)} percent`}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-zinc-100"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            className={cn("transition-[stroke-dasharray] duration-700 ease-out", TONE_STYLES[tone].ring)}
          />
          {thresholdAngle != null ? (
            <line
              x1={center + (radius - STROKE / 2) * Math.cos(thresholdAngle)}
              y1={center + (radius - STROKE / 2) * Math.sin(thresholdAngle)}
              x2={center + (radius + STROKE / 2) * Math.cos(thresholdAngle)}
              y2={center + (radius + STROKE / 2) * Math.sin(thresholdAngle)}
              stroke="currentColor"
              strokeWidth={2}
              className="text-zinc-400"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[34px] font-bold leading-none text-zinc-900">
            {valuePct == null ? "—" : `${Math.round(clamped)}%`}
          </span>
          {passingThreshold != null ? (
            <span className="mt-1 text-[11px] font-medium text-zinc-500">Pass ≥ {passingThreshold}%</span>
          ) : (
            <span className="mt-1 text-[11px] font-medium text-zinc-400">No pass mark</span>
          )}
        </div>
      </div>
      {caption ? <p className="mt-2 text-[12px] text-zinc-500">{caption}</p> : null}
    </div>
  );
}
