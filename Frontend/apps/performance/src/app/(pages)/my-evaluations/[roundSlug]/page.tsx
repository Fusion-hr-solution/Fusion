import { MyAssessmentWorkspacePage } from "@/components/evaluations/evaluation-assessment-pages";
export default async function MyAssessmentRoute({ params }: { params: Promise<{ roundSlug: string }> }) { const { roundSlug } = await params; return <MyAssessmentWorkspacePage roundId={roundSlug} />; }
