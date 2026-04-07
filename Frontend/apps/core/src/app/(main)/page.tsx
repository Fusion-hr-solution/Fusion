export default function CorePage() {
  return (
    <div className="min-h-screen bg-ch-surface p-8 font-chBody text-ch-on-surface">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-2 font-chHeadline text-4xl font-black text-ch-on-surface">
          Platform Admin Dashboard
        </h1>
        <p className="mb-8 text-ch-secondary">
          Overview of platform health, organizations, and system metrics.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-ch-lg bg-ch-surface-container-low p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-ch-secondary">
              Organizations
            </p>
            <p className="mt-2 font-chHeadline text-3xl font-black text-ch-on-surface">
              —
            </p>
            <p className="mt-1 text-xs text-ch-secondary">
              Waiting for stats endpoint
            </p>
          </div>

          <div className="rounded-ch-lg bg-ch-surface-container-low p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-ch-secondary">
              Active Users
            </p>
            <p className="mt-2 font-chHeadline text-3xl font-black text-ch-on-surface">
              —
            </p>
            <p className="mt-1 text-xs text-ch-secondary">
              Waiting for stats endpoint
            </p>
          </div>

          <div className="rounded-ch-lg bg-ch-surface-container-low p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-ch-secondary">
              Attention Needed
            </p>
            <p className="mt-2 font-chHeadline text-3xl font-black text-ch-error">
              —
            </p>
            <p className="mt-1 text-xs text-ch-secondary">
              Waiting for stats endpoint
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-ch-lg bg-ch-surface-container-low p-6">
          <h2 className="mb-4 font-chHeadline text-xl font-bold">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <a
              href="/organizations"
              className="block rounded-ch-md bg-ch-primary-container px-4 py-3 text-ch-on-primary-container transition-colors hover:bg-ch-primary-container/80"
            >
              View All Organizations →
            </a>
            <a
              href="/organizations/new"
              className="block rounded-ch-md bg-ch-surface-container-high px-4 py-3 text-ch-on-surface transition-colors hover:bg-ch-surface-container-highest"
            >
              Create New Organization →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
