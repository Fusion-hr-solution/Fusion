import { ExamBuilder } from "@/components/admin/exam-builder";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ExamBuilderPage({ params }: PageProps) {
  const { id } = await params;
  return <ExamBuilder trainingId={id} />;
}
