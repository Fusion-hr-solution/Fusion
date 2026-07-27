import dynamic from "next/dynamic";

const SelfAssessmentWorkspacePage = dynamic(() =>
  import("@/components/evaluations/assessment/self-assessment-workspace").then((module) => module.SelfAssessmentWorkspacePage),
);

export default async function MyAssessmentRoute({
  params,
}: {
  params: Promise<{ roundSlug: string }>;
}) {
  const { roundSlug } = await params;
  return <SelfAssessmentWorkspacePage roundId={roundSlug} />;
}
