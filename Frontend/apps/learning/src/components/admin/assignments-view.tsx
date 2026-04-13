"use client";

import { useCallback, useState } from "react";
import { Users, CalendarClock, BarChart3 } from "lucide-react";
import { Card, CardContent, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getAdminTrainings, getTrainingAssignments } from "@/services/admin-service";
import type { AdminAssignment } from "@/types/admin";
import { SearchInput } from "../search-input";
import { SummaryCard } from "./summary-card";
import { AssignmentsTable } from "./assignments-table";

export function AssignmentsView() {
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>("");
  const [search, setSearch] = useState("");

  const fetchTrainings = useCallback(
    () => getAdminTrainings({ pageSize: 100 }),
    [],
  );

  const fetchAssignments = useCallback(
    () => getTrainingAssignments(selectedTrainingId),
    [selectedTrainingId],
  );

  const { data: trainingsData } = useApiQuery(
    fetchTrainings,
    { enabled: true },
  );

  const { data: assignments, isLoading } = useApiQuery<AdminAssignment[]>(
    fetchAssignments,
    { enabled: Boolean(selectedTrainingId) },
  );

  const trainings = trainingsData?.trainings ?? [];

  const filteredAssignments = assignments?.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.trainingTitle.toLowerCase().includes(q) ||
      a.employeeId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Training Assignments
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage training assignments across employees
        </p>
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={selectedTrainingId || "none"} onValueChange={(v) => setSelectedTrainingId(v === "none" ? "" : v)}>
            <SelectTrigger className="h-9 min-w-[220px] text-sm">
              <SelectValue placeholder="Select a training..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select a training...</SelectItem>
              {trainings.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTrainingId && (
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Filter assignments..."
                ariaLabel="Filter assignments"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      {!selectedTrainingId ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Select a training to view its assignments
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading assignments...
        </div>
      ) : !filteredAssignments?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarClock className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            No assignments found for this training
          </p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard
              label="Total"
              value={filteredAssignments.length}
              icon={<Users className="h-4 w-4 text-[hsl(var(--ey-blue-600))]" />}
            />
            <SummaryCard
              label="Not Started"
              value={filteredAssignments.filter((a) => a.status === "NotStarted").length}
              icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
            />
            <SummaryCard
              label="In Progress"
              value={filteredAssignments.filter((a) => a.status === "InProgress").length}
              icon={<BarChart3 className="h-4 w-4 text-[hsl(var(--ey-blue-600))]" />}
            />
            <SummaryCard
              label="Completed"
              value={filteredAssignments.filter((a) => a.status === "Completed").length}
              icon={<BarChart3 className="h-4 w-4 text-[hsl(var(--ey-green-500))]" />}
            />
          </div>

          {/* Table */}
          <Card className="border-border/60 overflow-hidden">
            <AssignmentsTable assignments={filteredAssignments} />
          </Card>
        </>
      )}
    </div>
  );
}
