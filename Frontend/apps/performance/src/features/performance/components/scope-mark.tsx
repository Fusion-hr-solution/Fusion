/**
 * The objective mark: concentric target rings with a center dot and crosshair ticks. Shared across
 * the Organization Goals cards and the My Plan direction strip so an objective reads the same wherever
 * it appears. `muted` fills the center with the current text color instead of the accent.
 */
export function ScopeMark({ className, muted }: { className?: string; muted?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden role="img">
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <circle cx="24" cy="24" r="4.5" className={muted ? "fill-current" : "fill-primary"} />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
        <path d="M24 3.5v6" />
        <path d="M24 38.5v6" />
        <path d="M3.5 24h6" />
        <path d="M38.5 24h6" />
      </g>
    </svg>
  );
}
