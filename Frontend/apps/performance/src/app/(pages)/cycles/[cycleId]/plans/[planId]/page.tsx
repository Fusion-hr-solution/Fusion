import { PlanRecordPage } from "@/features/performance/components/plan/plan-record-page";

/** The canonical plan address: one plan resource for its owner, its reviewer and administrators. */
export default async function PlanRecordRoute({ params }: { params: Promise<{ cycleId: string; planId: string }> }) {
  const { cycleId, planId } = await params;
  return <PlanRecordPage cycleId={cycleId} planId={planId} />;
}
