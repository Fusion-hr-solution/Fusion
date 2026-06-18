"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarRange } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ds";
import { EmptyState } from "@repo/ui";
import {
  canManagePerformanceCycles,
  canOperatePerformanceCycles,
  canViewPerformanceCycles,
  useAuth,
} from "@repo/auth";
import type { CreatePerformanceCycleRequest, PopulationRuleInput } from "@repo/api";
import { CycleStatusBadge, DeadlineBadge } from "@/components";
import { CycleDialog } from "@/components/cycle-dialog";
import { PopulationEditor } from "@/components/population-editor";
import {
  useCycleAudit,
  useCycleParticipants,
  useCycleTransition,
  useDeleteCycle,
  usePerformanceCycle,
  useSetCyclePopulation,
  useUpdateCycle,
} from "@/hooks/use-cycles";
import { formatDate, formatDateTime, formatPeriod } from "@/lib/format";

export default function CycleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const canView = canViewPerformanceCycles(user);
  const canManage = canManagePerformanceCycles(user);
  const canOperate = canOperatePerformanceCycles(user);

  const [editOpen, setEditOpen] = useState(false);

  const { data: cycle, isLoading, error } = usePerformanceCycle(id, canView);
  const updateCycle = useUpdateCycle(id);
  const deleteCycle = useDeleteCycle();
  const setPopulation = useSetCyclePopulation(id);
  const transition = useCycleTransition(id);

  const isDraft = cycle?.status === "Draft";
  const { data: participants } = useCycleParticipants(
    id,
    { search: null, page: 1, pageSize: 100 },
    canView && !!cycle && !isDraft
  );
  const { data: audit } = useCycleAudit(id, canView && !!cycle);

  if (!canView) {
    return (
      <div className="container mx-auto px-4 py-12">
        <EmptyState icon={CalendarRange} title="You do not have access to this cycle" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !cycle) {
    return (
      <div className="container mx-auto px-4 py-12">
        <EmptyState
          icon={CalendarRange}
          title="Cycle not found"
          description={error?.message ?? "This cycle may have been removed."}
          action={{ label: "Back to cycles", onClick: () => router.push("/cycles") }}
        />
      </div>
    );
  }

  const handleEdit = (payload: CreatePerformanceCycleRequest) => {
    updateCycle
      .mutateAsync({ version: cycle.version, body: payload })
      .then(() => setEditOpen(false))
      .catch(() => {
        /* error surfaced via updateCycle.error */
      });
  };

  const handleSavePopulation = (includeInactive: boolean, rules: PopulationRuleInput[]) => {
    setPopulation.mutate({
      version: cycle.version,
      body: { populationIncludeInactive: includeInactive, rules },
    });
  };

  const runTransition = (kind: "publish" | "activate" | "close") => {
    transition.mutate({ kind, version: cycle.version });
  };

  const handleDelete = () => {
    deleteCycle
      .mutateAsync({ cycleId: cycle.id, version: cycle.version })
      .then(() => router.push("/cycles"))
      .catch(() => {
        /* error surfaced via deleteCycle.error */
      });
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/cycles">
          <ArrowLeft className="mr-1 h-4 w-4" /> Cycles
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{cycle.name}</h1>
            <CycleStatusBadge status={cycle.status} />
            <DeadlineBadge state={cycle.deadlineState} />
          </div>
          {cycle.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{cycle.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && canManage ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          ) : null}
          {isDraft && canManage ? (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleteCycle.isLoading}
            >
              Delete
            </Button>
          ) : null}
          {isDraft && canOperate ? (
            <Button onClick={() => runTransition("publish")} disabled={transition.isLoading}>
              Publish
            </Button>
          ) : null}
          {cycle.status === "Published" && canOperate ? (
            <Button onClick={() => runTransition("activate")} disabled={transition.isLoading}>
              Activate
            </Button>
          ) : null}
          {(cycle.status === "Published" || cycle.status === "Active") && canOperate ? (
            <Button variant="outline" onClick={() => runTransition("close")} disabled={transition.isLoading}>
              Close
            </Button>
          ) : null}
        </div>
      </div>

      {transition.error || setPopulation.error || deleteCycle.error ? (
        <p className="mb-4 text-sm text-destructive">
          {(transition.error ?? setPopulation.error ?? deleteCycle.error)?.message}
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Type</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{cycle.type}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Period</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {formatPeriod(cycle.periodStart, cycle.periodEnd)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Objective-setting deadline
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {formatDate(cycle.objectiveSettingDeadline)}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {isDraft ? (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Population</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Define who participates. The population is frozen as a snapshot when the cycle is
            published.
          </p>
          {canManage ? (
            <PopulationEditor
              initialRules={cycle.populationRules.map((r) => ({
                ruleType: r.ruleType,
                refId: r.refId,
                includeDescendants: r.includeDescendants,
                label: r.refId,
              }))}
              includeInactive={cycle.populationIncludeInactive}
              saving={setPopulation.isLoading}
              errorMessage={setPopulation.error?.message ?? null}
              onSave={handleSavePopulation}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {cycle.populationRules.length} population rule(s) configured.
            </p>
          )}
        </section>
      ) : (
        <section>
          <h2 className="mb-4 text-lg font-semibold">
            Participants ({participants?.totalCount ?? cycle.participantCount})
          </h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Org unit</TableHead>
                  <TableHead>Manager</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(participants?.items ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email ?? "—"}</TableCell>
                    <TableCell>{p.orgUnitName ?? "—"}</TableCell>
                    <TableCell>{p.managerName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <Separator className="my-8" />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Activity</h2>
        <ul className="space-y-3">
          {(audit ?? []).map((event) => (
            <li key={event.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <span className="font-medium">{event.action}</span>
                {event.details ? (
                  <span className="text-muted-foreground"> — {event.details}</span>
                ) : null}
                <div className="text-xs text-muted-foreground">
                  {event.actorName ? `${event.actorName} · ` : ""}
                  {formatDateTime(event.occurredAt)}
                </div>
              </div>
            </li>
          ))}
          {(audit ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">No activity yet.</li>
          ) : null}
        </ul>
      </section>

      <CycleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        cycle={cycle}
        submitting={updateCycle.isLoading}
        errorMessage={updateCycle.error?.message ?? null}
        onSubmit={handleEdit}
      />
    </div>
  );
}
