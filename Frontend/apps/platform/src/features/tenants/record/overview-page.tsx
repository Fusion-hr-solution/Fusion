"use client";

import { useState } from "react";
import { CircleCheck, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";
import { failureMessage } from "../api";
import { useTenantLifecycle } from "../queries";
import { AdminHandoff } from "./admin-handoff";
import { TenantProducts } from "./products-summary";
import { RecentActivity } from "./recent-activity";
import { TenantProfile } from "./tenant-profile";
import { useTenantRecord } from "./record-shell";

/**
 * The tenant's Overview destination.
 *
 * It opens with the lifecycle banner — the first thing the operator should read
 * is whether the tenant is usable at all — then a two-column summary: the left
 * column carries the administrative narrative, the right the tenant's standing
 * facts. Both build out from here.
 */
export function TenantOverviewDestination() {
  return (
    <div className="space-y-5">
      <LifecycleBanner />

      {/*
        The two columns are stretched to the taller one's height, and the last
        card in each grows to fill the slack, so both columns end on the same
        line whichever has more content. Cards render a <section> root, so the
        last-child selector reaches it without each card knowing it is last.
      */}
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 [&>section:last-child]:flex-1">
          <AdminHandoff />
          <TenantProducts />
        </div>
        <div className="flex flex-col gap-3 [&>section:last-child]:flex-1">
          <TenantProfile />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}

/**
 * Tenant lifecycle, stated plainly and always present.
 *
 * It carries exactly two states — active or deactivated — and nothing about the
 * administrator invitation or onboarding, which are separate concerns with their
 * own homes. A deactivated tenant is a calm, reversible state rather than an
 * error, so it reads in a muted tone and offers the one action that resolves it.
 */
function LifecycleBanner() {
  const { tenant } = useTenantRecord();
  const reactivate = useTenantLifecycle("reactivate");
  // Stay busy across the whole task: the mutation invalidates the record, and
  // the banner should not offer the action again until the refetched result
  // has settled and the banner can flip to active. `mutateAsync` resolves only
  // after that awaited invalidation.
  const [reactivating, setReactivating] = useState(false);
  const busy = reactivating || reactivate.isLoading;

  if (tenant.isActive) {
    return (
      <section
        aria-label="Tenant lifecycle"
        className="flex items-center gap-4 rounded-2xl border border-success/25 bg-gradient-to-r from-success-subtle to-transparent px-5 py-4 mb-3"
      >
        <BannerIcon tone="success">
          <CircleCheck className="size-5" aria-hidden="true" />
        </BannerIcon>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            Tenant is active
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            This tenant is active and available to authorized users.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Tenant lifecycle"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-destructive/25 bg-gradient-to-r from-destructive/10 to-transparent px-5 py-4"
    >
      <BannerIcon tone="destructive">
        <PowerOff className="size-5" aria-hidden="true" />
      </BannerIcon>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-foreground">
          Tenant is deactivated
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Customer users cannot currently access Fusion. Existing tenant data is
          retained.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setReactivating(true);
          try {
            await reactivate.mutateAsync(tenant.tenantId);
            toast.success("Tenant reactivated", {
              description: `${tenant.name} is active again and available to its users.`,
            });
          } catch (error) {
            toast.error("Couldn't reactivate the tenant", {
              description: failureMessage(error) ?? undefined,
            });
          } finally {
            setReactivating(false);
          }
        }}
        className="shrink-0"
      >
        {busy ? "Reactivating…" : "Reactivate tenant"}
      </Button>
    </section>
  );
}

function BannerIcon({
  tone,
  children,
}: {
  tone: "success" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        tone === "success"
          ? "bg-success/15 text-success"
          : "bg-destructive/15 text-destructive"
      )}
    >
      {children}
    </span>
  );
}
