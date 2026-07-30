import {
  Blocks,
  Building2,
  Fingerprint,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@repo/ds/components/ui/badge";
import { PageContainer, PageHeader } from "@repo/ds/shell";

export default function PlatformOverviewPage() {
  return (
    <PageContainer width="wide" className="py-8 sm:py-10">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-primary"
            />
            Fusion control plane
          </span>
        }
        title="Platform overview"
        description={
          <span className="text-foreground">
            The administrative boundary for customer-tenant identity,
            lifecycle, and module access.
          </span>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]">
        <section
          aria-labelledby="platform-scope-title"
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="border-b border-border px-6 py-7 sm:px-8 sm:py-8">
            <Badge className="mb-5 w-fit">Current workspace</Badge>
            <h2
              id="platform-scope-title"
              className="text-2xl font-semibold tracking-tight text-foreground"
            >
              Platform Foundation
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
              This workspace owns the platform-level boundary around every
              customer environment. It stays separate from the HR work carried
              out inside those environments.
            </p>
          </div>

          <dl className="grid sm:grid-cols-3">
            {[
              {
                title: "Tenant identity",
                description: "The durable boundary for each customer.",
                icon: Fingerprint,
              },
              {
                title: "Tenant lifecycle",
                description: "Platform-owned status and lifecycle control.",
                icon: RefreshCw,
              },
              {
                title: "Module access",
                description: "The source of customer module entitlements.",
                icon: Blocks,
              },
            ].map(({ title, description, icon: Icon }, index) => (
              <div
                key={title}
                className={[
                  "flex gap-4 px-6 py-6 sm:flex-col sm:px-7",
                  index > 0 ? "border-t border-border sm:border-l sm:border-t-0" : "",
                ].join(" ")}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <dt className="font-medium text-foreground">{title}</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                    {description}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <aside
          aria-labelledby="access-boundary-title"
          className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Responsibility map
              </p>
              <h2
                id="access-boundary-title"
                className="mt-1 text-lg font-semibold text-foreground"
              >
                Access boundary
              </h2>
            </div>
          </div>

          <dl className="mt-6 divide-y divide-border border-y border-border">
            <div className="py-4">
              <dt className="text-sm font-medium text-foreground">
                Platform administration
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                Your current administrative scope
              </dd>
            </div>
            <div className="py-4">
              <dt className="text-sm font-medium text-foreground">
                Identity and Access
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                Accounts, invitations, and memberships
              </dd>
            </div>
            <div className="py-4">
              <dt className="text-sm font-medium text-foreground">
                Customer workspaces
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                Separate authorization is always required
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex gap-3 rounded-xl bg-muted/70 p-4">
            <Building2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Platform Administrator access does not open customer Core HR or
              Performance workspaces.
            </p>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
