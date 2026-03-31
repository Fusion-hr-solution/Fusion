"use client";

import { useState } from "react";
import { Search, Users, CalendarClock, BarChart3 } from "lucide-react";
import { Badge, Card, CardContent, Input } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getAdminTrainings, getTrainingAssignments } from "@/services/admin-service";
import type { AdminAssignment } from "@/types/admin";
import { SummaryCard } from "./summary-card";

export function AssignmentsView() {
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: trainingsData } = useApiQuery(
    () => getAdminTrainings({ pageSize: 100 }),
    { enabled: true },
  );

  const { data: assignments, isLoading } = useApiQuery<AdminAssignment[]>(
    () => getTrainingAssignments(selectedTrainingId),
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

  const statusColor = (status: string) => {
    switch (status) {
      case "InProgress":
        return "bg-[hsl(var(--ey-blue-400))]/10 text-[hsl(var(--ey-blue-600))] border-[hsl(var(--ey-blue-400))]/25";
      case "Completed":
        return "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))] border-[hsl(var(--ey-green-500))]/25";
      default:
        return "bg-[hsl(var(--ey-grey-200))] text-[hsl(var(--ey-grey-400))] border-[hsl(var(--ey-grey-300))]/25";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "InProgress": return "In Progress";
      case "Completed": return "Completed";
      default: return "Not Started";
    }
  };

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
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[220px]"
            value={selectedTrainingId}
            onChange={(e) => setSelectedTrainingId(e.target.value)}
          >
            <option value="">Select a training...</option>
            {trainings.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          {selectedTrainingId && (
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter assignments..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              icon={<BarChart3 className="h-4 w-4 text-[hsl(var(--ey-grey-400))]" />}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-[hsl(var(--ey-grey-100))]/50">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Employee ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Progress</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Assigned</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-border/30 transition-colors hover:bg-[hsl(var(--ey-grey-100))]/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {a.employeeId.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {a.assignmentType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>
                          {statusLabel(a.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[hsl(var(--ey-grey-200))]">
                            <div
                              className="h-full rounded-full bg-[hsl(var(--ey-blue-500))] transition-all"
                              style={{ width: `${a.progressPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{a.progressPercentage}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(a.assignedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
