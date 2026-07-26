import { TeamQueuePage } from "@/components/evaluations/assessment/team-queue-page";

export default async function TeamEvaluationRoundRoute({
  params,
}: {
  params: Promise<{ roundSlug: string }>;
}) {
  const { roundSlug } = await params;
  return <TeamQueuePage roundId={roundSlug} />;
}
