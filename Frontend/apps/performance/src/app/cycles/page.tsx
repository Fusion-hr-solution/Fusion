"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, Plus } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  canViewPerformanceCycles,
  useAuth,
} from "@repo/auth";
import type { CreatePerformanceCycleRequest } from "@repo/api";
import { CycleStatusBadge, DeadlineBadge } from "@/components";
import { CycleDialog } from "@/components/cycle-dialog";
import { useCreateCycle, usePerformanceCycles } from "@/hooks/use-cycles";
import { formatPeriod } from "@/lib/format";

const STATUS_FILTERS = ["All", "Draft", "Published", "Active", "Closed"] as const;

export default function CyclesPage() {
  const { user } = useAuth();
  const canView = canViewPerformanceCycles(user);
  const canManage = canManagePerformanceCycles(user);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [createOpen, setCreateOpen] = useState(false);

  const params = useMemo(
    () => ({
      search: search || null,
      status: status === "All" ? null : status,
      type: null,
      page: 1,
      pageSize: 50,
    }),
    [search, status]
  );

  const { data, isLoading, error } = usePerformanceCycles(params, canView);
  const createCycle = useCreateCycle();

  if (!canView) {
    return (
      <div className="container mx-auto px-4 py-12">
        <EmptyState
          icon={CalendarRange}
          title="You do not have access to performance cycles"
          description="Ask an administrator for performance cycle access."
        />
      </div>
    );
  }

  const cycles = data?.items ?? [];

  const handleCreate = (payload: CreatePerformanceCycleRequest) => {
    createCycle
      .mutateAsync(payload)
      .then(() => setCreateOpen(false))
      .catch(() => {
        /* error surfaced via createCycle.error */
      });
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance cycles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and run time-bounded review cycles for your organization.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New cycle
          </Button>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search cycles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <EmptyState
          icon={CalendarRange}
          title="Could not load cycles"
          description={error.message}
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : cycles.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No cycles yet"
          description={
            canManage
              ? "Create your first performance cycle to get started."
              : "No performance cycles are available."
          }
          action={
            canManage ? { label: "New cycle", onClick: () => setCreateOpen(true) } : undefined
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Participants</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map((cycle) => (
                <TableRow key={cycle.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/cycles/${cycle.id}`} className="hover:underline">
                      {cycle.name}
                    </Link>
                  </TableCell>
                  <TableCell>{cycle.type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatPeriod(cycle.periodStart, cycle.periodEnd)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CycleStatusBadge status={cycle.status} />
                      <DeadlineBadge state={cycle.deadlineState} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{cycle.participantCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CycleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={createCycle.isLoading}
        errorMessage={createCycle.error?.message ?? null}
        onSubmit={handleCreate}
      />
    </div>
  );
}
