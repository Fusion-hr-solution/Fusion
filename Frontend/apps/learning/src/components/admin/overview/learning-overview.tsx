"use client";

import { useCallback, useMemo, useState } from "react";
import { useApiQuery } from "@repo/api/react";
import { getSessions } from "@/services/admin-sessions-service";
import { PageHeader } from "../../page-header";
import { OverviewKpiCard } from "./overview-kpi-card";
import { TeamProgressCard } from "./team-progress-card";
import { UpcomingSessionsCard } from "./upcoming-sessions-card";
import { PendingApprovalsCard } from "./pending-approvals-card";
import { CategoryCompletionCard } from "./category-completion-card";
import {
  buildOverviewKpis,
  MOCK_CATEGORY_RATES,
  MOCK_PENDING_APPROVALS,
  MOCK_TEAM_PROGRESS,
  MOCK_UPCOMING_SESSIONS,
  TEAM_TOTAL_LEARNERS,
  type PendingApproval,
  type UpcomingSession,
} from "@/data/admin-overview";

const VIRTUAL_ROOM = /virtual|online|remote|teams|zoom|meet/i;
const MAX_SESSIONS = 4;

export function LearningOverview() {
  // Pending approvals: optimistic local list over (mock) service data.
  const [approvals, setApprovals] = useState<PendingApproval[]>(
    MOCK_PENDING_APPROVALS,
  );
  const removeApproval = useCallback((id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Upcoming sessions: real admin-sessions endpoint, mock fallback while
  // loading or when the backend is unavailable.
  const fetchSessions = useCallback(
    () => getSessions({ fromUtc: new Date().toISOString(), pageSize: 20 }),
    [],
  );
  const { data } = useApiQuery(fetchSessions, { enabled: true });

  const sessions = useMemo<UpcomingSession[]>(() => {
    if (!data) return MOCK_UPCOMING_SESSIONS;
    return data.items
      .filter((s) => s.status !== "Cancelled")
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc))
      .slice(0, MAX_SESSIONS)
      .map((s) => ({
        id: s.id,
        title: s.trainingTitle,
        startUtc: s.startUtc,
        endUtc: s.endUtc,
        room: s.room,
        instructor: s.trainerName ?? "—",
        filled: s.enrolledCount,
        capacity: s.maxCapacity,
        virtual: VIRTUAL_ROOM.test(s.room),
      }));
  }, [data]);

  const kpis = useMemo(
    () => buildOverviewKpis(approvals.length),
    [approvals.length],
  );

  return (
    <>
      <PageHeader
        moduleTitle="HR Administration"
        title="Learning Overview"
        description="Monitor enrollment, completion, and compliance across the organization."
      >
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {kpis.map((kpi, i) => (
            <OverviewKpiCard key={kpi.label} kpi={kpi} index={i} />
          ))}
        </div>
      </PageHeader>

      <section className="px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            <div className="ey-animate-fade-up" style={{ animationDelay: "60ms" }}>
              <TeamProgressCard
                rows={MOCK_TEAM_PROGRESS}
                totalLearners={TEAM_TOTAL_LEARNERS}
              />
            </div>
            <div className="ey-animate-fade-up" style={{ animationDelay: "140ms" }}>
              <UpcomingSessionsCard sessions={sessions} />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="ey-animate-fade-up" style={{ animationDelay: "100ms" }}>
              <PendingApprovalsCard
                approvals={approvals}
                onApprove={removeApproval}
                onDecline={removeApproval}
              />
            </div>
            <div className="ey-animate-fade-up" style={{ animationDelay: "200ms" }}>
              <CategoryCompletionCard rates={MOCK_CATEGORY_RATES} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
