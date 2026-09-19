import { Target, Users, BarChart3 } from "lucide-react";

const VALUES = [
  { icon: Target, label: "Align people and goals" },
  { icon: Users, label: "Drive meaningful impact" },
  { icon: BarChart3, label: "Build a stronger future" },
];

/**
 * A deliberately dark spotlight that frames the whole setup journey — the same in light and dark,
 * like a feature banner. It carries the vision for the cycle (not UI instructions), with a summit
 * motif for "reach higher together."
 */
export function CycleSetupHero() {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c10] text-white shadow-lg">
      {/* warm summit glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 88% 15%, rgba(245,180,60,0.28) 0%, rgba(245,180,60,0.06) 32%, transparent 60%)",
        }}
      />
      <SummitArt />

      {/* People · Progress · Possibility — pinned to the top-right corner */}
      <div className="absolute right-7 top-6 z-10 hidden items-center gap-2.5 lg:flex lg:right-9">
        {["People", "Progress", "Possibility"].map((w, i) => (
          <span key={w} className="flex items-center gap-2.5">
            {i > 0 && <span className="size-1 rounded-full bg-amber-400/60" aria-hidden />}
            <span className="type-label text-zinc-300">{w}</span>
          </span>
        ))}
      </div>

      <div className="relative grid gap-8 p-7 lg:gap-12 lg:p-9">
        <div>
          <p className="type-eyebrow text-amber-400/90">Higher performance, together</p>
          <h2 className="type-display mt-2 max-w-xl text-white">Set the stage for performance</h2>
          <p className="type-body mt-3 max-w-xl text-zinc-300">
            Bring your people, goals, and growth into one cycle. A few clear steps and your
            organization is ready to perform.
          </p>

          <ul className="mt-6 flex flex-row flex-wrap items-center gap-x-7 gap-y-3 sm:flex-nowrap">
            {VALUES.map((v) => (
              <li key={v.label} className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/12 text-amber-400 ring-1 ring-inset ring-amber-400/20">
                  <v.icon className="size-4" aria-hidden />
                </span>
                <span className="whitespace-nowrap text-sm font-medium text-zinc-200">{v.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Abstract amber summit + flag, layered ridgelines. Decorative. */
function SummitArt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 520 240"
      preserveAspectRatio="xMaxYMax meet"
      className="pointer-events-none absolute bottom-0 right-0 hidden h-full w-[56%] opacity-90 md:block"
    >
      <defs>
        <linearGradient id="peak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6c453" />
          <stop offset="55%" stopColor="#c98a2a" />
          <stop offset="100%" stopColor="#3a2a12" />
        </linearGradient>
        <linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2c35" />
          <stop offset="100%" stopColor="#111319" />
        </linearGradient>
      </defs>
      {/* far ridge */}
      <path d="M300 240 L400 96 L470 150 L520 118 L520 240 Z" fill="url(#ridge)" opacity="0.8" />
      {/* main summit */}
      <path d="M330 240 L420 70 L470 128 L500 104 L520 128 L520 240 Z" fill="url(#peak)" opacity="0.92" />
      {/* snow/light facet */}
      <path d="M420 70 L446 100 L420 118 L398 100 Z" fill="#fde6b0" opacity="0.85" />
      {/* flag at the summit */}
      <line x1="420" y1="70" x2="420" y2="40" stroke="#fde6b0" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M420 42 L444 49 L420 57 Z" fill="#f6c453" />
    </svg>
  );
}
