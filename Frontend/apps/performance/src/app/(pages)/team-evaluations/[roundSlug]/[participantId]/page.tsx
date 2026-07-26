import { ParticipantWorkspacePage } from "@/components/evaluations/assessment/participant-workspace";

export default async function ParticipantAssessmentRoute({
  params,
}: {
  params: Promise<{ roundSlug: string; participantId: string }>;
}) {
  const { roundSlug, participantId } = await params;
  return (
    <ParticipantWorkspacePage roundId={roundSlug} participantId={participantId} />
  );
}
