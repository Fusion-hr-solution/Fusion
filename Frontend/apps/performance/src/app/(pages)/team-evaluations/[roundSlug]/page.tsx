import { TeamEvaluationRoundPage } from "@/components/evaluations/evaluation-assessment-pages";
export default async function TeamEvaluationRoundRoute({ params }: { params: Promise<{ roundSlug: string }> }) { const { roundSlug } = await params; return <TeamEvaluationRoundPage roundId={roundSlug} />; }
