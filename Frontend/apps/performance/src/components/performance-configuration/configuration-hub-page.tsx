"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardPenLine, Ruler, ScrollText, SlidersHorizontal } from "lucide-react";
import { createPlatformApiClient, performancePaths, performanceQueryKeys } from "@repo/api";
import type {
  EvaluationRatingScaleDto,
  EvaluationTemplateDto,
  ObjectivePlanningConfigurationSummaryDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import {
  canManageEvaluations,
  canViewObjectivePlanningConfiguration,
  useAuth,
} from "@repo/auth";
import { PageContainer, PageHeader, PageLoading, PagePermissionNotice, StatusBadge } from "@repo/ds/shell";
import { Badge, Button } from "@repo/ds";
import { parseWeights } from "@/components/performance-configuration/configuration-logic";

/**
 * The tenant's configuration posture in one glance: what the active evaluation scale and template
 * are, and what the objective-planning rules resolve to — each with a deliberate door into its
 * focused editor. This is the surface HR sees most; the editors are entered on demand.
 */
export function ConfigurationHubPage() {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canEvaluation = canManageEvaluations(user);
  const canPlanning = canViewObjectivePlanningConfiguration(user);

  const scales = useApiQuery<EvaluationRatingScaleDto[]>(
    performanceQueryKeys.evaluationScales(),
    (signal) => api.get(performancePaths.evaluationScales(), { signal }),
    { enabled: canEvaluation },
  );
  const templates = useApiQuery<EvaluationTemplateDto[]>(
    performanceQueryKeys.evaluationTemplates(),
    (signal) => api.get(performancePaths.evaluationTemplates(), { signal }),
    { enabled: canEvaluation },
  );
  const planning = useApiQuery<ObjectivePlanningConfigurationSummaryDto>(
    performanceQueryKeys.objectivePlanningConfiguration(),
    (signal) => api.get(performancePaths.objectivePlanningConfiguration(), { signal }),
    { enabled: canPlanning },
  );

  if (authLoading) {
    return <PageContainer><PageLoading label="Loading configuration" /></PageContainer>;
  }
  if (!canEvaluation && !canPlanning) {
    return <PageContainer><PagePermissionNotice title="Configuration unavailable" description="Tenant configuration permission is required." /></PageContainer>;
  }

  return (
    <PageContainer width="wide">
      <PageHeader title="Configuration" />
      <div className="flex flex-col gap-10">
        {canEvaluation ? (
          <PostureSection
            icon={SlidersHorizontal}
            title="Evaluation"
            href="/configuration/evaluation"
            loading={scales.isLoading || templates.isLoading}
          >
            {scales.error || templates.error ? (
              <PostureError onRetry={() => { void scales.refetch(); void templates.refetch(); }} />
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                <ScalePosture scale={activeItem(scales.data)} />
                <TemplatePosture template={activeItem(templates.data)} />
              </div>
            )}
          </PostureSection>
        ) : null}

        {canPlanning ? (
          <PostureSection
            icon={ScrollText}
            title="Objective planning"
            href="/configuration/planning"
            loading={planning.isLoading}
          >
            {planning.error ? (
              <PostureError onRetry={() => { void planning.refetch(); }} />
            ) : (
              <PlanningPosture summary={planning.data} />
            )}
          </PostureSection>
        ) : null}
      </div>
    </PageContainer>
  );
}

function PostureSection({
  icon: Icon, title, href, loading, children,
}: {
  icon: typeof SlidersHorizontal;
  title: string;
  href: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={href}>Adjust<ArrowRight data-icon="inline-end" /></Link>
        </Button>
      </div>
      {loading ? <PageLoading /> : children}
    </section>
  );
}

function PostureBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function PostureEmpty({ icon: Icon, message }: { icon: typeof Ruler; message: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function PostureError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>Couldn&apos;t load the current setup. No values were changed.</span>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

function ScalePosture({ scale }: { scale: EvaluationRatingScaleDto | null }) {
  return (
    <PostureBlock label="Rating scale">
      {scale ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{scale.name}</span>
            <LifecycleBadge status={scale.status} isInUse={scale.isInUse} />
          </div>
          <MiniSpine levels={scale.levels.length} />
          <p className="text-sm text-muted-foreground">{scale.levels.length} levels · {scale.levels.map((l) => l.label).join(" → ")}</p>
        </>
      ) : (
        <PostureEmpty icon={Ruler} message="No active scale — set up the professional default." />
      )}
    </PostureBlock>
  );
}

function TemplatePosture({ template }: { template: EvaluationTemplateDto | null }) {
  const questionCount = template?.sections.reduce((sum, s) => sum + s.questions.length, 0) ?? 0;
  return (
    <PostureBlock label="Template">
      {template ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{template.name}</span>
            <LifecycleBadge status={template.status} isInUse={template.isInUse} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {template.sections.map((s) => (
              <Badge key={s.id} variant="outline">{s.title}</Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{template.sections.length} sections · {questionCount} questions</p>
        </>
      ) : (
        <PostureEmpty icon={ClipboardPenLine} message="No active template — start from the starter annual template." />
      )}
    </PostureBlock>
  );
}

function PlanningPosture({ summary }: { summary: ObjectivePlanningConfigurationSummaryDto | undefined }) {
  if (!summary?.isConfigured || !summary.configuration) {
    return <PostureEmpty icon={ScrollText} message="Not yet initialized from the platform starting configuration." />;
  }
  const config = summary.configuration;
  const weights = parseWeights(config.allowedWeights);
  const methods = [config.quantitativeEnabled ? "Quantitative" : null, config.qualitativeEnabled ? "Qualitative" : null].filter(Boolean) as string[];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <PostureStat label="Objectives per plan" value={<span className="text-2xl font-semibold tabular-nums">{config.maxObjectiveCount}</span>} />
      <PostureStat label="Importance weights" value={
        weights.length ? (
          <div className="flex flex-wrap gap-1.5">{weights.map((w) => <Badge key={w} variant="outline">{w}%</Badge>)}</div>
        ) : <span className="text-sm text-muted-foreground">None</span>
      } />
      <PostureStat label="Measurement" value={
        methods.length ? (
          <div className="flex flex-wrap gap-1.5">{methods.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}</div>
        ) : <span className="text-sm text-muted-foreground">None</span>
      } />
    </div>
  );
}

function PostureStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {value}
    </div>
  );
}

function MiniSpine({ levels }: { levels: number }) {
  return (
    <div className="flex items-stretch gap-1" aria-hidden>
      {Array.from({ length: levels }).map((_, i) => (
        <div key={i} className="h-1.5 flex-1 rounded-full bg-primary" style={{ opacity: levels > 1 ? 0.35 + (0.65 * i) / (levels - 1) : 1 }} />
      ))}
    </div>
  );
}

function LifecycleBadge({ status, isInUse }: { status: string; isInUse: boolean }) {
  if (isInUse) return <StatusBadge tone="info">In use</StatusBadge>;
  const tone = status === "Active" ? "success" : status === "Archived" ? "muted" : "warning";
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}

function activeItem<T extends { status: string }>(items: T[] | undefined): T | null {
  if (!items?.length) return null;
  return items.find((x) => x.status === "Active") ?? items[0] ?? null;
}
