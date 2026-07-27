import dynamic from "next/dynamic";

const ParticipantWorkspacePage = dynamic(() =>
  import("@/components/evaluations/assessment/participant-workspace").then((module) => module.ParticipantWorkspacePage),
);

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
