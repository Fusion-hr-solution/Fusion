"use client";

import { useMemo } from "react";
import { CalendarClock, ClipboardPenLine, Target, UsersRound } from "lucide-react";
import { createPlatformApiClient, performancePaths, performanceQueryKeys } from "@repo/api";
import type { EvaluationWorkEntryDto } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { canAccessMyEvaluations, canAccessTeamEvaluations, useAuth } from "@repo/auth";
import { PageContainer, PageEmpty, PageError, PageHeader, PageListSkeleton, PagePermissionNotice, StatusBadge } from "@repo/ds/shell";
import { Card, CardContent, Progress, Separator } from "@repo/ds";

export function EvaluationWorkEntryPage({ mode }: { mode: "mine" | "team" }) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const allowed = mode === "mine" ? canAccessMyEvaluations(user) : canAccessTeamEvaluations(user);
  const query = useApiQuery<EvaluationWorkEntryDto[]>(
    mode === "mine" ? performanceQueryKeys.myEvaluationAssignments() : performanceQueryKeys.teamEvaluationAssignments(),
    signal => api.get(mode === "mine" ? performancePaths.myEvaluationAssignments() : performancePaths.teamEvaluationAssignments(), { signal }),
    { enabled: allowed },
  );
  const title = mode === "mine" ? "My evaluations" : "Team evaluations";
  if (authLoading) return <PageContainer><PageListSkeleton /></PageContainer>;
  if (!allowed) return <PageContainer><PagePermissionNotice title={`${title} unavailable`} description="This workspace opens only when your role includes the matching evaluation permission." /></PageContainer>;
  return <PageContainer><PageHeader eyebrow={<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned work</span>} title={title} description={mode === "mine" ? "Your self-assessments, with the frozen objectives and deadlines needed to begin." : "Manager assessments assigned through the reviewer relationship frozen at launch."} />
    {query.isLoading ? <PageListSkeleton /> : query.error ? <PageError title="Assignments could not be loaded" description="No evaluation data was changed." onRetry={query.refetch} /> : !query.data?.length ? <PageEmpty icon={mode === "mine" ? ClipboardPenLine : UsersRound} title="No evaluation work assigned" description={mode === "mine" ? "This door stays quiet until HR launches a round with a self-assessment for you." : "No launched manager assessments currently match your frozen reviewer scope."} /> : <div className="flex flex-col gap-4">{query.data.map(entry => <WorkEntryCard key={entry.assignment.id} entry={entry} mode={mode} />)}</div>}
  </PageContainer>;
}

function WorkEntryCard({ entry, mode }: { entry: EvaluationWorkEntryDto; mode: "mine" | "team" }) {
  const round = entry.round.round;
  const deadline = entry.assignment.kind === "SelfAssessment" ? round.selfAssessmentDeadline : round.managerAssessmentDeadline;
  const objectiveWeight = entry.objectiveBaseline.reduce((sum, item) => sum + (item.weight ?? 0), 0);
  return <Card className="overflow-hidden"><CardContent className="p-0"><div className="grid lg:grid-cols-[minmax(0,1fr)_16rem]"><div className="p-5"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={round.operationalState === "Overdue" ? "danger" : "info"} dot>{round.operationalState.replace(/([A-Z])/g, " $1").trim()}</StatusBadge><span className="text-xs text-muted-foreground">{entry.assignment.kind === "SelfAssessment" ? "Self-assessment" : "Manager assessment"}</span></div><h2 className="mt-3 text-lg font-semibold">{round.name}</h2><p className="mt-1 text-sm text-muted-foreground">{mode === "team" ? `Evaluate ${entry.assignment.participantName}` : entry.round.templateInstructions ?? "Review your frozen objectives and prepare your evidence."}</p><Separator className="my-4" /><div className="grid gap-4 sm:grid-cols-2"><div className="flex items-start gap-3"><CalendarClock className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Due date</p><p className="text-sm font-medium">{formatDate(deadline)}</p></div></div><div className="flex items-start gap-3"><Target className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Frozen objectives</p><p className="text-sm font-medium">{entry.objectiveBaseline.length ? `${entry.objectiveBaseline.length} objectives · ${objectiveWeight}% allocated` : "No objective section"}</p></div></div></div></div><div className="border-t border-border bg-muted/35 p-5 lg:border-l lg:border-t-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context ready</p><p className="mt-2 text-3xl font-semibold tabular-nums">{entry.objectiveBaseline.length}</p><p className="text-sm text-muted-foreground">objective{entry.objectiveBaseline.length === 1 ? "" : "s"} preserved at launch</p><Progress value={entry.objectiveBaseline.length ? 100 : 0} className="mt-4" /><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Responses and scoring open in the next evaluation step. This foundation keeps the assignment and historical context truthful.</p></div></div></CardContent></Card>;
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(value)) : "Not set"; }
