"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { PageContainer, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { useReviewRoundMutations } from "@/features/performance/api/use-reviews";
import { useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { roundSetupHref, withCycle } from "@/lib/performance-routes";

export default function NewReviewRoundPage() {
  const router = useRouter();
  const context = useWorkspaceContext();
  const isAdmin = context.data?.capabilities.administers ?? false;
  const cycle = context.data?.selected ?? null;
  const cycleId = cycle?.id ?? "";
  const { create } = useReviewRoundMutations(cycleId);
  const [name, setName] = useState("Mid-year review");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [pending, setPending] = useState(false);
  const formStart = periodStart || cycle?.startDate || "";
  const formEnd = periodEnd || cycle?.endDate || "";

  if (context.isLoading) return <PageSkeleton rows={5} width="wide" label="Loading Cycle" />;
  if (!isAdmin) return <PagePermissionNotice title="Administration only" description="Only Performance administrators can create review rounds." />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Cycle" />;
  if (!cycle) return <PagePermissionNotice title="No Active Cycle" description="A review round belongs to an Active Cycle. Select one before starting a round." />;
  if (cycle.state !== "Active") return <PagePermissionNotice title="Cycle is not active" description="Review rounds can only be created inside an Active Cycle." />;
  const activeCycle = cycle;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const created = await create.mutateAsync({ name: name.trim(), periodStart: formStart, periodEnd: formEnd });
      router.push(withCycle(roundSetupHref(created.id, "details"), activeCycle.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create this review round.");
      setPending(false);
    }
  }

  return (
    <PageContainer width="wide">
      <PerformancePageHeading title="Start a review round" eyebrow={cycle.name} back={{ href: withCycle("/reviews", cycle.id), label: "Reviews" }} />
      <form onSubmit={submit} className="max-w-3xl">
        <p className="max-w-2xl text-sm text-muted-foreground">A round opens a review period for this Cycle. Its subject list begins with the confirmed Cycle roster.</p>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="round-name">Round name</Label>
            <Input id="round-name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="period-start">Review period starts</Label>
            <Input id="period-start" type="date" required min={cycle.startDate} max={cycle.endDate} value={formStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="period-end">Review period ends</Label>
            <Input id="period-end" type="date" required min={formStart || cycle.startDate} max={cycle.endDate} value={formEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </div>
        </div>
        <div className="mt-7 flex flex-wrap justify-end gap-2 border-t border-border pt-5">
          <Button type="button" variant="ghost" onClick={() => router.push(withCycle("/reviews", cycle.id))}>Cancel</Button>
          <Button type="submit" disabled={pending || !name.trim() || !formStart || !formEnd || formEnd < formStart}>{pending ? "Creating…" : "Create round"}</Button>
        </div>
      </form>
    </PageContainer>
  );
}
