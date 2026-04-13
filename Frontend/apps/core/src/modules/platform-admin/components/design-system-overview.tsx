const SWATCHES: Array<{ name: string; className: string }> = [
  { name: "Primary", className: "bg-ch-primary" },
  { name: "Primary container", className: "bg-ch-primary-container" },
  { name: "On primary container", className: "bg-ch-on-primary-container" },
  { name: "Surface", className: "bg-ch-surface" },
  { name: "Surface container low", className: "bg-ch-surface-container-low" },
  { name: "Tertiary", className: "bg-ch-tertiary" },
  { name: "Error", className: "bg-ch-error" },
];

export function DesignSystemOverview() {
  return (
    <div className="bg-ch-surface font-chBody text-ch-on-surface">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12">
          <p className="mb-2 font-chHeadline text-[10px] font-bold uppercase tracking-widest text-ch-secondary">
            Core HR · Design system
          </p>
          <h1 className="font-chHeadline text-4xl font-extrabold tracking-tight">
            Executive Console tokens
          </h1>
          <p className="mt-3 max-w-2xl text-ch-secondary">
            Material Design–aligned palette and typography for the Executive
            Console experience. Token names map to Tailwind as{" "}
            <code className="text-ch-tertiary">ch-*</code> utilities.
          </p>
        </header>

        <section className="mb-14">
          <h2 className="mb-6 font-chHeadline text-sm font-bold uppercase tracking-widest">
            Color tokens
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {SWATCHES.map((s) => (
              <div
                key={s.name}
                className="overflow-hidden rounded-ch-md border border-ch-outline-variant/20"
              >
                <div className={["h-20", s.className].join(" ")} />
                <div className="bg-ch-surface-container-lowest p-3 text-[11px] font-medium">
                  {s.name}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-6 font-chHeadline text-sm font-bold uppercase tracking-widest">
            Typography
          </h2>
          <div className="space-y-4 rounded-ch-lg bg-ch-surface-container-low p-8">
            <p className="font-chHeadline text-4xl font-extrabold tracking-tight">
              Display — Manrope extrabold
            </p>
            <p className="font-chBody text-base text-ch-secondary">
              Body — Inter for dense operational UI and tables.
            </p>
            <p className="font-chBody text-[10px] font-bold uppercase tracking-[0.2em] text-ch-secondary">
              Label — uppercase metadata
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
