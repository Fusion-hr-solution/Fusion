/**
 * The Population step's banner — the same forced-dark spotlight language as the Step 1 hero, kept
 * shorter so the operational workspace below stays front and centre. It carries the intent of the
 * step (assemble the right people), not instructions.
 */
export function PopulationHero() {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c10] text-white shadow-lg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 85% 20%, rgba(245,180,60,0.24) 0%, rgba(245,180,60,0.05) 34%, transparent 62%)",
        }}
      />
      <NetworkArt />

      <div className="relative flex items-center justify-between gap-8 p-6 lg:p-7">
        <div className="max-w-xl">
          <p className="type-eyebrow text-amber-400/90">People · Power · Progress</p>
          <h2 className="type-page-title mt-1.5 text-white">Build your cycle population</h2>
          <p className="type-body mt-2 max-w-lg text-zinc-300">
            Choose who takes part. Fusion validates eligibility, resolves reviewers, and flags
            anything that needs your attention.
          </p>
        </div>
        <p className="hidden shrink-0 border-l border-white/10 pl-6 type-body-secondary text-zinc-300 lg:block">
          The right people.
          <br />
          Greater conversations.
          <br />
          <span className="text-amber-400/90">A stronger tomorrow.</span>
        </p>
      </div>
    </section>
  );
}

/** Abstract amber people-network motif. Decorative. */
function NetworkArt() {
  const nodes = [
    { x: 250, y: 60, r: 7 },
    { x: 320, y: 110, r: 6 },
    { x: 190, y: 120, r: 6 },
    { x: 285, y: 165, r: 14, hub: true },
    { x: 370, y: 70, r: 5 },
    { x: 150, y: 60, r: 5 },
    { x: 355, y: 150, r: 6 },
    { x: 215, y: 195, r: 5 },
  ];
  const hub = nodes[3]!;
  return (
    <svg
      aria-hidden
      viewBox="0 0 420 220"
      preserveAspectRatio="xMaxYMid meet"
      className="pointer-events-none absolute bottom-0 right-[27%] hidden h-full w-[45%] opacity-90 md:block"
    >
      {nodes.map((node, index) => (
        <line
          key={`l-${index}`}
          x1={hub.x}
          y1={hub.y}
          x2={node.x}
          y2={node.y}
          stroke="rgba(245,197,83,0.28)"
          strokeWidth="1"
        />
      ))}
      {nodes.map((node, index) => (
        <circle
          key={`n-${index}`}
          cx={node.x}
          cy={node.y}
          r={node.r}
          fill={node.hub ? "#f6c453" : "rgba(148,163,184,0.35)"}
          stroke={node.hub ? "rgba(253,230,176,0.9)" : "rgba(245,197,83,0.4)"}
          strokeWidth={node.hub ? 2 : 1}
        />
      ))}
    </svg>
  );
}
