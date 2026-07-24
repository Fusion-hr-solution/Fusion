import { ParticipantAssessmentWorkspacePage } from "@/components/evaluations/evaluation-assessment-pages";
export default async function ParticipantAssessmentRoute({ params }: { params: Promise<{ roundSlug: string; participantId: string }> }) { const { roundSlug, participantId } = await params; return <ParticipantAssessmentWorkspacePage roundId={roundSlug} participantId={participantId} />; }
