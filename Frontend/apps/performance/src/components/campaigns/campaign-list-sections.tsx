import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, Lock, Users } from "lucide-react";
import type { PerformanceCycleSummaryDto, PerformanceCycleType } from "@repo/api";
import { PageContainer, StatusBadge } from "@repo/ds/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { campaignStatusLabel, campaignStatusTone } from "./campaign-terminology";

const CAMPAIGN_TYPE_LABEL: Record<PerformanceCycleType, string> = {
  Annual: "Annual planning",
  MidYear: "Mid-year planning",
  Specific: "Specific period",
};

export function CampaignGrid({ campaigns }: { campaigns: readonly PerformanceCycleSummaryDto[] }) {
  const groups = useMemo(() => {
    const setup: PerformanceCycleSummaryDto[] = [];
    const active: PerformanceCycleSummaryDto[] = [];
    for (const campaign of campaigns) (campaign.status === "Draft" ? setup : active).push(campaign);
    const byRecency = (a: PerformanceCycleSummaryDto, b: PerformanceCycleSummaryDto) =>
      (b.referenceYear ?? 0) - (a.referenceYear ?? 0) || b.createdAt.localeCompare(a.createdAt);
    for (const items of [setup, active]) items.sort(byRecency);
    return [
      { key: "setup", label: "In setup", items: setup },
      { key: "active", label: "Active", items: active },
    ].filter((bucket) => bucket.items.length > 0);
  }, [campaigns]);
  const showHeaders = groups.length > 1;
  return <div className="space-y-8">{groups.map((group) => <section key={group.key} className="space-y-3">
    {showHeaders ? <div className="flex items-baseline gap-2"><h2 className="text-sm font-semibold text-foreground">{group.label}</h2><span className="text-xs font-medium tabular-nums text-muted-foreground">{group.items.length}</span></div> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{group.items.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}</div>
  </section>)}</div>;
}

function CampaignCard({ campaign }: { campaign: PerformanceCycleSummaryDto }) {
  const locked = !!campaign.planningLockedAt;
  const isDraft = campaign.status === "Draft";
  const year = campaign.referenceYear ?? new Date(campaign.periodStart).getUTCFullYear();
  const urgent = !locked && !isDraft ? campaign.deadlineState : "None";
  return <Link href={`/campaigns/${campaign.slug}`} className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <div className="flex items-center justify-between gap-2">{locked ? <StatusBadge tone="neutral"><Lock className="size-3" /> Planning locked</StatusBadge> : <StatusBadge tone={campaignStatusTone(campaign.status)} dot>{campaignStatusLabel(campaign.status)}</StatusBadge>}<span className="text-sm font-medium tabular-nums text-muted-foreground">{year}</span></div>
    <h3 className="mt-3 text-balance font-heading text-xl font-semibold leading-snug tracking-tight text-foreground">{campaign.name}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{CAMPAIGN_TYPE_LABEL[campaign.type]}</p>
    <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">{isDraft ? <span className="text-sm font-medium text-primary">Continue setup</span> : <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /><span className="font-semibold tabular-nums text-foreground">{campaign.participantCount}</span> participants</span>{urgent === "Overdue" ? <StatusBadge tone="danger">Overdue</StatusBadge> : urgent === "DueSoon" ? <StatusBadge tone="warning">Due soon</StatusBadge> : null}</span>}<ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
  </Link>;
}

export function CampaignListLoading() { return <PageContainer><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-80 max-w-full" /></div><Skeleton className="h-9 w-32 rounded-md" /></div><CampaignGridSkeleton /></PageContainer>; }

export function CampaignGridSkeleton() { return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy aria-label="Loading campaigns">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-4 w-10" /></div><Skeleton className="mt-3 h-6 w-3/4" /><Skeleton className="mt-2 h-4 w-32" /><div className="mt-4 flex items-center justify-between border-t border-border pt-4"><Skeleton className="h-4 w-28" /><Skeleton className="size-5 rounded" /></div></div>)}</div>; }
