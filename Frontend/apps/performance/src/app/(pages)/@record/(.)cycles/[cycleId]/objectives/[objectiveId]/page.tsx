import { ObjectiveRecordHost } from "@/features/performance/components/objective-record/objective-record-host";

export default async function ObjectiveSheet({ params }: { params: Promise<{ cycleId: string; objectiveId: string }> }) {
  return <ObjectiveRecordHost reference={await params} />;
}
