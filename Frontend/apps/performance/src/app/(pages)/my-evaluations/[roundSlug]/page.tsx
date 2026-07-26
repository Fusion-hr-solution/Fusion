import { SelfAssessmentWorkspacePage } from "@/components/evaluations/assessment/self-assessment-workspace";

export default async function MyAssessmentRoute({
  params,
}: {
  params: Promise<{ roundSlug: string }>;
}) {
  const { roundSlug } = await params;
  return <SelfAssessmentWorkspacePage roundId={roundSlug} />;
}
